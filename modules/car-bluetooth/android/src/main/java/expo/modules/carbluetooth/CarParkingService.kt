package expo.modules.carbluetooth

// ─────────────────────────────────────────────────────────────────────────────
// CarParkingService  —  Brief foreground service that captures the parking spot.
//
// Started by CarBluetoothModule.dispatch() on car disconnect (when the parking
// finder is enabled). A foreground service of type "location" is what lets us
// read a GPS fix while the app may be backgrounded or killed, without the
// heavyweight ACCESS_BACKGROUND_LOCATION permission. It shows a short-lived
// notification ("Saving your parking spot…"), grabs one fix, persists it to
// SharedPreferences (+ emits a JS event if the app is alive), then stops itself.
//
// A watchdog stops the service after a few seconds even if no fix arrives, so it
// never lingers as a foreground service.
// ─────────────────────────────────────────────────────────────────────────────

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.location.Location
import android.location.LocationManager
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import java.util.concurrent.atomic.AtomicBoolean

class CarParkingService : Service() {
  private val finished = AtomicBoolean(false)
  private val mainHandler = Handler(Looper.getMainLooper())

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    try {
      startInForeground()
      // Watchdog: if no fix within the window, stop anyway so we don't linger.
      mainHandler.postDelayed({ finish(null) }, WATCHDOG_MS)
      captureLocation()
    } catch (_: Exception) {
      // startForeground or capture not permitted in this state — bail cleanly.
      finish(null)
    }
    return Service.START_NOT_STICKY
  }

  private fun startInForeground() {
    val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (Build.VERSION.SDK_INT >= 26 && nm.getNotificationChannel(CHANNEL_ID) == null) {
      nm.createNotificationChannel(
        NotificationChannel(CHANNEL_ID, "CheckDrive", NotificationManager.IMPORTANCE_LOW)
      )
    }
    val builder = if (Build.VERSION.SDK_INT >= 26) {
      Notification.Builder(this, CHANNEL_ID)
    } else {
      @Suppress("DEPRECATION") Notification.Builder(this)
    }
    val notif = builder
      .setSmallIcon(applicationInfo.icon)
      .setContentTitle("CheckDrive")
      .setContentText("Saving your parking spot…")
      .setOngoing(true)
      .build()

    if (Build.VERSION.SDK_INT >= 34) {
      startForeground(PARK_NOTIF_ID, notif, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION)
    } else {
      startForeground(PARK_NOTIF_ID, notif)
    }
  }

  private fun hasLocationPermission(): Boolean {
    if (Build.VERSION.SDK_INT < 23) return true
    return applicationContext.checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) ==
      PackageManager.PERMISSION_GRANTED ||
      applicationContext.checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) ==
      PackageManager.PERMISSION_GRANTED
  }

  private fun captureLocation() {
    if (!hasLocationPermission()) {
      finish(null)
      return
    }
    val lm = getSystemService(Context.LOCATION_SERVICE) as LocationManager
    val provider = pickProvider(lm)
    if (provider == null) {
      finish(lastKnownAcross(lm))
      return
    }

    try {
      if (Build.VERSION.SDK_INT >= 30) {
        // Fresh single fix with a callback (API 30+).
        lm.getCurrentLocation(provider, null, mainExecutor) { loc ->
          finish(loc ?: lastKnownAcross(lm))
        }
      } else {
        finish(lm.getLastKnownLocation(provider) ?: lastKnownAcross(lm))
      }
    } catch (_: SecurityException) {
      finish(null)
    } catch (_: Exception) {
      finish(lastKnownAcross(lm))
    }
  }

  private fun pickProvider(lm: LocationManager): String? = when {
    Build.VERSION.SDK_INT >= 31 && lm.allProviders.contains(LocationManager.FUSED_PROVIDER) ->
      LocationManager.FUSED_PROVIDER
    lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER) -> LocationManager.NETWORK_PROVIDER
    lm.isProviderEnabled(LocationManager.GPS_PROVIDER) -> LocationManager.GPS_PROVIDER
    else -> null
  }

  // Best of the last-known fixes across providers, by recency.
  private fun lastKnownAcross(lm: LocationManager): Location? {
    if (!hasLocationPermission()) return null
    return try {
      lm.allProviders
        .mapNotNull { lm.getLastKnownLocation(it) }
        .maxByOrNull { it.time }
    } catch (_: SecurityException) {
      null
    }
  }

  // Runs exactly once: persist the fix (if any), notify JS, and stop the service.
  private fun finish(loc: Location?) {
    if (!finished.compareAndSet(false, true)) return
    mainHandler.removeCallbacksAndMessages(null)
    if (loc != null) {
      val now = System.currentTimeMillis()
      CarPrefs.setParking(applicationContext, loc.latitude, loc.longitude, now)
      CarBluetoothModule.notifyParkingSaved(loc.latitude, loc.longitude, now)
    }
    if (Build.VERSION.SDK_INT >= 24) {
      stopForeground(Service.STOP_FOREGROUND_REMOVE)
    } else {
      @Suppress("DEPRECATION") stopForeground(true)
    }
    stopSelf()
  }

  companion object {
    private const val CHANNEL_ID = "default"
    private const val PARK_NOTIF_ID = 4103
    private const val WATCHDOG_MS = 12_000L
  }
}
