// ─── Hook: Group Call Notifications ─────────────────────────────────────────
// Listens for incoming group call invitations

import { useState, useEffect } from 'react';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  getDoc,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from '../config/firebase';

// A pending call invite older than this is considered stale (the call has
// almost certainly ended). Prevents "ghost calls" from leftover notifications.
const STALE_NOTIFICATION_MS = 60 * 1000;

export interface GroupCallNotification {
  callId: string;
  chatId: string;
  roomName: string;
  initiatorId: string;
  initiatorName: string;
  callType: 'audio' | 'video';
  status: 'pending' | 'dismissed';
  createdAt: any;
}

export function useGroupCallNotifications(userId: string | null) {
  const [notifications, setNotifications] = useState<GroupCallNotification[]>([]);

  useEffect(() => {
    if (!userId) {
      setNotifications([]);
      return;
    }

    console.log('[useGroupCallNotifications] Setting up listener for user:', userId);

    // Listen for group call notifications for this user
    const notificationsRef = collection(db, 'users', userId, 'groupCallNotifications');
    const q = query(notificationsRef, where('status', '==', 'pending'));

    const unsubscribe: Unsubscribe = onSnapshot(
      q,
      async (snapshot) => {
        const now = Date.now();
        const candidates: GroupCallNotification[] = [];

        for (const docSnap of snapshot.docs) {
          const data = docSnap.data();

          // 1. Ignore stale invites — auto-dismiss them.
          const createdAtMs =
            data.createdAt && typeof data.createdAt.toMillis === 'function'
              ? data.createdAt.toMillis()
              : null;

          if (createdAtMs !== null && now - createdAtMs > STALE_NOTIFICATION_MS) {
            console.log('[useGroupCallNotifications] Ignoring stale notification:', docSnap.id);
            updateDoc(
              doc(db, 'users', userId, 'groupCallNotifications', docSnap.id),
              { status: 'dismissed' }
            ).catch((err) =>
              console.warn('[useGroupCallNotifications] Failed to dismiss stale notification:', err)
            );
            continue;
          }

          // 2. Ignore calls from blocked users — auto-dismiss silently.
          const initiatorId: string = data.initiatorId;
          if (initiatorId) {
            try {
              const blockedRef = doc(db, 'users', userId, 'blockedUsers', initiatorId);
              const blockedSnap = await getDoc(blockedRef);
              if (blockedSnap.exists()) {
                console.log('[useGroupCallNotifications] Ignoring call from blocked user:', initiatorId);
                updateDoc(
                  doc(db, 'users', userId, 'groupCallNotifications', docSnap.id),
                  { status: 'dismissed' }
                ).catch(() => {});
                continue;
              }
            } catch {
              // Non-fatal — if we can't check, allow the call through
            }
          }

          candidates.push({
            callId: data.callId,
            chatId: data.chatId,
            roomName: data.roomName,
            initiatorId: data.initiatorId,
            initiatorName: data.initiatorName,
            callType: data.callType,
            status: data.status,
            createdAt: data.createdAt,
          });
        }

        console.log('[useGroupCallNotifications] Received notifications:', candidates.length);
        setNotifications(candidates);
      },
      (error) => {
        console.error('[useGroupCallNotifications] Error listening for notifications:', error);
      }
    );

    return () => {
      console.log('[useGroupCallNotifications] Cleaning up listener');
      unsubscribe();
    };
  }, [userId]);

  /**
   * Dismiss a group call notification
   */
  const dismissNotification = async (callId: string) => {
    if (!userId) return;

    try {
      const notificationRef = doc(db, 'users', userId, 'groupCallNotifications', callId);
      await updateDoc(notificationRef, {
        status: 'dismissed',
      });
      console.log('[useGroupCallNotifications] Dismissed notification:', callId);
    } catch (error) {
      console.error('[useGroupCallNotifications] Error dismissing notification:', error);
    }
  };

  return {
    notifications,
    dismissNotification,
  };
}
