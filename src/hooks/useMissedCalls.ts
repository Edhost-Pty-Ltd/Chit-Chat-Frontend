// ─── useMissedCalls Hook ──────────────────────────────────────────────────────
// Real-time listener for UNVIEWED missed calls count

import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, writeBatch, getDocs } from 'firebase/firestore';
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
        // Count only UNVIEWED missed calls
        const unviewedCount = snapshot.docs.filter(doc => {
          const data = doc.data();
          return data.viewed !== true; // Count if viewed is false or undefined
        }).length;

        console.log('🔵 [useMissedCalls] Total missed:', snapshot.docs.length, 'Unviewed:', unviewedCount);
        setMissedCount(unviewedCount);
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

// Mark all missed calls as viewed when user opens CallsScreen
export async function markMissedCallsAsViewed(userId: string): Promise<void> {
  console.log('🟢 [markMissedCallsAsViewed] Marking missed calls as viewed for user:', userId);

  try {
    const historyRef = collection(db, 'users', userId, 'callHistory');
    const q = query(
      historyRef,
      where('direction', '==', 'incoming'),
      where('status', '==', 'missed')
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      console.log('[markMissedCallsAsViewed] No missed calls to mark');
      return;
    }

    // Use batch to update all missed calls
    const batch = writeBatch(db);
    let updateCount = 0;

    snapshot.docs.forEach((docSnap) => {
      const data = docSnap.data();
      // Only update if not already viewed
      if (data.viewed !== true) {
        batch.update(docSnap.ref, { viewed: true });
        updateCount++;
      }
    });

    if (updateCount > 0) {
      await batch.commit();
      console.log('✅ [markMissedCallsAsViewed] Marked', updateCount, 'calls as viewed');
    } else {
      console.log('[markMissedCallsAsViewed] All missed calls already viewed');
    }
  } catch (error) {
    console.error('❌ [markMissedCallsAsViewed] Error:', error);
  }
}
