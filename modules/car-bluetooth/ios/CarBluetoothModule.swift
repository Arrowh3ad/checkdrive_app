import ExpoModulesCore

// iOS has no public API equivalent to Android's CompanionDeviceManager for a
// non-CarPlay-category app, so this module is intentionally a no-op stub on iOS.
// The JS layer (modules/car-bluetooth/index.ts) guards every call behind
// Platform.OS === 'android' and never invokes these natives on iOS — it only
// needs requireNativeModule('CarBluetooth') to resolve. iOS users get car
// detection via the Shortcuts flow instead (see CarDetectionSetupScreen).
public class CarBluetoothModule: Module {
  public func definition() -> ModuleDefinition {
    Name("CarBluetooth")

    // Declared so addListener() typing matches Android; never emitted on iOS.
    Events("onCarConnected", "onCarDisconnected")
  }
}
