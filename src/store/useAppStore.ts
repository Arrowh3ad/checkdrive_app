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
// │   └─ activeRuns         persisted → AsyncStorage (resume in-progress)  │
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
import { Checklist, TripLog, Settings, StopStatus, ActiveRun } from '../types';
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
    geofenceEnabled: false,
    endOfTripEnabled: true,
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
    geofenceEnabled: false,
    // Two-phase like Daily commute: start (drop-off) + end (arrival) items, so
    // the end-of-trip tab actually shows the 2 arrival items.
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
        subtitle: '6 items',
        items: [
          { id: 'sp1-1', label: 'Luggage packed' },
          { id: 'sp1-2', label: 'Snacks & drinks' },
          { id: 'sp1-3', label: 'Phone charger' },
          { id: 'sp1-4', label: 'Sunscreen' },
          { id: 'sp1-5', label: 'Maps downloaded' },
          { id: 'sp1-6', label: 'House secured' },
        ],
        status: 'current',
        checkedItems: [],
      },
      {
        id: 'stop-2',
        name: 'Rest stop — Gas & snacks',
        subtitle: '3 items',
        items: [
          { id: 'sp2-1', label: 'Fill gas tank' },
          { id: 'sp2-2', label: 'Grab snacks & water' },
          { id: 'sp2-3', label: 'Bathroom break (kids!)' },
        ],
        status: 'upcoming',
        checkedItems: [],
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
    geofenceEnabled: false,
    endOfTripEnabled: false,
    createdAt: new Date().toISOString(),
  },
];

// Release builds start with a clean trip history — no seeded example trips, so
// the HomeScreen stats reflect only the user's real trips from day one.
const defaultTripLogs: TripLog[] = [];

// ── Store interface ───────────────────────────────────────────────────────────
// Declaring the interface separately (instead of inferring it from `create`)
// makes the type available for import and keeps the create() call concise.

interface AppStore {
  // ── State ──────────────────────────────────────────────────────────────────
  checklists: Checklist[];
  tripLogs: TripLog[];
  settings: Settings;
  connectedToVehicle: boolean;

  // In-progress checklist runs (both regular and multi-stop). Persisted so the
  // user can navigate away and resume later, and so the Home screen can show a
  // "continue where you left off" banner. At most one entry per checklistId.
  activeRuns: ActiveRun[];

  // The checklist tied to the current/most-recent trip — set when the car
  // connects (to the would-run checklist) and when a run is started. The
  // back-seat reminder keys off THIS on disconnect, so it works for any trip
  // without needing a Pro "default checklist". null until the first trip.
  lastTripChecklistId: string | null;

  // ── Actions ────────────────────────────────────────────────────────────────
  // `Omit<Checklist, 'id' | 'createdAt'>` is a TypeScript built-in that produces
  // a copy of the Checklist type with those two keys removed — callers don't
  // supply them because the action generates them internally.
  addChecklist: (data: Omit<Checklist, 'id' | 'createdAt'>) => void;
  // `Partial<Checklist>` makes every field optional — callers only pass the
  // fields they want to change; everything else is left as-is via the spread.
  updateChecklist: (id: string, data: Partial<Checklist>) => void;
  deleteChecklist: (id: string) => void;
  // Pro: creates a deep copy of an existing checklist with fresh IDs and
  // "Copy of …" prefix. Appended to the end of the checklist list.
  duplicateChecklist: (id: string) => void;
  addTripLog: (log: Omit<TripLog, 'id'>) => void;
  // Pro: removes specific trip log entries by ID (multi-select delete).
  deleteTripLogs: (ids: string[]) => void;
  updateSettings: (data: Partial<Settings>) => void;
  setConnectedToVehicle: (connected: boolean) => void;

  // Sets or clears the default checklist (Pro feature). Pass null to clear.
  setDefaultChecklist: (id: string | null) => void;

  // Active-run lifecycle (regular + multi-stop):
  //   saveActiveRun        → upsert (create or replace) a run by checklistId.
  //                          Called by the run screens on every change so
  //                          progress is auto-saved.
  //   clearActiveRun       → remove a run (on completion, or when the user
  //                          discards it from the Home banner).
  //   advanceActiveRunStop → multi-stop only: bump the run's stopIndex. Called
  //                          by useCarDetection when CarPlay reconnects mid-trip.
  saveActiveRun: (run: ActiveRun) => void;
  clearActiveRun: (checklistId: string) => void;
  advanceActiveRunStop: (checklistId: string) => void;

  // Records the checklist for the current trip (see lastTripChecklistId).
  setLastTripChecklist: (id: string | null) => void;

  // Called when the user cancels their Pro subscription. Trims checklists to 3
  // and clears any Pro-only state.
  downgradeFromPro: () => void;
}

// ── Store factory ─────────────────────────────────────────────────────────────
// `persist(...)` wraps the store with Zustand's persist middleware, which
// serializes state to JSON and writes it to AsyncStorage after every `set()`
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
        // Owned by the purchases layer now: initPurchases() writes this from the
        // live RevenueCat entitlement on launch. Defaults false (free tier);
        // flips true when the user owns the lifetime Pro unlock.
        isPro: false,
        totalTrips: 0,
        // Seed the default to the first checklist (Daily commute) so a fresh
        // install already has a sensible car checklist tied to connect/disconnect.
        defaultChecklistId: 'cl-default-1',
        openChecklistOnConnect: false,
      },
      // Fresh installs are not connected until a real ACL event fires. (Was
      // seeded `true` for demos, which both mis-showed "connected" on the Home
      // banner and suppressed ads on first launch via the adsEnabled() gate.)
      connectedToVehicle: false,
      activeRuns: [],
      lastTripChecklistId: null,

      // ── Checklist actions ────────────────────────────────────────────────
      addChecklist: (data) =>
        set((state) => {
          // Generate id and createdAt here so callers don't have to supply them.
          const created = { ...data, id: generateId(), createdAt: new Date().toISOString() };
          return { checklists: [...state.checklists, created] };
        }),

      updateChecklist: (id, data) =>
        set((state) => ({
          checklists: state.checklists.map((cl) => (cl.id === id ? { ...cl, ...data } : cl)),
        })),

      deleteChecklist: (id) =>
        set((state) => ({
          checklists: state.checklists.filter((cl) => cl.id !== id),
          // Drop any in-progress run for the deleted checklist so a dangling
          // run can't linger on the Home banner.
          activeRuns: state.activeRuns.filter((r) => r.checklistId !== id),
          // If the deleted checklist was the default, clear that setting too
          // so the user isn't left with a dangling reference.
          settings:
            state.settings.defaultChecklistId === id
              ? { ...state.settings, defaultChecklistId: null }
              : state.settings,
        })),

      duplicateChecklist: (id) =>
        set((state) => {
          const original = state.checklists.find((cl) => cl.id === id);
          if (!original) return {};
          return {
            checklists: [
              ...state.checklists,
              {
                ...original,
                id: generateId(),
                name: `Copy of ${original.name}`,
                createdAt: new Date().toISOString(),
                // Regenerate IDs for all items and stops so there are no
                // duplicate IDs in the store (which are used as React keys
                // and checked-state map keys).
                startItems: original.startItems.map((item) => ({ ...item, id: generateId() })),
                endItems:   original.endItems.map((item) => ({ ...item, id: generateId() })),
                stops: original.stops.map((stop, idx) => ({
                  ...stop,
                  id: generateId(),
                  items: stop.items.map((item) => ({ ...item, id: generateId() })),
                  // Reset run-time state: no pre-checked items, first stop is current.
                  checkedItems: [],
                  completedAt: undefined,
                  status: (idx === 0 ? 'current' : 'upcoming') as StopStatus,
                })),
              },
            ],
          };
        }),

      // ── Trip log actions ─────────────────────────────────────────────────
      addTripLog: (log) =>
        set((state) => {
          // Trip history is free for everyone — local-only data, so a generous
          // cap costs nothing. (Just bounds storage so it can't grow forever.)
          const cap = 500;
          return {
            tripLogs: [{ ...log, id: generateId() }, ...state.tripLogs.slice(0, cap - 1)],
            // Bump the total-trips counter so the Settings stats stay accurate.
            settings: { ...state.settings, totalTrips: state.settings.totalTrips + 1 },
          };
        }),

      deleteTripLogs: (ids) =>
        set((state) => ({
          tripLogs: state.tripLogs.filter((log) => !ids.includes(log.id)),
        })),

      // ── Settings actions ─────────────────────────────────────────────────
      updateSettings: (data) =>
        set((state) => ({ settings: { ...state.settings, ...data } })),

      setConnectedToVehicle: (connected) => set({ connectedToVehicle: connected }),

      setDefaultChecklist: (id) =>
        set((state) => ({
          settings: { ...state.settings, defaultChecklistId: id },
        })),

      // ── Active-run actions ─────────────────────────────────────────────────
      saveActiveRun: (run) =>
        set((state) => {
          // Upsert: replace the existing run for this checklist, or append a
          // new one. Filtering then appending keeps the array to one entry
          // per checklistId without needing a findIndex/splice dance.
          const others = state.activeRuns.filter((r) => r.checklistId !== run.checklistId);
          // Starting/touching a run also marks it as the current trip, so the
          // back-seat reminder on disconnect uses the right checklist.
          return { activeRuns: [...others, run], lastTripChecklistId: run.checklistId };
        }),

      clearActiveRun: (checklistId) =>
        set((state) => ({
          activeRuns: state.activeRuns.filter((r) => r.checklistId !== checklistId),
        })),

      advanceActiveRunStop: (checklistId) =>
        set((state) => ({
          activeRuns: state.activeRuns.map((r) =>
            // Only bump multi-stop runs for the matching checklist. The screen
            // is subscribed to activeRuns, so it re-renders onto the new stop.
            r.checklistId === checklistId && r.isMultiStop
              ? { ...r, stopIndex: r.stopIndex + 1, updatedAt: new Date().toISOString() }
              : r
          ),
        })),

      setLastTripChecklist: (id) => set({ lastTripChecklistId: id }),

      // ── Pro downgrade ────────────────────────────────────────────────────
      // Only flips the flag — it never deletes checklists or runs. We never
      // destroy data a user created (the free cap only gates *new* creation),
      // so a lapse/refund just re-enables ads and the creation limit. Currently
      // unused in-app (lifetime Pro doesn't lapse); kept for future subscription
      // support and exercised by tests.
      downgradeFromPro: () =>
        set((state) => ({
          settings: { ...state.settings, isPro: false },
        })),
    }),

    // ── Persist configuration ────────────────────────────────────────────────
    {
      name: 'checkdrive-storage', // AsyncStorage key
      storage: createJSONStorage(() => AsyncStorage),

      // Bumped to 1 for the autoDetect → defaultChecklistId consolidation. The
      // per-checklist `autoDetect` flag was removed; "default checklist" is now
      // the single concept. For older installs, adopt the first auto-on list as
      // the default (only if the user hadn't already set one), then drop the
      // now-defunct flag from every checklist.
      version: 1,
      migrate: (persisted: any) => {
        if (persisted && Array.isArray(persisted.checklists)) {
          const firstAuto = persisted.checklists.find((cl: any) => cl.autoDetect);
          if (persisted.settings && !persisted.settings.defaultChecklistId && firstAuto) {
            persisted.settings.defaultChecklistId = firstAuto.id;
          }
          persisted.checklists = persisted.checklists.map((cl: any) => {
            const { autoDetect, ...rest } = cl;
            return rest;
          });
        }
        return persisted;
      },

      // `partialize` controls which slices of state get written to disk.
      // `activeRuns` IS persisted now: an in-progress trip should survive an
      // app restart so the user can resume it (and the Home banner reflects
      // it). Stale runs that point at deleted checklists are filtered out at
      // the Home banner and cleared by deleteChecklist / downgradeFromPro.
      partialize: (state) => ({
        checklists: state.checklists,
        tripLogs: state.tripLogs,
        settings: state.settings,
        connectedToVehicle: state.connectedToVehicle,
        activeRuns: state.activeRuns,
        lastTripChecklistId: state.lastTripChecklistId,
      }),
    }
  )
);
