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
  Unsubscribe,
} from 'firebase/firestore';
import { db } from '../config/firebase';

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
      (snapshot) => {
        const newNotifications: GroupCallNotification[] = [];

        snapshot.forEach((doc) => {
          const data = doc.data();
          newNotifications.push({
            callId: data.callId,
            chatId: data.chatId,
            roomName: data.roomName,
            initiatorId: data.initiatorId,
            initiatorName: data.initiatorName,
            callType: data.callType,
            status: data.status,
            createdAt: data.createdAt,
          });
        });

        console.log('[useGroupCallNotifications] Received notifications:', newNotifications.length);
        setNotifications(newNotifications);
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
