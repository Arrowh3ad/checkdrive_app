/**
 * Car detection strategy:
 *
 * iOS: Apple does not allow detecting CarPlay without an entitlement reserved for Navigation,
 * Audio, and a few other approved categories. The practical workaround is Siri Shortcuts:
 * the user creates an automation "When CarPlay Connects → Open URL checkdrive://trigger".
 * This hook handles the incoming URL and fires the checklist prompt.
 *
 * Android: Android is more permissive. Full detection uses UiModeManager.getCurrentModeType()
 * (returns UI_MODE_TYPE_CAR=3) or a Bluetooth BroadcastReceiver, but both require native
 * modules outside Expo managed workflow. In this managed build we handle the same URL
 * scheme (automatable via Tasker, MacroDroid, or Google Assistant Routines) and provide a
 * background fetch task as a time-based fallback.
 *
 * For full Bluetooth/UiMode detection: eject to bare workflow and add
 * react-native-bluetooth-classic (Android BT receiver) or a custom Expo Module that wraps
 * android.app.UiModeManager.
 */

import { useEffect, useCallback } from 'react';
import * as Linking from 'expo-linking';
import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import { useAppStore } from '../store/useAppStore';
import { sendTripStartNotification } from './useNotifications';

const BG_TASK = 'checkdrive-bg-check';

// Register the background task outside of any component (module scope)
if (!TaskManager.isTaskDefined(BG_TASK)) {
  TaskManager.defineTask(BG_TASK, async () => {
    // In a real bare-workflow build this would call into UiModeManager.
    // Here we return NoData so the OS keeps the task registered without doing harm.
    return BackgroundFetch.BackgroundFetchResult.NoData;
  });
}

export function useCarDetection() {
  const { setConnectedToVehicle, checklists, settings } = useAppStore();

  const handleVehicleConnect = useCallback(async () => {
    setConnectedToVehicle(true);
    if (settings.pushNotifications) {
      const autoChecklist = checklists.find((cl) => cl.autoDetect);
      await sendTripStartNotification(autoChecklist?.name ?? 'your checklist');
    }
  }, [setConnectedToVehicle, checklists, settings.pushNotifications]);

  // Handle deep-link trigger — works for both iOS Siri Shortcuts and Android automation apps
  useEffect(() => {
    Linking.getInitialURL().then((url) => {
      if (url?.includes('trigger')) handleVehicleConnect();
    });

    const sub = Linking.addEventListener('url', ({ url }) => {
      if (url?.includes('trigger')) handleVehicleConnect();
    });

    return () => sub.remove();
  }, [handleVehicleConnect]);

  // Register background fetch (keeps the task slot alive; does nothing in managed workflow
  // but is ready to be wired to native UiMode checks after ejecting).
  useEffect(() => {
    BackgroundFetch.registerTaskAsync(BG_TASK, {
      minimumInterval: 15 * 60,
      stopOnTerminate: false,
      startOnBoot: true,
    }).catch(() => {
      // Background fetch not supported on this platform / simulator — ignore
    });
    return () => {
      BackgroundFetch.unregisterTaskAsync(BG_TASK).catch(() => {});
    };
  }, []);

  const simulateConnect = () => handleVehicleConnect();
  const simulateDisconnect = () => setConnectedToVehicle(false);

  return { simulateConnect, simulateDisconnect };
}
