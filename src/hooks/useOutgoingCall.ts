// ─── Hook: Outgoing Call ─────────────────────────────────────────────────────
// Manages the flow of initiating an outgoing voice call

import { useState, useCallback, useRef, useEffect } from 'react';
import { SignalingService } from '../services/signalingService';
import { useCallContext } from '../context/CallContext';
import type { CallParticipant } from '../types/call';

export function useOutgoingCall() {
  const { 
    setActiveCallId, setCallStatus, resetCallState, setIsCaller,
    localStream, remoteStream, streamVersion, connectionState, networkQuality,
    initializePeerConnection, createOffer, setRemoteAnswer, addIceCandidate,
    toggleMute, toggleVideo, startNetworkMonitoring, stopNetworkMonitoring, cleanup
  } = useCallContext();
  
  const [isInitiating, setIsInitiating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const callIdRef = useRef<string | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null); // Timeout for no answer
  const answerProcessedRef = useRef<boolean>(false); // Track if answer has been processed
  const iceCandidatesProcessedRef = useRef<Set<string>>(new Set()); // Track processed ICE candidates

  // Mark this hook as caller when initialized
  useEffect(() => {
    setIsCaller(true);
  }, [setIsCaller]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, []);

  // ── Initiate call ──────────────────────────────────────────────────────────
  const initiateCall = useCallback(
    async (
      callerId: string,
      calleeId: string,
      callerInfo: CallParticipant,
      calleeInfo: CallParticipant,
      callType: 'audio' | 'video' = 'audio'
    ): Promise<string | null> => {
      setIsInitiating(true);
      setError(null);
      
      // Reset processing flags for new call
      answerProcessedRef.current = false;
      iceCandidatesProcessedRef.current.clear();

      try {
        console.log('[useOutgoingCall] Creating call document...', 'Type:', callType);
        
        // Step 1: Create call document in Firestore
        const callId = await SignalingService.createCall(
          callerId,
          calleeId,
          callerInfo,
          calleeInfo,
          callType
        );
        
        callIdRef.current = callId;
        setActiveCallId(callId);
        setCallStatus('ringing');

        // Step 2: Listen for answer from callee and status changes
        console.log('[useOutgoingCall] Listening for answer and status changes...');
        
        // Set 30-second timeout for no answer
        timeoutRef.current = setTimeout(async () => {
          console.log('[useOutgoingCall] 30-second timeout reached - no answer');
          await SignalingService.updateCallStatus(callId, 'missed');
          setCallStatus('missed');
          setError('No answer');
          cleanup();
          if (unsubscribeRef.current) {
            unsubscribeRef.current();
            unsubscribeRef.current = null;
          }
        }, 30000);
        
        unsubscribeRef.current = SignalingService.onCallUpdated(callId, async (call) => {
          if (!call) return;

          console.log('[useOutgoingCall] Firestore update - status:', call.status, 'hasAnswer:', !!call.answer, 'answerProcessed:', answerProcessedRef.current);

          // Handle call rejected/missed/ended FIRST before processing answer - IMMEDIATE cleanup
          if (call.status === 'rejected') {
            console.log('[useOutgoingCall] Call rejected - saving to history and cleaning up');
            if (timeoutRef.current) {
              clearTimeout(timeoutRef.current);
              timeoutRef.current = null;
            }
            
            // Save to call history for both parties
            try {
              // Save for caller (outgoing, rejected)
              await SignalingService.saveToCallHistory(
                call.caller.userId,
                callId,
                call.callee,
                call.type,
                'outgoing',
                'rejected',
                null,
                call.chatId || undefined
              );
              
              // Save for callee (incoming, rejected)
              await SignalingService.saveToCallHistory(
                call.callee.userId,
                callId,
                call.caller,
                call.type,
                'incoming',
                'rejected',
                null,
                call.chatId || undefined
              );
              console.log('[useOutgoingCall] Call saved to history for both parties');
            } catch (err) {
              console.error('[useOutgoingCall] Error saving rejected call to history:', err);
            }
            
            cleanup(); // Cleanup WebRTC
            setCallStatus('rejected');
            setError('Call rejected');
            if (unsubscribeRef.current) {
              unsubscribeRef.current();
              unsubscribeRef.current = null;
            }
            return; // Stop processing
          } else if (call.status === 'missed') {
            console.log('[useOutgoingCall] Call missed - saving to history and cleaning up');
            if (timeoutRef.current) {
              clearTimeout(timeoutRef.current);
              timeoutRef.current = null;
            }
            
            // Save to call history for both parties
            try {
              // Save for caller (outgoing, missed)
              await SignalingService.saveToCallHistory(
                call.caller.userId,
                callId,
                call.callee,
                call.type,
                'outgoing',
                'missed',
                null,
                call.chatId || undefined
              );
              
              // Save for callee (incoming, missed)
              await SignalingService.saveToCallHistory(
                call.callee.userId,
                callId,
                call.caller,
                call.type,
                'incoming',
                'missed',
                null,
                call.chatId || undefined
              );
              console.log('[useOutgoingCall] Call saved to history for both parties');
            } catch (err) {
              console.error('[useOutgoingCall] Error saving missed call to history:', err);
            }
            
            cleanup(); // Cleanup WebRTC
            setCallStatus('missed');
            setError('Call not answered');
            if (unsubscribeRef.current) {
              unsubscribeRef.current();
              unsubscribeRef.current = null;
            }
            return; // Stop processing
          } else if (call.status === 'ended') {
            console.log('[useOutgoingCall] Call ended by remote party - immediate cleanup');
            
            if (timeoutRef.current) {
              clearTimeout(timeoutRef.current);
              timeoutRef.current = null;
            }
            
            // Cleanup WebRTC FIRST to stop audio immediately
            cleanup();
            
            // Then update status
            setCallStatus('ended');
            
            // Unsubscribe from further updates
            if (unsubscribeRef.current) {
              unsubscribeRef.current();
              unsubscribeRef.current = null;
            }
            return; // Stop processing
          }

          // When callee answers - NOW connect to media room
          if (call.answer && call.status === 'accepted') {
            if (answerProcessedRef.current) {
              console.log('[useOutgoingCall] Answer already processed, skipping...');
              // Don't process answer again, but continue to ICE candidates
            } else {
              console.log('[useOutgoingCall] Answer received! Now connecting to media room...');
              
              // Mark as processed immediately to prevent duplicate processing
              answerProcessedRef.current = true;
              
              try {
                // Clear timeout since call was answered
                if (timeoutRef.current) {
                  clearTimeout(timeoutRef.current);
                  timeoutRef.current = null;
                }
                
                // NOW initialize peer connection (after receiver accepted)
                const isVideo = callType === 'video';
                console.log('[useOutgoingCall] Initializing peer connection... Video:', isVideo);
                await initializePeerConnection(isVideo);

                // Set remote answer
                console.log('[useOutgoingCall] Setting remote answer...');
                await setRemoteAnswer(call.answer);
                
                setCallStatus('connected');
                console.log('[useOutgoingCall] Call connected!');
              } catch (err) {
                console.error('[useOutgoingCall] Failed to establish connection:', err);
                setError('Failed to establish connection');
                setCallStatus('failed');
                // Reset flag on error so it can be retried
                answerProcessedRef.current = false;
              }
            }
          }

          // Add ICE candidates from callee (only new ones)
          if (call.calleeIceCandidates.length > 0) {
            for (const candidate of call.calleeIceCandidates) {
              // Create a unique key for this candidate
              const candidateKey = `${candidate.candidate}-${candidate.sdpMLineIndex}-${candidate.sdpMid}`;
              
              if (!iceCandidatesProcessedRef.current.has(candidateKey)) {
                iceCandidatesProcessedRef.current.add(candidateKey);
                console.log('[useOutgoingCall] Adding ICE candidate');
                await addIceCandidate(candidate);
              }
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
    [initializePeerConnection, createOffer, setRemoteAnswer, addIceCandidate, setActiveCallId, setCallStatus]
  );

  // ── End call ───────────────────────────────────────────────────────────────
  const endCall = useCallback(
    async (duration?: number) => {
      // Get callId from context instead of ref
      const callId = callIdRef.current;
      console.log('[useOutgoingCall] ===== END CALL STARTED =====');
      console.log('[useOutgoingCall] Call ID from ref:', callId);
      console.log('[useOutgoingCall] Duration:', duration);
      
      if (!callId) {
        console.error('[useOutgoingCall] ❌ No callId in ref, cannot end call!');
        console.log('[useOutgoingCall] This means the hook was recreated and lost the callId');
        return;
      }

      console.log('[useOutgoingCall] Ending call...');

      try {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
        
        // Update call status in Firestore
        console.log('[useOutgoingCall] Step 1: Updating Firestore status to ended...');
        await SignalingService.updateCallStatus(callId, 'ended', duration);
        console.log('[useOutgoingCall] Step 2: Firestore updated successfully');

        // Save to call history
        console.log('[useOutgoingCall] Step 3: Fetching call document...');
        const call = await SignalingService.getCall(callId);
        console.log('[useOutgoingCall] Step 4: Call document fetched:', !!call);
        
        if (call) {
          // Save for caller (outgoing)
          console.log('[useOutgoingCall] Step 5: Saving to caller history...');
          await SignalingService.saveToCallHistory(
            call.caller.userId,
            callId,
            call.callee,
            call.type,
            'outgoing',
            duration && duration > 0 ? 'completed' : 'missed',
            duration || null
          );
          console.log('[useOutgoingCall] Step 6: Caller history saved');

          // Save for callee (incoming)
          console.log('[useOutgoingCall] Step 7: Saving to callee history...');
          await SignalingService.saveToCallHistory(
            call.callee.userId,
            callId,
            call.caller,
            call.type,
            'incoming',
            duration && duration > 0 ? 'completed' : 'missed',
            duration || null
          );
          console.log('[useOutgoingCall] Step 8: Callee history saved');
        }

        // Cleanup WebRTC
        console.log('[useOutgoingCall] Step 9: Cleaning up WebRTC...');
        cleanup();
        console.log('[useOutgoingCall] Step 10: WebRTC cleaned up');

        // Cleanup listener
        if (unsubscribeRef.current) {
          console.log('[useOutgoingCall] Step 11: Unsubscribing listener...');
          unsubscribeRef.current();
          unsubscribeRef.current = null;
          console.log('[useOutgoingCall] Step 12: Listener unsubscribed');
        }

        // Reset state
        callIdRef.current = null;
        resetCallState();

        console.log('[useOutgoingCall] ===== END CALL COMPLETED =====');
      } catch (err) {
        console.error('[useOutgoingCall] ❌ Error ending call:', err);
      }
    },
    [cleanup, resetCallState]
  );

  // Add method to accept a callId from outside (for when the hook is recreated)
  const setCallId = useCallback((id: string) => {
    console.log('[useOutgoingCall] Setting callId to:', id);
    callIdRef.current = id;
  }, []);

  // ── Cancel call (before answered) ──────────────────────────────────────────
  const cancelCall = useCallback(async () => {
    const callId = callIdRef.current;
    if (!callId) return;

    console.log('[useOutgoingCall] Cancelling call...');

    try {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      
      await SignalingService.updateCallStatus(callId, 'ended');
      cleanup();

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
  }, [cleanup, resetCallState]);

  return {
    initiateCall,
    endCall,
    cancelCall,
    setCallId,
    isInitiating,
    error,
    localStream,
    remoteStream,
    streamVersion,
    connectionState,
    networkQuality,
    toggleMute,
    toggleVideo,
  };
}
