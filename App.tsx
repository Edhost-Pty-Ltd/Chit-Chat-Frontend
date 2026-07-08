import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { enableScreens } from 'react-native-screens';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';

// Import Firebase config FIRST to ensure it's initialized before any contexts
import './src/config/firebase';

import { AuthProvider, useAuth } from './src/context/AuthContext';
import { useAuth as useHooksAuth } from './src/hooks/useAuth';
import { ThemeProvider } from './src/context/ThemeContext';
import { CallProvider } from './src/context/CallContext';
import { NotificationProvider, useNotifications } from './src/context/NotificationContext';
import { FloatingCallProvider } from './src/context/FloatingCallContext';
import { ActiveCallProvider } from './src/context/ActiveCallContext';
import AppNavigator from './src/navigation/AppNavigator';
import ToastOverlay from './src/components/ToastNotification';
import { FloatingCallManager } from './src/components/FloatingCallManager';
import { CallHost } from './src/components/CallHost';
import GroupCallNotificationManager from './src/components/GroupCallNotificationManager';
import { BiometricGate } from './src/components/BiometricGate';
import { usePushNotifications } from './src/hooks/usePushNotifications';
import { useWritePresence } from './src/hooks/usePresence';
import { useGlobalDelivery } from './src/hooks/useGlobalDelivery';
import { navigationRef, navigationQueue, navigateToChatWhenReady } from './src/services/navigationService';

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
} else {
  enableScreens(true);
}

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

// Push notification setup — uses the Firebase Auth user uid from hooks/useAuth
function PushNotificationManager() {
  // hooks/useAuth exposes the native Firebase user object with uid
  const { user } = useHooksAuth();
  const { pushNotification } = useNotifications();
  usePushNotifications(user?.uid ?? null, pushNotification);
  return null;
}

// Presence management — keeps user online/offline status synced at app level
function PresenceManager() {
  const { user } = useHooksAuth();
  useWritePresence(user?.uid ?? null);
  return null;
}

// Global delivery — marks all incoming messages as delivered when app is open
function GlobalDeliveryManager() {
  const { user } = useHooksAuth();
  useGlobalDelivery(user?.uid ?? null);
  return null;
}

// Notification tap handler — handles taps in all app states
function NotificationTapHandler() {
  useEffect(() => {
    // Handle notification tap when app is in FOREGROUND or BACKGROUND
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      console.log('[NotificationTapHandler] Notification tapped (foreground/background):', data);
      
      const chatId = data.chatId as string | undefined;
      const contactId = data.contactId as string | undefined;
      
      if (chatId) {
        // chatId takes precedence - navigate directly to chat
        console.log('[NotificationTapHandler] Navigating to chat:', chatId);
        navigateToChatWhenReady(chatId);
      } else if (contactId) {
        // Fallback to contactId - for now, log it
        // In the future, you might want to find/create a chat with this contact
        console.log('[NotificationTapHandler] Contact ID provided but no chatId:', contactId);
        // Could implement: look up chat by contactId or create new chat
      }
    });

    return () => subscription.remove();
  }, []);

  useEffect(() => {
    // Handle notification tap when app was KILLED/TERMINATED
    // This runs once on app launch to check if app was opened by tapping a notification
    (async () => {
      const response = await Notifications.getLastNotificationResponseAsync();
      
      if (response) {
        const data = response.notification.request.content.data;
        console.log('[NotificationTapHandler] App opened from notification (killed state):', data);
        
        const chatId = data.chatId as string | undefined;
        const contactId = data.contactId as string | undefined;
        
        if (chatId) {
          console.log('[NotificationTapHandler] Navigating to chat from killed state:', chatId);
          // Queue this navigation - it will execute once navigator is ready
          navigateToChatWhenReady(chatId);
        } else if (contactId) {
          console.log('[NotificationTapHandler] Contact ID provided but no chatId (killed state):', contactId);
        }
      }
    })();
  }, []);

  return null;
}

export default function App() {
  // Global handler for unhandled promise rejections
  useEffect(() => {
    if (Platform.OS === 'web') {
      // Web-specific promise rejection handler
      const handleRejection = (event: PromiseRejectionEvent) => {
        const error = event.reason;
        // Suppress auth/no-current-user errors as they're expected before sign-in
        if (error?.code === 'auth/no-current-user' || error?.message?.includes('no-current-user')) {
          console.warn('[App] Suppressed expected auth error:', error.message);
          event.preventDefault();
          return;
        }
        // Let other errors through
        console.error('[App] Unhandled promise rejection:', error);
      };

      if (typeof window !== 'undefined') {
        window.addEventListener('unhandledrejection', handleRejection as any);
        return () => window.removeEventListener('unhandledrejection', handleRejection as any);
      }
    } else {
      // React Native - use global error handler
      const ErrorUtils = (global as any).ErrorUtils;
      if (ErrorUtils) {
        const originalHandler = ErrorUtils.getGlobalHandler();
        
        ErrorUtils.setGlobalHandler((error: any, isFatal?: boolean) => {
          // Suppress auth/no-current-user errors
          if (error?.code === 'auth/no-current-user' || error?.message?.includes('no-current-user')) {
            console.warn('[App] Suppressed expected auth error:', error.message);
            return;
          }
          // Pass other errors to original handler
          if (originalHandler) {
            originalHandler(error, isFatal);
          }
        });
        
        return () => {
          if (originalHandler) {
            ErrorUtils.setGlobalHandler(originalHandler);
          }
        };
      }
    }
  }, []);

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <CallProvider>
            <NotificationProvider>
              <FloatingCallProvider>
                <ActiveCallProvider>
                  <ActivityWatcher />
                  <PushNotificationManager />
                  <PresenceManager />
                  <GlobalDeliveryManager />
                  <NotificationTapHandler />
                  <NavigationContainer 
                    ref={navigationRef}
                    onReady={() => {
                      console.log('[App] Navigation container ready');
                      navigationQueue.setReady();
                    }}
                  >
                    <StatusBar style="auto" />
                    <AppNavigator />
                    <ToastOverlay />
                    <FloatingCallManager />
                    <GroupCallNotificationManager />
                    <CallHost />
                    <BiometricGate />
                  </NavigationContainer>
                </ActiveCallProvider>
              </FloatingCallProvider>
            </NotificationProvider>
          </CallProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
