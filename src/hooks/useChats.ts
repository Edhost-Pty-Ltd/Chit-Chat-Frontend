// ─── useChats Hook ────────────────────────────────────────────────────────────
// Real-time listener for the current user's chat list.
// Each chat shows the last message, timestamp, and unread count.

import { useState, useEffect } from 'react';
import {
  collection, query, where, orderBy,
  onSnapshot, Timestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';

export interface ChatPreview {
  chatId:       string;
  type:         'direct' | 'group';
  members:      string[];
  groupName:    string | null;
  lastMessage:  string;
  lastSenderId: string;
  timestamp:    Date | null;
  unreadCount:  number;
}

export function useChats(userId: string | null) {
  const [chats,   setChats]   = useState<ChatPreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setChats([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    // Real-time listener — fires every time any chat updates
    const q = query(
      collection(db, 'chats'),
      where('members', 'array-contains', userId),
      orderBy('lastMessage.timestamp', 'desc'),
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const result: ChatPreview[] = snap.docs.map((doc) => {
          const d = doc.data();
          const lm = d.lastMessage;
          return {
            chatId:       doc.id,
            type:         d.type ?? 'direct',
            members:      d.members ?? [],
            groupName:    d.groupName ?? null,
            lastMessage:  lm?.text ?? '',
            lastSenderId: lm?.senderId ?? '',
            timestamp:    lm?.timestamp
              ? (lm.timestamp as Timestamp).toDate()
              : null,
            unreadCount: getUnreadCount(d.unreadCounts, userId),
          };
        });
        setChats(result);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );

    return () => unsub(); // cleanup on unmount
  }, [userId]);

  return { chats, loading, error };
}

function getUnreadCount(
  unreadCounts: Record<string, number> | undefined,
  userId: string,
): number {
  if (!unreadCounts) return 0;
  return unreadCounts[userId] ?? 0;
}
