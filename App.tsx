import React, { useEffect } from 'react';
import { Platform, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { ThemeProvider } from './src/context/ThemeContext';
import { ContactsProvider } from './src/context/ContactsContext';
import { MessagesProvider } from './src/context/MessagesContext';
import { NotificationProvider } from './src/context/NotificationContext';
import { BlockedProvider } from './src/context/BlockedContext';
import ToastOverlay from './src/components/ToastNotification';
import AppNavigator from './src/navigation/AppNavigator';

// On web, refresh the inactivity timer on any user interaction
function ActivityWatcher() {
  const { refreshActivity } = useAuth();
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const events = ['mousemove', 'keydown', 'pointerdown', 'touchstart', 'scroll'];
    events.forEach((e) => window.addEventListener(e, refreshActivity, { passive: true }));
    return () => events.forEach((e) => window.removeEventListener(e, refreshActivity));
  }, [refreshActivity]);
  return null;
}

export default function App() {
  return (
    <ThemeProvider>
      <ContactsProvider>
        <MessagesProvider>
          <BlockedProvider>
          <NotificationProvider>
            <AuthProvider>
              <NavigationContainer>
                <ActivityWatcher />
                <StatusBar style="auto" />
                <AppNavigator />
                {/* Toast overlay — sits above all screens inside NavigationContainer
                    so it can navigate on tap */}
                <ToastOverlay />
              </NavigationContainer>
            </AuthProvider>
          </NotificationProvider>
          </BlockedProvider>
        </MessagesProvider>
      </ContactsProvider>
    </ThemeProvider>
  );
}
