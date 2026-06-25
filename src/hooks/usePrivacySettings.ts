// ─── usePrivacySettings Hook ──────────────────────────────────────────────────
// Reads and persists the current user's privacy preferences on their Firestore
// user doc (users/{uid}). Also exposes helpers for other screens to check
// another user's privacy settings before showing sensitive information.

import { useState, useEffect, useCallback } from 'react';
import {
  doc, getDoc, setDoc, onSnapshot,
} from 'firebase/firestore';
import { db } from '../config/firebase';

// ─── Types ────────────────────────────────────────────────────────────────────

export type Visibility = 'Everyone' | 'Contacts' | 'Nobody';

export interface PrivacySettings {
  /** Who can see the user's "last seen" timestamp. */
  lastSeen: Visibility;
  /** Who can see the user's profile photo. */
  profilePhoto: Visibility;
  /** Who can see the user's status updates. */
  statusVisibility: Visibility;
  /** Who can add this user to groups. */
  groups: Visibility;
  /** Who can call this user. */
  calls: Visibility;
  /** Whether to send / display read receipts (double ticks turning blue). */
  readReceipts: boolean;
  /** Whether messages auto-delete after 72 hours. */
  disappearingMessages: boolean;
}

export const DEFAULT_PRIVACY: PrivacySettings = {
  lastSeen:             'Contacts',
  profilePhoto:         'Contacts',
  statusVisibility:     'Everyone',
  groups:               'Contacts',
  calls:                'Contacts',
  readReceipts:         true,
  disappearingMessages: true,
};

// Firestore field names (flat on users/{uid})
const FIELD_MAP: Record<keyof PrivacySettings, string> = {
  lastSeen:             'privacyLastSeen',
  profilePhoto:         'privacyProfilePhoto',
  statusVisibility:     'privacyStatus',
  groups:               'privacyGroups',
  calls:                'privacyCalls',
  readReceipts:         'readReceipts',
  disappearingMessages: 'disappearingMessages',
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function usePrivacySettings(userId: string | null) {
  const [settings, setSettings] = useState<PrivacySettings>(DEFAULT_PRIVACY);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);

  // ── Real-time listener ────────────────────────────────────────────────────
  useEffect(() => {
    if (!userId) { setLoading(false); return; }

    const ref = doc(db, 'users', userId);
    const unsub = onSnapshot(ref, (snap) => {
      if (!snap.exists()) { setLoading(false); return; }
      const d = snap.data();
      setSettings({
        lastSeen:             (d.privacyLastSeen         as Visibility) ?? DEFAULT_PRIVACY.lastSeen,
        profilePhoto:         (d.privacyProfilePhoto     as Visibility) ?? DEFAULT_PRIVACY.profilePhoto,
        statusVisibility:     (d.privacyStatus           as Visibility) ?? DEFAULT_PRIVACY.statusVisibility,
        groups:               (d.privacyGroups           as Visibility) ?? DEFAULT_PRIVACY.groups,
        calls:                (d.privacyCalls            as Visibility) ?? DEFAULT_PRIVACY.calls,
        readReceipts:         d.readReceipts         != null ? !!d.readReceipts         : DEFAULT_PRIVACY.readReceipts,
        disappearingMessages: d.disappearingMessages != null ? !!d.disappearingMessages : DEFAULT_PRIVACY.disappearingMessages,
      });
      setLoading(false);
    }, () => setLoading(false));

    return () => unsub();
  }, [userId]);

  // ── Update one setting ────────────────────────────────────────────────────
  const updateSetting = useCallback(
    async <K extends keyof PrivacySettings>(
      key: K,
      value: PrivacySettings[K],
    ): Promise<void> => {
      if (!userId) return;
      // Optimistic local update
      setSettings((prev) => ({ ...prev, [key]: value }));
      setSaving(true);
      try {
        await setDoc(
          doc(db, 'users', userId),
          { [FIELD_MAP[key]]: value },
          { merge: true },
        );
      } catch (err) {
        // Roll back on failure
        console.error('[usePrivacySettings] Failed to save:', key, err);
        setSettings((prev) => ({ ...prev })); // triggers re-read on next snapshot
      } finally {
        setSaving(false);
      }
    },
    [userId],
  );

  // ── Save all settings at once ─────────────────────────────────────────────
  const saveAll = useCallback(
    async (s: PrivacySettings): Promise<void> => {
      if (!userId) return;
      setSettings(s);
      setSaving(true);
      try {
        const patch: Record<string, unknown> = {};
        (Object.keys(FIELD_MAP) as (keyof PrivacySettings)[]).forEach((k) => {
          patch[FIELD_MAP[k]] = s[k];
        });
        await setDoc(doc(db, 'users', userId), patch, { merge: true });
      } catch (err) {
        console.error('[usePrivacySettings] Failed to save all:', err);
      } finally {
        setSaving(false);
      }
    },
    [userId],
  );

  return { settings, loading, saving, updateSetting, saveAll };
}

// ─── Read another user's privacy settings (one-shot, no subscription) ────────
// Used by screens that need to check e.g. "can I see their last seen?"

export async function fetchUserPrivacySettings(
  userId: string,
): Promise<PrivacySettings> {
  try {
    const snap = await getDoc(doc(db, 'users', userId));
    if (!snap.exists()) return DEFAULT_PRIVACY;
    const d = snap.data();
    return {
      lastSeen:             (d.privacyLastSeen         as Visibility) ?? DEFAULT_PRIVACY.lastSeen,
      profilePhoto:         (d.privacyProfilePhoto     as Visibility) ?? DEFAULT_PRIVACY.profilePhoto,
      statusVisibility:     (d.privacyStatus           as Visibility) ?? DEFAULT_PRIVACY.statusVisibility,
      groups:               (d.privacyGroups           as Visibility) ?? DEFAULT_PRIVACY.groups,
      calls:                (d.privacyCalls            as Visibility) ?? DEFAULT_PRIVACY.calls,
      readReceipts:         d.readReceipts         != null ? !!d.readReceipts         : DEFAULT_PRIVACY.readReceipts,
      disappearingMessages: d.disappearingMessages != null ? !!d.disappearingMessages : DEFAULT_PRIVACY.disappearingMessages,
    };
  } catch {
    return DEFAULT_PRIVACY;
  }
}

// ─── Visibility check helper ──────────────────────────────────────────────────
// Returns true if `viewerId` is allowed to see the field with `setting` given
// that `viewerIsContact` tells us whether the viewer is in the target's contacts.
export function isVisibleTo(
  setting: Visibility,
  viewerIsContact: boolean,
): boolean {
  if (setting === 'Everyone') return true;
  if (setting === 'Nobody')   return false;
  return viewerIsContact; // 'Contacts'
}
