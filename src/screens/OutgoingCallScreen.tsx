// ─── Screen: Outgoing Call ──────────────────────────────────────────────────
// Navigable screen wrapper for RingingCallScreen component.
//
// This screen is the SINGLE OWNER of the entire outgoing-call ringing lifecycle:
//   - Shows the ringing UI while the callee is notified.
//   - Listens to the call document for status changes.
//   - When the callee answers (status === 'active'): joins the caller into the
//     call's activeParticipants, starts the app-level LiveKit call via
//     ActiveCallContext, then dismisses itself.
//   - When declined / missed / cancelled: shows feedback and dismisses.
//   - On a 30s no-answer window: marks the call missed.
//   - On back / cancel: marks the call cancelled.
//
// Both CallsScreen and ChatScreen simply navigate here after initiateGroupCall();
// they do NOT run their own listeners. This avoids the split-brain design that
// previously caused double navigation and calls connecting before ringing.

import React, { useEffect, useRef } from 'react';
import { BackHandler, Alert } from 'react-native';
import { useRoute, RouteProp, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { doc, updateDoc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';
import { RingingCallScreen } from '../components/RingingCallScreen';
import { RootStackParamList } from '../types';
import type { CallParticipant } from '../types/call';
import { useActiveCall } from '../context/ActiveCallContext';
import { useGroupCall } from '../hooks/useGroupCall';
import { useAuth } from '../hooks/useAuth';
import { sendCallMessage } from '../hooks/useChatActions';

type RouteP = RouteProp<RootStackParamList, 'OutgoingCall'>;
type NavProp = NativeStackNavigationProp<RootStackParamList, 'OutgoingCall'>;

const RING_TIMEOUT_MS = 30000;
const CALLHOST_MOUNT_DELAY_MS = 150;

export default function OutgoingCallScreen() {
  const route = useRoute<RouteP>();
  const navigation = useNavigation<NavProp>();
  const { user } = useAuth();
  const { startCall: startActiveCall } = useActiveCall();
  const { joinGroupCall } = useGroupCall();

  const {
    callId,
    displayName,
    callType,
    photoUrl,
    roomName,
    callerName,
    chatId,
    memberCount,
    initials: calleeInitials,
  } = route.params;

  // Guards against firing terminal actions more than once. Using refs (not
  // state) so they take effect synchronously and never trigger a re-render.
  const callEndedRef = useRef(false);
  const answeredRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const delayTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Dismiss this screen exactly once.
  const dismiss = () => {
    if (callEndedRef.current) return;
    callEndedRef.current = true;
    navigation.goBack();
  };

  // User cancels the outgoing call (back button / cancel tap) before it's answered.
  const handleCancel = async () => {
    if (callEndedRef.current || answeredRef.current) {
      dismiss();
      return;
    }
    callEndedRef.current = true;

    console.log('[OutgoingCall] Cancelling call:', callId);
    try {
      const callRef = doc(db, 'groupCalls', callId);
      await updateDoc(callRef, { status: 'cancelled' });
    } catch (err) {
      console.error('[OutgoingCall] Failed to cancel call:', err);
    }
    navigation.goBack();
  };

  // ── The single listener that owns the outgoing lifecycle ──────────────────
  useEffect(() => {
    const callRef = doc(db, 'groupCalls', callId);

    const unsubscribe = onSnapshot(callRef, async (snapshot) => {
      if (!snapshot.exists()) {
        console.log('[OutgoingCall] Call document deleted');
        dismiss();
        return;
      }

      const data = snapshot.data();
      console.log('[OutgoingCall] Status update:', data.status);

      if (data.status === 'active') {
        // Callee answered. Start the active call, then dismiss.
        if (answeredRef.current) return;
        answeredRef.current = true;

        // Stop the no-answer timeout.
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }

        // Add the caller to activeParticipants so the participant-count based
        // hang-up detection sees BOTH parties (callee added itself on answer).
        try {
          if (user?.uid) await joinGroupCall(callId, user.uid);
        } catch (err) {
          console.warn('[OutgoingCall] Caller join failed (non-fatal):', err);
        }

        // Start the app-level LiveKit call (mounts CallHost).
        startActiveCall({
          roomName,
          displayName: callerName,
          audioOnly: callType === 'audio',
          groupName: displayName,
          memberCount,
          chatId,
          callId,
        });

        // Give CallHost a moment to mount before dismissing the ringing screen.
        delayTimeoutRef.current = setTimeout(() => {
          dismiss();
        }, CALLHOST_MOUNT_DELAY_MS);
      } else if (
        data.status === 'declined' ||
        data.status === 'missed' ||
        data.status === 'cancelled' ||
        data.status === 'ended'
      ) {
        // Terminal, non-answered state — dismiss with brief feedback.
        console.log('[OutgoingCall] Call ended:', data.status);
        if (callEndedRef.current) {
          return;
        }

        // Write call message to chat for missed/declined calls
        if (chatId && (data.status === 'declined' || data.status === 'missed' || data.status === 'cancelled')) {
          try {
            const callStatus = data.status === 'declined' ? 'rejected' : 'missed';
            await sendCallMessage(
              chatId,
              user?.uid ?? '',
              callType,
              null, // no duration for unanswered calls
              callStatus as 'missed' | 'rejected',
            );
          } catch (err) {
            console.warn('[OutgoingCall] Failed to write call message:', err);
          }
        }

        if (data.status === 'declined') {
          Alert.alert('Call declined', `${displayName} declined the call.`);
        } else if (data.status === 'missed') {
          Alert.alert('No answer', 'The call was not answered.');
        }
        dismiss();
      }
    });

    // No-answer timeout: mark the call missed after the ringing window.
    timeoutRef.current = setTimeout(async () => {
      if (answeredRef.current || callEndedRef.current) return;
      try {
        const snap = await getDoc(callRef);
        if (snap.exists() && snap.data().status === 'ringing') {
          console.log('[OutgoingCall] No answer after timeout - marking missed');
          await updateDoc(callRef, { status: 'missed' });
          // The listener above will handle dismissal + alert on the 'missed' status.
        }
      } catch (err) {
        console.error('[OutgoingCall] Timeout check failed:', err);
      }
    }, RING_TIMEOUT_MS);

    return () => {
      console.log('[OutgoingCall] Cleaning up listener');
      unsubscribe();
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      if (delayTimeoutRef.current) {
        clearTimeout(delayTimeoutRef.current);
        delayTimeoutRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callId]);

  // Android hardware back button → cancel the call.
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      handleCancel();
      return true; // We handle navigation ourselves.
    });
    return () => backHandler.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callId]);

  // iOS swipe-back / header back / tab navigation → cancel the call.
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      // Already answered or ended — let navigation proceed.
      if (callEndedRef.current || answeredRef.current) {
        return;
      }
      // Our own dismiss()/goBack() — let it proceed.
      if (e.data.action.type === 'GO_BACK') {
        return;
      }
      e.preventDefault();
      handleCancel();
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation, callId]);

  // Contact object for the ringing UI.
  const otherParty: CallParticipant = {
    userId: '',
    displayName,
    photoUrl,
  };

  return (
    <RingingCallScreen
      otherParty={otherParty}
      callType={callType}
      initials={calleeInitials}
      onEndCall={handleCancel}
    />
  );
}
