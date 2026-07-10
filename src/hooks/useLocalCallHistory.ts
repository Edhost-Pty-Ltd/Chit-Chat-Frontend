// ─── useLocalCallHistory ──────────────────────────────────────────────────────
// Persists the current user's call history to AsyncStorage so it appears
// instantly on cold start and remains visible while offline or on slow
// networks, instead of showing "No call history" until Firestore responds.
//
// Mirrors the approach used by useLocalChats.
//
// Storage key:  local_call_history_<userId>
// Format:       JSON array of CallHistoryItem (timestamp as ISO string)

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CallHistoryItem } from '../types/call';

const KEY = (userId: string) => `local_call_history_${userId}`;

// ── Serialisation helpers ────────────────────────────────────────────────────

/** Convert the Date field to an ISO string for JSON storage. */
function serialise(item: CallHistoryItem): object {
  return {
    ...item,
    timestamp: item.timestamp?.toISOString() ?? null,
  };
}

/** Restore the Date field from an ISO string after JSON.parse. */
function deserialise(raw: any): CallHistoryItem {
  return {
    ...raw,
    timestamp: raw.timestamp ? new Date(raw.timestamp) : new Date(),
  } as CallHistoryItem;
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Load the locally-cached call history for a user. Returns [] on any error. */
export async function loadLocalCallHistory(userId: string): Promise<CallHistoryItem[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY(userId));
    if (!raw) return [];
    const parsed: any[] = JSON.parse(raw);
    return parsed.map(deserialise);
  } catch (err) {
    console.warn('[useLocalCallHistory] load error:', err);
    return [];
  }
}

/** Overwrite the cached call history for a user with the latest server snapshot. */
export async function saveLocalCallHistory(
  userId: string,
  history: CallHistoryItem[],
): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY(userId), JSON.stringify(history.map(serialise)));
  } catch (err) {
    console.warn('[useLocalCallHistory] save error:', err);
  }
}

/** Wipe the cached call history for a user (e.g. on sign-out). */
export async function clearLocalCallHistory(userId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY(userId));
  } catch (err) {
    console.warn('[useLocalCallHistory] clear error:', err);
  }
}
