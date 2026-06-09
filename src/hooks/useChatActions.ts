// ─── useChatActions Hook ──────────────────────────────────────────────────────
// Creates new chats (1-on-1 and group) and handles sending messages
// with proper unread count increments for all members.

import {
  collection, doc, addDoc, getDoc, getDocs,
  query, where, serverTimestamp, updateDoc,
  increment, writeBatch,
} from 'firebase/firestore';
import { db } from '../config/firebase';

// ── Create or get existing 1-on-1 chat ───────────────────────────────────────
export async function getOrCreateDirectChat(
  currentUserId: string,
  otherUserId: string,
): Promise<string> {
  // Check if a direct chat already exists between these two users
  const q = query(
    collection(db, 'chats'),
    where('type', '==', 'direct'),
    where('members', 'array-contains', currentUserId),
  );

  const snap = await getDocs(q);
  const existing = snap.docs.find((doc) => {
    const members: string[] = doc.data().members ?? [];
    return members.includes(otherUserId);
  });

  if (existing) return existing.id;

  // Create new direct chat
  const newChat = await addDoc(collection(db, 'chats'), {
    type:        'direct',
    members:     [currentUserId, otherUserId],
    groupName:   null,
    groupPhoto:  null,
    createdBy:   currentUserId,
    createdAt:   serverTimestamp(),
    lastMessage: null,
    unreadCounts: {
      [currentUserId]: 0,
      [otherUserId]:   0,
    },
  });

  return newChat.id;
}

// ── Create a new group chat ───────────────────────────────────────────────────
export async function createGroupChat(
  currentUserId: string,
  memberIds: string[],   // include currentUserId
  groupName: string,
): Promise<string> {
  const allMembers = Array.from(new Set([currentUserId, ...memberIds]));

  // Build unreadCounts map: { userId: 0 } for each member
  const unreadCounts = Object.fromEntries(
    allMembers.map((id) => [id, 0])
  );

  const newChat = await addDoc(collection(db, 'chats'), {
    type:         'group',
    members:      allMembers,
    groupName,
    groupPhoto:   null,
    createdBy:    currentUserId,
    createdAt:    serverTimestamp(),
    lastMessage:  null,
    unreadCounts,
  });

  return newChat.id;
}

// ── Send a message with unread increments ─────────────────────────────────────
export async function sendMessage(
  chatId: string,
  senderId: string,
  text: string,
): Promise<boolean> {
  try {
    const trimmed = text.trim();
    if (!trimmed) return false;

    // Fetch chat to get member list
    const chatRef  = doc(db, 'chats', chatId);
    const chatSnap = await getDoc(chatRef);
    if (!chatSnap.exists()) return false;

    const members: string[] = chatSnap.data().members ?? [];
    const otherMembers = members.filter((id) => id !== senderId);

    // Use a batch write for atomicity
    const batch = writeBatch(db);

    // 1. Add message document
    const msgRef = doc(collection(db, 'chats', chatId, 'messages'));
    batch.set(msgRef, {
      messageId: msgRef.id,
      senderId,
      text:      trimmed,
      imageUrl:  null,
      voiceUrl:  null,
      type:      'text',
      timestamp: serverTimestamp(),
      readBy:    [senderId],
    });

    // 2. Update chat lastMessage + increment unread for other members
    const unreadUpdates = Object.fromEntries(
      otherMembers.map((id) => [`unreadCounts.${id}`, increment(1)])
    );

    batch.update(chatRef, {
      'lastMessage.text':      trimmed,
      'lastMessage.senderId':  senderId,
      'lastMessage.timestamp': serverTimestamp(),
      ...unreadUpdates,
    });

    await batch.commit();
    return true;
  } catch (err) {
    console.error('sendMessage error:', err);
    return false;
  }
}

// ── Mark chat as read for a user ──────────────────────────────────────────────
export async function markChatAsRead(
  chatId: string,
  userId: string,
): Promise<void> {
  try {
    const chatRef = doc(db, 'chats', chatId);
    await updateDoc(chatRef, {
      [`unreadCounts.${userId}`]: 0,
    });
  } catch (_) {
    // Non-critical
  }
}
