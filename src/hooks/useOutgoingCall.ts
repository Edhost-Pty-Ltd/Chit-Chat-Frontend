// ─── Hook: Outgoing Call ─────────────────────────────────────────────────────
// Manages the flow of initiating an outgoing voice call

import { useState, useCallback, useRef, useEffect } from 'react';
import { SignalingService } from '../services/signalingService';
import { useWebRTC } from './useWebRTC';
import { useCallContext } from '../context/CallContext';
import type { CallParticipant } from '../types/call';

export function useOutgoingCall() {
  const { setActiveCallId, setCallStatus, resetCallState } = useCallContext();
  const [isInitiating, setIsInitiating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const callIdRef = useRef<string | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // WebRTC handlers
  const webrtcHandlers = {
    onIceCandidate: useCallback(async (candidate: RTCIceCandidateInit) => {
      const callId = callIdRef.current;
      if (!callId) return;
      
      try {
        await SignalingService.addIceCandidate(callId, candidate, false); // false = caller
        console.log('[useOutgoingCall] ICE candidate sent to Firestore');
      } catch (err) {
        console.error('[useOutgoingCall] Failed to add ICE candidate:', err);
      }
    }, []),

    onConnectionStateChange: useCallback((state: string) => {
      console.log('[useOutgoingCall] Connection state:', state);
      
      if (state === 'connected') {
        setCallStatus('connected');
        // Start monitoring network quality once connected
        webrtc.startNetworkMonitoring();
      } else if (state === 'failed' || state === 'disconnected') {
        setCallStatus('failed');
      }
    }, [setCallStatus]),

    onNetworkQualityChange: useCallback((quality: string) => {
      console.log('[useOutgoingCall] Network quality changed:', quality);
    }, []),
  };

  const webrtc = useWebRTC(webrtcHandlers);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, []);

  // ── Initiate call ──────────────────────────────────────────────────────────
  const initiateCall = useCallback(
    async (
      callerId: string,
      calleeId: string,
      callerInfo: CallParticipant,
      calleeInfo: CallParticipant
    ): Promise<string | null> => {
      setIsInitiating(true);
      setError(null);

      try {
        console.log('[useOutgoingCall] Creating call document...');
        
        // Step 1: Create call document in Firestore
        const callId = await SignalingService.createCall(
          callerId,
          calleeId,
          callerInfo,
          calleeInfo,
          'audio'
        );
        
        callIdRef.current = callId;
        setActiveCallId(callId);
        setCallStatus('ringing');

        // Step 2: Initialize WebRTC peer connection
        console.log('[useOutgoingCall] Initializing peer connection...');
        await webrtc.initializePeerConnection();

        // Step 3: Create WebRTC offer
        console.log('[useOutgoingCall] Creating offer...');
        const offer = await webrtc.createOffer();

        // Step 4: Save offer to Firestore
        console.log('[useOutgoingCall] Saving offer to Firestore...');
        await SignalingService.saveOffer(callId, offer);

        // Step 5: Listen for answer from callee
        console.log('[useOutgoingCall] Listening for answer...');
        unsubscribeRef.current = SignalingService.onCallUpdated(callId, async (call) => {
          if (!call) return;

          // When callee answers
          if (call.answer && call.status === 'accepted') {
            console.log('[useOutgoingCall] Answer received, setting remote description...');
            
            try {
              await webrtc.setRemoteAnswer(call.answer);
              setCallStatus('connected');
              console.log('[useOutgoingCall] Call connected!');
            } catch (err) {
              console.error('[useOutgoingCall] Failed to set remote answer:', err);
              setError('Failed to establish connection');
              setCallStatus('failed');
            }
          }

          // Handle call rejected/missed/ended
          if (call.status === 'rejected') {
            console.log('[useOutgoingCall] Call rejected');
            setCallStatus('rejected');
            setError('Call rejected');
          } else if (call.status === 'missed') {
            console.log('[useOutgoingCall] Call missed');
            setCallStatus('missed');
            setError('Call not answered');
          } else if (call.status === 'ended') {
            console.log('[useOutgoingCall] Call ended');
            setCallStatus('ended');
          }

          // Add ICE candidates from callee
          if (call.calleeIceCandidates.length > 0) {
            console.log('[useOutgoingCall] Adding', call.calleeIceCandidates.length, 'ICE candidates');
            for (const candidate of call.calleeIceCandidates) {
              await webrtc.addIceCandidate(candidate);
            }
          }
        });

        setIsInitiating(false);
        return callId;
      } catch (err) {
        console.error('[useOutgoingCall] Failed to initiate call:', err);
        setError(err instanceof Error ? err.message : 'Failed to initiate call');
        setCallStatus('failed');
        setIsInitiating(false);
        return null;
      }
    },
    [webrtc, setActiveCallId, setCallStatus]
  );

  // ── End call ───────────────────────────────────────────────────────────────
  const endCall = useCallback(
    async (duration?: number) => {
      const callId = callIdRef.current;
      if (!callId) return;

      console.log('[useOutgoingCall] Ending call...');

      try {
        // Update call status in Firestore
        await SignalingService.updateCallStatus(callId, 'ended', duration);

        // Save to call history
        const call = await SignalingService.getCall(callId);
        if (call) {
          // Save for caller (outgoing)
          await SignalingService.saveToCallHistory(
            call.caller.userId,
            callId,
            call.callee,
            call.type,
            'outgoing',
            duration && duration > 0 ? 'completed' : 'missed',
            duration || null
          );

          // Save for callee (incoming)
          await SignalingService.saveToCallHistory(
            call.callee.userId,
            callId,
            call.caller,
            call.type,
            'incoming',
            duration && duration > 0 ? 'completed' : 'missed',
            duration || null
          );
        }

        // Cleanup WebRTC
        webrtc.cleanup();

        // Cleanup listener
        if (unsubscribeRef.current) {
          unsubscribeRef.current();
          unsubscribeRef.current = null;
        }

        // Reset state
        callIdRef.current = null;
        resetCallState();

        console.log('[useOutgoingCall] Call ended successfully');
      } catch (err) {
        console.error('[useOutgoingCall] Error ending call:', err);
      }
    },
    [webrtc, resetCallState]
  );

  // ── Cancel call (before answered) ──────────────────────────────────────────
  const cancelCall = useCallback(async () => {
    const callId = callIdRef.current;
    if (!callId) return;

    console.log('[useOutgoingCall] Cancelling call...');

    try {
      await SignalingService.updateCallStatus(callId, 'ended');
      webrtc.cleanup();

      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }

      callIdRef.current = null;
      resetCallState();

      console.log('[useOutgoingCall] Call cancelled');
    } catch (err) {
      console.error('[useOutgoingCall] Error cancelling call:', err);
    }
  }, [webrtc, resetCallState]);

  return {
    initiateCall,
    endCall,
    cancelCall,
    isInitiating,
    error,
    localStream: webrtc.localStream,
    remoteStream: webrtc.remoteStream,
    connectionState: webrtc.connectionState,
    networkQuality: webrtc.networkQuality,
    toggleMute: webrtc.toggleMute,
  };
}
