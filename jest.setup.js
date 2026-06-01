// Test setup — runs before each test file.
//
// The Zustand store persists through AsyncStorage. In Node there's no native
// AsyncStorage, so we swap in the package's official in-memory mock. The persist
// middleware then reads/writes a JS object instead of touching a device.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
