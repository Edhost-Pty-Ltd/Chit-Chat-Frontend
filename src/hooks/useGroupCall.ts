// ─── Hook: Group Call Management ────────────────────────────────────────────
// Manages group video/audio calls using Jitsi Meet with Firestore notifications

import { useState, useCallback } from 'react';
import { 
  collection, 
  doc, 
  setDoc, 
  updateDoc, 
  serverTimestamp,
  Timestamp,
  getDoc,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { fetchUserPrivacySettings } from './usePrivacySettings';

export interface GroupCallData {
  callId: string;
  chatId: string;
  roomName: string;
  initiatorId: string;
  initiatorName: string;
  callType: 'audio' | 'video';
  status: 'ringing' | 'active' | 'ended' | 'declined' | 'cancelled' | 'missed';
  isGroup: boolean;  // true if 3+ participants, false if 2 (1-on-1)
  startedAt: Timestamp;
  participants: string[]; // Array of user IDs in the group
  activeParticipants?: string[]; // Users currently in the call
}

export function useGroupCall() {
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Initiate a group call - creates Firestore document and notifies all group members
   */
  const initiateGroupCall = useCallback(
    async (
      chatId: string,
      initiatorId: string,
      initiatorName: string,
      groupMemberIds: string[],
      callType: 'audio' | 'video' = 'audio'
    ): Promise<{ callId: string; roomName: string } | null> => {
      setIsCreating(true);
      setError(null);

      try {
        console.log('[useGroupCall] Initiating group call for chat:', chatId);
        console.log('[useGroupCall] Group members:', groupMemberIds);

        // Generate unique call ID and room name
        const callId = `group-call-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const roomName = `chitchat-${chatId}`;

        // Create group call document in Firestore
        const groupCallRef = doc(db, 'groupCalls', callId);
        const groupCallData: GroupCallData = {
          callId,
          chatId,
          roomName,
          initiatorId,
          initiatorName,
          callType,
          status: 'ringing',  // Start as 'ringing', not 'active'
          isGroup: groupMemberIds.length > 2,  // true if 3+, false if 2
          startedAt: serverTimestamp() as Timestamp,
          participants: groupMemberIds,
          activeParticipants: [],  // Empty until someone joins
        };

        await setDoc(groupCallRef, groupCallData);
        console.log('[useGroupCall] Group call document created:', callId);

        // Create individual call notifications for each group member (except initiator)
        // Skip members who have turned off calls ('Nobody').
        const eligibleMembers = await Promise.all(
          groupMemberIds
            .filter(memberId => memberId !== initiatorId)
            .map(async (memberId) => {
              try {
                const privacy = await fetchUserPrivacySettings(memberId);
                return privacy.calls === 'Nobody' ? null : memberId;
              } catch {
                return memberId; // default to allow on error
              }
            })
        );
        const notifiableMembers = eligibleMembers.filter(Boolean) as string[];

        const notificationPromises = notifiableMembers
          .map(async (memberId) => {
            try {
              const notificationRef = doc(
                db,
                'users',
                memberId,
                'groupCallNotifications',
                callId
              );

              await setDoc(notificationRef, {
                callId,
                chatId,
                roomName,
                initiatorId,
                initiatorName,
                callType,
                status: 'pending',
                createdAt: serverTimestamp(),
              });

              console.log('[useGroupCall] Notification sent to:', memberId);
            } catch (err) {
              console.error('[useGroupCall] Failed to send notification to:', memberId, err);
            }
          });

        await Promise.all(notificationPromises);
        console.log('[useGroupCall] All notifications sent');

        setIsCreating(false);
        return { callId, roomName };
      } catch (err) {
        console.error('[useGroupCall] Failed to initiate group call:', err);
        setError('Failed to start group call');
        setIsCreating(false);
        return null;
      }
    },
    []
  );

  /**
   * Join an existing group call - updates active participants
   */
  const joinGroupCall = useCallback(
    async (callId: string, userId: string): Promise<boolean> => {
      try {
        console.log('[useGroupCall] Joining group call:', callId);

        const groupCallRef = doc(db, 'groupCalls', callId);
        const callSnap = await getDoc(groupCallRef);

        if (!callSnap.exists()) {
          console.warn('[useGroupCall] Call does not exist:', callId);
          return false;
        }

        const callData = callSnap.data() as GroupCallData;

        if (callData.status !== 'active') {
          console.warn('[useGroupCall] Call is not active:', callData.status);
          return false;
        }

        // Add user to active participants
        const activeParticipants = callData.activeParticipants || [];
        if (!activeParticipants.includes(userId)) {
          await updateDoc(groupCallRef, {
            activeParticipants: [...activeParticipants, userId],
          });
        }

        console.log('[useGroupCall] Successfully joined call');
        return true;
      } catch (err) {
        console.error('[useGroupCall] Failed to join group call:', err);
        return false;
      }
    },
    []
  );

  /**
   * Leave a group call - removes user from active participants
   */
  const leaveGroupCall = useCallback(
    async (callId: string, userId: string): Promise<void> => {
      try {
        console.log('[useGroupCall] Leaving group call:', callId);

        const groupCallRef = doc(db, 'groupCalls', callId);
        const callSnap = await getDoc(groupCallRef);

        if (!callSnap.exists()) {
          console.error('[useGroupCall] Call does not exist:', callId);
          return;
        }

        const callData = callSnap.data() as GroupCallData;
        const activeParticipants = callData.activeParticipants || [];

        // Remove user from active participants
        const updatedParticipants = activeParticipants.filter(id => id !== userId);

        // If no participants left, end the call
        if (updatedParticipants.length === 0) {
          await updateDoc(groupCallRef, {
            status: 'ended',
            activeParticipants: [],
          });
          console.log('[useGroupCall] Last participant left - call ended');
        } else {
          await updateDoc(groupCallRef, {
            activeParticipants: updatedParticipants,
          });
          console.log('[useGroupCall] User left call, remaining:', updatedParticipants.length);
        }
      } catch (err) {
        console.error('[useGroupCall] Failed to leave group call:', err);
      }
    },
    []
  );

  /**
   * End a group call - marks call as ended (initiator only)
   */
  const endGroupCall = useCallback(
    async (callId: string): Promise<void> => {
      try {
        console.log('[useGroupCall] Ending group call:', callId);

        const groupCallRef = doc(db, 'groupCalls', callId);
        await updateDoc(groupCallRef, {
          status: 'ended',
          activeParticipants: [],
        });

        console.log('[useGroupCall] Group call ended');
      } catch (err) {
        console.error('[useGroupCall] Failed to end group call:', err);
      }
    },
    []
  );

  /**
   * Invite an additional contact to an in-progress group call by creating a
   * pending notification for them pointing at the current call/room.
   */
  const inviteToGroupCall = useCallback(
    async (params: {
      callId: string;
      chatId: string;
      roomName: string;
      initiatorId: string;
      initiatorName: string;
      callType: 'audio' | 'video';
      inviteeId: string;
    }): Promise<boolean> => {
      try {
        const notificationRef = doc(
          db,
          'users',
          params.inviteeId,
          'groupCallNotifications',
          params.callId
        );

        await setDoc(notificationRef, {
          callId: params.callId,
          chatId: params.chatId,
          roomName: params.roomName,
          initiatorId: params.initiatorId,
          initiatorName: params.initiatorName,
          callType: params.callType,
          status: 'pending',
          createdAt: serverTimestamp(),
        });

        // Best-effort: add the invitee to the call's participant list so they
        // appear as expected and the count stays consistent.
        try {
          const groupCallRef = doc(db, 'groupCalls', params.callId);
          const snap = await getDoc(groupCallRef);
          if (snap.exists()) {
            const data = snap.data() as GroupCallData;
            const members = data.participants || [];
            if (!members.includes(params.inviteeId)) {
              await updateDoc(groupCallRef, {
                participants: [...members, params.inviteeId],
              });
            }
          }
        } catch (e) {
          console.warn('[useGroupCall] Could not update participants on invite:', e);
        }

        console.log('[useGroupCall] Invited contact to call:', params.inviteeId);
        return true;
      } catch (err) {
        console.error('[useGroupCall] Failed to invite contact:', err);
        return false;
      }
    },
    []
  );

  return {
    initiateGroupCall,
    joinGroupCall,
    leaveGroupCall,
    endGroupCall,
    inviteToGroupCall,
    isCreating,
    error,
  };
}
