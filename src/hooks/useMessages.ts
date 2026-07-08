// ─── useMessages Hook ─────────────────────────────────────────────────────────
// Real-time listener for messages inside a single chat.
// Also exposes sendMessage, which handles both 1-on-1 and group chats.

import { useState, useEffect } from 'react';
import {
  collection, query, orderBy, onSnapshot,
  addDoc, doc, updateDoc, serverTimestamp,
  Timestamp, increment, getDocs, getDoc, limit,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { loadLocalMessages, mergeLocalMessages } from './useLocalMessages';

export interface FireMessage {
  messageId:  string;
  senderId:   string;
  text:       string | null;
  imageUrl:   string | null;
  voiceUrl:   string | null;
  videoUrl:   string | null;
  fileUrl:    string | null;
  type:       'text' | 'image' | 'voice' | 'video' | 'file' | 'location' | 'system' | 'call';
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
   type: 'text' | 'image' | 'voice' | 'video' | 'file' | 'location' | 'system' | 'call';

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

        // Mark incoming messages as DELIVERED (not read) when they arrive
        // Read receipts are handled separately when user opens the chat
        // Delivery is also handled globally by useGlobalDelivery hook in App.tsx
        if (currentUserId) {
          markAsDelivered(chatId, currentUserId);
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
    
    // Delegate to the correct implementation in useChatActions
    const { sendMessage: sendMessageAction } = await import('./useChatActions');
    return await sendMessageAction(chatId, currentUserId, text);
  }

  return { messages, loading, error, sendMessage, markAsRead };
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
      await updateDoc(docSnap.ref, updates);
    }

    // Update chat-level lastMessage so chat list shows blue ticks in real-time
    const chatRef = doc(db, 'chats', chatId);
    const chatSnap = await getDoc(chatRef);
    if (chatSnap.exists()) {
      const chatData = chatSnap.data();
      const lm = chatData.lastMessage;
      if (lm && lm.senderId !== userId) {
        const lmReadBy = lm.readBy || [];
        if (!lmReadBy.includes(userId)) {
          const lmDeliveredTo = lm.deliveredTo || [];
          const chatUpdates: any = { 'lastMessage.readBy': [...lmReadBy, userId] };
          if (!lmDeliveredTo.includes(userId)) {
            chatUpdates['lastMessage.deliveredTo'] = [...lmDeliveredTo, userId];
          }
          await updateDoc(chatRef, chatUpdates);
        }
      }
    }
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

    for (const docSnap of snapshot.docs) {
      const data = docSnap.data();
      if (data.senderId === userId) continue;
      const deliveredTo = data.deliveredTo || [];
      if (deliveredTo.includes(userId)) continue;

      await updateDoc(docSnap.ref, {
        deliveredTo: [...deliveredTo, userId],
      });
    }
  } catch (error) {
    console.warn('[useMessages] Error marking as delivered:', error);
  }
}
