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
import { useAppStore } from '../store/useAppStore';
import {
  sendTripStartNotification,
  sendTripEndNotification,
  sendBackSeatNotification,
} from './useNotifications';
import { navigationRef } from '../navigation/navigationRef';
import * as CarBluetooth from '../../modules/car-bluetooth';

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
    setLastTripChecklist,
  } = useAppStore.getState();

  setConnectedToVehicle(true);

  // Mark the checklist this trip is "running" so a later disconnect can fire the
  // right back-seat reminder. Prefer the user's default, falling back to the
  // first checklist when none is set.
  const tripChecklist =
    checklists.find((cl) => cl.id === settings.defaultChecklistId) ??
    checklists[0];
  if (tripChecklist) setLastTripChecklist(tripChecklist.id);

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

  // Only embed/open a specific checklist when the user has explicitly chosen a
  // default. Without a default we fall back to the notification path, whose tap
  // lands on HomeScreen so the user can pick for themselves.
  const defaultCl = checklists.find((cl) => cl.id === settings.defaultChecklistId);

  // OPEN-ON-CONNECT OPTION (Pro-only)
  // When a Pro user has turned on "Open my checklist on connect", navigate
  // straight into their checklist instead of posting a notification:
  //   • default checklist set → jump straight into that checklist.
  //   • no default set → land on Home, so they can pick.
  // This is Pro-only: free users always fall through to the notification path
  // below, which posts an actionable "tap to run your checklist" reminder (a
  // better experience than silently landing on Home). The settings toggle is
  // also hidden for free users, but we gate on isPro here too so a stale flag
  // (e.g. from a lapsed Pro account) can't trigger this path.
  // The app is already foregrounded here — the checkdrive:// deep link brought
  // it up — so the navigate lands immediately. We guard on `isReady()` for the
  // cold-start race (deep link launches the app before the nav tree mounts);
  // if it's not ready we fall through to the notification, which has its own
  // cold-start handling in App.tsx.
  if (settings.openChecklistOnConnect && settings.isPro && navigationRef.isReady()) {
    if (defaultCl) {
      if (defaultCl.isMultiStop) {
        navigationRef.navigate('MultiStop', { checklistId: defaultCl.id });
      } else {
        navigationRef.navigate('ChecklistRun', { checklistId: defaultCl.id });
      }
    } else {
      navigationRef.navigate('Home', undefined);
    }
    return; // opened the app directly — skip the notification
  }

  // NOTIFICATION FLOW (default)
  // Post a notification so the user can tap to open the checklist when ready,
  // rather than the app taking over the moment the car connects.
  if (settings.pushNotifications) {
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
    lastTripChecklistId,
  } = useAppStore.getState();

  setConnectedToVehicle(false);

  if (!settings.pushNotifications) return;

  // Use the checklist for the trip that just ended (set on connect / run start),
  // falling back to the default only if we have no trip context at all.
  const tripCl =
    checklists.find((cl) => cl.id === lastTripChecklistId) ??
    checklists.find((cl) => cl.id === settings.defaultChecklistId);

  // BACK-SEAT REMINDER takes priority — it's the safety alert. Fires for the
  // active trip's checklist, no Pro default required. (When the app is dead, the
  // native module posts the equivalent notification using the synced config.)
  if (tripCl?.backSeatReminder) {
    await sendBackSeatNotification(tripCl.backSeatMessage, tripCl.id);
    return;
  }

  // Multi-stop trips have no end-of-trip tab and empty endItems, so they'd
  // otherwise fall through with no reminder at all. Deep-link into the stop list
  // instead so the user can finish/review on arrival.
  if (tripCl?.isMultiStop) {
    await sendTripEndNotification(tripCl.name, tripCl.id, true);
    return;
  }

  // Regular trips: only remind if there are arrival items to do — otherwise the
  // notification has no useful destination.
  if (tripCl?.endOfTripEnabled && tripCl.endItems.length > 0) {
    await sendTripEndNotification(tripCl.name, tripCl.id);
  } else if (!tripCl) {
    // No trip context — send a generic reminder that lands on HomeScreen.
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
    // Master switch: when "Bluetooth auto-detect" is off, ignore real car
    // events. The manual "Test connect" buttons call simulateVehicleConnect
    // directly, so they still work regardless of this setting.
    if (!useAppStore.getState().settings.bluetoothAutoDetect) return;
    await simulateVehicleConnect();
  }, []);

  // ── Disconnect handler ────────────────────────────────────────────────────
  // Called when the `checkdrive://disconnect` deep link fires (from a
  // "CarPlay disconnects" Shortcuts automation) or via simulateDisconnect.
  const handleVehicleDisconnect = useCallback(async () => {
    if (!useAppStore.getState().settings.bluetoothAutoDetect) return;
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

  // ── Native car-Bluetooth listener (Android) ───────────────────────────────
  // The car-bluetooth module fires these events when the user's associated car
  // connects/disconnects while the app is running. (When the app is dead, the
  // native receiver posts a deep-link notification instead, which routes back
  // through the Linking handler above on launch.) On iOS/web addConnectionListener
  // is a no-op, so this effect is harmless there.
  useEffect(() => {
    const unsubscribe = CarBluetooth.addConnectionListener(
      () => { void handleVehicleConnect(); },
      () => { void handleVehicleDisconnect(); }
    );
    return unsubscribe;
  }, [handleVehicleConnect, handleVehicleDisconnect]);

  // ── Native config sync (Android) ──────────────────────────────────────────
  // Push the back-seat settings down to SharedPreferences so the native
  // receiver posts the right disconnect notification even when JS isn't running.
  // Keyed off the current trip's checklist, mirroring the disconnect logic.
  const checklists = useAppStore((s) => s.checklists);
  const lastTripChecklistId = useAppStore((s) => s.lastTripChecklistId);
  const tripForBackSeat = checklists.find((c) => c.id === lastTripChecklistId);
  const backSeatEnabled = tripForBackSeat?.backSeatReminder ?? false;
  const backSeatMessage = tripForBackSeat?.backSeatMessage ?? null;
  useEffect(() => {
    void CarBluetooth.configure({ backSeatEnabled, backSeatMessage });
  }, [backSeatEnabled, backSeatMessage]);

  // Exposed so HomeScreen's Simulate button can trigger the same flow
  // without actually connecting a car — useful during development and testing.
  return {
    simulateConnect:    simulateVehicleConnect,
    simulateDisconnect: simulateVehicleDisconnect,
  };
}
