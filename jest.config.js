// Jest configuration for CheckDrive.
//
// `jest-expo` is the official Expo preset — it wires up the Babel transform
// (so TS/JSX + Expo/React Native modules compile in tests) and sensible default
// mocks for the RN/Expo runtime. We only test pure logic here (the Zustand store
// and the car-detection decision functions), so no native code or device runs.
module.exports = {
  preset: 'jest-expo',
  // Run our manual mocks (AsyncStorage) before each test file.
  setupFiles: ['<rootDir>/jest.setup.js'],
  // Only pick up files under __tests__ ending in .test.ts/.tsx.
  testMatch: ['**/__tests__/**/*.test.ts?(x)'],
};
