// ─── Component: Group Call Notification Manager ─────────────────────────────
// Global listener for group call notifications that shows UI for incoming calls

import React, { useState, useEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../hooks/useAuth';
import { useGroupCallNotifications } from '../hooks/useGroupCallNotifications';
import { useGroupCall } from '../hooks/useGroupCall';
import GroupCallNotification from './GroupCallNotification';
import { RootStackParamList } from '../types';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

export default function GroupCallNotificationManager() {
  const navigation = useNavigation<NavProp>();
  const { user } = useAuth();
  const { notifications, dismissNotification } = useGroupCallNotifications(user?.uid || null);
  const { joinGroupCall } = useGroupCall();
  const [currentNotification, setCurrentNotification] = useState<typeof notifications[0] | null>(null);

  // Show the most recent notification
  useEffect(() => {
    if (notifications.length > 0) {
      setCurrentNotification(notifications[0]);
    } else {
      setCurrentNotification(null);
    }
  }, [notifications]);

  const handleJoin = async () => {
    if (!currentNotification || !user?.uid) return;

    console.log('[GroupCallNotificationManager] Joining group call:', currentNotification.callId);

    // Join the call in Firestore
    const joined = await joinGroupCall(currentNotification.callId, user.uid);

    if (joined) {
      // Fetch group info from chat document
      try {
        const { doc, getDoc } = await import('firebase/firestore');
        const { db } = await import('../config/firebase');
        
        const chatRef = doc(db, 'chats', currentNotification.chatId);
        const chatSnap = await getDoc(chatRef);
        
        let groupName = 'Group Call';
        let memberCount = 2;
        
        if (chatSnap.exists()) {
          const chatData = chatSnap.data();
          groupName = chatData.groupName || chatData.name || 'Group Call';
          memberCount = (chatData.members as string[])?.length || 2;
        }

        // Dismiss notification
        await dismissNotification(currentNotification.callId);

        // Navigate to Group call screen with custom UI
        const userDisplayName = user.phoneNumber || user.displayName || 'Unknown';
        navigation.navigate('GroupCall', {
          roomName: currentNotification.roomName,
          displayName: userDisplayName,
          audioOnly: currentNotification.callType === 'audio',
          groupName,
          memberCount,
          chatId: currentNotification.chatId,
          callId: currentNotification.callId,
        });
      } catch (error) {
        console.error('[GroupCallNotificationManager] Error fetching group info:', error);
        // Fallback: still navigate with default values
        await dismissNotification(currentNotification.callId);
        
        const userDisplayName = user.phoneNumber || user.displayName || 'Unknown';
        navigation.navigate('GroupCall', {
          roomName: currentNotification.roomName,
          displayName: userDisplayName,
          audioOnly: currentNotification.callType === 'audio',
          groupName: 'Group Call',
          memberCount: 2,
          chatId: currentNotification.chatId,
          callId: currentNotification.callId,
        });
      }
    } else {
      console.error('[GroupCallNotificationManager] Failed to join call');
    }

    setCurrentNotification(null);
  };

  const handleDismiss = async () => {
    if (!currentNotification) return;

    console.log('[GroupCallNotificationManager] Dismissing notification:', currentNotification.callId);
    await dismissNotification(currentNotification.callId);
    setCurrentNotification(null);
  };

  if (!currentNotification) {
    return null;
  }

  return (
    <GroupCallNotification
      notification={currentNotification}
      onJoin={handleJoin}
      onDismiss={handleDismiss}
    />
  );
}
