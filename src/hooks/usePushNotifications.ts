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
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: false,
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
      const data = notif.request.content.data as { type?: string; contactId?: number } | undefined;
      onNotificationReceived?.({
        type: (data?.type as NotifType) ?? 'system',
        title: notif.request.content.title ?? '',
        body: notif.request.content.body ?? '',
        contactId: data?.contactId?.toString(),
      }, true);
    });

    // Listener for when a notification is tapped/interacted with
    const subscription2 = Notifications.addNotificationResponseReceivedListener((response: any) => {
      console.log('[usePushNotifications] Notification response:', response);
      handleNotificationResponse(response);
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
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

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

// ── Handle notification response (when user taps notification) ────────────────
function handleNotificationResponse(response: any) {
  const data = response.notification.request.content.data;
  console.log('[usePushNotifications] Notification data:', data);
}

// ── Helper: Send local notification (for testing) ─────────────────────────────
export async function sendLocalNotification(title: string, body: string, data?: any) {
  if (!Notifications) return;
  await Notifications.scheduleNotificationAsync({
    content: { title, body, data },
    trigger: null,
  });
}
