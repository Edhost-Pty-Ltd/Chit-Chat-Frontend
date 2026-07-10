// ─── useLocalUserProfiles ─────────────────────────────────────────────────────
// Persists resolved Firestore user profiles (displayName + phone) for chat
// participants who are NOT saved in the viewer's device contacts.
//
// Without this cache, offline / cold-start chat name resolution falls back to
// "Unknown": resolveDisplayName needs the other member's phone number, but that
// number only comes from a Firestore lookup keyed by uid — which requires a
// network round-trip and has nothing to show until it completes.
//
// Storage key:  local_user_profiles

import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'local_user_profiles';

export interface CachedUserProfile {
  displayName: string;
  phone: string;
  photoURL?: string;
}

/** Load all cached user profiles, keyed by uid. Returns an empty map on any error. */
export async function loadLocalUserProfiles(): Promise<Map<string, CachedUserProfile>> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return new Map();
    const parsed: Record<string, CachedUserProfile> = JSON.parse(raw);
    return new Map(Object.entries(parsed));
  } catch (err) {
    console.warn('[useLocalUserProfiles] load error:', err);
    return new Map();
  }
}

/** Merge newly-resolved profiles into the cache (existing entries are updated in place). */
export async function saveLocalUserProfiles(
  profiles: Map<string, CachedUserProfile>,
): Promise<void> {
  try {
    const existing = await loadLocalUserProfiles();
    const merged = new Map([...existing, ...profiles]);
    await AsyncStorage.setItem(KEY, JSON.stringify(Object.fromEntries(merged)));
  } catch (err) {
    console.warn('[useLocalUserProfiles] save error:', err);
  }
}
