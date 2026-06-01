package expo.modules.carbluetooth

// ─────────────────────────────────────────────────────────────────────────────
// CarAclReceiver  —  Manifest-declared receiver for Bluetooth connect/disconnect.
//
// ACTION_ACL_CONNECTED / ACTION_ACL_DISCONNECTED fire for Classic Bluetooth
// links (car audio / hands-free), and because this receiver is declared in the
// manifest the system will start the app process to deliver them even when the
// app isn't running. We hand off to CarBluetoothModule.dispatch(), which filters
// to the user's chosen car and either emits a JS event or posts a notification.
//
// Reading the device address does not require BLUETOOTH_CONNECT; reading its
// name would, so we only use the address for matching here.
// ─────────────────────────────────────────────────────────────────────────────

import android.bluetooth.BluetoothDevice
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build

class CarAclReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val action = intent.action ?: return

    val device: BluetoothDevice? = if (Build.VERSION.SDK_INT >= 33) {
      intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE, BluetoothDevice::class.java)
    } else {
      @Suppress("DEPRECATION")
      intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE)
    }
    val address = device?.address?.uppercase() ?: return

    when (action) {
      BluetoothDevice.ACTION_ACL_CONNECTED ->
        CarBluetoothModule.dispatch(context.applicationContext, true, address)
      BluetoothDevice.ACTION_ACL_DISCONNECTED ->
        CarBluetoothModule.dispatch(context.applicationContext, false, address)
    }
  }
}
