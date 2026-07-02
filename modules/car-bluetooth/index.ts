// ─────────────────────────────────────────────────────────────────────────────
// car-bluetooth  —  Public JS API for native car-Bluetooth detection (Android).
//
// Every function is Android-guarded: on iOS/web we return safe defaults so
// callers don't need their own Platform checks. iOS users get car detection via
// the Shortcuts flow instead (see CarDetectionSetupScreen).
// ─────────────────────────────────────────────────────────────────────────────

import { Platform } from 'react-native';

import Native from './src/CarBluetoothModule';
import { CarConnectionEvent, CarDevice } from './src/CarBluetooth.types';

export type { CarDevice, CarConnectionEvent };

// `Native` is null when the native module isn't linked into the running app
// (Expo Go, web, or any build without the compiled module). `available` rolls
// that together with the Android check so each function can bail safely instead
// of crashing — letting the app boot in Expo Go and fall back to the manual flow.
const available = Platform.OS === 'android' && Native != null;

// Whether this device can do native car detection (Android 12+ with the
// CompanionDeviceManager system feature, in a build that includes the module).
export async function isSupported(): Promise<boolean> {
  if (!available) return false;
  try {
    return await Native!.isSupported();
  } catch {
    return false;
  }
}

// Opens the system "choose a device" picker and saves the choice as the watched
// car. Resolves with the picked device; rejects if the user cancels.
// NOTE: this runs a live discovery scan, so it only surfaces *discoverable*
// devices — an already-paired car usually won't appear. Prefer
// getBondedDevices() + setCar() for the common "my car is already paired" case;
// this is kept as a fallback for genuinely unpaired devices.
export async function associateCar(): Promise<CarDevice> {
  if (!available) {
    throw new Error('Native car detection is unavailable in this build');
  }
  return Native!.associate();
}

// The phone's already-paired Bluetooth devices. This is the reliable car
// picker: a car used with Android Auto is always bonded, whereas associateCar()
// (a discovery scan) won't show a paired, non-discoverable car. Returns [] when
// native detection is unavailable or the permission hasn't been granted.
export async function getBondedDevices(): Promise<CarDevice[]> {
  if (!available) return [];
  try {
    return await Native!.getBondedDevices();
  } catch {
    return [];
  }
}

// Add a chosen bonded device to the watched cars (no system picker). Multiple
// cars can be watched at once; a connect/disconnect fires for any of them.
// Detection via the manifest ACL receiver works off the saved addresses
// regardless of any CDM association.
export async function addCar(address: string, name?: string | null): Promise<void> {
  if (!available) return;
  try {
    await Native!.addTarget(address, name ?? null);
  } catch {
    /* best-effort */
  }
}

// All devices this app is associated with (survives restarts).
export async function getAssociations(): Promise<CarDevice[]> {
  if (!available) return [];
  try {
    return await Native!.getAssociations();
  } catch {
    return [];
  }
}

// Every car currently being watched. Empty when none are set or native
// detection is unavailable.
export async function getTargets(): Promise<CarDevice[]> {
  if (!available) return [];
  try {
    return await Native!.getTargets();
  } catch {
    return [];
  }
}

// Remove an association and stop watching it.
export async function forgetCar(address: string): Promise<void> {
  if (!available) return;
  try {
    await Native!.forgetCar(address);
  } catch {
    /* best-effort */
  }
}

// Subscribe to connect/disconnect events fired while the app is running.
// Returns an unsubscribe function. No-op when native detection is unavailable.
export function addConnectionListener(
  onConnect: (event: CarConnectionEvent) => void,
  onDisconnect: (event: CarConnectionEvent) => void
): () => void {
  if (!available) return () => {};
  const connectSub = Native!.addListener('onCarConnected', onConnect);
  const disconnectSub = Native!.addListener('onCarDisconnected', onDisconnect);
  return () => {
    connectSub.remove();
    disconnectSub.remove();
  };
}

// Push feature settings down to the native side (SharedPreferences) so the
// receiver posts the correct disconnect notification even when JS isn't running.
export async function configure(opts: {
  backSeatEnabled: boolean;
  backSeatMessage?: string | null;
}): Promise<void> {
  if (!available) return;
  try {
    await Native!.configure(opts.backSeatEnabled, opts.backSeatMessage ?? null);
  } catch {
    /* best-effort */
  }
}
