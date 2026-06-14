// ─── Hook: Incoming Call Answer ──────────────────────────────────────────────
// Manages answering/rejecting incoming calls

import { useState, useCallback, useRef, useEffect } from 'react';
import { SignalingService } from '../services/signalingService';
import { useWebRTC } from './useWebRTC';
import { useCallContext } from '../context/CallContext';

export function useIncomingCallAnswer() {
  const { setActiveCallId, setCallStatus, resetCallState } = useCallContext();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const callIdRef = useRef<string | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // WebRTC handlers
  const webrtcHandlers = {
    onIceCandidate: useCallback(async (candidate: RTCIceCandidateInit) => {
      const callId = callIdRef.current;
      if (!callId) return;
      
      try {
        await SignalingService.addIceCandidate(callId, candidate, true); // true = callee
        console.log('[useIncomingCallAnswer] ICE candidate sent to Firestore');
      } catch (err) {
        console.error('[useIncomingCallAnswer] Failed to add ICE candidate:', err);
      }
    }, []),

    onConnectionStateChange: useCallback((state: string) => {
      console.log('[useIncomingCallAnswer] Connection state:', state);
      
      if (state === 'connected') {
        setCallStatus('connected');
        // Start monitoring network quality once connected
        webrtc.startNetworkMonitoring();
      } else if (state === 'failed' || state === 'disconnected') {
        setCallStatus('failed');
      }
    }, [setCallStatus]),

    onNetworkQualityChange: useCallback((quality: string) => {
      console.log('[useIncomingCallAnswer] Network quality changed:', quality);
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

  // ── Answer call ────────────────────────────────────────────────────────────
  const answerCall = useCallback(
    async (callId: string, offer: RTCSessionDescriptionInit): Promise<boolean> => {
      setIsProcessing(true);
      setError(null);

      try {
        console.log('[useIncomingCallAnswer] Answering call:', callId);
        
        callIdRef.current = callId;
        setActiveCallId(callId);
        setCallStatus('accepted');

        // Step 1: Initialize WebRTC peer connection
        console.log('[useIncomingCallAnswer] Initializing peer connection...');
        await webrtc.initializePeerConnection();

        // Step 2: Create answer from the offer
        console.log('[useIncomingCallAnswer] Creating answer...');
        const answer = await webrtc.createAnswer(offer);

        // Step 3: Save answer to Firestore
        console.log('[useIncomingCallAnswer] Saving answer to Firestore...');
        await SignalingService.saveAnswer(callId, answer);

        // Step 4: Listen for ICE candidates from caller
        console.log('[useIncomingCallAnswer] Listening for ICE candidates...');
        unsubscribeRef.current = SignalingService.onCallUpdated(callId, async (call) => {
          if (!call) return;

          // Add ICE candidates from caller
          if (call.callerIceCandidates.length > 0) {
            console.log('[useIncomingCallAnswer] Adding', call.callerIceCandidates.length, 'ICE candidates');
            for (const candidate of call.callerIceCandidates) {
              await webrtc.addIceCandidate(candidate);
            }
          }

          // Handle call ended by caller
          if (call.status === 'ended') {
            console.log('[useIncomingCallAnswer] Call ended by caller');
            setCallStatus('ended');
          }
        });

        setIsProcessing(false);
        console.log('[useIncomingCallAnswer] Call answered successfully');
        return true;
      } catch (err) {
        console.error('[useIncomingCallAnswer] Failed to answer call:', err);
        setError(err instanceof Error ? err.message : 'Failed to answer call');
        setCallStatus('failed');
        setIsProcessing(false);
        return false;
      }
    },
    [webrtc, setActiveCallId, setCallStatus]
  );

  // ── Reject call ────────────────────────────────────────────────────────────
  const rejectCall = useCallback(async (callId: string): Promise<void> => {
    console.log('[useIncomingCallAnswer] Rejecting call:', callId);

    try {
      await SignalingService.updateCallStatus(callId, 'rejected');
      resetCallState();
      console.log('[useIncomingCallAnswer] Call rejected successfully');
    } catch (err) {
      console.error('[useIncomingCallAnswer] Error rejecting call:', err);
    }
  }, [resetCallState]);

  // ── End call ───────────────────────────────────────────────────────────────
  const endCall = useCallback(
    async (duration?: number) => {
      const callId = callIdRef.current;
      if (!callId) return;

      console.log('[useIncomingCallAnswer] Ending call...');

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

        console.log('[useIncomingCallAnswer] Call ended successfully');
      } catch (err) {
        console.error('[useIncomingCallAnswer] Error ending call:', err);
      }
    },
    [webrtc, resetCallState]
  );

  return {
    answerCall,
    rejectCall,
    endCall,
    isProcessing,
    error,
    localStream: webrtc.localStream,
    remoteStream: webrtc.remoteStream,
    connectionState: webrtc.connectionState,
    networkQuality: webrtc.networkQuality,
    toggleMute: webrtc.toggleMute,
  };
}
