package expo.modules.carbluetooth

// ─────────────────────────────────────────────────────────────────────────────
// CarBluetoothModule  —  Native Android car-Bluetooth detection.
//
// WHAT THIS REPLACES
// On Android, CheckDrive otherwise relies on a third-party automation app
// (AutomateIt/Tasker) to fire a checkdrive:// deep link when the car's
// Bluetooth connects. This module does that job natively so the user never
// installs a second app — they just pick their car once via the system
// CompanionDeviceManager (CDM) picker.
//
// TWO PIECES
//   1. associate()  — opens the CDM "choose a device" system dialog. CDM is the
//      official way to bind to a companion device; the association also grants
//      background-launch / run-in-background exemptions and (unlike a raw BT
//      scan) needs no location permission. We persist the chosen MAC address.
//   2. CarAclReceiver — a manifest-declared BroadcastReceiver for
//      ACTION_ACL_CONNECTED / ACTION_ACL_DISCONNECTED. These fire for Classic
//      Bluetooth (car audio/HFP), wake the app process, and we match them
//      against the saved address. This is the actual connect/disconnect trigger.
//
// We intentionally do NOT use CompanionDeviceService.onDeviceAppeared here: its
// presence detection is BLE-oriented (unreliable for a Classic-only car stereo)
// and its abstract surface changed across API 31→36 in a way that's risky to
// compile against blindly. The ACL receiver covers the same need more robustly.
//
// ALIVE vs DEAD APP
// CarBluetoothModule.dispatch() is the single funnel for both detection paths.
//   • If the JS runtime is alive (module instance != null) it emits a JS event,
//     and useCarDetection runs the normal simulateVehicleConnect/Disconnect flow
//     (notification by default, or open-on-connect per Settings).
//   • If the app process is dead, JS can't run, so we post a notification
//     natively whose tap fires the checkdrive:// deep link — landing in the same
//     JS handler once the app opens.
// A short debounce drops duplicate/burst broadcasts (BT can emit several).
// ─────────────────────────────────────────────────────────────────────────────

import android.app.Activity
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.bluetooth.BluetoothDevice
import android.companion.AssociationInfo
import android.companion.AssociationRequest
import android.companion.BluetoothDeviceFilter
import android.companion.CompanionDeviceManager
import android.content.Context
import android.content.Intent
import android.content.IntentSender
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.concurrent.Executor

// SharedPreferences-backed store for the chosen car. The ACL receiver runs in a
// freshly-started process (no JS, no module instance) so it must read the target
// address from disk, not from memory.
internal object CarPrefs {
  private const val PREFS = "checkdrive_car_bt"
  private const val KEY_ADDR = "target_address"
  private const val KEY_NAME = "target_name"

  // Feature config, synced from JS via configure() so the receiver/service can
  // honor the user's settings even when the JS runtime isn't running.
  private const val KEY_PARK_ENABLED = "parking_enabled"
  private const val KEY_BACKSEAT_ENABLED = "backseat_enabled"
  private const val KEY_BACKSEAT_MSG = "backseat_message"

  // The most recent captured parking fix. lat/lng stored as strings to keep
  // full double precision (SharedPreferences has no double type).
  private const val KEY_PARK_LAT = "park_lat"
  private const val KEY_PARK_LNG = "park_lng"
  private const val KEY_PARK_TIME = "park_time"

  private fun prefs(c: Context) = c.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  fun setTarget(c: Context, address: String, name: String?) {
    prefs(c).edit().putString(KEY_ADDR, address).putString(KEY_NAME, name).apply()
  }

  fun getAddress(c: Context): String? = prefs(c).getString(KEY_ADDR, null)
  fun getName(c: Context): String? = prefs(c).getString(KEY_NAME, null)

  // Clears only the watched-car target — leaves feature config + last parking
  // intact so forgetting a car doesn't wipe the user's settings.
  fun clearTarget(c: Context) {
    prefs(c).edit().remove(KEY_ADDR).remove(KEY_NAME).apply()
  }

  fun setConfig(c: Context, parkingEnabled: Boolean, backSeatEnabled: Boolean, backSeatMessage: String?) {
    prefs(c).edit()
      .putBoolean(KEY_PARK_ENABLED, parkingEnabled)
      .putBoolean(KEY_BACKSEAT_ENABLED, backSeatEnabled)
      .putString(KEY_BACKSEAT_MSG, backSeatMessage)
      .apply()
  }

  fun isParkingEnabled(c: Context): Boolean = prefs(c).getBoolean(KEY_PARK_ENABLED, false)
  fun isBackSeatEnabled(c: Context): Boolean = prefs(c).getBoolean(KEY_BACKSEAT_ENABLED, false)
  fun getBackSeatMessage(c: Context): String? = prefs(c).getString(KEY_BACKSEAT_MSG, null)

  fun setParking(c: Context, lat: Double, lng: Double, timeMs: Long) {
    prefs(c).edit()
      .putString(KEY_PARK_LAT, lat.toString())
      .putString(KEY_PARK_LNG, lng.toString())
      .putLong(KEY_PARK_TIME, timeMs)
      .apply()
  }

  // Returns (lat, lng, epochMillis) or null if nothing saved yet.
  fun getParking(c: Context): Triple<Double, Double, Long>? {
    val p = prefs(c)
    val lat = p.getString(KEY_PARK_LAT, null)?.toDoubleOrNull() ?: return null
    val lng = p.getString(KEY_PARK_LNG, null)?.toDoubleOrNull() ?: return null
    val t = p.getLong(KEY_PARK_TIME, 0L)
    return Triple(lat, lng, t)
  }
}

class CarBluetoothModule : Module() {
  // Request code used with startIntentSenderForResult / OnActivityResult so we
  // recognize the CDM picker's result among any other activity results.
  private val selectDeviceRequestCode = 0xCD01

  // The associate() promise is resolved asynchronously from OnActivityResult,
  // so we stash it here between launching the picker and the result coming back.
  private var pendingAssociate: Promise? = null

  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  private val currentActivity: Activity
    get() = appContext.activityProvider?.currentActivity ?: throw Exceptions.MissingActivity()

  private val companionManager: CompanionDeviceManager
    get() = context.getSystemService(Context.COMPANION_DEVICE_SERVICE) as CompanionDeviceManager

  override fun definition() = ModuleDefinition {
    Name("CarBluetooth")

    Events(EVENT_CONNECT, EVENT_DISCONNECT, EVENT_PARKING)

    // Keep a static handle to the live instance so the receiver can emit JS
    // events when the app is running. Cleared on destroy to avoid leaking a
    // dead instance (in which case the receiver falls back to a notification).
    OnCreate {
      instance = this@CarBluetoothModule
    }
    OnDestroy {
      if (instance === this@CarBluetoothModule) instance = null
    }

    // CDM (associate picker) needs API 26+, and the background exemptions we
    // rely on are API 31+, so we gate the whole feature at 31+.
    AsyncFunction("isSupported") {
      Build.VERSION.SDK_INT >= 31 &&
        context.packageManager.hasSystemFeature(PackageManager.FEATURE_COMPANION_DEVICE_SETUP)
    }

    // Opens the system "choose a device" dialog. Resolves with the picked
    // device once OnActivityResult fires; rejects on cancel/failure.
    AsyncFunction("associate") { promise: Promise ->
      if (Build.VERSION.SDK_INT < 31) {
        promise.reject("ERR_UNSUPPORTED", "CompanionDeviceManager needs Android 12+", null)
        return@AsyncFunction
      }
      if (pendingAssociate != null) {
        promise.reject("ERR_BUSY", "An association request is already in progress", null)
        return@AsyncFunction
      }
      pendingAssociate = promise
      startAssociation()
    }

    // List devices already associated with this app (so the UI can show "your
    // car" across restarts even before any connect event).
    AsyncFunction("getAssociations") {
      val out = ArrayList<Map<String, Any?>>()
      try {
        if (Build.VERSION.SDK_INT >= 33) {
          for (a in companionManager.myAssociations) {
            out.add(mapOf(
              "address" to a.deviceMacAddress?.toString()?.uppercase(),
              "name" to a.displayName?.toString()
            ))
          }
        } else {
          @Suppress("DEPRECATION")
          for (addr in companionManager.associations) {
            out.add(mapOf("address" to addr, "name" to null))
          }
        }
      } catch (_: Exception) { /* return what we have */ }
      out
    }

    // The single car we actively watch (the most recent associate()).
    AsyncFunction("getTarget") {
      val addr = CarPrefs.getAddress(context) ?: return@AsyncFunction null
      mapOf("address" to addr, "name" to CarPrefs.getName(context))
    }

    // Remove an association and stop watching it.
    AsyncFunction("forgetCar") { address: String ->
      try {
        if (Build.VERSION.SDK_INT >= 33) {
          val match = companionManager.myAssociations.firstOrNull {
            it.deviceMacAddress?.toString().equals(address, ignoreCase = true)
          }
          if (match != null) companionManager.disassociate(match.id)
          else @Suppress("DEPRECATION") companionManager.disassociate(address)
        } else {
          @Suppress("DEPRECATION") companionManager.disassociate(address)
        }
      } catch (_: Exception) { /* ignore — we still clear our saved target */ }
      CarPrefs.clearTarget(context)
    }

    // Sync feature settings from JS → SharedPreferences so the receiver and the
    // parking service can honor them even when the JS runtime isn't running.
    AsyncFunction("configure") { parkingEnabled: Boolean, backSeatEnabled: Boolean, backSeatMessage: String? ->
      CarPrefs.setConfig(context, parkingEnabled, backSeatEnabled, backSeatMessage)
    }

    // The most recent parking fix the native service captured, or null. Returns
    // epoch millis as `savedAtMs`; the JS layer converts to an ISO string.
    AsyncFunction("getLastParking") {
      val p = CarPrefs.getParking(context) ?: return@AsyncFunction null
      mapOf("lat" to p.first, "lng" to p.second, "savedAtMs" to p.third)
    }

    // Manually capture the current location now (used by the "Save my spot"
    // button and for testing without a real car disconnect). Starts the same
    // foreground service; the result flows back via the onParkingSaved event.
    AsyncFunction("captureParkingNow") {
      val ctx = context
      val svc = Intent(ctx, CarParkingService::class.java)
      if (Build.VERSION.SDK_INT >= 26) ctx.startForegroundService(svc) else ctx.startService(svc)
    }

    // Receives the CDM picker result. The picker returns either an
    // AssociationInfo (API 33+) or a BluetoothDevice in EXTRA_DEVICE.
    OnActivityResult { _, payload ->
      if (payload.requestCode != selectDeviceRequestCode) return@OnActivityResult
      val promise = pendingAssociate
      pendingAssociate = null
      if (promise == null) return@OnActivityResult

      if (payload.resultCode != Activity.RESULT_OK || payload.data == null) {
        promise.reject("ERR_CANCELLED", "Device selection was cancelled", null)
        return@OnActivityResult
      }
      resolvePickedDevice(payload.data!!, promise)
    }
  }

  // ── CDM association launch ──────────────────────────────────────────────────
  // An empty BluetoothDeviceFilter matches all Classic Bluetooth devices, so the
  // picker lists everything paired/nearby and the user taps their car.
  private fun startAssociation() {
    val request = AssociationRequest.Builder()
      .addDeviceFilter(BluetoothDeviceFilter.Builder().build())
      .setSingleDevice(false)
      .build()

    val callback = object : CompanionDeviceManager.Callback() {
      // API 33+ entry point.
      override fun onAssociationPending(intentSender: IntentSender) {
        launchPicker(intentSender)
      }

      override fun onAssociationCreated(associationInfo: AssociationInfo) {
        // The association is recorded by the system here; we still wait for the
        // activity result to read the device details and resolve the promise.
      }

      // API 31–32 entry point (deprecated on 33+ but still delivered there).
      @Deprecated("Replaced by onAssociationPending on API 33+")
      override fun onDeviceFound(intentSender: IntentSender) {
        launchPicker(intentSender)
      }

      override fun onFailure(error: CharSequence?) {
        val promise = pendingAssociate
        pendingAssociate = null
        promise?.reject("ERR_ASSOCIATE", error?.toString() ?: "Association failed", null)
      }
    }

    if (Build.VERSION.SDK_INT >= 33) {
      companionManager.associate(request, Executor { it.run() }, callback)
    } else {
      @Suppress("DEPRECATION")
      companionManager.associate(request, callback, null)
    }
  }

  private fun launchPicker(intentSender: IntentSender) {
    // startIntentSenderForResult must run on the UI thread; the CDM callback may
    // arrive on a binder thread.
    val activity = currentActivity
    activity.runOnUiThread {
      try {
        activity.startIntentSenderForResult(intentSender, selectDeviceRequestCode, null, 0, 0, 0)
      } catch (e: IntentSender.SendIntentException) {
        val promise = pendingAssociate
        pendingAssociate = null
        promise?.reject("ERR_PICKER", "Could not open the device picker", e)
      }
    }
  }

  private fun resolvePickedDevice(data: Intent, promise: Promise) {
    var address: String? = null
    var name: String? = null

    if (Build.VERSION.SDK_INT >= 33) {
      val assoc = data.getParcelableExtra(
        CompanionDeviceManager.EXTRA_ASSOCIATION, AssociationInfo::class.java
      )
      if (assoc != null) {
        address = assoc.deviceMacAddress?.toString()?.uppercase()
        name = assoc.displayName?.toString()
      }
    }

    if (address == null) {
      @Suppress("DEPRECATION")
      val device = data.getParcelableExtra<BluetoothDevice>(CompanionDeviceManager.EXTRA_DEVICE)
      if (device != null) {
        address = device.address?.uppercase()
        // device.name needs BLUETOOTH_CONNECT; tolerate a SecurityException.
        name = try { device.name } catch (_: SecurityException) { null }
      }
    }

    if (address == null) {
      promise.reject("ERR_NO_DEVICE", "Could not read the selected device", null)
      return
    }

    CarPrefs.setTarget(context, address, name)
    promise.resolve(mapOf("address" to address, "name" to name))
  }

  // Member helpers so the companion object can fire JS events through the
  // protected Module.sendEvent without exposing it directly.
  internal fun emitEvent(connected: Boolean, address: String?) {
    sendEvent(
      if (connected) EVENT_CONNECT else EVENT_DISCONNECT,
      mapOf("address" to address)
    )
  }

  internal fun emitParking(lat: Double, lng: Double, timeMs: Long) {
    sendEvent(EVENT_PARKING, mapOf("lat" to lat, "lng" to lng, "savedAtMs" to timeMs))
  }

  companion object {
    const val EVENT_CONNECT = "onCarConnected"
    const val EVENT_DISCONNECT = "onCarDisconnected"
    const val EVENT_PARKING = "onParkingSaved"

    // Live module instance (null when the JS runtime isn't running).
    @Volatile
    private var instance: CarBluetoothModule? = null

    // Debounce state — BT stacks can emit several ACL broadcasts in a burst.
    private var lastKey = ""
    private var lastTime = 0L
    private const val DEBOUNCE_MS = 4000L

    // Single entry point for both the ACL receiver and (future) presence
    // sources. Filters to the saved car, debounces, then either emits a JS
    // event (app alive) or posts a deep-link notification (app dead).
    fun dispatch(context: Context, connected: Boolean, address: String?) {
      val target = CarPrefs.getAddress(context) ?: return
      // ACL broadcasts always include the device; require a match so other
      // Bluetooth gadgets (earbuds, watch) don't trigger CheckDrive.
      if (address == null || !address.equals(target, ignoreCase = true)) return

      val now = System.currentTimeMillis()
      val key = (if (connected) "c" else "d") + target
      synchronized(this) {
        if (key == lastKey && now - lastTime < DEBOUNCE_MS) return
        lastKey = key
        lastTime = now
      }

      // On disconnect (= just parked), kick off a brief foreground service to
      // capture the parking location, if the user enabled the feature. Starting
      // a foreground service from this background broadcast is permitted by the
      // companion-association exemption; if the OS still blocks it we just skip.
      if (!connected && CarPrefs.isParkingEnabled(context)) {
        try {
          val svc = Intent(context, CarParkingService::class.java)
          if (Build.VERSION.SDK_INT >= 26) context.startForegroundService(svc)
          else context.startService(svc)
        } catch (_: Exception) { /* FGS-from-background blocked — skip capture */ }
      }

      val live = instance
      if (live != null) {
        live.emitEvent(connected, address)
      } else {
        postNotification(context, connected)
      }
    }

    // Called by CarParkingService once it has a fix. Emits to JS if alive; the
    // fix is also persisted to SharedPreferences for the next-launch sync.
    fun notifyParkingSaved(lat: Double, lng: Double, timeMs: Long) {
      instance?.emitParking(lat, lng, timeMs)
    }

    private fun postNotification(context: Context, connected: Boolean) {
      val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      val channelId = "default" // matches expo-notifications' defaultChannel

      if (Build.VERSION.SDK_INT >= 26 && nm.getNotificationChannel(channelId) == null) {
        nm.createNotificationChannel(
          NotificationChannel(channelId, "CheckDrive", NotificationManager.IMPORTANCE_HIGH)
        )
      }

      val deepLink = if (connected) "checkdrive://trigger" else "checkdrive://disconnect"
      val tapIntent = Intent(Intent.ACTION_VIEW, Uri.parse(deepLink)).apply {
        setPackage(context.packageName)
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      }
      var piFlags = PendingIntent.FLAG_UPDATE_CURRENT
      if (Build.VERSION.SDK_INT >= 23) piFlags = piFlags or PendingIntent.FLAG_IMMUTABLE
      val pi = PendingIntent.getActivity(
        context, if (connected) 1 else 2, tapIntent, piFlags
      )

      // On disconnect, if the back-seat reminder is enabled, swap in the
      // urgent safety wording instead of the normal arrival reminder.
      val backSeat = !connected && CarPrefs.isBackSeatEnabled(context)
      val title = when {
        connected -> "Ready to drive?"
        backSeat -> "Don't forget the back seat!"
        else -> "Trip finished?"
      }
      val text = when {
        connected -> "Tap to open your CheckDrive checklist."
        backSeat -> CarPrefs.getBackSeatMessage(context) ?: "Check the back seat before you walk away."
        else -> "Tap to open your end-of-trip checklist."
      }

      val builder = if (Build.VERSION.SDK_INT >= 26) {
        Notification.Builder(context, channelId)
      } else {
        @Suppress("DEPRECATION") Notification.Builder(context)
      }
      builder
        .setSmallIcon(context.applicationInfo.icon)
        .setContentTitle(title)
        .setContentText(text)
        .setAutoCancel(true)
        .setContentIntent(pi)
      if (Build.VERSION.SDK_INT < 26) {
        @Suppress("DEPRECATION") builder.setPriority(Notification.PRIORITY_HIGH)
      }

      nm.notify(if (connected) 4101 else 4102, builder.build())
    }
  }
}
