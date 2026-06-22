// ─── useBlockedContacts Hook ──────────────────────────────────────────────────
// Manages blocked contacts list with real-time updates

import { useState, useEffect, useCallback } from 'react';
import {
  collection, doc, setDoc, deleteDoc, onSnapshot,
  query, getDocs, Timestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';

export interface BlockedContact {
  userId: string;
  displayName: string;
  photoURL: string | null;
  phone?: string;
  blockedAt: Date;
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
      phone?: string
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

        console.log('[useBlockedContacts] Contact blocked successfully');
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
