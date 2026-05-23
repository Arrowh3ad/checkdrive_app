// ─────────────────────────────────────────────────────────────────────────────
// store/useAppStore.ts  —  Global state management via Zustand.
//
// This is the single source of truth for all app data. Any component can call
// `useAppStore()` to read or mutate state; the hook is a thin Zustand selector
// that triggers a re-render only when the slice of state it reads changes.
//
// ARCHITECTURE
// ┌─────────────────────────────────────────────────────────────────────────┐
// │  Zustand store (in-memory)                                              │
// │   ├─ checklists[]       persisted → AsyncStorage                       │
// │   ├─ tripLogs[]         persisted → AsyncStorage                       │
// │   ├─ settings           persisted → AsyncStorage                       │
// │   ├─ connectedToVehicle persisted → AsyncStorage                       │
// │   └─ activeMultiStopTrip  NOT persisted (resets on every app launch)   │
// └─────────────────────────────────────────────────────────────────────────┘
//
// WHY ZUSTAND?
// Redux would require actions/reducers/selectors boilerplate. React Context
// re-renders every consumer on every change. Zustand gives us a simple `set()`
// API, granular re-renders via selectors, and first-class persist middleware —
// all with zero extra packages beyond Zustand itself.
// ─────────────────────────────────────────────────────────────────────────────

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Checklist, TripLog, Settings } from '../types';
import { generateId } from '../utils/ids';

// ── Demo / seed data ──────────────────────────────────────────────────────────
// Shown on first launch so the app doesn't open to an empty state.
// These are hard-coded templates; users can delete or edit them freely.

const defaultChecklists: Checklist[] = [
  {
    id: 'cl-default-1',
    name: 'Daily commute',
    iconName: 'briefcase-outline',
    iconBg: '#E1F5EE',
    iconColor: '#0F6E56',
    startItems: [
      { id: 'si-1', label: 'Wallet & ID' },
      { id: 'si-2', label: 'Phone & charger' },
      { id: 'si-3', label: 'Laptop bag' },
      { id: 'si-4', label: 'House keys' },
      { id: 'si-5', label: 'Coffee (important!)' },
      { id: 'si-6', label: 'Lock front door' },
    ],
    endItems: [
      { id: 'ei-1', label: 'Grab laptop from car' },
      { id: 'ei-2', label: 'Turn off headlights' },
      { id: 'ei-3', label: 'Lock car' },
      { id: 'ei-4', label: 'Note any damages' },
    ],
    stops: [],
    isMultiStop: false,
    autoDetect: true,
    geofenceEnabled: false,
    endOfTripEnabled: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'cl-default-2',
    name: 'Weekend road trip',
    iconName: 'location-outline',
    iconBg: '#EEEDFE',
    iconColor: '#534AB7',
    startItems: [],
    endItems: [],
    stops: [
      {
        id: 'stop-1',
        name: 'Home — depart',
        subtitle: '6 items checked · 7:30am',
        items: [
          { id: 'sp1-1', label: 'Luggage packed' },
          { id: 'sp1-2', label: 'Snacks & drinks' },
          { id: 'sp1-3', label: 'Phone charger' },
          { id: 'sp1-4', label: 'Sunscreen' },
          { id: 'sp1-5', label: 'Maps downloaded' },
          { id: 'sp1-6', label: 'House secured' },
        ],
        status: 'done',
        // Pre-marking all items so the demo shows a completed first stop.
        checkedItems: ['sp1-1', 'sp1-2', 'sp1-3', 'sp1-4', 'sp1-5', 'sp1-6'],
        completedAt: new Date().toISOString(),
      },
      {
        id: 'stop-2',
        name: 'Rest stop — Gas & snacks',
        subtitle: '3 items · tap to check off',
        items: [
          { id: 'sp2-1', label: 'Fill gas tank' },
          { id: 'sp2-2', label: 'Grab snacks & water' },
          { id: 'sp2-3', label: 'Bathroom break (kids!)' },
        ],
        status: 'current',
        checkedItems: ['sp2-1'], // one item pre-checked for the demo
      },
      {
        id: 'stop-3',
        name: 'Beach house — arrive',
        subtitle: '4 items on arrival',
        items: [
          { id: 'sp3-1', label: 'Check in / get keys' },
          { id: 'sp3-2', label: 'Unpack car' },
          { id: 'sp3-3', label: 'Check house condition' },
          { id: 'sp3-4', label: 'Set up for night' },
        ],
        status: 'upcoming',
        checkedItems: [],
      },
    ],
    isMultiStop: true,
    autoDetect: false,
    geofenceEnabled: false,
    endOfTripEnabled: false,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'cl-default-3',
    name: 'School run',
    iconName: 'people-outline',
    iconBg: '#FAEEDA',
    iconColor: '#854F0B',
    startItems: [
      { id: 'sch-1', label: 'School bag' },
      { id: 'sch-2', label: 'Lunchbox' },
      { id: 'sch-3', label: 'Permission slips' },
      { id: 'sch-4', label: 'Sports kit' },
    ],
    endItems: [
      { id: 'sche-1', label: 'Pick up kids' },
      { id: 'sche-2', label: 'Sign out form' },
    ],
    stops: [],
    isMultiStop: false,
    autoDetect: true,
    geofenceEnabled: false,
    endOfTripEnabled: false,
    createdAt: new Date().toISOString(),
  },
];

// Pre-populated trip history so the HomeScreen stats aren't all zeros on first run.
const defaultTripLogs: TripLog[] = [
  {
    id: 'log-1',
    checklistId: 'cl-default-1',
    checklistName: 'Daily commute',
    checkedCount: 6,
    totalCount: 6,
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    isComplete: true,
  },
  {
    id: 'log-2',
    checklistId: 'cl-default-3',
    checklistName: 'School run',
    checkedCount: 3,
    totalCount: 4,
    timestamp: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString(),
    isComplete: false,
  },
  {
    id: 'log-3',
    checklistId: 'cl-default-1',
    checklistName: 'Daily commute',
    checkedCount: 6,
    totalCount: 6,
    timestamp: new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString(),
    isComplete: true,
  },
];

// ── Store interface ───────────────────────────────────────────────────────────
// Declaring the interface separately (instead of inferring it from `create`)
// makes the type available for import and keeps the create() call concise.

interface AppStore {
  // ── State ──────────────────────────────────────────────────────────────────
  checklists: Checklist[];
  tripLogs: TripLog[];
  settings: Settings;
  connectedToVehicle: boolean;

  // Tracks the in-progress multi-stop trip that the app is currently running.
  // This is intentionally NOT persisted so a stale trip from a previous session
  // never reappears on cold start (see `partialize` below).
  activeMultiStopTrip: { checklistId: string; stopIndex: number } | null;

  // ── Actions ────────────────────────────────────────────────────────────────
  addChecklist: (data: Omit<Checklist, 'id' | 'createdAt'>) => void;
  updateChecklist: (id: string, data: Partial<Checklist>) => void;
  deleteChecklist: (id: string) => void;
  addTripLog: (log: Omit<TripLog, 'id'>) => void;
  updateSettings: (data: Partial<Settings>) => void;
  setConnectedToVehicle: (connected: boolean) => void;

  // Sets or clears the default checklist (Pro feature). Pass null to clear.
  setDefaultChecklist: (id: string | null) => void;

  // Multi-stop trip lifecycle:
  //   startMultiStopTrip   → called by MultiStopScreen on mount
  //   advanceMultiStopStop → called when CarPlay fires again mid-trip, or the
  //                          user taps "Continue to next stop"
  //   rewindMultiStopStop  → called when the user taps "Undo last advance"
  //   endMultiStopTrip     → called on trip completion or MultiStopScreen unmount
  startMultiStopTrip: (checklistId: string, stopIndex: number) => void;
  advanceMultiStopStop: () => void;
  rewindMultiStopStop: () => void;
  endMultiStopTrip: () => void;

  // Called when the user cancels their Pro subscription. Trims checklists to 3
  // and clears any Pro-only state.
  downgradeFromPro: () => void;
}

// ── Store factory ─────────────────────────────────────────────────────────────
// `persist(...)` wraps the store with Zustand's persist middleware, which
// serialises state to JSON and writes it to AsyncStorage after every `set()`
// call. On the next app launch, the middleware rehydrates from AsyncStorage
// before the first render.

export const useAppStore = create<AppStore>()(
  persist(
    (set) => ({
      // Initial state — overwritten by persisted data after the first launch.
      checklists: defaultChecklists,
      tripLogs: defaultTripLogs,
      settings: {
        pushNotifications: true,
        bluetoothAutoDetect: true,
        tripStreaks: false,
        isPro: false,
        currentStreak: 5,
        totalTrips: 47,
        defaultChecklistId: null,
      },
      connectedToVehicle: true,
      activeMultiStopTrip: null,

      // ── Checklist actions ────────────────────────────────────────────────
      addChecklist: (data) =>
        set((state) => ({
          checklists: [
            ...state.checklists,
            // Generate id and createdAt here so callers don't have to supply them.
            { ...data, id: generateId(), createdAt: new Date().toISOString() },
          ],
        })),

      updateChecklist: (id, data) =>
        set((state) => ({
          // Map over checklists, replacing only the one with the matching id.
          checklists: state.checklists.map((cl) =>
            cl.id === id ? { ...cl, ...data } : cl
          ),
        })),

      deleteChecklist: (id) =>
        set((state) => ({
          checklists: state.checklists.filter((cl) => cl.id !== id),
          // If the deleted checklist was the default, clear that setting too
          // so the user isn't left with a dangling reference.
          settings:
            state.settings.defaultChecklistId === id
              ? { ...state.settings, defaultChecklistId: null }
              : state.settings,
        })),

      // ── Trip log actions ─────────────────────────────────────────────────
      addTripLog: (log) =>
        set((state) => ({
          // Prepend the new log and cap the list at 50 entries to bound storage.
          tripLogs: [{ ...log, id: generateId() }, ...state.tripLogs.slice(0, 49)],
          // Bump the total-trips counter so the Settings stats stay accurate.
          settings: { ...state.settings, totalTrips: state.settings.totalTrips + 1 },
        })),

      // ── Settings actions ─────────────────────────────────────────────────
      updateSettings: (data) =>
        set((state) => ({ settings: { ...state.settings, ...data } })),

      setConnectedToVehicle: (connected) => set({ connectedToVehicle: connected }),

      setDefaultChecklist: (id) =>
        set((state) => ({
          settings: { ...state.settings, defaultChecklistId: id },
        })),

      // ── Multi-stop trip actions ───────────────────────────────────────────
      startMultiStopTrip: (checklistId, stopIndex) =>
        set({ activeMultiStopTrip: { checklistId, stopIndex } }),

      advanceMultiStopStop: () =>
        set((state) => ({
          // Guard: if activeMultiStopTrip is null (shouldn't happen in practice),
          // keep it null rather than incrementing into undefined state.
          activeMultiStopTrip: state.activeMultiStopTrip
            ? {
                ...state.activeMultiStopTrip,
                stopIndex: state.activeMultiStopTrip.stopIndex + 1,
              }
            : null,
        })),

      endMultiStopTrip: () => set({ activeMultiStopTrip: null }),

      rewindMultiStopStop: () =>
        set((state) => ({
          activeMultiStopTrip:
            state.activeMultiStopTrip && state.activeMultiStopTrip.stopIndex > 0
              ? { ...state.activeMultiStopTrip, stopIndex: state.activeMultiStopTrip.stopIndex - 1 }
              : state.activeMultiStopTrip,
        })),

      // ── Pro downgrade ────────────────────────────────────────────────────
      downgradeFromPro: () =>
        set((state) => ({
          settings: {
            ...state.settings,
            isPro: false,
            // Always clear the default on downgrade — it was a Pro-only feature.
            defaultChecklistId: null,
          },
          // Truncate to 3 checklists (free plan limit).
          checklists: state.checklists.slice(0, 3),
          // Cancel any in-progress multi-stop trip.
          activeMultiStopTrip: null,
        })),
    }),

    // ── Persist configuration ────────────────────────────────────────────────
    {
      name: 'checkdrive-storage', // AsyncStorage key
      storage: createJSONStorage(() => AsyncStorage),

      // `partialize` controls which slices of state get written to disk.
      // `activeMultiStopTrip` is deliberately excluded: a trip in progress
      // should always reset to null on a fresh app launch so stale trip state
      // never confuses the user.
      partialize: (state) => ({
        checklists: state.checklists,
        tripLogs: state.tripLogs,
        settings: state.settings,
        connectedToVehicle: state.connectedToVehicle,
      }),
    }
  )
);
