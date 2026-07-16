// ─── useContacts Hook ─────────────────────────────────────────────────────────
// Fetches phone contacts, normalizes numbers to E.164 format,
// then cross-references with Firestore users collection to return
// ONLY contacts that have a registered ChitChat account.

import { useState, useEffect } from 'react';
import { getContactsAsync, requestPermissionsAsync, Fields } from 'expo-contacts/legacy';
import {
  collection, query, where, getDocs,
} from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from '../config/firebase';
import { normalizePhone, chunkArray } from '../utils/phoneUtils';

// Local cache so the resolved contact list (names, phones, userIds) survives
// offline / slow-network cold starts instead of starting empty until the
// device contacts + Firestore cross-reference finish loading.
const CACHE_KEY = 'local_app_contacts';

export interface AppContact {
  userId:      string;       // Firestore user ID (empty string if not a ChitChat user)
  phone:       string;       // normalized E.164 phone number
  displayName: string;       // contact name from phone book, or phone number if not saved
  isSaved:     boolean;      // true = found in phone contacts
  isOnApp:     boolean;      // true = registered ChitChat user
  photoUri?:   string;       // contact photo from phone book
  firebasePhotoURL?: string; // Firebase profile photo (only for app users)
}

export function useContacts() {
  const [contacts,    setContacts]    = useState<AppContact[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState(false);

  // ── Seed from local cache immediately ─────────────────────────
  // Shows the previously-resolved contact list right away on cold start /
  // offline, instead of leaving chat names blank until permissions + the
  // Firestore cross-reference finish (which requires a network round-trip).
  useEffect(() => {
    AsyncStorage.getItem(CACHE_KEY).then((raw) => {
      if (!raw) return;
      try {
        const cached: AppContact[] = JSON.parse(raw);
        // Dedupe by userId in case an older cache was written before the
        // dedupe logic existed (prevents duplicate-key warnings on render).
        const seen = new Set<string>();
        const deduped = cached.filter((c) => {
          if (!c.userId || seen.has(c.userId)) return false;
          seen.add(c.userId);
          return true;
        });
        if (deduped.length > 0) {
          setContacts(deduped);
          setLoading(false);
        }
      } catch {
        // ignore malformed cache
      }
    });
  }, []);

  useEffect(() => {
    loadContacts();
  }, []);

  async function loadContacts() {
    try {
      // Only show the full spinner on the first load. Background refreshes
      // (e.g. re-syncing when the contact picker opens) keep the existing list
      // visible so it doesn't flash a spinner every time.
      if (contacts.length === 0) setLoading(true);
      setError(null);

      // ── 1. Request contacts permission ──────────────────────────
      const { status } = await requestPermissionsAsync();
      
      if (status !== 'granted') {
        setHasPermission(false);
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

      // ── 3. Build a map of normalized phone → contact info ────────
      // Use a map to de-duplicate by normalized phone number
      const phoneToName  = new Map<string, string>();
      const phoneToPhoto = new Map<string, string>();

      for (const contact of data) {
        if (!contact.phoneNumbers) continue;
        for (const pn of contact.phoneNumbers) {
          if (!pn.number) continue;
          const normalized = normalizePhone(pn.number);
          if (!normalized) continue;
          // Only set if not already present (first match wins)
          if (!phoneToName.has(normalized)) {
            phoneToName.set(normalized, contact.name || pn.number);
          }
          if (contact.imageAvailable && contact.image?.uri && !phoneToPhoto.has(normalized)) {
            phoneToPhoto.set(normalized, contact.image.uri);
          }
        }
      }

      if (phoneToName.size === 0) {
        setContacts([]);
        setLoading(false);
        return;
      }

      // ── 4. Query Firestore to find which contacts are on ChitChat ─
      const phones  = Array.from(phoneToName.keys());
      const chunks  = chunkArray(phones, 30);
      // Map of normalized phone → { userId, firebasePhotoURL }
      const appUserMap = new Map<string, { userId: string; firebasePhotoURL: string | null }>();

      for (const chunk of chunks) {
        const q = query(
          collection(db, 'users'),
          where('phone', 'in', chunk),
        );
        const snap = await getDocs(q);

        for (const docSnap of snap.docs) {
          const docData = docSnap.data();
          const phone   = docData.phone as string;
          // Respect the user's profile-photo privacy setting
          const photoPrivacy    = docData.privacyProfilePhoto ?? 'Contacts';
          const firebasePhotoURL = photoPrivacy === 'Nobody' ? null : (docData.photoURL || null);
          appUserMap.set(phone, { userId: docSnap.id, firebasePhotoURL });
        }
      }

      // ── 5. Build the contact list (only registered ChitChat users) ───
      const appContacts: AppContact[] = [];
      // One entry per account. The same person can be saved under several phone
      // numbers, all resolving to the same userId — without this dedupe the
      // contact picker renders duplicate React keys (same uid twice).
      const seenUserIds = new Set<string>();

      for (const [phone, name] of phoneToName.entries()) {
        const appUser = appUserMap.get(phone);
        if (!appUser) continue; // skip contacts without a ChitChat account
        if (seenUserIds.has(appUser.userId)) continue; // already added under another number
        seenUserIds.add(appUser.userId);
        appContacts.push({
          userId:           appUser.userId,
          phone,
          displayName:      name,
          isSaved:          true,
          isOnApp:          true,
          photoUri:         phoneToPhoto.get(phone),
          firebasePhotoURL: appUser.firebasePhotoURL ?? undefined,
        });
      }

      // Sort alphabetically by name
      appContacts.sort((a, b) => a.displayName.localeCompare(b.displayName));

      console.log('[useContacts] Loaded', appContacts.length, 'ChitChat contacts');
      setContacts(appContacts);
      AsyncStorage.setItem(CACHE_KEY, JSON.stringify(appContacts)).catch(() => {});
    } catch (err: any) {
      console.error('[useContacts] Failed to load contacts:', err);
      setError(err.message ?? 'Failed to load contacts');
    } finally {
      setLoading(false);
    }
  }

  return { contacts, loading, error, hasPermission, reload: loadContacts };
}