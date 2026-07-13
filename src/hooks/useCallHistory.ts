// ─── Hook: Call History ──────────────────────────────────────────────────────
// Fetch and manage call history from Firestore

import { useState, useEffect } from 'react';
import {
  collection, query, orderBy, onSnapshot, Timestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import type { CallHistoryItem } from '../types/call';
import { loadLocalCallHistory, saveLocalCallHistory } from './useLocalCallHistory';

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

    let cancelled = false;

    console.log('[useCallHistory] Setting up listener for user:', userId);
    setLoading(true);
    setError(null);

    // ── Seed from the local cache immediately ─────────────────────
    // Shows the previous call history instantly on cold start and keeps it
    // visible while offline or waiting for a slow network to respond.
    loadLocalCallHistory(userId).then((cached) => {
      if (cancelled) return;
      if (cached.length > 0) {
        setCallHistory(cached);
        setLoading(false);
      }
    });

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
            timestamp: data.timestamp ? (data.timestamp as Timestamp).toDate() : new Date(),
          };
        });

        // Ignore an empty snapshot that only came from the (cold) local
        // Firestore cache — otherwise it briefly flashes "No call history"
        // before the server snapshot arrives on a slow network.
        if (history.length === 0 && snapshot.metadata.fromCache) {
          return;
        }

        console.log('[useCallHistory] Loaded', history.length, 'calls');
        setCallHistory(history);
        setLoading(false);

        // Persist authoritative (server) snapshots for offline use.
        if (!snapshot.metadata.fromCache) {
          saveLocalCallHistory(userId, history);
        }
      },
      (err) => {
        console.error('[useCallHistory] Error:', err);
        // Keep any cached history already on screen; only surface the error.
        setError(err.message);
        setLoading(false);
      }
    );

    return () => {
      console.log('[useCallHistory] Cleaning up listener');
      cancelled = true;
      unsubscribe();
    };
  }, [userId]);

  return { callHistory, loading, error };
}
