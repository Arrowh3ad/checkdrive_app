// Types shared across the CarBluetooth module's JS surface.

// A Bluetooth device the user has associated as their car. `name` may be null
// when the OS didn't expose it (e.g. without BLUETOOTH_CONNECT at pick time).
export type CarDevice = {
  address: string;
  name: string | null;
};

// Payload delivered with the onCarConnected / onCarDisconnected events.
export type CarConnectionEvent = {
  address: string | null;
};

// Event map for the native module (used to type addListener).
export type CarBluetoothEvents = {
  onCarConnected: (event: CarConnectionEvent) => void;
  onCarDisconnected: (event: CarConnectionEvent) => void;
};
