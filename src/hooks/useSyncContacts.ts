// ─── useSyncContacts Hook ────────────────────────────────────────────────────
// Syncs device contact names to Firestore so Cloud Functions can personalize
// notifications with the recipient's saved contact name instead of the generic
// displayName or phone number.
//
// Structure: users/{userId}/savedContacts/{contactUserId} → { name: string }

import { useEffect } from 'react';
import { doc, writeBatch } from 'firebase/firestore';
import { db } from '../config/firebase';
import type { AppContact } from './useContacts';

export function useSyncContacts(userId: string | null | undefined, contacts: AppContact[]) {
  useEffect(() => {
    if (!userId || contacts.length === 0) return;

    // Sync contacts to Firestore (debounced to avoid excessive writes)
    const timeoutId = setTimeout(() => {
      syncContactsToFirestore(userId, contacts);
    }, 2000);

    return () => clearTimeout(timeoutId);
  }, [userId, contacts]);
}

async function syncContactsToFirestore(userId: string, contacts: AppContact[]) {
  try {
    // Only sync contacts that are ChitChat users (isOnApp) and have a displayName
    const contactsToSync = contacts.filter(c => c.isOnApp && c.userId && c.displayName);

    if (contactsToSync.length === 0) return;

    // Firestore writeBatch has a 500 operation limit, so chunk if needed
    const BATCH_SIZE = 500;
    for (let i = 0; i < contactsToSync.length; i += BATCH_SIZE) {
      const batch = writeBatch(db);
      const chunk = contactsToSync.slice(i, i + BATCH_SIZE);

      for (const contact of chunk) {
        const contactRef = doc(db, 'users', userId, 'savedContacts', contact.userId);
        batch.set(contactRef, {
          name: contact.displayName,
          phone: contact.phone,
          updatedAt: new Date(),
        }, { merge: true });
      }

      await batch.commit();
      console.log(`[useSyncContacts] Synced ${chunk.length} contacts for user ${userId}`);
    }
  } catch (err) {
    console.error('[useSyncContacts] Failed to sync contacts:', err);
  }
}
