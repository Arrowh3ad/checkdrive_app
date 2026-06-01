// ─────────────────────────────────────────────────────────────────────────────
// types/index.ts  —  Shared data types for the entire CheckDrive app.
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

  // Icon appearance — either a preset Ionicons name with bg/color, or a
  // custom photo identified by a local file URI (see NewChecklistScreen).
  iconName: string;
  iconBg: string;
  iconColor: string;
  iconUri?: string;      // local file URI for a custom photo icon; overrides preset when set

  startItems: ChecklistItem[];  // shown in the "Start of trip" tab
  endItems: ChecklistItem[];    // shown in the "End of trip" tab (only if endOfTripEnabled)
  stops: Stop[];                // populated only when isMultiStop === true

  isMultiStop: boolean;
  autoDetect: boolean;          // included in the CarPlay auto-detection candidate pool
  geofenceEnabled: boolean;     // Pro feature: trigger when leaving a saved location
  endOfTripEnabled: boolean;    // shows the "End of trip" tab in ChecklistRunScreen
  // When true, disconnecting from the car fires a distinct, high-urgency
  // "check the back seat" reminder instead of the normal arrival notification.
  // Free feature (safety), defaults false on existing checklists (undefined → falsy).
  backSeatReminder?: boolean;
  backSeatMessage?: string;     // optional custom text; defaults to "Check the back seat!"
  createdAt: string;            // ISO timestamp; used for sorting / display
};

// A saved "where did I park" location, captured when the car disconnects.
// lat/lng/savedAt are written by the native parking service (works even when the
// app is killed); photoUri and note are optional Pro enrichments added in-app.
export type ParkingRecord = {
  id: string;
  lat: number;
  lng: number;
  savedAt: string;   // ISO timestamp of capture
  photoUri?: string; // Pro: local file URI of a photo of the spot
  note?: string;     // Pro: free text, e.g. "Level 3, B12"
};

// Per-item record stored inside a TripLog (Pro only).
// Captures the label and the exact moment the user tapped the checkbox.
// `checkedAt` is undefined when the item was left unchecked.
export type TripLogItem = {
  id: string;
  label: string;
  checkedAt?: string; // ISO timestamp; absent when the item was skipped
  // Human-readable group header, e.g. "Start of trip", "End of trip",
  // "Stop 1 — Home — depart". Items with the same section are grouped
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
// different subsets of the fields below — the irrelevant ones just stay at
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
  // two-phase flow — the trip is only logged to history when the arrival phase
  // is finished, but `startDone` lets the Home banner show "departed, arrival
  // pending" in the meantime.
  startDone: boolean;
  // item id → checked, spanning BOTH start and end items (their IDs are unique).
  checked: Record<string, boolean>;
  // item id → ISO timestamp it was checked (Pro per-item detail).
  checkedAt: Record<string, string>;

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

// The signed-in user, mirrored from Firebase Auth into the Zustand store by
// useAuthSync. `null` means "guest" — the app is fully usable in this state;
// an account is only required to start a Pro subscription. NOT persisted by
// Zustand: Firebase owns session persistence (AsyncStorage), and this is
// re-hydrated by the auth listener on launch.
export type AuthUser = {
  uid: string;
  email: string | null;
};

// All persisted user preferences. Lives in `settings` inside the Zustand store.
export type Settings = {
  pushNotifications: boolean;
  bluetoothAutoDetect: boolean;
  tripStreaks: boolean;
  isPro: boolean;
  currentStreak: number;
  totalTrips: number;
  // Pro feature: when set, the CarPlay notification tap and the HomeScreen
  // banner tap open this specific checklist instead of the first autoDetect one.
  // `null` means "no default — use the first autoDetect checklist".
  defaultChecklistId: string | null;
  // When true, a car-connect trigger opens the default checklist immediately
  // instead of only posting a notification. Default false: the gentler
  // notification-only behavior (the app may still be foregrounded by the
  // deep link itself, but it won't take over with a checklist).
  openChecklistOnConnect: boolean;
  // When true, disconnecting from the car captures your parking location (via
  // the native foreground-location service on Android). Default false; enabling
  // it prompts for location permission. iOS has no equivalent capture path.
  parkingFinderEnabled: boolean;
};

// The navigation param map consumed by React Navigation's `createNativeStackNavigator`.
// Each key is a screen name; the value is the params object type or `undefined`
// when no params are required.
// `NewChecklist` accepts an optional `checklistId` — present in edit mode,
// absent when creating a new checklist.
export type RootStackParamList = {
  Home: undefined;
  // `tab` is optional — omitting it defaults to 'start'. The disconnect
  // notification passes 'end' so the screen opens straight to arrival items.
  ChecklistRun: { checklistId: string; tab?: 'start' | 'end' };
  MultiStop: { checklistId: string };
  NewChecklist: { checklistId?: string } | undefined;
  Settings: undefined;
  Pro: undefined;
  CarDetectionSetup: undefined;
  Parking: undefined; // "Where did I park" — latest spot + history
  TripHistory: undefined; // Pro: full history with timestamps + multi-select delete
  // Auth screens. Reached when a guest tries to go Pro, or from Settings.
  // SignIn ↔ SignUp swap via navigation.replace (they're alternatives, not a
  // stack), so a single goBack() after success returns to the caller.
  SignIn: undefined;
  SignUp: undefined;
  ForgotPassword: undefined;
};
