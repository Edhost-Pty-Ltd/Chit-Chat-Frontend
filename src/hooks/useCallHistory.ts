// ─── Hook: Call History ──────────────────────────────────────────────────────
// Fetch and manage call history from Firestore

import { useState, useEffect } from 'react';
import {
  collection, query, orderBy, onSnapshot, Timestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import type { CallHistoryItem } from '../types/call';

export function useCallHistory(userId: string | null) {
  const [callHistory, setCallHistory] = useState<CallHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setCallHistory([]);
      setLoading(false);
      return;
    }

    console.log('[useCallHistory] Setting up listener for user:', userId);
    setLoading(true);
    setError(null);

    const historyRef = collection(db, 'users', userId, 'callHistory');
    const q = query(historyRef, orderBy('timestamp', 'desc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const history: CallHistoryItem[] = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            callId: data.callId,
            otherParty: data.otherParty,
            type: data.type,
            direction: data.direction,
            status: data.status,
            duration: data.duration ?? null,
            timestamp: (data.timestamp as Timestamp).toDate(),
          };
        });

        console.log('[useCallHistory] Loaded', history.length, 'calls');
        setCallHistory(history);
        setLoading(false);
      },
      (err) => {
        console.error('[useCallHistory] Error:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => {
      console.log('[useCallHistory] Cleaning up listener');
      unsubscribe();
    };
  }, [userId]);

  return { callHistory, loading, error };
}
