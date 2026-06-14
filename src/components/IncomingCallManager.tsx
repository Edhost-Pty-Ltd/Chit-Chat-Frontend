// ─── Component: Incoming Call Manager ────────────────────────────────────────
// Manages incoming call detection and display

import React, { useEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../hooks/useAuth';
import { useIncomingCalls } from '../hooks/useIncomingCalls';
import { useIncomingCallAnswer } from '../hooks/useIncomingCallAnswer';
import { useCallContext } from '../context/CallContext';
import { SignalingService } from '../services/signalingService';
import { IncomingCallOverlay } from '.';
import type { RootStackParamList } from '../types';
import type { Call } from '../types/call';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export function IncomingCallManager() {
  const { user } = useAuth();
  const navigation = useNavigation<NavigationProp>();
  const { incomingCall, setIncomingCall, resetCallState } = useCallContext();
  const incomingCallAnswer = useIncomingCallAnswer();
  
  // Listen for incoming calls
  useIncomingCalls(user?.uid || null);

  // Handle answer
  const handleAnswer = async () => {
    if (!incomingCall) return;

    console.log('[IncomingCallManager] Answering call:', incomingCall.callId);

    try {
      // Get the full call document to retrieve the offer
      const callDoc = await SignalingService.getCall(incomingCall.callId);
      
      if (!callDoc || !callDoc.offer) {
        console.error('[IncomingCallManager] Call document or offer not found');
        setIncomingCall(null);
        return;
      }

      // Answer the call
      const success = await incomingCallAnswer.answerCall(incomingCall.callId, callDoc.offer);

      if (success) {
        // Navigate to AudioCallScreen
        navigation.navigate('AudioCall', {
          callId: incomingCall.callId,
          isOutgoing: false,
          otherParty: incomingCall.caller,
        });

        // Clear incoming call from context
        setIncomingCall(null);
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
    <IncomingCallOverlay
      visible={!!incomingCall}
      call={incomingCall}
      onAnswer={handleAnswer}
      onReject={handleReject}
    />
  );
}
