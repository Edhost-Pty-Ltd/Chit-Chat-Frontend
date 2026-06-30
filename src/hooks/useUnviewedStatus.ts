// ─── useUnviewedStatus Hook ──────────────────────────────────────────────────
// Detects if there are unviewed status updates from contacts

import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '../config/firebase';

export function useUnviewedStatus(userId: string | null): {
  hasUnviewedStatus: boolean;
  unviewedCount: number;
  loading: boolean;
} {
  const [hasUnviewedStatus, setHasUnviewedStatus] = useState(false);
  const [unviewedCount, setUnviewedCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setHasUnviewedStatus(false);
      setUnviewedCount(0);
      setLoading(false);
      return;
    }

    setLoading(true);

    // Listen to all statuses that haven't expired yet
    const now = new Date();
    const statusesRef = collection(db, 'statuses');
    const q = query(
      statusesRef,
      where('expiresAt', '>', now)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        let count = 0;

        snapshot.docs.forEach((doc) => {
          const data = doc.data();
          
          // Skip own statuses
          if (data.userId === userId) return;
          
          // Check if current user has viewed this status
          const viewedBy = data.viewedBy || [];
          const hasViewed = viewedBy.includes(userId);
          
          // Check if user is excluded from viewing this status
          const excludedUsers = data.excludedUsers || [];
          const isExcluded = excludedUsers.includes(userId);
          
          // Count as unviewed if not viewed and not excluded
          if (!hasViewed && !isExcluded) {
            count++;
          }
        });

        setUnviewedCount(count);
        setHasUnviewedStatus(count > 0);
        setLoading(false);
      },
      (error) => {
        console.error('[useUnviewedStatus] Error fetching statuses:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [userId]);

  return { hasUnviewedStatus, unviewedCount, loading };
}
