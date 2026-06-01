// ─────────────────────────────────────────────────────────────────────────────
// App.tsx  —  Root component and notification tap handler.
//
// COMPONENT TREE
//   App  (SafeAreaProvider)
//   └─ AppRoot  (notification listener + nav ref)
//      └─ AppNavigator  (NavigationContainer + Stack.Navigator)
//         └─ [all screens]
//
// WHY TWO COMPONENTS?
// `App` owns SafeAreaProvider (which must wrap everything).
// `AppRoot` owns the notification-response listener, which needs to be inside
// SafeAreaProvider but outside NavigationContainer. Splitting them keeps each
// component's responsibility clear.
//
// COLD-START NOTIFICATION TAP PROBLEM
// When the user taps a notification while the app is fully closed:
//   1. The OS launches the app.
//   2. The notification-response listener fires almost immediately.
//   3. NavigationContainer hasn't mounted yet → navigationRef.isReady() = false.
//   4. A direct navigate() call would silently fail.
//
// FIX: Store the desired navigation target in the module-level variable
// `pendingNotificationNav`. Once the NavigationContainer is ready it calls
// `onReady` → `handleNavReady()`, which flushes the pending navigation.
// Module-level (not component state) is intentional: it survives the timing
// gap and doesn't cause re-renders.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import { AppNavigator, navigationRef } from './src/navigation/AppNavigator';
import { useNotifications } from './src/hooks/useNotifications';

// Configure how expo-notifications displays alerts while the app is in the
// foreground. Without this handler, iOS silently drops foreground notifications.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Module-level pending-navigation target. Set when a notification tap arrives
// before the NavigationContainer is ready; cleared after navigation fires.
// `checklistId` is null → fall back to HomeScreen.
// `tab` is set to 'end' by the car-disconnect notification so the screen opens
// straight to arrival items; omitted for car-connect notifications.
type PendingNav = { checklistId: string | null; isMultiStop: boolean; tab?: 'start' | 'end' };
let pendingNotificationNav: PendingNav | null = null;

function AppRoot() {
  // Requests notification permissions on mount (handled inside the hook).
  useNotifications();

  // Listen for notification taps. The `data` payload embedded by
  // `sendTripStartNotification` (see useNotifications.ts) contains the
  // checklistId and isMultiStop flag, so we can navigate straight to the
  // right screen without any ambiguity.
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      // Expo types `data` as `Record<string, unknown>` — cast to `any` to
      // access the custom fields without verbose type assertions.
      const data = response.notification.request.content.data as any;
      const trigger = data?.trigger;
      // Only handle our own notifications; ignore everything else.
      if (trigger !== 'car-connect' && trigger !== 'car-disconnect') return;

      const target: PendingNav = {
        checklistId: data.checklistId ?? null,
        isMultiStop: !!data.isMultiStop,
        // Disconnect notifications should open straight to the end-of-trip tab.
        tab: trigger === 'car-disconnect' ? 'end' : undefined,
      };

      if (navigationRef.isReady()) {
        navigateFromNotification(target);
      } else {
        // Cold start: NavigationContainer isn't ready yet. Store the target
        // so `handleNavReady` can flush it once the container mounts.
        pendingNotificationNav = target;
      }
    });

    return () => sub.remove();
  }, []);

  // Navigates to the checklist screen, or falls back to HomeScreen when no
  // specific checklist was embedded in the notification (no default set).
  function navigateFromNotification(target: PendingNav) {
    if (!target.checklistId) {
      navigationRef.navigate('Home', undefined);
      return;
    }
    if (target.isMultiStop) {
      navigationRef.navigate('MultiStop', { checklistId: target.checklistId });
    } else {
      navigationRef.navigate('ChecklistRun', {
        checklistId: target.checklistId,
        // `tab` is only defined for car-disconnect notifications; omitting it
        // leaves ChecklistRunScreen to default to 'start'.
        tab: target.tab,
      });
    }
  }

  // Called by NavigationContainer.onReady once it has finished mounting.
  // Flushes any notification-tap navigation that arrived during cold start.
  function handleNavReady() {
    if (!pendingNotificationNav) return;
    const nav = pendingNotificationNav;
    pendingNotificationNav = null; // clear before navigating to avoid double-fire
    navigateFromNotification(nav);
  }

  return (
    <>
      {/* `style="auto"` adapts light/dark status bar text to the screen background */}
      <StatusBar style="auto" />
      <AppNavigator onReady={handleNavReady} />
    </>
  );
}

// `SafeAreaProvider` measures the device's safe-area insets (notch, home bar,
// etc.) and makes them available to any `SafeAreaView` deep in the tree.
// It must be the outermost wrapper.
export default function App() {
  return (
    <SafeAreaProvider>
      <AppRoot />
    </SafeAreaProvider>
  );
}
