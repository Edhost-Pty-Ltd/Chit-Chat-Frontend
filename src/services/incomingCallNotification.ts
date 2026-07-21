import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

const PENDING_ANSWER_KEY = '@chitchat:pendingAnswerCallId';

// Set by GroupCallNotificationManager while mounted, so an Answer tap can drive
// the in-app join immediately when the app is already alive.
let answerHandler: ((callId: string) => void) | null = null;

export function setAnswerHandler(fn: ((callId: string) => void) | null): void {
  answerHandler = fn;
}

// Read + clear the pending auto-answer callId persisted across a cold start
// (Answer tapped while the app was killed → app launches → consume on mount).
export async function consumePendingAnswer(): Promise<string | null> {
  try {
    const id = await AsyncStorage.getItem(PENDING_ANSWER_KEY);
    if (id) await AsyncStorage.removeItem(PENDING_ANSWER_KEY);
    return id;
  } catch {
    return null;
  }
}

let notifee: any = null;
let AndroidImportance: any = null;
let AndroidCategory: any = null;
let AndroidVisibility: any = null;
let EventType: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod = require('@notifee/react-native');
  notifee = mod.default;
  AndroidImportance = mod.AndroidImportance;
  AndroidCategory = mod.AndroidCategory;
  AndroidVisibility = mod.AndroidVisibility;
  EventType = mod.EventType;
  console.log('[CALLKIT-DIAG][incomingCallNotification] notifee loaded:', !!notifee);
} catch (e) {
  console.warn('[incomingCallNotification] @notifee/react-native not available — full-screen call UI disabled.', e);
}

export const INCOMING_CALL_CHANNEL_ID = 'incoming-call-fullscreen';
const NOTIF_ID_PREFIX = 'incoming-call-';

let channelReady = false;

async function ensureChannel(): Promise<void> {
  if (!notifee || channelReady) return;
  await notifee.createChannel({
    id: INCOMING_CALL_CHANNEL_ID,
    name: 'Incoming Calls',
    importance: AndroidImportance.HIGH,
    sound: 'default',
    vibration: true,
    vibrationPattern: [300, 500, 300, 500],
    visibility: AndroidVisibility.PUBLIC,
    bypassDnd: true,
  });
  channelReady = true;
}

export async function displayIncomingCallNotification(params: {
  callId: string;
  callerName: string;
  hasVideo?: boolean;
}): Promise<void> {
  console.log('[CALLKIT-DIAG][incomingCallNotification] display called | callId:', params.callId,
    '| caller:', params.callerName, '| available:', !!notifee);
  if (Platform.OS !== 'android' || !notifee) return;
  try {
    await ensureChannel();
    await notifee.displayNotification({
      id: NOTIF_ID_PREFIX + params.callId,
      title: params.callerName || 'Incoming call',
      body: params.hasVideo ? 'Incoming video call' : 'Incoming call',
      data: { type: 'incoming-call', callId: params.callId },
      android: {
        channelId: INCOMING_CALL_CHANNEL_ID,
        category: AndroidCategory.CALL,
        importance: AndroidImportance.HIGH,
        visibility: AndroidVisibility.PUBLIC,
        color: '#1E9CF0',
        colorized: true,
        fullScreenAction: { id: 'default' },
        pressAction: { id: 'default', launchActivity: 'default' },
        ongoing: true,
        autoCancel: false,
        loopSound: true,
        timeoutAfter: 45000,
        actions: [
          {
            title: '\u274C Decline',
            pressAction: { id: 'decline' },
          },
          {
            title: '\u2705 Answer',
            pressAction: { id: 'answer', launchActivity: 'default' },
          },
        ],
      },
    });
    console.log('[CALLKIT-DIAG][incomingCallNotification] displayNotification OK:', params.callId);
  } catch (err) {
    console.error('[CALLKIT-DIAG][incomingCallNotification] displayNotification failed:', err);
  }
}

export async function cancelIncomingCallNotification(callId?: string): Promise<void> {
  if (!notifee) return;
  try {
    if (callId) {
      await notifee.cancelNotification(NOTIF_ID_PREFIX + callId);
    } else {
      await notifee.cancelDisplayedNotifications();
    }
  } catch (err) {
    console.error('[incomingCallNotification] cancel failed:', err);
  }
}

async function declineCallInFirestore(callId: string): Promise<void> {
  try {
    await updateDoc(doc(db, 'groupCalls', callId), { status: 'declined' });
    console.log('[CALLKIT-DIAG][incomingCallNotification] marked call declined:', callId);
  } catch (err) {
    console.warn('[incomingCallNotification] declineCallInFirestore failed (caller will time out to missed):', err);
  }
}

async function handleNotificationEvent({ type, detail }: any): Promise<void> {
  const pressActionId = detail?.pressAction?.id;
  const callId = detail?.notification?.data?.callId;
  console.log('[CALLKIT-DIAG][incomingCallNotification] event type:', type,
    '| pressAction:', pressActionId, '| callId:', callId);

  if (type !== EventType?.ACTION_PRESS && type !== EventType?.PRESS) return;

  if (pressActionId === 'decline') {
    if (callId) await declineCallInFirestore(String(callId));
    await cancelIncomingCallNotification(callId ? String(callId) : undefined);
    return;
  }

  // 'answer' or default press → the app launches (launchActivity). Record the
  // callId so the in-app GroupCallNotificationManager auto-joins the LiveKit
  // room (one-tap answer, WhatsApp-style) instead of showing another prompt.
  if (callId) {
    const id = String(callId);
    if (pressActionId === 'answer') {
      try {
        await AsyncStorage.setItem(PENDING_ANSWER_KEY, id);
      } catch {}
      answerHandler?.(id);
    }
    await cancelIncomingCallNotification(id);
  }
}

export function registerNotifeeBackgroundHandler(): void {
  if (Platform.OS !== 'android' || !notifee) return;
  try {
    notifee.onBackgroundEvent(handleNotificationEvent);
    console.log('[CALLKIT-DIAG][incomingCallNotification] notifee background handler registered');
  } catch (err) {
    console.error('[incomingCallNotification] registerNotifeeBackgroundHandler failed:', err);
  }
}

export function registerNotifeeForegroundHandler(): () => void {
  if (Platform.OS !== 'android' || !notifee) return () => {};
  try {
    return notifee.onForegroundEvent(handleNotificationEvent);
  } catch (err) {
    console.error('[incomingCallNotification] registerNotifeeForegroundHandler failed:', err);
    return () => {};
  }
}

export function isIncomingCallNotificationAvailable(): boolean {
  return !!notifee;
}
