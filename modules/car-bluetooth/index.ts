// ─────────────────────────────────────────────────────────────────────────────
// car-bluetooth  —  Public JS API for native car-Bluetooth detection (Android).
//
// Every function is Android-guarded: on iOS/web we return safe defaults so
// callers don't need their own Platform checks. iOS users get car detection via
// the Shortcuts flow instead (see CarDetectionSetupScreen).
// ─────────────────────────────────────────────────────────────────────────────

import { Platform } from 'react-native';

import Native from './src/CarBluetoothModule';
import { CarConnectionEvent, CarDevice, ParkingFix } from './src/CarBluetooth.types';

export type { CarDevice, CarConnectionEvent, ParkingFix };

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
export async function associateCar(): Promise<CarDevice> {
  if (!available) {
    throw new Error('Native car detection is unavailable in this build');
  }
  return Native!.associate();
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

// The single car currently being watched (most recent association), or null.
export async function getTarget(): Promise<CarDevice | null> {
  if (!available) return null;
  try {
    return await Native!.getTarget();
  } catch {
    return null;
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
// receiver/parking service behave correctly even when JS isn't running.
export async function configure(opts: {
  parkingEnabled: boolean;
  backSeatEnabled: boolean;
  backSeatMessage?: string | null;
}): Promise<void> {
  if (!available) return;
  try {
    await Native!.configure(
      opts.parkingEnabled,
      opts.backSeatEnabled,
      opts.backSeatMessage ?? null
    );
  } catch {
    /* best-effort */
  }
}

// The most recent parking fix captured natively, or null. Used on app launch
// to sync a spot that was saved while the app was killed.
export async function getLastParking(): Promise<ParkingFix | null> {
  if (!available) return null;
  try {
    return await Native!.getLastParking();
  } catch {
    return null;
  }
}

// Manually capture the current location (the "Save my spot" button / testing).
// The saved fix arrives via the onParkingSaved listener. Returns whether the
// capture was kicked off (false when native detection is unavailable).
export async function captureParkingNow(): Promise<boolean> {
  if (!available) return false;
  try {
    await Native!.captureParkingNow();
    return true;
  } catch {
    return false;
  }
}

// Subscribe to parking-saved events (fired when the native service captures a
// fix while the app is running). Returns an unsubscribe function.
export function addParkingListener(onSaved: (fix: ParkingFix) => void): () => void {
  if (!available) return () => {};
  const sub = Native!.addListener('onParkingSaved', onSaved);
  return () => sub.remove();
}
