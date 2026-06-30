// ─── useNotificationSync Hook ─────────────────────────────────────────────────
// Syncs real-time events from Firestore to the notification system.
// Listens for:
//   • New messages in all user's chats
//   • Incoming calls (missed/rejected)
//   • System events (optional)

import { useEffect, useRef } from 'react';
import {
  collection, query, where, orderBy,
  onSnapshot, Timestamp, Unsubscribe, doc, getDoc,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import type { AppNotification, NotifType } from '../context/NotificationContext';
import { resolveNotificationName } from '../utils/resolveNotificationName';

interface LastMessageTimestamp {
  [chatId: string]: Date;
}

type PushNotificationFn = (n: Omit<AppNotification, 'id' | 'time' | 'read'>) => void;

export function useNotificationSync(userId: string | null, pushNotification: PushNotificationFn) {

  // ── Keep a ref to always have the latest pushNotification ────────
  const pushNotificationRef = useRef(pushNotification);
  useEffect(() => {
    pushNotificationRef.current = pushNotification;
  });

  const lastMessageTimestamps = useRef<LastMessageTimestamp>({});
  const unsubscribers = useRef<Unsubscribe[]>([]);
  const isInitialLoad = useRef(true);

  useEffect(() => {
    console.log('[useNotificationSync] Effect triggered, userId:', userId);
    
    if (!userId) {
      console.log('[useNotificationSync] No userId, cleaning up');
      // Cleanup all listeners
      unsubscribers.current.forEach(unsub => unsub());
      unsubscribers.current = [];
      lastMessageTimestamps.current = {};
      isInitialLoad.current = true;
      return;
    }

    console.log('[useNotificationSync] Setting up listeners for userId:', userId);

    // ── 1. Listen for new messages in user's chats ────────────────
    const chatsQuery = query(
      collection(db, 'chats'),
      where('members', 'array-contains', userId),
    );

    const unsubChats = onSnapshot(
      chatsQuery, 
      async (chatsSnap) => {
        console.log('[useNotificationSync] Chats snapshot received, docs:', chatsSnap.docs.length, 'isInitialLoad:', isInitialLoad.current);
        
        if (isInitialLoad.current) {
          // On first load, just store timestamps - don't show notifications
          chatsSnap.docs.forEach((chatDoc) => {
            const chatData = chatDoc.data();
            const lastMsg = chatData.lastMessage;
            if (lastMsg?.timestamp) {
              lastMessageTimestamps.current[chatDoc.id] = 
                (lastMsg.timestamp as Timestamp).toDate();
              console.log('[useNotificationSync] Stored initial timestamp for chat:', chatDoc.id);
            }
          });
          isInitialLoad.current = false;
          console.log('[useNotificationSync] Initial load complete, will notify on next change');
          return;
        }

        console.log('[useNotificationSync] Processing chat updates, changes:', chatsSnap.docChanges().length);

        // Process only modified or added chats
        for (const change of chatsSnap.docChanges()) {
          if (change.type === 'modified' || change.type === 'added') {
            const chatDoc = change.doc;
            const chatId = chatDoc.id;
            const chatData = chatDoc.data();
            const lastMsg = chatData.lastMessage;

            console.log('[useNotificationSync] Chat change:', change.type, 'chatId:', chatId, 'lastMsg:', lastMsg);

            if (!lastMsg || !lastMsg.timestamp) {
              console.log('[useNotificationSync] No lastMessage or timestamp, skipping');
              continue;
            }

            const lastMsgTime = (lastMsg.timestamp as Timestamp).toDate();
            const lastKnownTime = lastMessageTimestamps.current[chatId];

            console.log('[useNotificationSync] Chat:', chatId, 'senderId:', lastMsg.senderId, 'currentUserId:', userId, 'lastMsgTime:', lastMsgTime, 'lastKnownTime:', lastKnownTime);

            // Check if this is a new message (not from current user)
            if (
              lastMsg.senderId !== userId &&
              (!lastKnownTime || lastMsgTime > lastKnownTime)
            ) {
              console.log('[useNotificationSync] NEW MESSAGE DETECTED! Chat:', chatId);
              
              // Update timestamp
              lastMessageTimestamps.current[chatId] = lastMsgTime;

              // Fetch sender info for notification
              try {
                const senderDoc = await getDoc(doc(db, 'users', lastMsg.senderId));
                if (!senderDoc.exists()) {
                  console.log('[useNotificationSync] Sender not found');
                  continue;
                }
                
                const senderPhone = senderDoc.data().phone;
                const senderName = await resolveNotificationName(senderPhone);

                console.log('[useNotificationSync] Sender phone:', senderPhone, 'Resolved name:', senderName);

                // Determine chat name
                let chatName = senderName;
                if (chatData.type === 'group' && chatData.groupName) {
                  chatName = chatData.groupName;
                }

                const notificationData = {
                  type: 'message' as const,
                  title: chatName,
                  body: chatData.type === 'group' 
                    ? `${senderName}: ${lastMsg.text || 'Sent a media file'}`
                    : (lastMsg.text || 'Sent a media file'),
                  contactId: chatData.type === 'direct' ? lastMsg.senderId : undefined,
                };

                console.log('[useNotificationSync] Pushing notification:', notificationData);
                console.log('[useNotificationSync] pushNotification function:', typeof pushNotification, pushNotification ? 'defined' : 'undefined');

                // Push notification via ref to avoid stale closure
                try {
                  await pushNotificationRef.current(notificationData);
                  console.log('[useNotificationSync] Notification pushed successfully');
                } catch (err) {
                  console.error('[useNotificationSync] Error pushing notification:', err);
                }
              } catch (err) {
                console.error('[useNotificationSync] Error fetching sender info:', err);
              }
            } else {
              console.log('[useNotificationSync] Message not new or from current user, skipping');
            }
          }
        }
      },
      (error) => {
        console.error('[useNotificationSync] Error in chats listener:', error);
      }
    );

    unsubscribers.current.push(unsubChats);

    // ── 2. Listen for missed/rejected calls ───────────────────────
    // Note: This query requires a compound index in Firestore
    // If index is not created yet, call notifications won't work but message notifications will
    try {
      const callHistoryQuery = query(
        collection(db, 'users', userId, 'callHistory'),
        where('direction', '==', 'incoming'),
        where('status', 'in', ['missed', 'rejected']),
        orderBy('timestamp', 'desc'),
      );

      const lastCallCheck = new Date();
      console.log('[useNotificationSync] Setting up call history listener, will notify for calls after:', lastCallCheck);
      
      const unsubCalls = onSnapshot(
        callHistoryQuery, 
        (callsSnap) => {
          console.log('[useNotificationSync] Call history snapshot, changes:', callsSnap.docChanges().length);
          
          callsSnap.docChanges().forEach(async (change) => {
            console.log('[useNotificationSync] Call change type:', change.type);
            
            if (change.type === 'added') {
              const callData = change.doc.data();
              const callTime = callData.timestamp 
                ? (callData.timestamp as Timestamp).toDate()
                : new Date();

              console.log('[useNotificationSync] New call added, callTime:', callTime, 'lastCallCheck:', lastCallCheck);

              // Only notify for calls after we started listening
              if (callTime > lastCallCheck) {
                const callType = callData.type === 'video' ? 'Video Call' : 'Call';
                const status = callData.status === 'missed' ? 'Missed' : 'Rejected';
                
                // Resolve caller name from contacts
                let callerName = 'Unknown';
                try {
                  if (callData.otherParty?.userId) {
                    const callerDoc = await getDoc(doc(db, 'users', callData.otherParty.userId));
                    if (callerDoc.exists()) {
                      const callerPhone = callerDoc.data().phone;
                      callerName = await resolveNotificationName(callerPhone);
                      console.log('[useNotificationSync] Caller phone:', callerPhone, 'Resolved name:', callerName);
                    }
                  }
                } catch (err) {
                  console.error('[useNotificationSync] Error resolving caller name:', err);
                }

                const notificationData = {
                  type: 'call' as const,
                  title: `${status} ${callType}`,
                  body: `${callerName} tried to ${callData.type === 'video' ? 'video ' : ''}call you`,
                  contactId: callData.otherParty?.userId,
                };

                console.log('[useNotificationSync] Pushing call notification:', notificationData);
                
                try {
                  pushNotificationRef.current(notificationData);
                  console.log('[useNotificationSync] Call notification pushed');
                } catch (err) {
                  console.error('[useNotificationSync] Error pushing call notification:', err);
                }
              } else {
                console.log('[useNotificationSync] Call is older than listener start time, skipping');
              }
            }
          });
        },
        (error) => {
          console.error('[useNotificationSync] Error in call history listener:', error);
          // Don't throw - let message notifications continue to work
        }
      );

      unsubscribers.current.push(unsubCalls);
      console.log('[useNotificationSync] Call history listener set up successfully');
    } catch (error) {
      console.error('[useNotificationSync] Failed to set up call history listener (index may be missing):', error);
      console.log('[useNotificationSync] Continuing with message notifications only');
      // Continue execution - message notifications will still work
    }

    console.log('[useNotificationSync] All listeners set up successfully');

    // Cleanup on unmount
    return () => {
      console.log('[useNotificationSync] Cleaning up listeners');
      unsubscribers.current.forEach(unsub => unsub());
      unsubscribers.current = [];
    };
  }, [userId]); // Only re-run when userId changes — pushNotification is accessed via ref
}
