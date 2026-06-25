// ─── usePushNotifications Hook ────────────────────────────────────────────────
// Handles expo-notifications setup, permissions, and push token registration

import { useState, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

// Configure how notifications are handled when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export function usePushNotifications(userId: string | null) {
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [notification, setNotification] = useState<Notifications.Notification | null>(null);
  const notificationListener = useRef<Notifications.Subscription>();
  const responseListener = useRef<Notifications.Subscription>();

  useEffect(() => {
    if (!userId) return;

    // Register for push notifications
    registerForPushNotificationsAsync().then((token) => {
      if (token) {
        setExpoPushToken(token);
        // Save token to Firestore
        savePushToken(userId, token);
      }
    });

    // Listener for notifications received while app is foregrounded
    notificationListener.current = Notifications.addNotificationReceivedListener((notification) => {
      console.log('[usePushNotifications] Notification received:', notification);
      setNotification(notification);
    });

    // Listener for when a notification is tapped/interacted with
    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      console.log('[usePushNotifications] Notification response:', response);
      // Handle navigation based on notification data
      handleNotificationResponse(response);
    });

    return () => {
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current);
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
    };
  }, [userId]);

  return { expoPushToken, notification };
}

// ── Register for push notifications ──────────────────────────────────────────
async function registerForPushNotificationsAsync(): Promise<string | null> {
  let token: string | null = null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  // Check if we're on a physical device
  if (Platform.OS === 'web') {
    console.log('[usePushNotifications] Push notifications not supported on web');
    return null;
  }

  // Request permissions
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
    // Get push token
    token = (await Notifications.getExpoPushTokenAsync({
      projectId: 'e68eeca5-8ee9-4c30-b23f-8cd3616b7c21',
    })).data;
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
function handleNotificationResponse(response: Notifications.NotificationResponse) {
  const data = response.notification.request.content.data;
  
  // TODO: Add navigation logic based on notification type
  console.log('[usePushNotifications] Notification data:', data);
  
  // Example navigation logic:
  // if (data.type === 'message') {
  //   navigation.navigate('Chat', { chatId: data.chatId });
  // } else if (data.type === 'call') {
  //   // Handle incoming call
  // } else if (data.type === 'status') {
  //   navigation.navigate('Status');
  // }
}

// ── Helper: Send local notification (for testing) ─────────────────────────────
export async function sendLocalNotification(title: string, body: string, data?: any) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data,
    },
    trigger: null, // Show immediately
  });
}

