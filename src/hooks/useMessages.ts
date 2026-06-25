// ─── useMessages Hook ─────────────────────────────────────────────────────────
// Real-time listener for messages inside a single chat.
// Also exposes sendMessage, which handles both 1-on-1 and group chats.

import { useState, useEffect } from 'react';
import {
  collection, query, orderBy, onSnapshot,
  addDoc, doc, updateDoc, serverTimestamp,
  Timestamp, increment, getDocs, getDoc,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { fetchUserPrivacySettings } from './usePrivacySettings';
import { loadLocalMessages, mergeLocalMessages } from './useLocalMessages';

export interface FireMessage {
  messageId:  string;
  senderId:   string;
  text:       string | null;
  imageUrl:   string | null;
  voiceUrl:   string | null;
  videoUrl:   string | null;
  fileUrl:    string | null;
  type:       'text' | 'image' | 'voice' | 'video' | 'file' | 'location';
  timestamp:  Date | null;
  expiresAt:  Date | null;
  readBy:     string[];
  deliveredTo?: string[]; // Track who has received the message
  duration:   number | null;
  fileName:   string | null;
  fileSize:   number | null;
  mimeType:   string | null;
  thumbnailUrl: string | null;
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
    type: 'text' | 'image' | 'voice' | 'video' | 'file' | 'location';
  } | null;
}

export function useMessages(chatId: string | null, currentUserId: string | null) {
  const [messages, setMessages] = useState<FireMessage[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);

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

    const q = query(
      collection(db, 'chats', chatId, 'messages'),
      orderBy('timestamp', 'asc'),
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
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
              location: d.location ?? null,
              isLiveLocation: d.isLiveLocation ?? false,
              liveLocationExpiry: d.liveLocationExpiry
                ? (d.liveLocationExpiry as Timestamp).toDate()
                : null,
              replyTo: d.replyTo ?? null,
            };
          });
          // No client-side expiry filter here — we keep all messages Firestore
          // sends us (Firestore already removed expired docs server-side via the
          // Cloud Function). New messages flow through; expired ones simply stop
          // appearing in future snapshots.

        // Merge into local cache (keeps locally-retained messages alive).
        mergeLocalMessages(chatId, firestoreMsgs).catch(() => {});

        // Load the merged local state (includes locally-retained messages that
        // Firestore has already deleted) and render it.
        loadLocalMessages(chatId).then((merged) => {
          setMessages(merged);
          setLoading(false);
        });

        // Mark messages as read (respects the user's readReceipts privacy setting)
        if (currentUserId) {
          fetchUserPrivacySettings(currentUserId).then((privacy) => {
            markAsRead(chatId, currentUserId, privacy.readReceipts);
          });
        }
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );

    return () => unsub();
  }, [chatId, currentUserId]);

  // ── Send a text message ───────────────────────────────────────
  async function sendMessage(text: string): Promise<boolean> {
    if (!chatId || !currentUserId || !text.trim()) return false;

    try {
      const trimmed = text.trim();

      // 1. Add message to subcollection
      await addDoc(collection(db, 'chats', chatId, 'messages'), {
        senderId:  currentUserId,
        text:      trimmed,
        imageUrl:  null,
        voiceUrl:  null,
        type:      'text',
        timestamp: serverTimestamp(),
        readBy:    [currentUserId],
        deliveredTo: [], // Will be populated when recipients come online
      });

      // 2. Update chat's lastMessage + unread counts for other members
      const chatRef = doc(db, 'chats', chatId);
      await updateDoc(chatRef, {
        'lastMessage.text':      trimmed,
        'lastMessage.senderId':  currentUserId,
        'lastMessage.timestamp': serverTimestamp(),
        // Firestore doesn't support dynamic keys in updateDoc directly,
        // so we use a helper below
        ...buildUnreadIncrement(currentUserId),
      });

      return true;
    } catch (err: any) {
      setError(err.message);
      return false;
    }
  }

  return { messages, loading, error, sendMessage };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Mark all messages in this chat as read by currentUser
// If readReceipts is false, only reset the unread counter — do NOT add to readBy.
async function markAsRead(chatId: string, userId: string, readReceipts = true) {
  try {
    const chatRef = doc(db, 'chats', chatId);
    await updateDoc(chatRef, {
      [`unreadCounts.${userId}`]: 0,
    });

    if (!readReceipts) return; // User opted out — skip updating readBy / deliveredTo

    // Also mark undelivered messages as delivered
    const messagesRef = collection(db, 'chats', chatId, 'messages');
    const q = query(messagesRef, orderBy('timestamp', 'desc'));
    const snapshot = await getDocs(q);

    const batch: any[] = [];
    snapshot.docs.forEach((docSnap) => {
      const data = docSnap.data();
      const deliveredTo = data.deliveredTo || [];
      const readBy = data.readBy || [];

      // If not delivered yet, mark as delivered
      if (!deliveredTo.includes(userId) && data.senderId !== userId) {
        batch.push({
          ref: docSnap.ref,
          updates: {
            deliveredTo: [...deliveredTo, userId],
            readBy: readBy.includes(userId) ? readBy : [...readBy, userId],
          },
        });
      } else if (!readBy.includes(userId) && data.senderId !== userId) {
        // If delivered but not read, mark as read
        batch.push({
          ref: docSnap.ref,
          updates: {
            readBy: [...readBy, userId],
          },
        });
      }
    });

    // Execute batch updates
    for (const item of batch) {
      await updateDoc(item.ref, item.updates);
    }
  } catch (error) {
    console.warn('[useMessages] Error marking messages:', error);
    // Non-critical — ignore silently
  }
}

// Build an increment object for all members except the sender
// Called after sending — increments unread count for every other member
function buildUnreadIncrement(senderId: string): Record<string, any> {
  // We can't know other member IDs here without fetching the chat doc,
  // so we use a Firestore transaction in the ChatsScreen instead.
  // This is a placeholder — see createChat() for full implementation.
  return {};
}
