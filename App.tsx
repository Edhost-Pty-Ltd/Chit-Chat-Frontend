import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { enableScreens } from 'react-native-screens';
import { AuthProvider } from './src/context/AuthContext';
import { ThemeProvider } from './src/context/ThemeContext';
import { CallProvider } from './src/context/CallContext';
import { NotificationProvider } from './src/context/NotificationContext';
import AppNavigator from './src/navigation/AppNavigator';
import ToastOverlay from './src/components/ToastNotification';
import GroupCallNotificationManager from './src/components/GroupCallNotificationManager';

// Enable native screens for better performance
enableScreens(true);

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <CallProvider>
          <NotificationProvider>
            <NavigationContainer>
              <StatusBar style="auto" />
              <AppNavigator />
              <ToastOverlay />
              <GroupCallNotificationManager />
            </NavigationContainer>
          </NotificationProvider>
        </CallProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
