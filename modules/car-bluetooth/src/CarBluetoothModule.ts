import { NativeModule, requireOptionalNativeModule } from 'expo';

import { CarBluetoothEvents, CarDevice } from './CarBluetooth.types';

// Typed handle to the native module. `NativeModule<Events>` gives us a typed
// addListener() for the connect/disconnect events. The native side is the
// Android CarBluetoothModule (Kotlin) or the iOS no-op stub.
declare class CarBluetoothModule extends NativeModule<CarBluetoothEvents> {
  isSupported(): Promise<boolean>;
  associate(): Promise<CarDevice>;
  getAssociations(): Promise<CarDevice[]>;
  getTarget(): Promise<CarDevice | null>;
  forgetCar(address: string): Promise<void>;
  // Syncs the back-seat reminder setting to the native side so the receiver
  // posts the right disconnect notification even when JS isn't running.
  configure(backSeatEnabled: boolean, backSeatMessage: string | null): Promise<void>;
}

// requireOptionalNativeModule returns null (instead of throwing) when the native
// module isn't linked into the running app — e.g. in Expo Go or on web, which
// can't load custom native modules. The JS API in index.ts treats null as
// "native detection unavailable" and falls back to the manual/Shortcuts flow,
// so the app boots fine everywhere and only actually uses the module in EAS
// builds that contain the compiled Kotlin.
export default requireOptionalNativeModule<CarBluetoothModule>('CarBluetooth');
