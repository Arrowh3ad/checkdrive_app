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
// Two separate Shortcuts objects are needed for BOTH connect and disconnect:
//
//   Shortcut "Start CheckDrive":  URL → checkdrive://trigger    → Open URLs
//   Shortcut "Stop CheckDrive":   URL → checkdrive://disconnect → Open URLs
//
//   Automation "When CarPlay Connects":    Run Shortcut → "Start CheckDrive"
//   Automation "When CarPlay Disconnects": Run Shortcut → "Stop CheckDrive"
//   (Both automations: disable "Ask Before Running")
//
// ANDROID APPROACH
// Android is more permissive. Full detection could use UiModeManager
// (returns UI_MODE_TYPE_CAR=3) or a Bluetooth BroadcastReceiver, but both
// require native modules outside the Expo managed workflow. Here we handle
// the same URL schemes, automatable via Google Assistant Routines, Tasker,
// or MacroDroid. For a bare-workflow build, add react-native-bluetooth-classic.
//
// WHY STANDALONE EXPORTED FUNCTIONS?
// `simulateVehicleConnect` and `simulateVehicleDisconnect` are exported so
// CarDetectionSetupScreen can call them from its test buttons WITHOUT calling
// the hook a second time. Calling the hook twice would register duplicate
// Linking listeners (both would fire on the same URL, causing double
// notifications). The standalone functions use `useAppStore.getState()` —
// Zustand's outside-React accessor — so they always read current state without
// needing to be inside a component.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import * as Linking from 'expo-linking';
import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import { useAppStore } from '../store/useAppStore';
import { sendTripStartNotification, sendTripEndNotification } from './useNotifications';

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

// ── Standalone simulation functions ──────────────────────────────────────────
// These contain the full connect/disconnect logic and can be called from
// anywhere — inside the hook OR from CarDetectionSetupScreen's test buttons.
// `useAppStore.getState()` reads the latest store snapshot synchronously
// without subscribing to re-renders, so calling this outside React is safe.

export async function simulateVehicleConnect(): Promise<void> {
  const {
    setConnectedToVehicle,
    checklists,
    settings,
    activeRuns,
    advanceActiveRunStop,
  } = useAppStore.getState();

  setConnectedToVehicle(true);

  // MULTI-STOP INTERCEPT
  // If a multi-stop trip is already in progress when CarPlay fires again (e.g.
  // the user reconnected after a rest stop), offer to advance to the next
  // stop instead of firing the notification flow.
  const activeRun = activeRuns.find((r) => r.isMultiStop);
  if (activeRun) {
    const tripChecklist = checklists.find((cl) => cl.id === activeRun.checklistId);
    const nextStop = tripChecklist?.stops[activeRun.stopIndex + 1];
    if (nextStop) {
      Alert.alert(
        'Arrived at next stop?',
        `Continue to: "${nextStop.name}"`,
        [
          { text: 'Not yet', style: 'cancel' },
          { text: 'Continue', onPress: () => advanceActiveRunStop(activeRun.checklistId) },
        ]
      );
    }
    return; // don't fall through to the notification path
  }

  // NOTIFICATION FLOW
  // Push a notification so the user can tap to open the checklist, even if
  // they're not looking at the phone when CarPlay connects.
  if (settings.pushNotifications) {
    // Only embed a specific checklist when the user has explicitly chosen a
    // default. Without a default the notification tap lands on HomeScreen
    // so the user can pick for themselves.
    const defaultCl = checklists.find((cl) => cl.id === settings.defaultChecklistId);
    await sendTripStartNotification(
      defaultCl?.name,
      defaultCl?.id,
      defaultCl?.isMultiStop
    );
  }
}

export async function simulateVehicleDisconnect(): Promise<void> {
  const {
    setConnectedToVehicle,
    checklists,
    settings,
  } = useAppStore.getState();

  setConnectedToVehicle(false);

  if (!settings.pushNotifications) return;

  // Only send a reminder if there's a default checklist with end-of-trip
  // items — otherwise the notification has no useful destination.
  const defaultCl = checklists.find((cl) => cl.id === settings.defaultChecklistId);
  if (defaultCl?.endOfTripEnabled && defaultCl.endItems.length > 0) {
    await sendTripEndNotification(defaultCl.name, defaultCl.id);
  } else if (!defaultCl) {
    // No default set — send a generic reminder that lands on HomeScreen.
    await sendTripEndNotification();
  }
}

// ── Hook ─────────────────────────────────────────────────────────────────────
// Used in HomeScreen to wire up the Linking listener for the whole session.
// The hook delegates to the standalone functions above, so the `useCallback`
// deps arrays are empty — reading via `getState()` never closes over stale
// state, meaning the function identity is stable across renders and the
// Linking effect below only registers once.

export function useCarDetection() {
  const handleVehicleConnect = useCallback(async () => {
    await simulateVehicleConnect();
  }, []);

  // ── Disconnect handler ────────────────────────────────────────────────────
  // Called when the `checkdrive://disconnect` deep link fires (from a
  // "CarPlay disconnects" Shortcuts automation) or via simulateDisconnect.
  const handleVehicleDisconnect = useCallback(async () => {
    await simulateVehicleDisconnect();
  }, []);

  // ── Deep-link listener ────────────────────────────────────────────────────
  // `getInitialURL()` handles the cold-start case: the app was launched by
  // tapping the deep link from a completely closed state, so there's no
  // 'url' event — only the initial URL value from the launcher.
  // `addEventListener('url', …)` handles the warm-start / foreground case:
  // the app was already running when the Shortcuts automation fired.
  useEffect(() => {
    Linking.getInitialURL().then((url) => {
      if (url?.includes('trigger'))    handleVehicleConnect();
      if (url?.includes('disconnect')) handleVehicleDisconnect();
    });

    const sub = Linking.addEventListener('url', ({ url }) => {
      if (url?.includes('trigger'))    handleVehicleConnect();
      if (url?.includes('disconnect')) handleVehicleDisconnect();
    });

    // Clean up the listener when the component that uses this hook unmounts.
    return () => sub.remove();
  }, [handleVehicleConnect, handleVehicleDisconnect]);

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

  // Exposed so HomeScreen's Simulate button can trigger the same flow
  // without actually connecting a car — useful during development and testing.
  return {
    simulateConnect:    simulateVehicleConnect,
    simulateDisconnect: simulateVehicleDisconnect,
  };
}
