// ─── Call Background Handlers (Android) ──────────────────────────────────────
// Registered at the entry point (index.android.ts) BEFORE the app renders, so
// they work even when the app is fully killed:
//
//   1) FCM data-only message handler — a background/killed data message of
//      type 'incoming-call' wakes the app and shows the native CallKeep
//      incoming-call UI + foreground service.
//   2) CallKeep headless task — handles answer/end actions taken on the native
//      UI while the JS app hasn't booted yet (the app is then launched and the
//      in-app answerCall/endCall handlers complete the WebRTC flow).
//
// Android-only for this pass; iOS killed-state (PushKit/CallKit) is future work.

import { AppRegistry, Platform } from 'react-native';
import { setupCallKeep, displayIncomingCall } from './callKeepService';

let registered = false;

export function registerCallBackgroundHandlers(): void {
  if (Platform.OS !== 'android') return;
  if (registered) return;
  registered = true;

  // ── 1) FCM data-only messages (backgrounded / killed) ────────────────────
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const messagingModule = require('@react-native-firebase/messaging');
    const messaging =
      typeof messagingModule.getMessaging === 'function'
        ? messagingModule.getMessaging()
        : messagingModule.default();

    const handler = async (remoteMessage: any) => {
      const data = remoteMessage?.data || {};
      console.log('[callBackground] FCM background message:', data?.type, data?.callId);

      if (data?.type !== 'incoming-call' || !data?.callId) return;

      await setupCallKeep();
      await displayIncomingCall({
        callId: String(data.callId),
        callerName: String(data.callerName || 'Incoming call'),
        hasVideo: data.callType === 'video',
      });
    };

    if (typeof messagingModule.setBackgroundMessageHandler === 'function') {
      messagingModule.setBackgroundMessageHandler(messaging, handler);
    } else if (typeof messaging.setBackgroundMessageHandler === 'function') {
      messaging.setBackgroundMessageHandler(handler);
    }
    console.log('[callBackground] FCM background handler registered');
  } catch (err) {
    console.error('[callBackground] Failed to register FCM background handler:', err);
  }

  // ── 2) CallKeep headless task (answer/end while killed) ───────────────────
  // CallKeep's RNCallKeepBackgroundMessagingService dispatches to this JS task
  // for actions performed before the app is alive. The heavy lifting (WebRTC
  // answer, navigation) is done by the in-app useCallKeepEvents handler once
  // the app is launched; this task just needs to exist so the native service
  // has something to invoke and can keep the process alive briefly.
  try {
    AppRegistry.registerHeadlessTask(
      'RNCallKeepBackgroundMessage',
      () => async (taskData: any) => {
        console.log(
          '[callBackground] CallKeep headless task:',
          taskData?.name,
          taskData?.callUUID,
        );
        // Intentionally minimal — see note above.
      },
    );
    console.log('[callBackground] CallKeep headless task registered');
  } catch (err) {
    console.error('[callBackground] Failed to register CallKeep headless task:', err);
  }
}
