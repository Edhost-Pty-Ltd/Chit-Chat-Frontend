// ─── Hook: Incoming Calls ────────────────────────────────────────────────────
// Listen for incoming calls in Firestore

import { useEffect } from 'react';
import {
  collection, query, where, onSnapshot, Timestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { useCallContext } from '../context/CallContext';
import type { Call } from '../types/call';

export function useIncomingCalls(userId: string | null) {
  const { setIncomingCall } = useCallContext();

  useEffect(() => {
    if (!userId) {
      return;
    }

    console.log('[useIncomingCalls] Setting up listener for user:', userId);

    // Listen for calls where the current user is the callee and status is 'ringing'
    const callsRef = collection(db, 'calls');
    const q = query(
      callsRef,
      where('callee.userId', '==', userId),
      where('status', '==', 'ringing')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const data = change.doc.data();
            const call: Call = {
              callId: change.doc.id,
              caller: data.caller,
              callee: data.callee,
              status: data.status,
              type: data.type,
              startTime: data.startTime ? (data.startTime as Timestamp).toDate() : null,
              endTime: data.endTime ? (data.endTime as Timestamp).toDate() : null,
              duration: data.duration ?? null,
              offer: data.offer ?? null,
              answer: data.answer ?? null,
              callerIceCandidates: data.callerIceCandidates ?? [],
              calleeIceCandidates: data.calleeIceCandidates ?? [],
              createdAt: (data.createdAt as Timestamp).toDate(),
              updatedAt: (data.updatedAt as Timestamp).toDate(),
            };

            console.log('[useIncomingCalls] Incoming call detected:', call.callId);
            
            // Set incoming call in context
            setIncomingCall({
              callId: call.callId,
              caller: call.caller,
              type: call.type,
            });
          }
        });
      },
      (error) => {
        console.error('[useIncomingCalls] Error listening for incoming calls:', error);
      }
    );

    return () => {
      console.log('[useIncomingCalls] Cleaning up listener');
      unsubscribe();
    };
  }, [userId, setIncomingCall]);
}
