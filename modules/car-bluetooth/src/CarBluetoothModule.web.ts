import { registerWebModule, NativeModule } from 'expo';

class CarBluetoothModule extends NativeModule<{}> {}

export default registerWebModule(CarBluetoothModule, 'CarBluetoothModule');
