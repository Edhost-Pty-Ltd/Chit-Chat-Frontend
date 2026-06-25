// ─── useMissedCalls Hook ──────────────────────────────────────────────────────
// Real-time listener for missed calls count

import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import type { CallHistoryItem } from '../types/call';

export function useMissedCalls(userId: string | null): {
  missedCount: number;
  loading: boolean;
} {
  const [missedCount, setMissedCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setMissedCount(0);
      setLoading(false);
      return;
    }

    setLoading(true);

    // Listen to user's call history for missed incoming calls
    const historyRef = collection(db, 'users', userId, 'callHistory');
    const q = query(
      historyRef,
      where('direction', '==', 'incoming'),
      where('status', '==', 'missed')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        // Count missed calls
        const count = snapshot.docs.length;
        setMissedCount(count);
        setLoading(false);
      },
      (error) => {
        console.error('[useMissedCalls] Error fetching missed calls:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [userId]);

  return { missedCount, loading };
}
