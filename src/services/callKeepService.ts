// ─── CallKeep Service ────────────────────────────────────────────────────────
// Thin wrapper around react-native-callkeep for the native incoming-call UI.
//
// In this pass CallKeep is used for ANDROID full killed-state support
// (ConnectionService + full-screen incoming-call UI + foreground service).
// iOS CallKit/PushKit is intentionally NOT wired yet (best-effort in-app UI
// only) — see the `// TODO: PushKit/VoIP` markers elsewhere.
//
// The native module is lazy-required so the app still boots in Expo Go / web /
// any build where react-native-callkeep isn't linked.

import { Platform } from 'react-native';

// Lazy module handle.
let RNCallKeep: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  RNCallKeep = require('react-native-callkeep').default;
} catch {
  console.warn('[callKeepService] react-native-callkeep not available — native call UI disabled.');
}

/** Android foreground-service notification channel used while a call rings. */
export const CALLKEEP_FOREGROUND_CHANNEL_ID = 'com.edhost.chitchat.callkeep';

let isSetup = false;

/**
 * Configure CallKeep. Safe to call multiple times (no-ops after first success).
 * Must run before displayIncomingCall — including inside the FCM background
 * handler on Android, where the JS app may not have booted yet.
 */
export async function setupCallKeep(): Promise<boolean> {
  if (!RNCallKeep) return false;
  if (isSetup) return true;

  try {
    await RNCallKeep.setup({
      ios: {
        // iOS CallKit is configured by the native plugin but not driven in this
        // pass. These options are harmless defaults for when PushKit lands.
        appName: 'Chit-Chat',
        supportsVideo: true,
        maximumCallGroups: '1',
        maximumCallsPerCallGroup: '1',
      },
      android: {
        alertTitle: 'Permissions required',
        alertDescription: 'Chit-Chat needs phone-account access to show incoming calls.',
        cancelButton: 'Cancel',
        okButton: 'OK',
        // Standard (non self-managed) ConnectionService: Android renders the
        // system incoming-call UI and launches the app on answer.
        selfManaged: false,
        // Foreground service keeps the process alive long enough to show the
        // call UI when the app was killed and woken by a data FCM message.
        foregroundService: {
          channelId: CALLKEEP_FOREGROUND_CHANNEL_ID,
          channelName: 'Incoming calls',
          notificationTitle: 'Incoming call',
          // Must be a drawable/mipmap resource that actually exists, or the
          // foreground-service notification fails to build and the call UI
          // never shows. 'ic_launcher' is always present (app launcher icon).
          notificationIcon: 'mipmap/ic_launcher',
        },
        additionalPermissions: [],
      },
    });

    // Register the JS-side Android event bridge (answerCall/endCall/etc.).
    if (Platform.OS === 'android' && RNCallKeep.registerAndroidEvents) {
      RNCallKeep.registerAndroidEvents();
    }

    RNCallKeep.setAvailable(true);
    isSetup = true;
    console.log('[callKeepService] CallKeep setup complete');
    return true;
  } catch (err) {
    console.error('[callKeepService] setup failed:', err);
    return false;
  }
}

/**
 * Show the native incoming-call screen.
 * We use the Firestore callId as the CallKeep UUID so answer/end events map
 * back to the call unambiguously (Android accepts arbitrary UUID strings).
 */
export async function displayIncomingCall(params: {
  callId: string;
  callerName: string;
  hasVideo?: boolean;
  handle?: string;
}): Promise<void> {
  if (!RNCallKeep) return;
  await setupCallKeep();
  try {
    RNCallKeep.displayIncomingCall(
      params.callId,
      params.handle ?? params.callerName,
      params.callerName,
      'generic',
      !!params.hasVideo,
    );
    console.log('[callKeepService] displayIncomingCall:', params.callId);
  } catch (err) {
    console.error('[callKeepService] displayIncomingCall failed:', err);
  }
}

/** Tell the OS the call connected (dismisses the ringing UI, keeps call active). */
export function setCurrentCallActive(callId: string): void {
  if (!RNCallKeep) return;
  try {
    RNCallKeep.setCurrentCallActive(callId);
    RNCallKeep.backToForeground?.();
  } catch (err) {
    console.error('[callKeepService] setCurrentCallActive failed:', err);
  }
}

/** End a specific call in the native UI and stop the foreground service. */
export function endCall(callId: string): void {
  if (!RNCallKeep) return;
  try {
    RNCallKeep.endCall(callId);
  } catch (err) {
    console.error('[callKeepService] endCall failed:', err);
  }
}

/** End every native call (safety net on teardown). */
export function endAllCalls(): void {
  if (!RNCallKeep) return;
  try {
    RNCallKeep.endAllCalls();
  } catch (err) {
    console.error('[callKeepService] endAllCalls failed:', err);
  }
}

/** Reject/decline an incoming native call. */
export function rejectCall(callId: string): void {
  if (!RNCallKeep) return;
  try {
    RNCallKeep.rejectCall(callId);
  } catch (err) {
    console.error('[callKeepService] rejectCall failed:', err);
  }
}

export function isCallKeepAvailable(): boolean {
  return !!RNCallKeep;
}

export function getCallKeep(): any {
  return RNCallKeep;
}
