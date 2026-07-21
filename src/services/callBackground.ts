import { Platform } from 'react-native';
import {
  displayIncomingCallNotification,
  registerNotifeeBackgroundHandler,
} from './incomingCallNotification';

let registered = false;

export function registerCallBackgroundHandlers(): void {
  console.log('[CALLKIT-DIAG][callBackground] registerCallBackgroundHandlers called | platform:', Platform.OS,
    '| alreadyRegistered:', registered);
  if (Platform.OS !== 'android') return;
  if (registered) return;
  registered = true;

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const messagingModule = require('@react-native-firebase/messaging');
    console.log('[CALLKIT-DIAG][callBackground] messaging module loaded:', !!messagingModule,
      '| getMessaging:', typeof messagingModule?.getMessaging,
      '| setBackgroundMessageHandler:', typeof messagingModule?.setBackgroundMessageHandler);
    const messaging =
      typeof messagingModule.getMessaging === 'function'
        ? messagingModule.getMessaging()
        : messagingModule.default();

    const handler = async (remoteMessage: any) => {
      console.log('[CALLKIT-DIAG][callBackground] >>> FCM BACKGROUND HANDLER FIRED <<<');
      console.log('[CALLKIT-DIAG][callBackground] raw remoteMessage:', JSON.stringify(remoteMessage));
      const data = remoteMessage?.data || {};
      console.log('[CALLKIT-DIAG][callBackground] data.type:', data?.type, '| data.callId:', data?.callId,
        '| callerName:', data?.callerName, '| callType:', data?.callType);

      if (data?.type !== 'incoming-call' || !data?.callId) {
        console.log('[CALLKIT-DIAG][callBackground] Not an incoming-call data message — ignoring');
        return;
      }

      console.log('[CALLKIT-DIAG][callBackground] posting full-screen incoming-call notification…');
      await displayIncomingCallNotification({
        callId: String(data.callId),
        callerName: String(data.callerName || 'Incoming call'),
        hasVideo: data.callType === 'video',
      });
      console.log('[CALLKIT-DIAG][callBackground] full-screen notification posted');
    };

    if (typeof messagingModule.setBackgroundMessageHandler === 'function') {
      messagingModule.setBackgroundMessageHandler(messaging, handler);
    } else if (typeof messaging.setBackgroundMessageHandler === 'function') {
      messaging.setBackgroundMessageHandler(handler);
    }
    console.log('[CALLKIT-DIAG][callBackground] FCM background handler registered');
  } catch (err) {
    console.error('[CALLKIT-DIAG][callBackground] Failed to register FCM background handler:', err);
  }

  registerNotifeeBackgroundHandler();
}
