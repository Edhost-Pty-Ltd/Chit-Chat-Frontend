// ─── FCM Service ─────────────────────────────────────────────────────────────
// Native Firebase Cloud Messaging token registration for Android killed-state
// incoming calls. This runs ALONGSIDE the existing Expo push token pipeline
// (dual-write): messages/calendar keep using Expo push; call pushes use the
// native FCM token so a data-only message can wake a killed app.
//
// Scoped to Android for now. iOS native FCM requires an APNs setup we are not
// doing in this pass (iOS stays best-effort via Expo push). See TODO: PushKit.

import { Platform } from 'react-native';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

// Lazy-require so the app boots even where the native module isn't linked.
let messagingModule: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  messagingModule = require('@react-native-firebase/messaging');
} catch {
  console.warn('[fcmService] @react-native-firebase/messaging not available — native FCM disabled.');
}

function getMessagingInstance(): any | null {
  if (!messagingModule) return null;
  try {
    // Modular API (v22+). Falls back to the default namespaced export.
    if (typeof messagingModule.getMessaging === 'function') {
      return messagingModule.getMessaging();
    }
    if (typeof messagingModule.default === 'function') {
      return messagingModule.default();
    }
  } catch (err) {
    console.error('[fcmService] Failed to get messaging instance:', err);
  }
  return null;
}

async function persistFcmToken(userId: string, token: string): Promise<void> {
  try {
    await setDoc(
      doc(db, 'users', userId),
      {
        fcmToken: token,
        fcmTokenPlatform: Platform.OS,
        fcmTokenUpdatedAt: new Date(),
      },
      { merge: true },
    );
    console.log('[fcmService] FCM token saved to Firestore');
  } catch (err) {
    console.error('[fcmService] Error saving FCM token:', err);
  }
}

/**
 * Request permission (Android 13+ POST_NOTIFICATIONS), fetch the native FCM
 * token, and dual-write it to Firestore. Returns the token or null.
 */
export async function registerAndSaveFcmToken(userId: string): Promise<string | null> {
  if (Platform.OS !== 'android') return null; // Android-only for this pass.
  const messaging = getMessagingInstance();
  if (!messaging || !messagingModule) return null;

  try {
    // Ensure notification permission (also gates POST_NOTIFICATIONS on 13+).
    if (typeof messagingModule.requestPermission === 'function') {
      await messagingModule.requestPermission(messaging);
    } else if (typeof messaging.requestPermission === 'function') {
      await messaging.requestPermission();
    }

    let token: string | null = null;
    if (typeof messagingModule.getToken === 'function') {
      token = await messagingModule.getToken(messaging);
    } else if (typeof messaging.getToken === 'function') {
      token = await messaging.getToken();
    }

    if (token) {
      console.log('[fcmService] FCM token:', token);
      await persistFcmToken(userId, token);
    }
    return token;
  } catch (err) {
    console.error('[fcmService] registerAndSaveFcmToken failed:', err);
    return null;
  }
}

/**
 * Subscribe to token refreshes and keep Firestore in sync.
 * Returns an unsubscribe function (no-op when unavailable).
 */
export function subscribeFcmTokenRefresh(userId: string): () => void {
  if (Platform.OS !== 'android') return () => {};
  const messaging = getMessagingInstance();
  if (!messaging || !messagingModule) return () => {};

  try {
    if (typeof messagingModule.onTokenRefresh === 'function') {
      return messagingModule.onTokenRefresh(messaging, (token: string) => {
        console.log('[fcmService] FCM token refreshed');
        persistFcmToken(userId, token);
      });
    }
    if (typeof messaging.onTokenRefresh === 'function') {
      return messaging.onTokenRefresh((token: string) => {
        console.log('[fcmService] FCM token refreshed');
        persistFcmToken(userId, token);
      });
    }
  } catch (err) {
    console.error('[fcmService] subscribeFcmTokenRefresh failed:', err);
  }
  return () => {};
}
