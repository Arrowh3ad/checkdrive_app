// ─────────────────────────────────────────────────────────────────────────────
// types/index.ts  -  Shared data types for the entire CheckDrive app.
//
// All types live here so every file imports from one place. If a type needs
// to change (e.g. adding a field to Checklist), there is only one file to
// edit, and TypeScript will immediately surface every caller that needs to
// be updated.
// ─────────────────────────────────────────────────────────────────────────────

// A single checkbox row inside a checklist or stop.
export type ChecklistItem = {
  id: string;   // stable unique ID used as React key and checked-state map key
  label: string;
};

// The lifecycle state of a stop inside a multi-stop trip.
// 'done' → already completed, 'current' → the stop the user is working on,
// 'upcoming' → not yet reached.
export type StopStatus = 'done' | 'current' | 'upcoming';

// One stop in a multi-stop trip. Stops are ordered; the user works through
// them sequentially. `checkedItems` is persisted so we can show a pre-checked
// state when returning to a stop (see MultiStopScreen).
export type Stop = {
  id: string;
  name: string;
  subtitle: string;        // short description shown in the timeline row
  items: ChecklistItem[];
  status: StopStatus;
  checkedItems: string[];  // IDs of pre-checked items (used to seed initial state)
  completedAt?: string;    // ISO timestamp, set when the stop is marked done
};

// A checklist template the user creates. Instances of this type are stored in
// Zustand and persisted to AsyncStorage. It holds both the template definition
// (items, appearance, settings) and is referenced by TripLog for history.
export type Checklist = {
  id: string;
  name: string;

  // Icon appearance - either a preset Ionicons name with bg/color, or a
  // custom photo identified by a local file URI (see NewChecklistScreen).
  iconName: string;
  iconBg: string;
  iconColor: string;
  iconUri?: string;      // local file URI for a custom photo icon; overrides preset when set

  startItems: ChecklistItem[];  // shown in the "Start of trip" tab
  endItems: ChecklistItem[];    // shown in the "End of trip" tab (only if endOfTripEnabled)
  stops: Stop[];                // populated only when isMultiStop === true

  isMultiStop: boolean;
  geofenceEnabled: boolean;     // Pro feature: trigger when leaving a saved location
  endOfTripEnabled: boolean;    // shows the "End of trip" tab in ChecklistRunScreen
  // When true, disconnecting from the car fires a distinct, high-urgency
  // "check the back seat" reminder instead of the normal arrival notification.
  // Free feature (safety), defaults false on existing checklists (undefined → falsy).
  backSeatReminder?: boolean;
  backSeatMessage?: string;     // optional custom text; defaults to "Check the back seat!"
  createdAt: string;            // ISO timestamp; used for sorting / display
};


// Per-item record stored inside a TripLog (Pro only).
// Captures the label and the exact moment the user tapped the checkbox.
// `checkedAt` is undefined when the item was left unchecked.
export type TripLogItem = {
  id: string;
  label: string;
  checkedAt?: string; // ISO timestamp; absent when the item was skipped
  // Human-readable group header, e.g. "Start of trip", "End of trip",
  // "Stop 1 - Home - depart". Items with the same section are grouped
  // together in TripHistoryScreen.
  section?: string;
};

// A record of one completed (or partially completed) trip run. Stored in
// `tripLogs` in the Zustand store and used to populate the "Recent trips"
// list on HomeScreen and the stats widgets.
export type TripLog = {
  id: string;
  checklistId: string;
  checklistName: string;
  checkedCount: number;
  totalCount: number;
  timestamp: string;   // ISO timestamp of when the user tapped "Done"
  isComplete: boolean; // true only when checkedCount === totalCount
  // Pro: per-item detail with individual check timestamps. Absent for free-plan logs.
  items?: TripLogItem[];
};

// An in-progress checklist run, persisted to AsyncStorage so the user never
// loses progress by navigating away. There is at most one active run per
// checklist (keyed by `checklistId`). Regular and multi-stop checklists use
// different subsets of the fields below - the irrelevant ones just stay at
// their empty defaults.
export type ActiveRun = {
  checklistId: string;
  isMultiStop: boolean;
  startedAt: string;   // ISO timestamp of when the run began
  updatedAt: string;   // ISO timestamp of the last change (newest-first on Home)

  // ── Regular-trip fields (isMultiStop === false) ──────────────────────────
  // Which phase/tab the user is currently working: 'start' = departure list,
  // 'end' = arrival list.
  phase: 'start' | 'end';
  // True once the departure phase has been completed. This is what drives the
  // two-phase flow - the trip is only logged to history when the arrival phase
  // is finished, but `startDone` lets the Home banner show "departed, arrival
  // pending" in the meantime.
  startDone: boolean;
  // item id → checked, spanning BOTH start and end items (their IDs are unique).
  checked: Record<string, boolean>;
  // item id → ISO timestamp it was checked (Pro per-item detail).
  checkedAt: Record<string, string>;
  // item id → "ignored/skipped for this trip". Ignored items are excluded from
  // BOTH the completion numerator and denominator, so skipping something you
  // didn't need today (e.g. coffee) never lowers your score. Per-run only -
  // cleared on reset/completion, never written back to the checklist template.
  // Optional: older persisted runs won't have it (read with `?? {}`).
  ignored?: Record<string, boolean>;

  // ── Multi-stop fields (isMultiStop === true) ─────────────────────────────
  // Index of the stop the user is currently on.
  stopIndex: number;
  // Checked item IDs per stop index, e.g. `stopChecked[0] = ['sp1-1', 'sp1-3']`.
  // Keeping it keyed by index means an undo + re-advance simply re-reads the
  // existing entry, so progress on already-visited stops is never lost.
  stopChecked: Record<number, string[]>;
  // Per-stop check timestamps: `stopCheckedAt[stopIndex][itemId] = ISO string`.
  stopCheckedAt: Record<number, Record<string, string>>;
};

// All persisted user preferences. Lives in `settings` inside the Zustand store.
export type Settings = {
  pushNotifications: boolean;
  bluetoothAutoDetect: boolean;
  isPro: boolean;
  totalTrips: number;
  // The user's primary checklist. Free to set (marks it with a star and makes
  // it the checklist tied to car connect/disconnect - trip-start notification
  // naming and the back-seat / end-of-trip reminder). `null` means "no default
  // - fall back to the first checklist". Pro additionally unlocks auto-opening
  // this list on connect (see openChecklistOnConnect).
  defaultChecklistId: string | null;
  // When true, a car-connect trigger opens the default checklist immediately
  // instead of only posting a notification. Jumping straight into the default
  // is a Pro behavior; free users with this on just land on Home. Default
  // false: the gentler notification-only behavior.
  openChecklistOnConnect: boolean;
  // Set true once the in-app "rate this app" prompt has been requested, so it
  // only ever fires once. (Missing on older persisted installs → treated as
  // false, which is correct - they just become eligible at the trip threshold.)
  reviewRequested: boolean;
  // Set true once the first-run welcome sheet has been dismissed.
  onboardingSeen: boolean;
};

// The navigation param map consumed by React Navigation's `createNativeStackNavigator`.
// Each key is a screen name; the value is the params object type or `undefined`
// when no params are required.
// `NewChecklist` accepts an optional `checklistId` - present in edit mode,
// absent when creating a new checklist.
export type RootStackParamList = {
  Home: undefined;
  // `tab` is optional - omitting it defaults to 'start'. The disconnect
  // notification passes 'end' so the screen opens straight to arrival items.
  ChecklistRun: { checklistId: string; tab?: 'start' | 'end' };
  MultiStop: { checklistId: string };
  NewChecklist: { checklistId?: string } | undefined;
  Settings: undefined;
  CarDetectionSetup: undefined;
  TripHistory: undefined; // full trip history with timestamps + multi-select delete
  Paywall: undefined; // CheckDrive Pro - lifetime unlock (no ads + unlimited lists)
};
