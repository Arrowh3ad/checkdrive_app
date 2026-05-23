import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as Linking from 'expo-linking';
import { RootStackParamList } from '../types';
import { HomeScreen } from '../screens/HomeScreen';
import { ChecklistRunScreen } from '../screens/ChecklistRunScreen';
import { MultiStopScreen } from '../screens/MultiStopScreen';
import { NewChecklistScreen } from '../screens/NewChecklistScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { ProScreen } from '../screens/ProScreen';
import { CarDetectionSetupScreen } from '../screens/CarDetectionSetupScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

const linking = {
  prefixes: [Linking.createURL('/'), 'checkdrive://'],
  config: {
    screens: {
      Home: '',
      ChecklistRun: 'checklist/:checklistId',
      MultiStop: 'multistop/:checklistId',
      NewChecklist: 'new',
      Settings: 'settings',
      Pro: 'pro',
      CarDetectionSetup: 'trigger',
    },
  },
};

export function AppNavigator() {
  return (
    <NavigationContainer linking={linking}>
      <Stack.Navigator
        screenOptions={{ headerShown: false, animation: 'slide_from_right' }}
      >
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="ChecklistRun" component={ChecklistRunScreen} />
        <Stack.Screen name="MultiStop" component={MultiStopScreen} />
        <Stack.Screen name="NewChecklist" component={NewChecklistScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
        <Stack.Screen name="Pro" component={ProScreen} />
        <Stack.Screen name="CarDetectionSetup" component={CarDetectionSetupScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
