// ─── useLastSeen Hook ─────────────────────────────────────────────────────────
// Returns the last seen timestamp for a user, respecting block privacy
// If the user has blocked the viewer, return the frozen lastSeenAtBlock timestamp

import { useState, useEffect } from 'react';
import { doc, getDoc, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '../config/firebase';

export function useLastSeen(
  userId: string | null,
  viewerId: string | null
): { lastSeen: Date | null; loading: boolean } {
  const [lastSeen, setLastSeen] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId || !viewerId || userId === viewerId) {
      setLastSeen(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    // Check if the user has blocked the viewer
    const checkBlockAndGetLastSeen = async () => {
      try {
        // Check if userId has blocked viewerId
        const blockedRef = doc(db, 'users', userId, 'blockedUsers', viewerId);
        const blockedSnap = await getDoc(blockedRef);

        if (blockedSnap.exists()) {
          // Viewer is blocked - return frozen lastSeenAtBlock
          const data = blockedSnap.data();
          const frozenLastSeen = data.lastSeenAtBlock;
          
          if (frozenLastSeen instanceof Timestamp) {
            setLastSeen(frozenLastSeen.toDate());
          } else if (frozenLastSeen instanceof Date) {
            setLastSeen(frozenLastSeen);
          } else {
            setLastSeen(null);
          }
          setLoading(false);
          return;
        }

        // Not blocked - listen to real-time lastSeen
        const userRef = doc(db, 'users', userId);
        const unsubscribe = onSnapshot(
          userRef,
          (snapshot) => {
            if (snapshot.exists()) {
              const data = snapshot.data();
              const userLastSeen = data.lastSeen;

              if (userLastSeen instanceof Timestamp) {
                setLastSeen(userLastSeen.toDate());
              } else if (userLastSeen instanceof Date) {
                setLastSeen(userLastSeen);
              } else {
                setLastSeen(null);
              }
            } else {
              setLastSeen(null);
            }
            setLoading(false);
          },
          (error) => {
            console.error('[useLastSeen] Error fetching last seen:', error);
            setLastSeen(null);
            setLoading(false);
          }
        );

        return unsubscribe;
      } catch (error) {
        console.error('[useLastSeen] Error checking block status:', error);
        setLastSeen(null);
        setLoading(false);
      }
    };

    const unsubscribePromise = checkBlockAndGetLastSeen();

    return () => {
      unsubscribePromise?.then((unsub) => {
        if (typeof unsub === 'function') {
          unsub();
        }
      });
    };
  }, [userId, viewerId]);

  return { lastSeen, loading };
}
