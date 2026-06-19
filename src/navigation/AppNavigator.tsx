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
//
// NAVIGATION REF
// `navigationRef` is exported so that code outside the React tree (App.tsx's
// notification tap handler) can navigate programmatically without needing a
// component-level `useNavigation()` hook.
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as Linking from 'expo-linking';
import { RootStackParamList } from '../types';
import { navigationRef } from './navigationRef';
import { HomeScreen } from '../screens/HomeScreen';
import { ChecklistRunScreen } from '../screens/ChecklistRunScreen';
import { MultiStopScreen } from '../screens/MultiStopScreen';
import { NewChecklistScreen } from '../screens/NewChecklistScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { CarDetectionSetupScreen } from '../screens/CarDetectionSetupScreen';
import { TripHistoryScreen } from '../screens/TripHistoryScreen';
import { PaywallScreen } from '../screens/PaywallScreen';

// Re-exported so existing import sites (App.tsx) can keep importing it from
// here. The ref itself is defined in ./navigationRef to avoid a require cycle —
// see that file's header for why.
export { navigationRef };

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
      // NOTE: `trigger` and `disconnect` are deliberately NOT mapped to any
      // screen. They're the car connect/disconnect deep links, handled by
      // useCarDetection's raw Linking listener (which fires the notification /
      // open-on-connect flow). Mapping `trigger` to a screen (it used to point
      // at CarDetectionSetup) made the link navigate there with no back stack —
      // a dead-end. CarDetectionSetup is reached in-app only, so it needs no
      // deep-link path.
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
        <Stack.Screen name="CarDetectionSetup" component={CarDetectionSetupScreen} />
        <Stack.Screen name="TripHistory" component={TripHistoryScreen} />
        {/* Paywall is presented modally so the close (X) feels like dismissing a sheet. */}
        <Stack.Screen name="Paywall" component={PaywallScreen} options={{ presentation: 'modal' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
