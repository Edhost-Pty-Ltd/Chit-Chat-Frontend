// ─── usePresence Hook ─────────────────────────────────────────────────────────
// Two responsibilities:
//
//   1. WRITE  — keeps the current user's presence current in both RTDB and Firestore.
//               • PRIMARY: Uses Firebase Realtime Database (RTDB) for presence
//               • BACKUP: Mirrors data to Firestore for backwards compatibility
//               • Sets { online: true, lastSeen: now } on app-foreground / sign-in.
//               • Sets { online: false, lastSeen: now } on app-background / sign-out.
//               • Sends periodic heartbeats (every 30s) while app is in foreground
//               • Uses RTDB onDisconnect to auto-mark offline on connection loss
//               • This ensures offline status works even on force-close, crash, or network loss
//
//   2. READ   — watches another user's presence in real time from RTDB and resolves the
//               text to display in the chat header ("Online", "last seen …") while
//               respecting that user's privacyLastSeen setting.
//
import { useEffect, useRef, useState, useCallback } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import { doc, setDoc, onSnapshot, getDoc } from 'firebase/firestore';
import { ref as dbRef, onDisconnect as rtdbOnDisconnect, set as rtdbSet, onValue, serverTimestamp as rtdbServerTimestamp } from 'firebase/database';
import { db, rtdb } from '../config/firebase';
import { fetchUserPrivacySettings, isVisibleTo } from './usePrivacySettings';
import { usePhoneBook } from './usePhoneBook';

// ── Constants ─────────────────────────────────────────────────────────────────
const HEARTBEAT_INTERVAL_MS = 30_000; // 30 seconds
const PRESENCE_TIMEOUT_MS = 90_000;   // 90 seconds (3x heartbeat)
const APP_STATE_DEBOUNCE_MS = 2_000;  // 2 seconds debounce for app state changes

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

/** Write the current user's online state to both RTDB (primary) and Firestore (backup). */
export async function writePresence(userId: string, online: boolean): Promise<void> {
  if (!userId) {
    console.warn('[usePresence] Cannot write presence: userId is null/undefined');
    return;
  }

  try {
    const timestamp = Date.now();
    
    console.log(`[usePresence] Writing presence to RTDB: userId=${userId}, online=${online}`);
    
    // PRIMARY: Write to RTDB (this is what we'll read from)
    const presenceRef = dbRef(rtdb, `presence/${userId}`);
    await rtdbSet(presenceRef, {
      online,
      lastSeen: timestamp,
      lastHeartbeat: online ? timestamp : null,
    });
    
    console.log(`[usePresence] ✅ RTDB write successful`);
    
    // BACKUP: Also write to Firestore for backwards compatibility
    // (in case we need to query presence data for other features)
    await setDoc(
      doc(db, 'users', userId),
      { 
        online, 
        lastSeen: new Date(timestamp),
        lastHeartbeat: online ? new Date(timestamp) : null,
      },
      { merge: true },
    );
    
    console.log(`[usePresence] ✅ Firestore write successful`);
    console.log(`[usePresence] Presence fully updated: ${online ? 'online' : 'offline'}`);
  } catch (err: any) {
    console.error('[usePresence] Failed to write presence:', {
      error: err?.message || err,
      code: err?.code,
      userId,
      online,
    });
    throw err; // Re-throw so caller knows it failed
  }
}

/** Send a heartbeat to keep the user marked as active. */
async function sendHeartbeat(userId: string): Promise<void> {
  if (!userId) {
    console.warn('[usePresence] Cannot send heartbeat: userId is null/undefined');
    return;
  }

  try {
    const timestamp = Date.now();
    
    // PRIMARY: Update RTDB
    const presenceRef = dbRef(rtdb, `presence/${userId}`);
    await rtdbSet(presenceRef, {
      online: true,
      lastHeartbeat: timestamp,
      lastSeen: timestamp,
    });
    
    // BACKUP: Also update Firestore
    await setDoc(
      doc(db, 'users', userId),
      { 
        lastHeartbeat: new Date(timestamp),
        lastSeen: new Date(timestamp),
      },
      { merge: true },
    );
    
    console.log('[usePresence] ✅ Heartbeat sent successfully');
  } catch (err: any) {
    console.error('[usePresence] Failed to send heartbeat:', {
      error: err?.message || err,
      code: err?.code,
      userId,
    });
  }
}

/** Setup Firebase Realtime Database onDisconnect handler for automatic offline status. */
async function setupDisconnectHandler(userId: string): Promise<void> {
  if (!userId) {
    console.warn('[usePresence] Cannot setup disconnect handler: userId is null/undefined');
    return;
  }

  try {
    // Use RTDB for presence since it has proper disconnect detection
    const presenceRef = dbRef(rtdb, `presence/${userId}`);

    // Set up automatic offline status on disconnect
    // This fires when the connection to Firebase is lost (force-close, network loss, etc.)
    await rtdbOnDisconnect(presenceRef).set({
      online: false,
      lastSeen: rtdbServerTimestamp(),
      lastHeartbeat: null,
    });

    console.log('[usePresence] ✅ RTDB disconnect handler configured for user:', userId);
  } catch (err: any) {
    console.error('[usePresence] Failed to setup disconnect handler:', {
      error: err?.message || err,
      code: err?.code,
      userId,
    });
  }
}

// ── Hook 1: Write the current user's presence ─────────────────────────────────
// THIS SHOULD BE CALLED ONCE AT APP LEVEL, NOT IN INDIVIDUAL SCREENS
export function useWritePresence(userId: string | null) {
  const appState = useRef<AppStateStatus>(AppState.currentState);
  const heartbeatInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const backgroundTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isActive = useRef(true);

  // Start heartbeat timer
  const startHeartbeat = useCallback((uid: string) => {
    if (heartbeatInterval.current) {
      clearInterval(heartbeatInterval.current);
    }
    
    heartbeatInterval.current = setInterval(() => {
      if (isActive.current) {
        sendHeartbeat(uid);
      }
    }, HEARTBEAT_INTERVAL_MS);
    
    console.log('[usePresence] Heartbeat started');
  }, []);

  // Stop heartbeat timer
  const stopHeartbeat = useCallback(() => {
    if (heartbeatInterval.current) {
      clearInterval(heartbeatInterval.current);
      heartbeatInterval.current = null;
      console.log('[usePresence] Heartbeat stopped');
    }
  }, []);

  // Handle going online
  const goOnline = useCallback(async (uid: string) => {
    isActive.current = true;
    
    // Clear any pending background timeout
    if (backgroundTimeout.current) {
      clearTimeout(backgroundTimeout.current);
      backgroundTimeout.current = null;
    }

    await writePresence(uid, true);
    await setupDisconnectHandler(uid);
    startHeartbeat(uid);
  }, [startHeartbeat]);

  // Handle going offline (with debounce to prevent flicker)
  const goOffline = useCallback(async (uid: string, immediate: boolean = false) => {
    isActive.current = false;
    stopHeartbeat();

    const performOffline = async () => {
      await writePresence(uid, false);
      console.log('[usePresence] User marked offline');
    };

    if (immediate) {
      await performOffline();
    } else {
      // Debounce to avoid flickering during quick app switches
      backgroundTimeout.current = setTimeout(() => {
        performOffline();
      }, APP_STATE_DEBOUNCE_MS);
    }
  }, [stopHeartbeat]);

  useEffect(() => {
    if (!userId) {
      stopHeartbeat();
      return;
    }

    // Go online immediately on mount
    goOnline(userId);

    // Web-specific: use visibility API
    if (Platform.OS === 'web') {
      const handleVisibilityChange = () => {
        if (document.hidden) {
          goOffline(userId, false);
        } else {
          goOnline(userId);
        }
      };

      document.addEventListener('visibilitychange', handleVisibilityChange);
      
      // Also handle beforeunload for clean disconnect
      const handleBeforeUnload = () => {
        // This needs to be synchronous for beforeunload
        writePresence(userId, false);
      };
      
      window.addEventListener('beforeunload', handleBeforeUnload);

      return () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        window.removeEventListener('beforeunload', handleBeforeUnload);
        goOffline(userId, true);
      };
    }

    // Native: use AppState
    const sub = AppState.addEventListener('change', (nextState) => {
      const prevState = appState.current;
      appState.current = nextState;

      console.log(`[usePresence] AppState changed: ${prevState} → ${nextState}`);

      if (nextState === 'active' && prevState !== 'active') {
        goOnline(userId);
      } else if (nextState.match(/inactive|background/) && prevState === 'active') {
        // Use debounced offline for background (not immediate)
        // to avoid flicker during quick app switches
        goOffline(userId, false);
      }
    });

    return () => {
      // Go offline on unmount (sign-out / component teardown)
      goOffline(userId, true);
      sub.remove();
    };
  }, [userId, goOnline, goOffline, stopHeartbeat]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopHeartbeat();
      if (backgroundTimeout.current) {
        clearTimeout(backgroundTimeout.current);
      }
    };
  }, [stopHeartbeat]);
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
    let presenceUnsub: (() => void) | null = null;
    let profileUnsub: (() => void) | null = null;

    // First fetch the privacy settings (one-shot), then subscribe to presence.
    fetchUserPrivacySettings(otherUserId).then((privacy) => {
      if (cancelled) return;

      const lastSeenVisible = isVisibleTo(privacy.lastSeen, viewerIsContact ?? false);
      const photoVisible    = isVisibleTo(privacy.profilePhoto, viewerIsContact ?? false);

      // PRIMARY: Subscribe to RTDB presence (this is our source of truth)
      const presenceRef = dbRef(rtdb, `presence/${otherUserId}`);
      presenceUnsub = onValue(
        presenceRef, 
        (snapshot) => {
          if (cancelled) return;
          
          const data = snapshot.val();
          console.log(`[usePresence] RTDB snapshot received for ${otherUserId}:`, { 
            exists: snapshot.exists(), 
            data,
            online: data?.online,
            lastSeen: data?.lastSeen 
          });
          
          if (!data || data.online === undefined) {
            // No presence data in RTDB yet - fallback to Firestore
            console.log(`[usePresence] No RTDB presence data for ${otherUserId}, will read from Firestore backup`);
            // Don't set offline yet - let Firestore subscription handle it
            return;
          }

          const online: boolean = !!data.online;
          
          console.log(`[usePresence] ✅ Using RTDB presence for ${otherUserId}: online=${online}`);

          if (online) {
            setInfo((prev) => ({ 
              ...prev, 
              statusText: lastSeenVisible ? 'Online' : '', 
              isOnline: true 
            }));
          } else {
            if (!lastSeenVisible) {
              setInfo((prev) => ({ ...prev, statusText: '', isOnline: false }));
              return;
            }
            // lastSeen is stored as milliseconds timestamp in RTDB
            const date = data.lastSeen ? new Date(data.lastSeen) : null;
            setInfo((prev) => ({
              ...prev,
              statusText: date ? formatLastSeen(date) : '',
              isOnline: false,
            }));
          }
        },
        (error) => {
          console.error(`[usePresence] Error reading RTDB presence for ${otherUserId}:`, {
            error: error?.message || error,
            code: error?.code
          });
          console.log(`[usePresence] Falling back to Firestore for ${otherUserId}`);
        }
      );

      // SECONDARY: Subscribe to Firestore for profile photo AND as backup for presence
      profileUnsub = onSnapshot(doc(db, 'users', otherUserId), (snap) => {
        if (cancelled || !snap.exists()) return;
        const data = snap.data();
        
        // Always update photo
        const photoURL = photoVisible ? (data.photoURL || null) : null;
        
        // If we have Firestore presence data, use it as fallback
        if (data.online !== undefined) {
          const online = !!data.online;
          console.log(`[usePresence] 📦 Using Firestore backup presence for ${otherUserId}: online=${online}`);
          
          if (online) {
            setInfo({ 
              statusText: lastSeenVisible ? 'Online' : '', 
              isOnline: true,
              photoURL
            });
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
        } else {
          // Just update photo if no presence in Firestore either
          setInfo((prev) => ({ ...prev, photoURL }));
        }
      });
    });

    return () => { 
      cancelled = true;
      presenceUnsub?.();
      profileUnsub?.();
    };
  }, [otherUserId, isGroup, viewerIsContact]);

  return info;
}
