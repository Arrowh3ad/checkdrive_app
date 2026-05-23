import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Checklist, TripLog, Settings } from '../types';
import { generateId } from '../utils/ids';

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
        checkedItems: ['sp2-1'],
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

interface AppStore {
  checklists: Checklist[];
  tripLogs: TripLog[];
  settings: Settings;
  connectedToVehicle: boolean;

  addChecklist: (data: Omit<Checklist, 'id' | 'createdAt'>) => void;
  updateChecklist: (id: string, data: Partial<Checklist>) => void;
  deleteChecklist: (id: string) => void;
  addTripLog: (log: Omit<TripLog, 'id'>) => void;
  updateSettings: (data: Partial<Settings>) => void;
  setConnectedToVehicle: (connected: boolean) => void;
}

export const useAppStore = create<AppStore>()(
  persist(
    (set) => ({
      checklists: defaultChecklists,
      tripLogs: defaultTripLogs,
      settings: {
        pushNotifications: true,
        bluetoothAutoDetect: true,
        tripStreaks: false,
        isPro: false,
        currentStreak: 5,
        totalTrips: 47,
      },
      connectedToVehicle: true,

      addChecklist: (data) =>
        set((state) => ({
          checklists: [
            ...state.checklists,
            { ...data, id: generateId(), createdAt: new Date().toISOString() },
          ],
        })),

      updateChecklist: (id, data) =>
        set((state) => ({
          checklists: state.checklists.map((cl) =>
            cl.id === id ? { ...cl, ...data } : cl
          ),
        })),

      deleteChecklist: (id) =>
        set((state) => ({
          checklists: state.checklists.filter((cl) => cl.id !== id),
        })),

      addTripLog: (log) =>
        set((state) => ({
          tripLogs: [{ ...log, id: generateId() }, ...state.tripLogs.slice(0, 49)],
          settings: { ...state.settings, totalTrips: state.settings.totalTrips + 1 },
        })),

      updateSettings: (data) =>
        set((state) => ({ settings: { ...state.settings, ...data } })),

      setConnectedToVehicle: (connected) => set({ connectedToVehicle: connected }),
    }),
    {
      name: 'checkdrive-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
