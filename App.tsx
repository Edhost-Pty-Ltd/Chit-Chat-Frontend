import React, { useEffect } from 'react';
import { Platform, View, ActivityIndicator, Linking, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { enableScreens } from 'react-native-screens';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import { useFonts as useRoboto, Roboto_400Regular, Roboto_700Bold } from '@expo-google-fonts/roboto';
import { Merriweather_400Regular } from '@expo-google-fonts/merriweather';
import { RobotoMono_400Regular } from '@expo-google-fonts/roboto-mono';
import { Nunito_700Bold } from '@expo-google-fonts/nunito';
import { DancingScript_400Regular } from '@expo-google-fonts/dancing-script';
import { RobotoCondensed_600SemiBold } from '@expo-google-fonts/roboto-condensed';

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

// ── Invite link handler — joins group when app opens via chitchat.app/join/... link
function InviteLinkHandler() {
  const { user } = useHooksAuth();

  useEffect(() => {
    if (!user?.uid) return;

    const handleUrl = async (url: string | null) => {
      if (!url) return;
      const match = url.match(/chitchat\.app\/join\/([a-zA-Z0-9]+)/);
      if (!match) return;
      const inviteCode = match[1];
      console.log('[InviteLinkHandler] Invite code:', inviteCode);

      try {
        const { collection, query, where, getDocs, doc, updateDoc, arrayUnion, serverTimestamp } = await import('firebase/firestore');
        const { db } = await import('./src/config/firebase');

        // Find the chat with this invite code
        const q = query(collection(db, 'chats'), where('inviteCode', '==', inviteCode));
        const snap = await getDocs(q);
        if (snap.empty) {
          Alert.alert('Invalid Link', 'This invite link is no longer valid.');
          return;
        }
        const chatDoc = snap.docs[0];
        const chatData = chatDoc.data();
        const members: string[] = chatData.members ?? [];

        if (members.includes(user.uid)) {
          // Already a member — just navigate
          navigateToChatWhenReady(chatDoc.id);
          return;
        }

        // Add user to group
        await updateDoc(doc(db, 'chats', chatDoc.id), {
          members: arrayUnion(user.uid),
          [`memberJoinedAt.${user.uid}`]: serverTimestamp(),
        });

        const { sendGroupJoinLinkMessage } = await import('./src/hooks/useChatActions');
        const userName = user.displayName || 'Someone';
        await sendGroupJoinLinkMessage(chatDoc.id, user.uid, userName);

        Alert.alert('Joined!', `You joined "${chatData.groupName || 'the group'}".`);
        navigateToChatWhenReady(chatDoc.id);
      } catch (err) {
        console.error('[InviteLinkHandler] Error joining group:', err);
        Alert.alert('Error', 'Failed to join the group.');
      }
    };

    // Handle app opened via link
    Linking.getInitialURL().then(handleUrl);

    // Handle link while app is running
    const sub = Linking.addEventListener('url', (event) => handleUrl(event.url));
    return () => sub.remove();
  }, [user?.uid]);

  return null;
}

export default function App() {
  // Load Google Fonts used by the Appearance settings font presets.
  const [fontsLoaded] = useRoboto({
    Roboto_400Regular,
    Roboto_700Bold,
    Merriweather_400Regular,
    RobotoMono_400Regular,
    Nunito_700Bold,
    DancingScript_400Regular,
    RobotoCondensed_600SemiBold,
  });

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

  // Wait for fonts before rendering so preset fonts render correctly on first paint.
  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#87CEEB' }}>
        <ActivityIndicator size="large" color="#1E9CF0" />
      </View>
    );
  }

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
                    <InviteLinkHandler />
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
