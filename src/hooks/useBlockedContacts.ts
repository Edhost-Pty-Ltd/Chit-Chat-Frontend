// ─── useBlockedContacts Hook ──────────────────────────────────────────────────
// Manages blocked contacts list with real-time updates and block notifications

import { useState, useEffect, useCallback } from 'react';
import {
  collection, doc, setDoc, deleteDoc, onSnapshot,
  query, getDocs, Timestamp, addDoc, updateDoc, serverTimestamp, writeBatch,
} from 'firebase/firestore';
import { db } from '../config/firebase';

export interface BlockedContact {
  userId: string;
  displayName: string;
  photoURL: string | null;
  phone?: string;
  blockedAt: Date;
}

// ─── Helper: Send block notification to chat ─────────────────────────────────
async function sendBlockNotifications(
  blockerId: string,
  blockedId: string,
  blockerName: string,
  blockedName: string
) {
  try {
    // Find the chat between these two users
    const chatsRef = collection(db, 'chats');
    const chatsSnapshot = await getDocs(query(chatsRef));
    
    let chatId: string | null = null;

    for (const chatDoc of chatsSnapshot.docs) {
      const data = chatDoc.data();
      const members = data.members || [];
      
      // Check if this is a 1-on-1 chat between these two users
      if (!data.isGroup && members.length === 2 && 
          members.includes(blockerId) && members.includes(blockedId)) {
        chatId = chatDoc.id;
        break;
      }
    }

    if (!chatId) {
      console.log('[sendBlockNotifications] No chat found between users');
      return;
    }

    const batch = writeBatch(db);

    // Add system message to the chat
    const msgRef = doc(collection(db, 'chats', chatId, 'messages'));
    batch.set(msgRef, {
      messageId: msgRef.id,
      senderId: 'system',
      text: `${blockerName} blocked ${blockedName}`,
      imageUrl: null,
      voiceUrl: null,
      videoUrl: null,
      fileUrl: null,
      type: 'system',
      timestamp: serverTimestamp(),
      readBy: [],
      deliveredTo: [],
      duration: null,
      fileName: null,
      fileSize: null,
      mimeType: null,
      thumbnailUrl: null,
      location: null,
      isLiveLocation: false,
      replyTo: null,
    });

    // Update chat's lastMessage
    const chatRef = doc(db, 'chats', chatId);
    batch.update(chatRef, {
      'lastMessage.text': `${blockerName} blocked ${blockedName}`,
      'lastMessage.senderId': 'system',
      'lastMessage.timestamp': serverTimestamp(),
    });

    await batch.commit();
    console.log('[sendBlockNotifications] Block notifications sent to chat:', chatId);
  } catch (error) {
    console.error('[sendBlockNotifications] Error sending notifications:', error);
    // Non-critical - don't throw
  }
}

export function useBlockedContacts(currentUserId: string | null) {
  const [blockedContacts, setBlockedContacts] = useState<BlockedContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Real-time listener for blocked contacts ───────────────────────
  useEffect(() => {
    if (!currentUserId) {
      setBlockedContacts([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const blockedRef = collection(db, 'users', currentUserId, 'blockedUsers');
    
    const unsubscribe = onSnapshot(
      blockedRef,
      (snapshot) => {
        const contacts: BlockedContact[] = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            userId: doc.id,
            displayName: data.displayName || 'Unknown',
            photoURL: data.photoURL || null,
            phone: data.phone || undefined,
            blockedAt: data.blockedAt instanceof Timestamp
              ? data.blockedAt.toDate()
              : new Date(data.blockedAt),
          };
        });

        console.log('[useBlockedContacts] Blocked contacts updated:', contacts.length);
        setBlockedContacts(contacts);
        setLoading(false);
      },
      (err) => {
        console.error('[useBlockedContacts] Error fetching blocked contacts:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [currentUserId]);

  // ── Block a contact ────────────────────────────────────────────────
  const blockContact = useCallback(
    async (
      userId: string,
      displayName: string,
      photoURL?: string | null,
      phone?: string,
      blockerDisplayName?: string
    ): Promise<{ success: boolean; error?: string }> => {
      if (!currentUserId) {
        return { success: false, error: 'Not authenticated' };
      }

      try {
        console.log('[useBlockedContacts] Blocking contact:', userId);

        const blockedRef = doc(db, 'users', currentUserId, 'blockedUsers', userId);
        
        await setDoc(blockedRef, {
          displayName,
          photoURL: photoURL || null,
          phone: phone || null,
          blockedAt: new Date(),
        });

        // Send system message to both users' chats
        await sendBlockNotifications(
          currentUserId,
          userId,
          blockerDisplayName || 'You',
          displayName
        );

        console.log('[useBlockedContacts] Contact blocked successfully with notifications');
        return { success: true };
      } catch (err: any) {
        console.error('[useBlockedContacts] Error blocking contact:', err);
        return { success: false, error: err.message };
      }
    },
    [currentUserId]
  );

  // ── Unblock a contact ──────────────────────────────────────────────
  const unblockContact = useCallback(
    async (userId: string): Promise<{ success: boolean; error?: string }> => {
      if (!currentUserId) {
        return { success: false, error: 'Not authenticated' };
      }

      try {
        console.log('[useBlockedContacts] Unblocking contact:', userId);

        const blockedRef = doc(db, 'users', currentUserId, 'blockedUsers', userId);
        await deleteDoc(blockedRef);

        console.log('[useBlockedContacts] Contact unblocked successfully');
        return { success: true };
      } catch (err: any) {
        console.error('[useBlockedContacts] Error unblocking contact:', err);
        return { success: false, error: err.message };
      }
    },
    [currentUserId]
  );

  // ── Check if a contact is blocked ──────────────────────────────────
  const isContactBlocked = useCallback(
    (userId: string): boolean => {
      return blockedContacts.some((contact) => contact.userId === userId);
    },
    [blockedContacts]
  );

  return {
    blockedContacts,
    loading,
    error,
    blockContact,
    unblockContact,
    isContactBlocked,
  };
}
