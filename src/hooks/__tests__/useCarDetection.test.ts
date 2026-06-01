// ─────────────────────────────────────────────────────────────────────────────
// Tests for the car connect/disconnect DECISION LOGIC
// (simulateVehicleConnect / simulateVehicleDisconnect).
//
// This is where the real branching lives — back-seat vs. end-of-trip, the
// open-on-connect Pro gating, and which checklist counts as "the trip". We mock
// the *edges* (notifications, navigation, the native module, expo task/linking
// modules) and let the REAL store run, then assert which edge functions got
// called with which arguments. No device, no Bluetooth, no GPS.
// ─────────────────────────────────────────────────────────────────────────────

// ── Mock the boundaries ──────────────────────────────────────────────────────
// Notifications: assert they're *requested* without touching expo-notifications.
jest.mock('../useNotifications', () => ({
  sendTripStartNotification: jest.fn(),
  sendTripEndNotification: jest.fn(),
  sendBackSeatNotification: jest.fn(),
}));

// Navigation ref: assert programmatic navigation without a real nav tree.
jest.mock('../../navigation/navigationRef', () => ({
  navigationRef: { isReady: jest.fn(() => true), navigate: jest.fn() },
}));

// Native module: never load Kotlin / the native bridge in a unit test.
jest.mock('../../../modules/car-bluetooth', () => ({
  addConnectionListener: jest.fn(() => () => {}),
  addParkingListener: jest.fn(() => () => {}),
  getLastParking: jest.fn(async () => null),
  configure: jest.fn(async () => {}),
  captureParkingNow: jest.fn(async () => true),
}));

// Expo runtime bits touched at import time — neutralize them.
jest.mock('expo-task-manager', () => ({
  isTaskDefined: jest.fn(() => true), // skip the module-level defineTask()
  defineTask: jest.fn(),
}));
jest.mock('expo-background-fetch', () => ({
  registerTaskAsync: jest.fn(),
  unregisterTaskAsync: jest.fn(),
  BackgroundFetchResult: { NoData: 'NoData' },
}));
jest.mock('expo-linking', () => ({
  getInitialURL: jest.fn(async () => null),
  addEventListener: jest.fn(() => ({ remove: jest.fn() })),
}));

import { simulateVehicleConnect, simulateVehicleDisconnect } from '../useCarDetection';
import { useAppStore } from '../../store/useAppStore';
import {
  sendBackSeatNotification,
  sendTripEndNotification,
  sendTripStartNotification,
} from '../useNotifications';
import { navigationRef } from '../../navigation/navigationRef';
import { Checklist } from '../../types';

function makeChecklist(over: Partial<Checklist> = {}): Checklist {
  return {
    id: 'cl-test',
    name: 'Test',
    iconName: 'list-outline',
    iconBg: '#fff',
    iconColor: '#000',
    startItems: [],
    endItems: [],
    stops: [],
    isMultiStop: false,
    autoDetect: false,
    geofenceEnabled: false,
    endOfTripEnabled: false,
    createdAt: new Date().toISOString(),
    ...over,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  // Reset to a known baseline before each test.
  useAppStore.setState({
    checklists: [],
    activeRuns: [],
    lastTripChecklistId: null,
    settings: {
      ...useAppStore.getState().settings,
      pushNotifications: true,
      openChecklistOnConnect: false,
      isPro: false,
      defaultChecklistId: null,
    },
  });
});

describe('connect → which checklist is "the trip"', () => {
  it('prefers the default checklist', async () => {
    useAppStore.setState({
      checklists: [makeChecklist({ id: 'auto', autoDetect: true }), makeChecklist({ id: 'def' })],
    });
    useAppStore.setState({
      settings: { ...useAppStore.getState().settings, defaultChecklistId: 'def' },
    });

    await simulateVehicleConnect();

    expect(useAppStore.getState().lastTripChecklistId).toBe('def');
  });

  it('falls back to the first auto-detect checklist when there is no default', async () => {
    useAppStore.setState({
      checklists: [makeChecklist({ id: 'x', autoDetect: false }), makeChecklist({ id: 'auto', autoDetect: true })],
    });

    await simulateVehicleConnect();

    expect(useAppStore.getState().lastTripChecklistId).toBe('auto');
  });
});

describe('connect → open-on-connect behavior', () => {
  it('opens the default checklist when Pro + toggle on', async () => {
    useAppStore.setState({ checklists: [makeChecklist({ id: 'commute' })] });
    useAppStore.setState({
      settings: {
        ...useAppStore.getState().settings,
        isPro: true,
        openChecklistOnConnect: true,
        defaultChecklistId: 'commute',
      },
    });

    await simulateVehicleConnect();

    expect(navigationRef.navigate).toHaveBeenCalledWith('ChecklistRun', { checklistId: 'commute' });
    expect(sendTripStartNotification).not.toHaveBeenCalled();
  });

  it('opens Home when the toggle is on but the user is not Pro', async () => {
    useAppStore.setState({ checklists: [makeChecklist({ id: 'c1', autoDetect: true })] });
    useAppStore.setState({
      settings: {
        ...useAppStore.getState().settings,
        isPro: false,
        openChecklistOnConnect: true,
        defaultChecklistId: 'c1',
      },
    });

    await simulateVehicleConnect();

    expect(navigationRef.navigate).toHaveBeenCalledWith('Home', undefined);
  });

  it('only notifies (no navigation) when the toggle is off', async () => {
    useAppStore.setState({ checklists: [makeChecklist({ id: 'c1', autoDetect: true })] });

    await simulateVehicleConnect();

    expect(navigationRef.navigate).not.toHaveBeenCalled();
    expect(sendTripStartNotification).toHaveBeenCalled();
  });
});

describe('disconnect → back-seat reminder', () => {
  it('fires for the most-recent trip even with NO Pro default (the bug we fixed)', async () => {
    const cl = makeChecklist({
      id: 'school',
      name: 'School run',
      autoDetect: true,
      backSeatReminder: true,
      backSeatMessage: 'Check for the kids!',
    });
    useAppStore.setState({ checklists: [cl] }); // defaultChecklistId stays null

    await simulateVehicleConnect(); // sets the trip to 'school' (first auto-detect)
    await simulateVehicleDisconnect();

    expect(sendBackSeatNotification).toHaveBeenCalledWith('Check for the kids!', 'school');
    expect(sendTripEndNotification).not.toHaveBeenCalled();
  });

  it('falls back to the end-of-trip notification when back-seat is off', async () => {
    const cl = makeChecklist({
      id: 'c1',
      name: 'Commute',
      autoDetect: true,
      endOfTripEnabled: true,
      endItems: [{ id: 'e1', label: 'Lock car' }],
    });
    useAppStore.setState({ checklists: [cl] });

    await simulateVehicleConnect();
    await simulateVehicleDisconnect();

    expect(sendTripEndNotification).toHaveBeenCalledWith('Commute', 'c1');
    expect(sendBackSeatNotification).not.toHaveBeenCalled();
  });

  it('sends nothing when notifications are turned off', async () => {
    const cl = makeChecklist({ id: 'c1', autoDetect: true, backSeatReminder: true });
    useAppStore.setState({ checklists: [cl] });
    useAppStore.setState({
      settings: { ...useAppStore.getState().settings, pushNotifications: false },
    });

    await simulateVehicleConnect();
    await simulateVehicleDisconnect();

    expect(sendBackSeatNotification).not.toHaveBeenCalled();
    expect(sendTripEndNotification).not.toHaveBeenCalled();
  });
});
