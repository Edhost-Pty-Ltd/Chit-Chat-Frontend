// ─── useLocalChats ────────────────────────────────────────────────────────────
// Persists the current user's chat list to AsyncStorage so it appears instantly
// on cold start and remains visible while offline or on slow networks.
//
// Mirrors the approach used by useLocalMessages, but keyed per user so multiple
// accounts on one device don't clobber each other.
//
// Storage key:  local_chats_<userId>
// Format:       JSON array of ChatPreview (timestamp as ISO string)

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ChatPreview } from './useChats';

const KEY = (userId: string) => `local_chats_${userId}`;

// ── Serialisation helpers ────────────────────────────────────────────────────

/** Convert the Date field to an ISO string for JSON storage. */
function serialise(chat: ChatPreview): object {
  return {
    ...chat,
    timestamp: chat.timestamp?.toISOString() ?? null,
  };
}

/** Restore the Date field from an ISO string after JSON.parse. */
function deserialise(raw: any): ChatPreview {
  return {
    ...raw,
    timestamp: raw.timestamp ? new Date(raw.timestamp) : null,
  } as ChatPreview;
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Load the locally-cached chat list for a user. Returns [] on any error. */
export async function loadLocalChats(userId: string): Promise<ChatPreview[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY(userId));
    if (!raw) return [];
    const parsed: any[] = JSON.parse(raw);
    return parsed.map(deserialise);
  } catch (err) {
    console.warn('[useLocalChats] load error:', err);
    return [];
  }
}

/** Overwrite the cached chat list for a user with the latest server snapshot. */
export async function saveLocalChats(
  userId: string,
  chats: ChatPreview[],
): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY(userId), JSON.stringify(chats.map(serialise)));
  } catch (err) {
    console.warn('[useLocalChats] save error:', err);
  }
}

/** Wipe the cached chat list for a user (e.g. on sign-out). */
export async function clearLocalChats(userId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY(userId));
  } catch (err) {
    console.warn('[useLocalChats] clear error:', err);
  }
}
