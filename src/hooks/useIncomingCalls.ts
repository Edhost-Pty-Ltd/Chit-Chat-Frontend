// ─── Hook: Incoming Calls ────────────────────────────────────────────────────
// Listen for incoming calls in Firestore

import { useEffect } from 'react';
import {
  collection, query, where, onSnapshot, Timestamp, getDocs,
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

    // Cleanup stale ringing calls on mount (calls older than 2 minutes)
    // Do this with client-side filtering to avoid needing a Firestore index
    const cleanupStaleCallsAsync = async () => {
      try {
        const callsRef = collection(db, 'calls');
        const allRingingCallsQuery = query(
          callsRef,
          where('callee.userId', '==', userId),
          where('status', '==', 'ringing')
        );

        const snapshot = await getDocs(allRingingCallsQuery);
        const twoMinutesAgo = Date.now() - 2 * 60 * 1000;
        
        // Filter and mark stale calls as missed (client-side filtering)
        for (const docSnap of snapshot.docs) {
          const data = docSnap.data();
          
          // Check if createdAt exists before using it
          if (data.createdAt) {
            const createdAt = (data.createdAt as Timestamp).toDate().getTime();
            
            if (createdAt < twoMinutesAgo) {
              // Use updateDoc from firebase/firestore instead of doc.ref.update
              const { updateDoc, doc } = await import('firebase/firestore');
              await updateDoc(doc(db, 'calls', docSnap.id), {
                status: 'missed',
                endTime: Timestamp.now(),
                updatedAt: Timestamp.now(),
              });
              console.log('[useIncomingCalls] Marked stale call as missed:', docSnap.id);
            }
          }
        }
      } catch (error) {
        console.error('[useIncomingCalls] Error cleaning up stale calls:', error);
      }
    };

    cleanupStaleCallsAsync();

    // Listen for ringing calls (removed createdAt filter to avoid composite index)
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
            
            // Check if createdAt exists before filtering
            if (data.createdAt) {
              // Filter by age client-side (only show calls < 60 seconds old)
              const createdAt = (data.createdAt as Timestamp).toDate();
              const ageInSeconds = (Date.now() - createdAt.getTime()) / 1000;
              
              if (ageInSeconds > 60) {
                console.log('[useIncomingCalls] Ignoring stale call:', change.doc.id, 'Age:', ageInSeconds, 'seconds');
                return;
              }
            }
            
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
              createdAt: data.createdAt ? (data.createdAt as Timestamp).toDate() : new Date(),
              updatedAt: data.updatedAt ? (data.updatedAt as Timestamp).toDate() : new Date(),
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
