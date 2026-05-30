// ─────────────────────────────────────────────────────────────────────────────
// navigation/navigationRef.ts  —  Standalone navigation ref.
//
// Lives in its own module (separate from AppNavigator) so code OUTSIDE the React
// tree can drive navigation without importing AppNavigator. AppNavigator imports
// every screen, and some of those screens need the ref too — e.g. HomeScreen
// pulls in useCarDetection, which navigates on the car-connect deep link.
// Importing the ref from AppNavigator would form a require cycle:
//   AppNavigator → HomeScreen → useCarDetection → AppNavigator
// Keeping the ref here — importing only from the nav library + types — breaks
// that cycle. AppNavigator re-exports it so existing import sites keep working.
// ─────────────────────────────────────────────────────────────────────────────

import { createNavigationContainerRef } from '@react-navigation/native';
import { RootStackParamList } from '../types';

// The generic parameter `<RootStackParamList>` makes `navigationRef.navigate()`
// type-safe: TypeScript errors if you pass a screen name that doesn't exist in
// the param map, or omit required params.
export const navigationRef = createNavigationContainerRef<RootStackParamList>();
