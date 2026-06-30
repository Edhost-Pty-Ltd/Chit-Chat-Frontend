// ─── useTypingIndicator ───────────────────────────────────────────────────────
// Writes the current user's typing presence to Firestore and listens for
// other participants typing in the same chat.
//
// Firestore path:  chats/{chatId}  →  field  typing: { [userId]: Timestamp }
//
// Behaviour:
//   • setTyping(true)  → writes serverTimestamp for userId
//   • setTyping(false) → deletes the userId key
//   • Auto-clears own entry after 5 s of silence (debounce)
//   • Considers a remote user "typing" if their timestamp is < 6 s old

import { useEffect, useRef, useCallback, useState } from 'react';
import {
  doc, onSnapshot, updateDoc, deleteField, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';

const STOP_TYPING_DELAY_MS = 5_000;   // clear own entry after 5 s of silence
const STALE_THRESHOLD_MS   = 6_000;   // treat remote entry as stale after 6 s

export interface TypingUser {
  userId: string;
}

export function useTypingIndicator(
  chatId: string | null,
  userId: string | null,
) {
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const stopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Listen for remote typing presence ──────────────────────────
  useEffect(() => {
    if (!chatId || !userId) return;

    const chatRef = doc(db, 'chats', chatId);

    const unsub = onSnapshot(chatRef, (snap) => {
      if (!snap.exists()) return;

      const typing: Record<string, any> = snap.data().typing ?? {};
      const now = Date.now();

      const active: TypingUser[] = Object.entries(typing)
        .filter(([uid, ts]) => {
          if (uid === userId) return false;            // skip self
          if (!ts?.toMillis) return false;             // malformed
          return now - ts.toMillis() < STALE_THRESHOLD_MS;
        })
        .map(([uid]) => ({ userId: uid }));

      setTypingUsers(active);
    });

    return () => unsub();
  }, [chatId, userId]);

  // ── Write own typing presence ───────────────────────────────────
  const setTyping = useCallback(
    async (isTyping: boolean) => {
      if (!chatId || !userId) return;

      // Clear any pending auto-stop
      if (stopTimer.current) {
        clearTimeout(stopTimer.current);
        stopTimer.current = null;
      }

      const chatRef = doc(db, 'chats', chatId);

      if (isTyping) {
        try {
          await updateDoc(chatRef, {
            [`typing.${userId}`]: serverTimestamp(),
          });
        } catch {
          // Chat doc might not have typing field yet — silently ignore
        }

        // Schedule auto-clear
        stopTimer.current = setTimeout(async () => {
          try {
            await updateDoc(chatRef, {
              [`typing.${userId}`]: deleteField(),
            });
          } catch { /* ignore */ }
        }, STOP_TYPING_DELAY_MS);
      } else {
        try {
          await updateDoc(chatRef, {
            [`typing.${userId}`]: deleteField(),
          });
        } catch { /* ignore */ }
      }
    },
    [chatId, userId],
  );

  // ── Clear own presence on unmount ───────────────────────────────
  useEffect(() => {
    return () => {
      if (stopTimer.current) clearTimeout(stopTimer.current);
      if (chatId && userId) {
        const chatRef = doc(db, 'chats', chatId);
        updateDoc(chatRef, {
          [`typing.${userId}`]: deleteField(),
        }).catch(() => {});
      }
    };
  }, [chatId, userId]);

  return { typingUsers, setTyping };
}
