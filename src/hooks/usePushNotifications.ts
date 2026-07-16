// ─── usePushNotifications Hook ────────────────────────────────────────────────
// Handles expo-notifications setup, permissions, and push token registration.
//
// NOTE: expo-notifications requires a custom development build.
// The hook degrades gracefully when the native module is unavailable
// (Expo Go, web, or a build that hasn't added expo-notifications yet).

import { useState, useEffect } from 'react';
import { Platform } from 'react-native';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { AppNotification, NotifType } from '../context/NotificationContext';

// Lazy-load expo-notifications so a missing native module doesn't crash startup.
let Notifications: any = null;
try {
  Notifications = require('expo-notifications');
  // Configure how notifications are handled when app is in foreground.
  // Show native system notification banner for all notifications in foreground
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
} catch {
  // expo-notifications native module not available — push notifications disabled.
  console.warn('[usePushNotifications] expo-notifications not available. Push notifications disabled.');
}

// usePushNotifications.ts
export function usePushNotifications(
  userId: string | null,
  onNotificationReceived?: (n: Omit<AppNotification, 'id' | 'time' | 'read'>, skipNative?: boolean) => void,
) {
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [notification, setNotification] = useState<any | null>(null);

  useEffect(() => {
    if (!userId || !Notifications) return;

    registerForPushNotificationsAsync().then((token) => {
      if (token) {
        setExpoPushToken(token);
        savePushToken(userId, token);
      }
    });

    // Listener for notifications received while app is foregrounded
    const subscription1 = Notifications.addNotificationReceivedListener((notif: any) => {
      console.log('[usePushNotifications] Notification received:', notif);
      setNotification(notif);

      // 🔑 Bridge into the in-app notification context
      // Pass skipNative=true to prevent scheduling a duplicate native notification
      // (the native notification was already shown by the push system)
      const data = notif.request.content.data as { 
        type?: string; 
        contactId?: string;
        chatId?: string;
      } | undefined;
      
      onNotificationReceived?.({
        type: (data?.type as NotifType) ?? 'system',
        title: notif.request.content.title ?? '',
        body: notif.request.content.body ?? '',
        contactId: data?.contactId,
        chatId: data?.chatId,
      }, true);
    });

    // Listener for when a notification is tapped/interacted with
    const subscription2 = Notifications.addNotificationResponseReceivedListener(async (response: any) => {
      console.log('[usePushNotifications] Notification response:', response);

      const data = response.notification.request.content.data as { 
        type?: string;
        callId?: string;
        callerId?: string;
        callerName?: string;
        callerPhotoUrl?: string;
        callType?: 'audio' | 'video';
      } | undefined;
      
      const actionId = response.actionIdentifier;
      console.log('[usePushNotifications] Action identifier:', actionId);

      // Handle incoming call notification actions
      if (data?.type === 'incoming-call' && data.callId) {
        const { SignalingService } = await import('../services/signalingService');
        
        if (actionId === 'answer') {
          console.log('[usePushNotifications] Answer action tapped for call:', data.callId);
          // The app will open and IncomingCallManager will detect the call
          // and show the overlay. User can then complete the answer flow.
          // We don't answer directly here because we need the full WebRTC setup.
        } else if (actionId === 'decline') {
          console.log('[usePushNotifications] Decline action tapped for call:', data.callId);
          // Reject the call directly without opening the app
          try {
            await SignalingService.updateCallStatus(data.callId, 'rejected');
            console.log('[usePushNotifications] Call rejected successfully');
          } catch (err) {
            console.error('[usePushNotifications] Error rejecting call:', err);
          }
          return; // Don't navigate anywhere
        } else {
          // Default tap (not an action button) - open the app
          console.log('[usePushNotifications] Notification tapped (default), opening app');
        }
        
        // If answered or default tap, the app opens and IncomingCallManager handles it
        return;
      }

      // Calendar notifications navigate to the Calendar screen.
      if (data?.type === 'calendar-event') {
        const { navigateTo } = require('../navigation/navigationRef');
        navigateTo('Calendar');
        return;
      }

      // Chat and other notifications are handled by NotificationTapHandler in
      // App.tsx, which navigates to the relevant chat using the chatId payload.
    });

    return () => {
      subscription1.remove();
      subscription2.remove();
    };
  }, [userId, onNotificationReceived]);

  return { expoPushToken, notification };
}

// ── Register for push notifications ──────────────────────────────────────────
async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (!Notifications) return null;
  let token: string | null = null;

  if (Platform.OS === 'android') {
    // Default notification channel
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
    
    // Incoming call notification channel - highest priority for full-screen intent
    await Notifications.setNotificationChannelAsync('incoming-call', {
      name: 'Incoming Calls',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 500, 500, 500],
      lightColor: '#1E9CF0',
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      bypassDnd: true,
      sound: 'default',
    });
  }

  // Set up notification category with action buttons for incoming calls
  await Notifications.setNotificationCategoryAsync('incoming-call', [
    {
      identifier: 'answer',
      buttonTitle: 'Answer',
      options: {
        opensAppToForeground: true,
      },
    },
    {
      identifier: 'decline',
      buttonTitle: 'Decline',
      options: {
        opensAppToForeground: false,
        isDestructive: true,
      },
    },
  ]);

  if (Platform.OS === 'web') {
    console.log('[usePushNotifications] Push notifications not supported on web');
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('[usePushNotifications] Failed to get push token - permission denied');
    return null;
  }

  try {
    // Get push token (expo-notifications v56 API requires projectId)
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: 'e68eeca5-8ee9-4c30-b23f-8cd3616b7c21',
    });
    token = tokenData.data;
    console.log('[usePushNotifications] Push token:', token);
  } catch (error) {
    console.error('[usePushNotifications] Error getting push token:', error);
  }

  return token;
}

// ── Save push token to Firestore ──────────────────────────────────────────────
async function savePushToken(userId: string, token: string) {
  try {
    const userRef = doc(db, 'users', userId);
    await setDoc(
      userRef,
      {
        pushToken: token,
        pushTokenUpdatedAt: new Date(),
        platform: Platform.OS,
      },
      { merge: true }
    );
    console.log('[usePushNotifications] Push token saved to Firestore');
  } catch (error) {
    console.error('[usePushNotifications] Error saving push token:', error);
  }
}

// ── Helper: Send local notification (for testing) ─────────────────────────────
export async function sendLocalNotification(title: string, body: string, data?: any) {
  if (!Notifications) return;
  await Notifications.scheduleNotificationAsync({
    content: { title, body, data },
    trigger: null,
  });
}
