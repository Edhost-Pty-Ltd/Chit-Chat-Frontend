// ─── useChats Hook ────────────────────────────────────────────────────────────
// Real-time listener for the current user's chat list.
// Each chat shows the last message, timestamp, and unread count.

import { useState, useEffect } from 'react';
import {
  collection, query, where, orderBy,
  onSnapshot, Timestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { loadLocalChats, saveLocalChats } from './useLocalChats';

export interface ChatPreview {
  chatId:       string;
  type:         'direct' | 'group';
  members:      string[];
  groupName:    string | null;
  lastMessage:  string;
  lastSenderId: string;
  timestamp:    Date | null;
  unreadCount:  number;
  /** UIDs that have delivered the last message. Optional to survive older cached rows. */
  lastMessageDeliveredTo?: string[];
  /** UIDs that have read the last message. Optional to survive older cached rows. */
  lastMessageReadBy?: string[];
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

    let cancelled = false;

    setLoading(true);

    // ── Seed from the local cache immediately ─────────────────────
    // Shows the previous chat list instantly on cold start and keeps it
    // visible while offline or waiting for a slow network to respond.
    loadLocalChats(userId).then((cached) => {
      if (cancelled) return;
      if (cached.length > 0) {
        setChats([...cached].sort(sortByRecentActivity));
        setLoading(false);
      }
    });

    // Real-time listener — simplified query (no orderBy) for debugging
    const q = query(
      collection(db, 'chats'),
      where('members', 'array-contains', userId),
    );

    console.log('[useChats] Subscribing for userId:', userId);

    const unsub = onSnapshot(
      q,
      (snap) => {
        console.log(
          '[useChats] Snapshot received, docs:', snap.docs.length,
          'fromCache:', snap.metadata.fromCache,
        );

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
            lastMessageDeliveredTo: lm?.deliveredTo ?? [],
            lastMessageReadBy:      lm?.readBy      ?? [],
          };
        });

        // Newest activity first (WhatsApp-style): a chat with a new message
        // jumps to the top. Chats without a last message (never messaged) sort
        // to the bottom.
        result.sort(sortByRecentActivity);

        // Ignore an empty snapshot that only came from the (cold) local cache.
        // On a slow network the SDK fires an empty fromCache snapshot before the
        // server responds — treating it as "No chats yet" causes a flash of the
        // empty state. We keep showing the cached list (or the spinner) until a
        // real result arrives.
        if (result.length === 0 && snap.metadata.fromCache) {
          return;
        }

        setChats(result);
        setLoading(false);

        // Persist authoritative (server) snapshots for offline use.
        if (!snap.metadata.fromCache) {
          saveLocalChats(userId, result);
        }
      },
      (err) => {
        console.error('[useChats] Error:', err.code, err.message);
        // Keep any cached chats already on screen; only surface the error.
        setError(err.message);
        setLoading(false);
      },
    );

    return () => {
      cancelled = true;
      unsub();
    }; // cleanup on unmount
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

/** Sort chats by most recent last-message time, newest first. */
function sortByRecentActivity(a: ChatPreview, b: ChatPreview): number {
  const ta = a.timestamp?.getTime() ?? 0;
  const tb = b.timestamp?.getTime() ?? 0;
  return tb - ta;
}
