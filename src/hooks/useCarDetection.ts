// ─────────────────────────────────────────────────────────────────────────────
// hooks/useCarDetection.ts  —  Car-connection detection and response logic.
//
// WHY CAN'T THE APP DETECT CarPlay DIRECTLY?
// Apple restricts the CarPlay SDK to approved categories: Navigation, Audio,
// Communication, and a handful of others. A utility checklist app doesn't
// qualify. The practical workaround is a Shortcuts automation that the user
// sets up once (see CarDetectionSetupScreen for instructions).
//
// iOS SHORTCUTS APPROACH (two-shortcut method for iOS 17+/18)
// ──────────────────────────────────────────────────────────────
// In recent iOS versions, CarPlay automations don't surface "Open URLs"
// directly in the action picker. The reliable solution is two separate
// Shortcuts objects:
//
//   Shortcut A — "Start CheckDrive" (a regular, manually-triggerable shortcut):
//     1. URL action        → checkdrive://trigger
//     2. Open URLs action  → (uses the URL from step 1 automatically)
//
//   Automation — "When CarPlay Connects":
//     1. Trigger: CarPlay → Is Connected
//     2. Action:  Run Shortcut → "Start CheckDrive"
//     3. Disable "Ask Before Running"
//
// When CarPlay connects, iOS fires the automation, which runs Shortcut A,
// which calls `Linking.openURL('checkdrive://trigger')`. This hook's
// `addEventListener('url', …)` handler catches that URL and calls
// `handleVehicleConnect()`.
//
// ANDROID APPROACH
// Android is more permissive. Full detection could use UiModeManager
// (returns UI_MODE_TYPE_CAR=3) or a Bluetooth BroadcastReceiver, but both
// require native modules outside the Expo managed workflow. Here we handle
// the same `checkdrive://trigger` URL scheme, which is automatable via
// Google Assistant Routines, Tasker, or MacroDroid. For a bare-workflow
// build, add react-native-bluetooth-classic for BT-level detection.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import * as Linking from 'expo-linking';
import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import { useAppStore } from '../store/useAppStore';
import { sendTripStartNotification } from './useNotifications';

// A named constant for the background-fetch task so the same string is used in
// both `defineTask` (module level) and `registerTaskAsync` (hook level).
const BG_TASK = 'checkdrive-bg-check';

// TaskManager.defineTask must be called at module level (outside any component
// or hook), before the app registers the task. Expo's task manager requires the
// definition to exist before `registerTaskAsync` is called.
// Currently the task body is a no-op — the slot is reserved for future
// logic (e.g. checking a geofence or polling BT state periodically).
if (!TaskManager.isTaskDefined(BG_TASK)) {
  TaskManager.defineTask(BG_TASK, async () => {
    return BackgroundFetch.BackgroundFetchResult.NoData;
  });
}

export function useCarDetection() {
  const {
    setConnectedToVehicle,
    checklists,
    settings,
    activeMultiStopTrip,
    advanceMultiStopStop,
  } = useAppStore();

  // `useCallback` memoises this function so it doesn't change identity on
  // every render. This matters because it's used as a dependency in the
  // `useEffect` below — a new function reference would re-attach the Linking
  // listener on every render.
  const handleVehicleConnect = useCallback(async () => {
    setConnectedToVehicle(true);

    // MULTI-STOP INTERCEPT
    // If a multi-stop trip is already running when CarPlay fires again (e.g.
    // the user reconnected after a rest stop), offer to advance to the next
    // stop instead of firing the notification flow.
    if (activeMultiStopTrip) {
      const tripChecklist = checklists.find(
        (cl) => cl.id === activeMultiStopTrip.checklistId
      );
      const nextStop = tripChecklist?.stops[activeMultiStopTrip.stopIndex + 1];
      if (nextStop) {
        Alert.alert(
          'Arrived at next stop?',
          `Continue to: "${nextStop.name}"`,
          [
            { text: 'Not yet', style: 'cancel' },
            { text: 'Continue', onPress: () => advanceMultiStopStop() },
          ]
        );
      }
      return; // don't fall through to the notification path
    }

    // NOTIFICATION FLOW
    // Push a notification so the user can tap to open the checklist, even if
    // they're not looking at the phone when CarPlay connects.
    if (settings.pushNotifications) {
      // Priority: user's chosen default checklist (Pro) → first autoDetect checklist.
      const target =
        checklists.find((cl) => cl.id === settings.defaultChecklistId) ??
        checklists.find((cl) => cl.autoDetect);

      await sendTripStartNotification(
        target?.name ?? 'your checklist',
        target?.id,
        target?.isMultiStop
      );
    }
  }, [
    setConnectedToVehicle,
    checklists,
    settings.pushNotifications,
    settings.defaultChecklistId,
    activeMultiStopTrip,
    advanceMultiStopStop,
  ]);

  // ── Deep-link listener ────────────────────────────────────────────────────
  // `getInitialURL()` handles the cold-start case: the app was launched by
  // tapping the deep link from a completely closed state, so there's no
  // 'url' event — only the initial URL value from the launcher.
  // `addEventListener('url', …)` handles the warm-start / foreground case:
  // the app was already running when the Shortcuts automation fired.
  useEffect(() => {
    Linking.getInitialURL().then((url) => {
      if (url?.includes('trigger')) handleVehicleConnect();
    });

    const sub = Linking.addEventListener('url', ({ url }) => {
      if (url?.includes('trigger')) handleVehicleConnect();
    });

    // Clean up the listener when the component that uses this hook unmounts.
    return () => sub.remove();
  }, [handleVehicleConnect]);

  // ── Background fetch registration ─────────────────────────────────────────
  // Registers a background-fetch slot that iOS/Android can wake the app into
  // periodically. The minimum interval is 15 minutes (iOS enforces this lower
  // bound regardless of what you pass). Currently the task is a no-op; it
  // exists to have the slot reserved so it can be filled with logic later
  // without requiring an app update to re-register.
  useEffect(() => {
    BackgroundFetch.registerTaskAsync(BG_TASK, {
      minimumInterval: 15 * 60, // 15 minutes (iOS minimum)
      stopOnTerminate: false,   // keep the task running after the user force-quits
      startOnBoot: true,        // re-register after device restart
    }).catch(() => {});         // silently ignore if already registered

    return () => {
      // Unregister when the hook's owner unmounts (e.g. in tests or HMR).
      BackgroundFetch.unregisterTaskAsync(BG_TASK).catch(() => {});
    };
  }, []);

  // These are exposed so SettingsScreen / HomeScreen can trigger the same flow
  // without actually connecting a car — useful during development and testing.
  const simulateConnect = () => handleVehicleConnect();
  const simulateDisconnect = () => setConnectedToVehicle(false);

  return { simulateConnect, simulateDisconnect };
}
