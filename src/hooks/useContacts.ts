// ─── useContacts Hook ─────────────────────────────────────────────────────────
// Fetches phone contacts, normalizes numbers to E.164 format,
// then cross-references with Firestore users collection to find
// which contacts are registered on SkyConnect.

import { useState, useEffect } from 'react';
import { getContactsAsync, requestPermissionsAsync, Fields } from 'expo-contacts/legacy';
import {
  collection, query, where, getDocs,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { normalizePhone, chunkArray } from '../utils/phoneUtils';

export interface AppContact {
  userId:      string;       // Firestore user ID
  phone:       string;       // normalized E.164 phone number
  displayName: string;       // contact name from phone book, or phone number if not saved
  isSaved:     boolean;      // true = found in phone contacts
  photoUri?:   string;       // contact photo from phone book
  firebasePhotoURL?: string; // Firebase profile photo
}

export function useContacts() {
  const [contacts,    setContacts]    = useState<AppContact[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState(false);

  useEffect(() => {
    loadContacts();
  }, []);

  async function loadContacts() {
    try {
      setLoading(true);
      setError(null);

      // ── 1. Request contacts permission ──────────────────────────
      const { status } = await requestPermissionsAsync();
      
      if (status !== 'granted') {
        setError('Contacts permission denied');
        setLoading(false);
        return;
      }
      setHasPermission(true);

      // ── 2. Fetch all phone contacts ──────────────────────────────
      const { data } = await getContactsAsync({
        fields: [
          Fields.Name,
          Fields.PhoneNumbers,
          Fields.Image,
        ],
      });

      // ── 3. Build a map of normalized phone → contact name ────────
      const phoneToName = new Map<string, string>();
      const phoneToPhoto = new Map<string, string>();

      for (const contact of data) {
        if (!contact.phoneNumbers) continue;
        for (const pn of contact.phoneNumbers) {
          if (!pn.number) continue;
          const normalized = normalizePhone(pn.number);
          const name = contact.name || pn.number;
          phoneToName.set(normalized, name);
          if (contact.imageAvailable && contact.image?.uri) {
            phoneToPhoto.set(normalized, contact.image.uri);
          }
        }
      }

      if (phoneToName.size === 0) {
        setContacts([]);
        setLoading(false);
        return;
      }

      // ── 4. Query Firestore for registered users ───────────────────
      // Firestore "in" query supports max 30 items per query
      const phones   = Array.from(phoneToName.keys());
      const chunks   = chunkArray(phones, 30);
      const appContacts: AppContact[] = [];

      for (const chunk of chunks) {
        const q = query(
          collection(db, 'users'),
          where('phone', 'in', chunk),
        );
        const snap = await getDocs(q);

        for (const doc of snap.docs) {
          const data = doc.data();
          const phone = data.phone as string;
          const contactName = phoneToName.get(phone);

          // Respect the user's profile-photo privacy. These contacts are all
          // saved in the viewer's phone book, so 'Everyone' and 'Contacts' both
          // allow the photo; only 'Nobody' hides the Firebase profile photo.
          // (The device contact photo, photoUri, is the viewer's own data and
          // always shows.)
          const photoPrivacy = data.privacyProfilePhoto ?? 'Contacts';
          const firebasePhotoURL =
            photoPrivacy === 'Nobody' ? null : (data.photoURL || null);

          // All users in this result are in phone contacts (isSaved: true)
          // Use the contact name from phoneToName
          appContacts.push({
            userId:      doc.id,
            phone,
            displayName: contactName ?? phone,
            isSaved:     true, // Always true since we queried for phones in contacts
            photoUri:    phoneToPhoto.get(phone), // Contact photo from device
            firebasePhotoURL, // Firebase profile photo (privacy-filtered)
          });
        }
      }

      // Sort: saved contacts first (by name), then unsaved (by number)
      appContacts.sort((a, b) => {
        if (a.isSaved && !b.isSaved) return -1;
        if (!a.isSaved && b.isSaved) return 1;
        return a.displayName.localeCompare(b.displayName);
      });

      setContacts(appContacts);
    } catch (err: any) {
      setError(err.message ?? 'Failed to load contacts');
    } finally {
      setLoading(false);
    }
  }

  return { contacts, loading, error, hasPermission, reload: loadContacts };
}

