// ─────────────────────────────────────────────────────────────────────────────
// navigation/AppNavigator.tsx  —  Root navigation stack + deep-link config.
//
// React Navigation v7 drives all screen transitions. We use a native stack so
// screens animate with native UINavigationController push/pop on iOS and the
// equivalent FragmentTransaction on Android — smoother than the JS-driven
// animated stack.
//
// DEEP LINKS
// The `linking` config maps URL paths to screen names. Two prefixes are
// registered:
//   • `checkdrive://`  — the custom URL scheme used by iOS Shortcuts and
//                        Android automation tools to launch the app.
//   • `Linking.createURL('/')` — the Expo development-mode URL (e.g.
//                        `exp://192.168.1.5:19000/`) so deep links also work
//                        when running via Expo Go during development.
//
// Example URLs that open screens:
//   checkdrive://                   → Home
//   checkdrive://checklist/cl-abc   → ChecklistRunScreen for checklist cl-abc
//   checkdrive://multistop/cl-xyz   → MultiStopScreen for checklist cl-xyz
//   checkdrive://trigger            → CarDetection hook fires (Shortcuts entry point)
//   checkdrive://settings           → SettingsScreen
//   checkdrive://pro                → ProScreen
//
// NAVIGATION REF
// `navigationRef` is exported so that code outside the React tree (App.tsx's
// notification tap handler) can navigate programmatically without needing a
// component-level `useNavigation()` hook.
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as Linking from 'expo-linking';
import { RootStackParamList } from '../types';
import { HomeScreen } from '../screens/HomeScreen';
import { ChecklistRunScreen } from '../screens/ChecklistRunScreen';
import { MultiStopScreen } from '../screens/MultiStopScreen';
import { NewChecklistScreen } from '../screens/NewChecklistScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { ProScreen } from '../screens/ProScreen';
import { CarDetectionSetupScreen } from '../screens/CarDetectionSetupScreen';

// The generic parameter `<RootStackParamList>` makes `navigationRef.navigate()`
// type-safe: TypeScript will error if you pass a screen name that doesn't exist
// in the param map, or if you omit required params.
export const navigationRef = createNavigationContainerRef<RootStackParamList>();

const Stack = createNativeStackNavigator<RootStackParamList>();

// ── Deep-link mapping ─────────────────────────────────────────────────────────
// Each entry under `screens` maps a URL path to a screen. `:checklistId` is a
// dynamic segment — React Navigation extracts its value and passes it as a
// route param automatically.
const linking = {
  prefixes: [
    Linking.createURL('/'), // dev / Expo Go prefix resolved at runtime
    'checkdrive://',         // production custom URL scheme (defined in app.json)
  ],
  config: {
    screens: {
      Home: '',                          // checkdrive://
      ChecklistRun: 'checklist/:checklistId',
      MultiStop: 'multistop/:checklistId',
      NewChecklist: 'new',
      Settings: 'settings',
      Pro: 'pro',
      // `trigger` is a special path with no corresponding screen — it's caught
      // by useCarDetection's Linking listener before navigation happens.
      CarDetectionSetup: 'trigger',
    },
  },
};

// ── Navigator ─────────────────────────────────────────────────────────────────
// `onReady` is forwarded from App.tsx, which uses it to flush any pending
// navigation that arrived before the container was ready (e.g. a notification
// tap during a cold start).
export function AppNavigator({ onReady }: { onReady?: () => void }) {
  return (
    <NavigationContainer
      ref={navigationRef}
      linking={linking}
      onReady={onReady}
    >
      {/* `headerShown: false` — every screen manages its own custom topbar */}
      {/* `slide_from_right` — standard iOS push animation                  */}
      <Stack.Navigator
        screenOptions={{ headerShown: false, animation: 'slide_from_right' }}
      >
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="ChecklistRun" component={ChecklistRunScreen} />
        <Stack.Screen name="MultiStop" component={MultiStopScreen} />
        <Stack.Screen name="NewChecklist" component={NewChecklistScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
        <Stack.Screen name="Pro" component={ProScreen} />
        <Stack.Screen name="CarDetectionSetup" component={CarDetectionSetupScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
