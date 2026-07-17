// ─── Component: Incoming Call Manager ────────────────────────────────────────
// Manages incoming call detection and display

import React from 'react';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../hooks/useAuth';
import { useIncomingCalls } from '../hooks/useIncomingCalls';
import { useIncomingCallAnswer } from '../hooks/useIncomingCallAnswer';
import { useCallContext } from '../context/CallContext';
import { SignalingService } from '../services/signalingService';
import { IncomingCallScreen } from '.';
import type { RootStackParamList } from '../types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export function IncomingCallManager() {
  const { user } = useAuth();
  const navigation = useNavigation<NavigationProp>();
  const { incomingCall, setIncomingCall } = useCallContext();
  const incomingCallAnswer = useIncomingCallAnswer();

  // Listen for incoming calls (Firestore listener → sets incomingCall in context).
  // Also covers the iOS killed-state cold-start case: when the app is opened
  // from a call notification, this listener detects the still-ringing call and
  // presents the IncomingCallScreen so the user can answer via the proven
  // WebRTC answer path.
  useIncomingCalls(user?.uid || null);

  // NOTE: ringtone + vibration are owned by <IncomingCallScreen /> so it is
  // self-contained and reusable. Do NOT start the ringtone here as well, or it
  // will double-play.

  // Handle answer
  const handleAnswer = async () => {
    if (!incomingCall) return;

    console.log('[IncomingCallManager] Answering call:', incomingCall.callId, 'Type:', incomingCall.type);

    try {
      // Get the full call document to retrieve the offer
      const callDoc = await SignalingService.getCall(incomingCall.callId);
      
      if (!callDoc || !callDoc.offer) {
        console.error('[IncomingCallManager] Call document or offer not found');
        setIncomingCall(null);
        return;
      }

      // Answer the call with the correct type - wait for completion before navigation
      const success = await incomingCallAnswer.answerCall(
        incomingCall.callId, 
        callDoc.offer,
        incomingCall.type // Pass the call type (audio or video)
      );

      if (success) {
        // Small delay to ensure answer is fully processed
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Navigate to appropriate call screen based on type
        if (incomingCall.type === 'video') {
          navigation.navigate('VideoCall', {
            callId: incomingCall.callId,
            isOutgoing: false,
            otherParty: incomingCall.caller,
          });
        } else {
          navigation.navigate('AudioCall', {
            callId: incomingCall.callId,
            isOutgoing: false,
            otherParty: incomingCall.caller,
          });
        }

        // Clear incoming call from context after navigation starts
        setTimeout(() => setIncomingCall(null), 200);
      }
    } catch (error) {
      console.error('[IncomingCallManager] Error answering call:', error);
      setIncomingCall(null);
    }
  };

  // Handle reject
  const handleReject = async () => {
    if (!incomingCall) return;

    console.log('[IncomingCallManager] Rejecting call:', incomingCall.callId);

    try {
      await incomingCallAnswer.rejectCall(incomingCall.callId);
      setIncomingCall(null);
    } catch (error) {
      console.error('[IncomingCallManager] Error rejecting call:', error);
      setIncomingCall(null);
    }
  };

  return (
    <IncomingCallScreen
      visible={!!incomingCall}
      call={incomingCall}
      onAnswer={handleAnswer}
      onDecline={handleReject}
    />
  );
}
