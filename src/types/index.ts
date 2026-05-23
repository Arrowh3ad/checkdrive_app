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
  createdAt: string;            // ISO timestamp; used for sorting / display
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
};

// The navigation param map consumed by React Navigation's `createNativeStackNavigator`.
// Each key is a screen name; the value is the params object type or `undefined`
// when no params are required.
// `NewChecklist` accepts an optional `checklistId` — present in edit mode,
// absent when creating a new checklist.
export type RootStackParamList = {
  Home: undefined;
  ChecklistRun: { checklistId: string };
  MultiStop: { checklistId: string };
  NewChecklist: { checklistId?: string } | undefined;
  Settings: undefined;
  Pro: undefined;
  CarDetectionSetup: undefined;
};
