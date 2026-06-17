// ─────────────────────────────────────────────────────────────────────────────
// hooks/useNotifications.ts  —  Push-notification setup and helpers.
//
// This module handles two responsibilities:
//
//  1. PERMISSION REQUEST
//     `useNotifications()` is called once from AppRoot. On iOS it presents the
//     system permission dialog on first launch; subsequent calls are no-ops
//     if permission has already been granted or denied.
//     Android requires an explicit notification channel (setNotificationChannelAsync)
//     on Android 8+ for notifications to appear.
//
//  2. SEND TRIP-START NOTIFICATION
//     When the CarPlay deep-link fires, `useCarDetection` calls
//     `sendTripStartNotification()`, which schedules an immediate notification.
//     The `data` payload embeds `checklistId` and `isMultiStop` so that when
//     the user taps the notification, App.tsx knows which screen to navigate to.
//
// The `Notifications.setNotificationHandler` call here mirrors the one in
// App.tsx. They are intentionally identical — the module-level handler in
// App.tsx runs for the live app; this one ensures the handler is set even if
// this module is loaded before App.tsx runs (e.g. in tests).
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';

// Tell expo-notifications how to show notifications while the app is in the
// foreground. Without this handler, foreground notifications are silently
// dropped on iOS.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Requests notification permissions at runtime. Returns `true` if granted.
// Should be called once early in the app lifecycle (via `useNotifications`).
export async function requestNotificationPermissions(): Promise<boolean> {
  // expo-notifications requires a real device; permission dialogs don't appear
  // on simulators and the API would throw if we called it there.
  if (!Device.isDevice) return false;

  // Android 8+ (API 26+) requires a notification channel before scheduling.
  // The channel name and importance level control how the system displays the
  // notification in the Android settings panel.
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'CheckDrive',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#1D9E75', // matches theme.colors.primary
    });
  }

  // If permissions were already granted in a previous session, skip the dialog.
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;

  // First-time request — presents the system permission prompt.
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

// Fires an immediate ("trigger: null") notification to alert the user that
// their car was detected. The data payload is what App.tsx reads on notification
// tap to navigate to the correct screen.
export async function sendTripStartNotification(
  checklistName?: string,
  checklistId?: string,
  isMultiStop?: boolean
): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Ready for your trip?',
      body: checklistName
        ? `Tap to run your "${checklistName}" checklist`
        : 'Tap to open CheckDrive',
      data: {
        trigger: 'car-connect',         // lets App.tsx distinguish checklist taps from other notifs
        checklistId: checklistId ?? null,
        isMultiStop: isMultiStop ?? false,
      },
      sound: true,
    },
    // `trigger: null` → fire immediately, not on a schedule.
    trigger: null,
  });
}

// Fires an immediate notification when CarPlay/Android Auto disconnects,
// reminding the user to run through their arrival (end-of-trip) items.
// Mirrors sendTripStartNotification but uses a different trigger value so
// App.tsx can route the tap to the end tab automatically.
export async function sendTripEndNotification(
  checklistName?: string,
  checklistId?: string,
  isMultiStop?: boolean,
): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      // Multi-stop trips have no separate arrival tab — the destination is the
      // stop list itself, so word it as "review your stops" instead.
      title: isMultiStop ? 'Trip ended — review your stops' : 'Trip ended — check your arrival items',
      body: checklistName
        ? isMultiStop
          ? `Tap to finish your "${checklistName}" stops`
          : `Don't forget your "${checklistName}" end-of-trip checklist`
        : 'Open CheckDrive to complete your checklist',
      data: {
        trigger: 'car-disconnect',
        checklistId: checklistId ?? null,
        // Routed by App.tsx: true → opens the MultiStop screen on tap.
        isMultiStop: isMultiStop ?? false,
      },
      sound: true,
    },
    trigger: null,
  });
}

// Fires a distinct, high-urgency reminder to check the back seat when the car
// disconnects — the safety variant of the arrival notification. Carries the
// same data payload so a tap still opens the relevant checklist.
export async function sendBackSeatNotification(
  message?: string,
  checklistId?: string,
): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Don't forget the back seat!",
      body: message && message.trim().length > 0
        ? message
        : 'Check the back seat before you walk away.',
      data: {
        trigger: 'car-disconnect',
        checklistId: checklistId ?? null,
        isMultiStop: false,
      },
      sound: true,
    },
    trigger: null,
  });
}

// Thin React hook that requests notification permissions on mount.
// Called once from AppRoot in App.tsx; safe to call multiple times.
export function useNotifications() {
  useEffect(() => {
    requestNotificationPermissions();
  }, []);
}
