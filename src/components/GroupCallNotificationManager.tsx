// ─── Component: Group Call Notification Manager ─────────────────────────────
// Global listener for group call notifications that shows UI for incoming calls

import React, { useState, useEffect } from 'react';
import { Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../hooks/useAuth';
import { useGroupCallNotifications } from '../hooks/useGroupCallNotifications';
import { useGroupCall } from '../hooks/useGroupCall';
import { useContacts } from '../hooks/useContacts';
import { usePhoneBook } from '../hooks/usePhoneBook';
import { useActiveCall } from '../context/ActiveCallContext';
import GroupCallNotification from './GroupCallNotification';
import { RootStackParamList } from '../types';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

export default function GroupCallNotificationManager() {
  const navigation = useNavigation<NavProp>();
  const { user } = useAuth();
  const { notifications, dismissNotification } = useGroupCallNotifications(user?.uid || null);
  const { joinGroupCall } = useGroupCall();
  const { contacts } = useContacts();
  const { resolveName } = usePhoneBook();
  const { startCall: startActiveCall } = useActiveCall();
  const [currentNotification, setCurrentNotification] = useState<typeof notifications[0] | null>(null);
  // Pre-fetched member count for the current incoming call — distinguishes 1-on-1 from group.
  const [callMemberCount, setCallMemberCount] = useState(2);
  // Resolved caller phone from Firebase (for unsaved contacts)
  const [callerPhone, setCallerPhone] = useState<string | null>(null);

  // Show the most recent notification and pre-fetch its chat member count.
  useEffect(() => {
    if (notifications.length > 0) {
      const notif = notifications[0];
      setCurrentNotification(notif);
      // Fetch member count so we can label "1-on-1 Call" vs "Group Call" correctly.
      getDoc(doc(db, 'chats', notif.chatId))
        .then((snap) => {
          if (snap.exists()) {
            const members = (snap.data().members as string[]) || [];
            setCallMemberCount(members.length);
          } else {
            setCallMemberCount(2);
          }
        })
        .catch(() => setCallMemberCount(2));

      // Check if the caller is saved in contacts; if not, fetch their phone from Firebase
      const callerContact = contacts.find((c) => c.userId === notif.initiatorId);
      if (callerContact) {
        // Saved contact — no need for phone, name resolution happens via resolveName
        setCallerPhone(null);
      } else {
        // Unsaved contact — fetch their phone number from Firebase for display
        getDoc(doc(db, 'users', notif.initiatorId))
          .then((snap) => {
            if (snap.exists()) {
              setCallerPhone(snap.data().phone || null);
            } else {
              setCallerPhone(null);
            }
          })
          .catch(() => setCallerPhone(null));
      }
    } else {
      setCurrentNotification(null);
      setCallMemberCount(2);
      setCallerPhone(null);
    }
  }, [notifications, contacts]);

  const handleJoin = async () => {
    if (!currentNotification || !user?.uid) return;

    console.log('[GroupCallNotificationManager] Joining group call:', currentNotification.callId);

    // Mark the call active FIRST. joinGroupCall() only adds a participant when
    // the call is already 'active', so the status update must happen before it,
    // otherwise the receiver is never added to activeParticipants and the call
    // appears to end immediately.
    const callRef = doc(db, 'groupCalls', currentNotification.callId);
    try {
      const snap = await getDoc(callRef);
      if (!snap.exists() || ['ended', 'declined', 'cancelled', 'missed'].includes(snap.data()?.status)) {
        // Call is gone or already terminated — treat as a stale notification.
        console.warn('[GroupCallNotificationManager] Call no longer available; dismissing notification');
        await dismissNotification(currentNotification.callId);
        Alert.alert('Call ended', 'This call has already ended.');
        setCurrentNotification(null);
        return;
      }
      await updateDoc(callRef, { status: 'active' });
    } catch (err) {
      console.error('[GroupCallNotificationManager] Failed to mark call active:', err);
      await dismissNotification(currentNotification.callId);
      setCurrentNotification(null);
      return;
    }

    // Now add the receiver to activeParticipants (status is 'active' at this point).
    const joined = await joinGroupCall(currentNotification.callId, user.uid);

    if (joined) {
      // Fetch group info from chat document
      try {
        const chatRef = doc(db, 'chats', currentNotification.chatId);
        const chatSnap = await getDoc(chatRef);
        
        let groupName = currentNotification.initiatorName || 'Call';
        let memberCount = 2;

        if (chatSnap.exists()) {
          const chatData = chatSnap.data();
          // Group chats have a name; for direct (1-on-1) chats fall back to the
          // caller's name so the call header shows who you're talking to.
          groupName =
            chatData.groupName || chatData.name || currentNotification.initiatorName || 'Call';
          memberCount = (chatData.members as string[])?.length || 2;
        }

        // Dismiss notification
        await dismissNotification(currentNotification.callId);

        // Start the call via the app-level host (supports minimize)
        const userDisplayName = user.phoneNumber || user.displayName || 'Unknown';
        startActiveCall({
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
        // Fallback: still start with default values
        await dismissNotification(currentNotification.callId);

        const userDisplayName = user.phoneNumber || user.displayName || 'Unknown';
        startActiveCall({
          roomName: currentNotification.roomName,
          displayName: userDisplayName,
          audioOnly: currentNotification.callType === 'audio',
          groupName: currentNotification.initiatorName || 'Call',
          memberCount: 2,
          chatId: currentNotification.chatId,
          callId: currentNotification.callId,
        });
      }
    } else {
      // The call has already ended (or no longer exists) — this is an expected
      // condition for a stale/ghost notification, not an error. Clear it so it
      // stops showing, and let the user know.
      console.warn('[GroupCallNotificationManager] Call is no longer available; dismissing notification');
      await dismissNotification(currentNotification.callId);
      Alert.alert('Call ended', 'This group call has already ended.');
    }

    setCurrentNotification(null);
  };

  const handleDismiss = async () => {
    if (!currentNotification) return;

    console.log('[GroupCallNotificationManager] Declining call:', currentNotification.callId);

    // For 1-on-1 calls, mark the call 'declined' so the caller's ringing screen
    // dismisses immediately. For group calls, only dismiss THIS receiver's
    // notification — the call continues for the remaining participants.
    if (callMemberCount <= 2) {
      try {
        const callRef = doc(db, 'groupCalls', currentNotification.callId);
        const snap = await getDoc(callRef);
        // Only decline while still ringing — don't clobber an active/ended call.
        if (snap.exists() && snap.data()?.status === 'ringing') {
          await updateDoc(callRef, { status: 'declined' });
        }
      } catch (err) {
        console.error('[GroupCallNotificationManager] Failed to mark call declined:', err);
      }
    }

    await dismissNotification(currentNotification.callId);
    setCurrentNotification(null);
  };

  if (!currentNotification) {
    return null;
  }

  // Resolve the caller's display name and avatar initials:
  // - Saved contact: use phone-book name for both
  // - Unsaved contact: phone number for display, signup username (initiatorName) for initials
  const callerContact = contacts.find((c) => c.userId === currentNotification.initiatorId);
  let resolvedCallerName: string | undefined;
  let callerInitials: string | undefined;

  if (callerContact) {
    // Saved contact — use phone-book name
    resolvedCallerName = resolveName(callerContact.phone, callerContact.displayName);
  } else if (callerPhone) {
    // Unsaved contact — show formatted phone number, initials from signup username
    const digits = callerPhone.replace(/\D/g, '');
    if (digits.startsWith('27') && digits.length === 11) {
      resolvedCallerName = `+${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
    } else if (digits.length > 6) {
      resolvedCallerName = `+${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}`;
    } else {
      resolvedCallerName = callerPhone;
    }
    // Initials come from the signup username (initiatorName)
    const cleaned = (currentNotification.initiatorName || '').replace(/[^\p{L}\s]/gu, '').trim();
    const parts = cleaned.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      callerInitials = (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    } else if (parts.length === 1) {
      callerInitials = parts[0][0].toUpperCase();
    } else {
      const firstAlpha = (currentNotification.initiatorName || '').match(/\p{L}/u);
      callerInitials = firstAlpha ? firstAlpha[0].toUpperCase() : '?';
    }
  }

  return (
    <GroupCallNotification
      notification={currentNotification}
      memberCount={callMemberCount}
      resolvedCallerName={resolvedCallerName}
      callerInitials={callerInitials}
      onJoin={handleJoin}
      onDismiss={handleDismiss}
    />
  );
}
