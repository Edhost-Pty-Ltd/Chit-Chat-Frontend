// ─── useMessages Hook ─────────────────────────────────────────────────────────
// Real-time listener for messages inside a single chat.
// Also exposes sendMessage, which handles both 1-on-1 and group chats.

import { useState, useEffect, useCallback } from 'react';
import {
  collection, query, orderBy, onSnapshot,
  addDoc, doc, updateDoc, serverTimestamp,
  Timestamp, increment, getDocs, getDoc, limit, writeBatch,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { loadLocalMessages, mergeLocalMessages } from './useLocalMessages';

// How many of the most recent messages the live listener keeps in sync.
// Older messages remain visible from the local cache (useLocalMessages); on a
// slow network this bounds the initial payload instead of streaming the entire
// history. loadOlder() grows the window a page at a time.
const MESSAGE_PAGE = 50;

export interface FireMessage {
  messageId:  string;
  senderId:   string;
  text:       string | null;
  imageUrl:   string | null;
  voiceUrl:   string | null;
  videoUrl:   string | null;
  fileUrl:    string | null;
  type:       'text' | 'image' | 'voice' | 'video' | 'file' | 'location' | 'system' | 'call' | 'contact' | 'group-invite';
  contactName?: string | null;
  contactPhone?: string | null;
  contactUserId?: string | null;
  groupName?: string | null;      // For group-invite messages
  groupId?: string | null;        // For group-invite messages
  inviteCode?: string | null;     // For group-invite messages
  callType?: 'audio' | 'video';
  callDuration?: number | null;  // in seconds
  callStatus?: 'completed' | 'missed' | 'rejected' | 'busy' | 'failed';
  timestamp:  Date | null;
  expiresAt:  Date | null;
  readBy:     string[];
  deliveredTo?: string[]; // Track who has received the message
  duration:   number | null;
  fileName:   string | null;
  fileSize:   number | null;
  mimeType:   string | null;
  thumbnailUrl: string | null;
  blockedMessage?: boolean; // Message sent while recipient was blocked
  location?: {
    latitude: number;
    longitude: number;
    accuracy?: number;
    altitude?: number | null;
    altitudeAccuracy?: number | null;
    heading?: number | null;
    speed?: number | null;
    timestamp: number;
  } | null;
  isLiveLocation?: boolean;
  liveLocationExpiry?: Date | null;
  replyTo?: {
    messageId: string;
    senderId: string;
    text: string | null;
   type: 'text' | 'image' | 'voice' | 'video' | 'file' | 'location' | 'system' | 'call' | 'contact' | 'group-invite';

  } | null;
}

export function useMessages(chatId: string | null, currentUserId: string | null) {
  const [messages, setMessages] = useState<FireMessage[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [pageSize,     setPageSize]     = useState(MESSAGE_PAGE);
  const [hasMore,      setHasMore]      = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);

  // Reset the paging window whenever the chat changes.
  useEffect(() => {
    setPageSize(MESSAGE_PAGE);
    setHasMore(false);
  }, [chatId]);

  // ── Seed from local cache immediately on mount ────────────────
  // This means messages appear instantly (even when offline) and
  // locally-retained messages remain visible after Firestore deletes them.
  useEffect(() => {
    if (!chatId) return;
    loadLocalMessages(chatId).then((cached) => {
      if (cached.length > 0) {
        setMessages(cached);
        setLoading(false);
      }
    });
  }, [chatId]);

  // ── Real-time listener ────────────────────────────────────────
  useEffect(() => {
    if (!chatId) return;

    setLoading(true);

    // Only sync the newest `pageSize` messages. Ordering descending + limit
    // means the server sends the most recent slice first; the merge step below
    // re-sorts ascending and preserves any older messages already cached.
    const q = query(
      collection(db, 'chats', chatId, 'messages'),
      orderBy('timestamp', 'desc'),
      limit(pageSize),
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        // A full page implies there may be older messages on the server.
        setHasMore(snap.docs.length >= pageSize);
        const now = new Date();
        const firestoreMsgs: FireMessage[] = snap.docs
          .map((doc) => {
            const d = doc.data();
            return {
              messageId: doc.id,
              senderId:  d.senderId,
              text:      d.text      ?? null,
              imageUrl:  d.imageUrl  ?? null,
              voiceUrl:  d.voiceUrl  ?? null,
              videoUrl:  d.videoUrl  ?? null,
              fileUrl:   d.fileUrl   ?? null,
              type:      d.type      ?? 'text',
              callType: d.callType ?? null,
              callDuration: d.callDuration ?? null,
              callStatus: d.callStatus ?? null,
              timestamp: d.timestamp
                ? (d.timestamp as Timestamp).toDate()
                : null,
              expiresAt: d.expiresAt
                ? (d.expiresAt as Timestamp).toDate()
                : null,
              readBy: d.readBy ?? [],
              deliveredTo: d.deliveredTo ?? [],
              duration: d.duration ?? null,
              fileName: d.fileName ?? null,
              fileSize: d.fileSize ?? null,
              mimeType: d.mimeType ?? null,
              thumbnailUrl: d.thumbnailUrl ?? null,
              blockedMessage: d.blockedMessage ?? false,
              location: d.location ?? null,
              isLiveLocation: d.isLiveLocation ?? false,
              liveLocationExpiry: d.liveLocationExpiry
                ? (d.liveLocationExpiry as Timestamp).toDate()
                : null,
              replyTo: d.replyTo ?? null,
              contactName: d.contactName ?? null,
              contactPhone: d.contactPhone ?? null,
              contactUserId: d.contactUserId ?? null,
              groupName: d.groupName ?? null,
              groupId: d.groupId ?? null,
              inviteCode: d.inviteCode ?? null,
            };
          });
          // No client-side expiry filter here — we keep all messages Firestore
          // sends us (Firestore already removed expired docs server-side via the
          // Cloud Function). New messages flow through; expired ones simply stop
          // appearing in future snapshots.

        // Merge into the local cache and render the merged result directly.
        // Using the value returned by the merge (rather than a separate
        // loadLocalMessages read) avoids a read/write race that, on a cold
        // start with an empty cache, briefly showed the empty "say hello"
        // state until the chat was reopened.
        mergeLocalMessages(chatId, firestoreMsgs).then((merged) => {
          setMessages(merged);
          setLoading(false);
          setLoadingOlder(false);
        });

        // Mark incoming messages as DELIVERED (not read) when they arrive
        // Read receipts are handled separately when user opens the chat
        if (currentUserId) {
          markAsDelivered(chatId, currentUserId);
        }
      },
      (err) => {
        setError(err.message);
        setLoading(false);
        setLoadingOlder(false);
      },
    );

    return () => unsub();
  }, [chatId, currentUserId, pageSize]);

  // ── Load an older page of messages ────────────────────────────
  // Grows the live window; the listener re-subscribes with a larger limit.
  const loadOlder = useCallback(() => {
    if (loadingOlder || !hasMore) return;
    setLoadingOlder(true);
    setPageSize((n) => n + MESSAGE_PAGE);
  }, [loadingOlder, hasMore]);

  // ── Send a text message ───────────────────────────────────────
  async function sendMessage(text: string): Promise<boolean> {
    if (!chatId || !currentUserId || !text.trim()) return false;
    
    // Delegate to the correct implementation in useChatActions
    const { sendMessage: sendMessageAction } = await import('./useChatActions');
    return await sendMessageAction(chatId, currentUserId, text);
  }

  return { messages, loading, error, sendMessage, markAsRead, loadOlder, hasMore, loadingOlder };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Mark all messages in this chat as read by currentUser
// If readReceipts is false, only reset the unread counter — do NOT add to readBy.
async function markAsRead(chatId: string, userId: string, readReceipts = true) {
  try {
    if (!readReceipts) return;

    const messagesRef = collection(db, 'chats', chatId, 'messages');
    const q = query(messagesRef, orderBy('timestamp', 'desc'), limit(30));
    const snapshot = await getDocs(q);

    // Batch all receipt updates into a single round-trip instead of one
    // updateDoc per message — critical on slow networks.
    const batch = writeBatch(db);
    let pending = 0;

    for (const docSnap of snapshot.docs) {
      const data = docSnap.data();
      if (data.senderId === userId) continue;

      const deliveredTo = data.deliveredTo || [];
      const readBy = data.readBy || [];

      if (readBy.includes(userId)) continue;

      const updates: any = { readBy: [...readBy, userId] };
      if (!deliveredTo.includes(userId)) {
        updates.deliveredTo = [...deliveredTo, userId];
      }
      batch.update(docSnap.ref, updates);
      pending++;
    }

    if (pending > 0) await batch.commit();
  } catch (error) {
    console.warn('[useMessages] Error marking as read:', error);
  }
}

// Mark incoming messages as DELIVERED when they arrive on device
// WhatsApp-style: double grey tick means delivered to recipient's device
async function markAsDelivered(chatId: string, userId: string) {
  try {
    const messagesRef = collection(db, 'chats', chatId, 'messages');
    const q = query(messagesRef, orderBy('timestamp', 'desc'), limit(30));
    const snapshot = await getDocs(q);

    // Batch delivery updates into a single commit rather than one write each.
    const batch = writeBatch(db);
    let pending = 0;

    for (const docSnap of snapshot.docs) {
      const data = docSnap.data();
      if (data.senderId === userId) continue;
      const deliveredTo = data.deliveredTo || [];
      if (deliveredTo.includes(userId)) continue;

      batch.update(docSnap.ref, {
        deliveredTo: [...deliveredTo, userId],
      });
      pending++;
    }

    if (pending > 0) await batch.commit();
  } catch (error) {
    console.warn('[useMessages] Error marking as delivered:', error);
  }
}
