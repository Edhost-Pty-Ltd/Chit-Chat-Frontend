import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { ThemeProvider } from './src/context/ThemeContext';
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
      <AuthProvider>
        <ActivityWatcher />
        <NavigationContainer>
          <StatusBar style="auto" />
          <AppNavigator />
        </NavigationContainer>
      </AuthProvider>
    </ThemeProvider>
  );
}
