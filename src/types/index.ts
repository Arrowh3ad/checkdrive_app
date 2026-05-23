export type ChecklistItem = {
  id: string;
  label: string;
};

export type StopStatus = 'done' | 'current' | 'upcoming';

export type Stop = {
  id: string;
  name: string;
  subtitle: string;
  items: ChecklistItem[];
  status: StopStatus;
  checkedItems: string[];
  completedAt?: string;
};

export type Checklist = {
  id: string;
  name: string;
  iconName: string;
  iconBg: string;
  iconColor: string;
  startItems: ChecklistItem[];
  endItems: ChecklistItem[];
  stops: Stop[];
  isMultiStop: boolean;
  autoDetect: boolean;
  geofenceEnabled: boolean;
  endOfTripEnabled: boolean;
  createdAt: string;
};

export type TripLog = {
  id: string;
  checklistId: string;
  checklistName: string;
  checkedCount: number;
  totalCount: number;
  timestamp: string;
  isComplete: boolean;
};

export type Settings = {
  pushNotifications: boolean;
  bluetoothAutoDetect: boolean;
  tripStreaks: boolean;
  isPro: boolean;
  currentStreak: number;
  totalTrips: number;
};

export type RootStackParamList = {
  Home: undefined;
  ChecklistRun: { checklistId: string };
  MultiStop: { checklistId: string };
  NewChecklist: undefined;
  Settings: undefined;
  Pro: undefined;
  CarDetectionSetup: undefined;
};
