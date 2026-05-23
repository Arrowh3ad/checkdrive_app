import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function requestNotificationPermissions(): Promise<boolean> {
  if (!Device.isDevice) return false;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'CheckDrive',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#1D9E75',
    });
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;

  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function sendTripStartNotification(checklistName: string): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Ready for your trip?',
      body: `Tap to run your "${checklistName}" checklist`,
      data: { trigger: 'car-connect' },
      sound: true,
    },
    trigger: null,
  });
}

export function useNotifications() {
  useEffect(() => {
    requestNotificationPermissions();
  }, []);
}
