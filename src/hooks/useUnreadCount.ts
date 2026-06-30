// ─── useUnreadCount Hook ──────────────────────────────────────────────────────
// Real-time listener for total unread message count across all chats

import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';

export function useUnreadCount(userId: string | null): {
  totalUnread: number;
  unreadByChat: Map<string, number>;
  loading: boolean;
} {
  const [totalUnread, setTotalUnread] = useState(0);
  const [unreadByChat, setUnreadByChat] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setTotalUnread(0);
      setUnreadByChat(new Map());
      setLoading(false);
      return;
    }

    setLoading(true);

    // Listen to all chats where the user is a member
    const chatsRef = collection(db, 'chats');
    const q = query(chatsRef, where('members', 'array-contains', userId));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        let total = 0;
        const chatMap = new Map<string, number>();

        snapshot.docs.forEach((doc) => {
          const data = doc.data();
          const unreadCounts = data.unreadCounts || {};
          const unreadCount = unreadCounts[userId] || 0;

          if (unreadCount > 0) {
            chatMap.set(doc.id, unreadCount);
            total += unreadCount;
          }
        });

        setUnreadByChat(chatMap);
        setTotalUnread(total);
        setLoading(false);
      },
      (error) => {
        console.error('[useUnreadCount] Error fetching unread counts:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [userId]);

  return { totalUnread, unreadByChat, loading };
}
