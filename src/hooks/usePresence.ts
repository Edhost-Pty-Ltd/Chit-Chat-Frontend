// ─── usePresence Hook ─────────────────────────────────────────────────────────
// Two responsibilities:
//
//   1. WRITE  — keeps the current user's presence current in Firestore.
//               • Sets { online: true, lastSeen: now } on app-foreground / sign-in.
//               • Sets { online: false, lastSeen: now } on app-background / sign-out.
//               Mirrors AppState changes so the field stays accurate without a
//               server-side disconnect handler.
//
//   2. READ   — watches another user's presence in real time and resolves the
//               text to display in the chat header ("Online", "last seen …") while
//               respecting that user's privacyLastSeen setting.
//
import { useEffect, useRef, useState, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { doc, setDoc, onSnapshot, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { fetchUserPrivacySettings, isVisibleTo } from './usePrivacySettings';
import { usePhoneBook } from './usePhoneBook';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Format a lastSeen Date into a human-readable string for the chat header. */
export function formatLastSeen(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMins < 1)   return 'last seen just now';
  if (diffMins < 60)  return `last seen ${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
  if (diffHours < 24) return `last seen ${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  if (diffDays === 1) return 'last seen yesterday';
  if (diffDays < 7)   return `last seen ${diffDays} days ago`;

  return `last seen ${date.toLocaleDateString([], { day: 'numeric', month: 'short', year: diffDays > 365 ? 'numeric' : undefined })}`;
}

/** Write the current user's online state to Firestore. */
export async function writePresence(userId: string, online: boolean): Promise<void> {
  try {
    await setDoc(
      doc(db, 'users', userId),
      { online, lastSeen: new Date() },
      { merge: true },
    );
  } catch (err) {
    console.warn('[usePresence] Failed to write presence:', err);
  }
}

// ── Hook 1: Write the current user's presence ─────────────────────────────────
export function useWritePresence(userId: string | null) {
  const appState = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    if (!userId) return;

    // Go online immediately
    writePresence(userId, true);

    const sub = AppState.addEventListener('change', (next) => {
      const prev = appState.current;
      appState.current = next;

      if (next === 'active' && prev !== 'active') {
        writePresence(userId, true);
      } else if (next.match(/inactive|background/) && prev === 'active') {
        writePresence(userId, false);
      }
    });

    return () => {
      // Go offline on unmount (sign-out / component teardown)
      writePresence(userId, false);
      sub.remove();
    };
  }, [userId]);
}

// ── Hook 2: Watch another user's presence and return the header subtitle ──────
export interface PresenceInfo {
  /** "Online" | "last seen …" | "" (hidden by privacy) */
  statusText: string;
  isOnline: boolean;
  /** The other user's profile photo, filtered by their privacyProfilePhoto setting.
   *  `undefined` while still loading; `null` when hidden or not set. */
  photoURL: string | null | undefined;
}

export function useOtherUserPresence(
  otherUserId: string | null,
  isGroup: boolean,
  /** Whether this viewer is in the other user's contacts (for privacy check). */
  viewerIsContact?: boolean,
): PresenceInfo {
  const [info, setInfo] = useState<PresenceInfo>({ statusText: '', isOnline: false, photoURL: undefined });

  useEffect(() => {
    if (!otherUserId || isGroup) return;

    let cancelled = false;

    // First fetch the privacy settings (one-shot), then subscribe to presence.
    fetchUserPrivacySettings(otherUserId).then((privacy) => {
      if (cancelled) return;

      const lastSeenVisible = isVisibleTo(privacy.lastSeen, viewerIsContact ?? false);
      const photoVisible    = isVisibleTo(privacy.profilePhoto, viewerIsContact ?? false);

      const unsub = onSnapshot(doc(db, 'users', otherUserId), (snap) => {
        if (cancelled || !snap.exists()) return;
        const data = snap.data();
        const online: boolean = !!data.online;

        // Resolve the privacy-filtered profile photo from the live doc
        const photoURL = photoVisible ? (data.photoURL || null) : null;

        if (online) {
          setInfo({ statusText: lastSeenVisible ? 'Online' : '', isOnline: true, photoURL });
        } else {
          if (!lastSeenVisible) {
            setInfo({ statusText: '', isOnline: false, photoURL });
            return;
          }
          // Resolve lastSeen timestamp (may be a Firestore Timestamp or a plain Date)
          const raw = data.lastSeen;
          let date: Date | null = null;
          if (raw) {
            date = typeof raw.toDate === 'function' ? raw.toDate() : new Date(raw);
          }
          setInfo({
            statusText: date ? formatLastSeen(date) : '',
            isOnline: false,
            photoURL,
          });
        }
      });

      return unsub;
    });

    return () => { cancelled = true; };
  }, [otherUserId, isGroup, viewerIsContact]);

  return info;
}
