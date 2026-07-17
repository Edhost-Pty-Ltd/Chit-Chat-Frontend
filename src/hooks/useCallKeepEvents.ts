// ─── Hook: CallKeep Events ───────────────────────────────────────────────────
// Bridges native CallKeep actions (answer / hang up on the Android system call
// UI) into the app's existing WebRTC answer flow.
//
// Flow for an Android killed-state call:
//   FCM data message → callBackground shows native UI → user taps Answer →
//   Android launches the app → 'answerCall' (or a replayed 'didLoadWithEvents')
//   fires here → we fetch the offer, run the proven useIncomingCallAnswer path,
//   mark the CallKeep call active, and route into AudioCall/VideoCall via the
//   navigationQueue (cold-start safe).
//
// Android-only; no-ops where CallKeep isn't available.

import { useEffect } from 'react';
import { Platform } from 'react-native';
import { useIncomingCallAnswer } from './useIncomingCallAnswer';
import { useCallContext } from '../context/CallContext';
import { SignalingService } from '../services/signalingService';
import { navigate, navigationQueue } from '../services/navigationService';
import {
  isCallKeepAvailable,
  getCallKeep,
  setupCallKeep,
  setCurrentCallActive,
  endCall as callKeepEndCall,
} from '../services/callKeepService';

export function useCallKeepEvents() {
  const incomingCallAnswer = useIncomingCallAnswer();
  const { setIncomingCall } = useCallContext();

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    if (!isCallKeepAvailable()) return;

    const RNCallKeep = getCallKeep();
    setupCallKeep();

    // User accepted on the native call UI → run the WebRTC answer + navigate.
    const handleAnswer = async ({ callUUID }: { callUUID: string }) => {
      const callId = callUUID;
      console.log('[useCallKeepEvents] answerCall:', callId);
      try {
        const call = await SignalingService.getCall(callId);
        if (!call || !call.offer) {
          console.warn('[useCallKeepEvents] No call/offer for answer; ending native call');
          callKeepEndCall(callId);
          setIncomingCall(null);
          return;
        }

        const ok = await incomingCallAnswer.answerCall(callId, call.offer, call.type);
        if (!ok) {
          callKeepEndCall(callId);
          setIncomingCall(null);
          return;
        }

        // Dismiss the ringing UI and mark the call connected in the OS.
        setCurrentCallActive(callId);

        // Route into the call screen (queued until the navigator is ready —
        // handles the cold-start case where the app just launched).
        const routeName = call.type === 'video' ? 'VideoCall' : 'AudioCall';
        navigationQueue.enqueue(() =>
          navigate(routeName, {
            callId,
            isOutgoing: false,
            otherParty: call.caller,
          }),
        );

        // The overlay is not needed — the native UI handled acceptance.
        setIncomingCall(null);
      } catch (err) {
        console.error('[useCallKeepEvents] answerCall error:', err);
        callKeepEndCall(callId);
        setIncomingCall(null);
      }
    };

    // User hung up / declined on the native UI.
    const handleEnd = async ({ callUUID }: { callUUID: string }) => {
      const callId = callUUID;
      console.log('[useCallKeepEvents] endCall:', callId);
      try {
        const call = await SignalingService.getCall(callId);
        // Still ringing → treat as a decline; otherwise tear down the call.
        if (call && call.status === 'ringing') {
          await incomingCallAnswer.rejectCall(callId);
        } else {
          await incomingCallAnswer.endCall();
        }
      } catch (err) {
        console.error('[useCallKeepEvents] endCall error:', err);
      } finally {
        setIncomingCall(null);
      }
    };

    // Replays actions that happened before JS was ready (cold-start answer).
    const handleDidLoadWithEvents = (events: any) => {
      const list = Array.isArray(events) ? events : events?.events;
      if (!Array.isArray(list)) return;
      for (const e of list) {
        if (e?.name === 'RNCallKeepPerformAnswerCallAction' && e?.data?.callUUID) {
          handleAnswer({ callUUID: e.data.callUUID });
        } else if (e?.name === 'RNCallKeepPerformEndCallAction' && e?.data?.callUUID) {
          handleEnd({ callUUID: e.data.callUUID });
        }
      }
    };

    RNCallKeep.addEventListener('answerCall', handleAnswer);
    RNCallKeep.addEventListener('endCall', handleEnd);
    RNCallKeep.addEventListener('didLoadWithEvents', handleDidLoadWithEvents);

    return () => {
      RNCallKeep.removeEventListener('answerCall');
      RNCallKeep.removeEventListener('endCall');
      RNCallKeep.removeEventListener('didLoadWithEvents');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
