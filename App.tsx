import React from 'react';
import { Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { enableScreens } from 'react-native-screens';
import AppNavigator from './src/navigation/AppNavigator';

// Disable native screens on web to avoid touch/interaction issues
if (Platform.OS === 'web') {
  enableScreens(false);

  // Lock html/body/#root to viewport so the gradient fills the screen
  // and there is no white background showing on overscroll.
  if (typeof document !== 'undefined') {
    const css = `
      html, body, #root { height: 100%; margin: 0; overflow: hidden; }
      body { background-color: #0a2463; overscroll-behavior: none; }
    `;
    const style = document.createElement('style');
    style.appendChild(document.createTextNode(css));
    document.head.appendChild(style);
  }
}

export default function App() {
  return (
    <NavigationContainer>
      <StatusBar style="auto" />
      <AppNavigator />
    </NavigationContainer>
  );
}
