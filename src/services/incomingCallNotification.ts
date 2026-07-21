import { Platform } from 'react-native';

let notifee: any = null;
let AndroidImportance: any = null;
let AndroidCategory: any = null;
let AndroidVisibility: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod = require('@notifee/react-native');
  notifee = mod.default;
  AndroidImportance = mod.AndroidImportance;
  AndroidCategory = mod.AndroidCategory;
  AndroidVisibility = mod.AndroidVisibility;
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
        fullScreenAction: { id: 'default' },
        pressAction: { id: 'default' },
        ongoing: true,
        autoCancel: false,
        loopSound: true,
        timeoutAfter: 45000,
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

export function registerNotifeeBackgroundHandler(): void {
  if (Platform.OS !== 'android' || !notifee) return;
  try {
    notifee.onBackgroundEvent(async ({ type, detail }: any) => {
      console.log('[CALLKIT-DIAG][incomingCallNotification] bg event type:', type,
        '| notifId:', detail?.notification?.id);
    });
    console.log('[CALLKIT-DIAG][incomingCallNotification] notifee background handler registered');
  } catch (err) {
    console.error('[incomingCallNotification] registerNotifeeBackgroundHandler failed:', err);
  }
}

export function isIncomingCallNotificationAvailable(): boolean {
  return !!notifee;
}
