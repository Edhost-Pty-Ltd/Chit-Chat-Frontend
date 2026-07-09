// ─── useGlobalDelivery ─────────────────────────────────────────────────────
// Marks all incoming messages as DELIVERED across all chats when app is open.
// Also updates the chat-level lastMessage.deliveredTo for the chat list ticks.

import { useEffect, useRef } from 'react';
import {
  collection, query, where, onSnapshot, getDocs, updateDoc,
  orderBy, limit, doc,
} from 'firebase/firestore';
import { db } from '../config/firebase';

export function useGlobalDelivery(userId: string | null) {
  const processed = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!userId) return;
    processed.current.clear();

    const q = query(
      collection(db, 'chats'),
      where('members', 'array-contains', userId),
    );

    const unsub = onSnapshot(q, async (snap) => {
      for (const chatDoc of snap.docs) {
        const chatId = chatDoc.id;
        const chatData = chatDoc.data();
        const lm = chatData.lastMessage;

        if (!lm || !lm.senderId) continue;

        // CASE 1: We received a message from someone else — mark as delivered
        if (lm.senderId !== userId) {
          const chatDeliveredTo: string[] = lm.deliveredTo || [];
          if (chatDeliveredTo.includes(userId)) continue;

          const key = `${chatId}-deliver-${lm.timestamp?.seconds || ''}`;
          if (processed.current.has(key)) continue;
          processed.current.add(key);

          try {
            // Mark individual messages as delivered
            const messagesRef = collection(db, 'chats', chatId, 'messages');
            const msgQuery = query(messagesRef, orderBy('timestamp', 'desc'), limit(20));
            const msgSnap = await getDocs(msgQuery);

            for (const msgDoc of msgSnap.docs) {
              const data = msgDoc.data();
              if (data.senderId === userId) continue;
              const deliveredTo = data.deliveredTo || [];
              if (deliveredTo.includes(userId)) continue;
              await updateDoc(msgDoc.ref, { deliveredTo: [...deliveredTo, userId] });
            }

            // Update chat-level lastMessage.deliveredTo
            await updateDoc(doc(db, 'chats', chatId), {
              'lastMessage.deliveredTo': [...chatDeliveredTo, userId],
            });
          } catch (err) {
            console.warn('[useGlobalDelivery] Deliver error:', err);
          }
        }

        // CASE 2: We sent the last message — sync readBy/deliveredTo from the actual message doc
        if (lm.senderId === userId) {
          const key = `${chatId}-sync-${lm.timestamp?.seconds || ''}`;
          if (processed.current.has(key)) continue;
          processed.current.add(key);

          try {
            // Get the latest message we sent to check its actual readBy/deliveredTo
            const messagesRef = collection(db, 'chats', chatId, 'messages');
            const msgQuery = query(messagesRef, orderBy('timestamp', 'desc'), limit(1));
            const msgSnap = await getDocs(msgQuery);

            if (!msgSnap.empty) {
              const latestMsg = msgSnap.docs[0].data();
              const msgReadBy = latestMsg.readBy || [];
              const msgDeliveredTo = latestMsg.deliveredTo || [];
              const lmReadBy = lm.readBy || [];
              const lmDeliveredTo = lm.deliveredTo || [];

              // Sync if the message doc has more recipients than the chat doc
              const needsUpdate =
                msgReadBy.length > lmReadBy.length ||
                msgDeliveredTo.length > lmDeliveredTo.length;

              if (needsUpdate) {
                await updateDoc(doc(db, 'chats', chatId), {
                  'lastMessage.readBy': msgReadBy,
                  'lastMessage.deliveredTo': msgDeliveredTo,
                });
              }
            }
          } catch (err) {
            console.warn('[useGlobalDelivery] Sync error:', err);
          }
        }
      }
    });

    return () => unsub();
  }, [userId]);
}
