// ─── Cloud Functions: LiveKit Token Generation ─────────────────────────────
// Securely generates LiveKit access tokens on the backend so the API secret
// never ships in the client bundle.
//
// Uses 1st-gen callable functions. 1st-gen HTTPS/callable functions are public
// by default and are NOT subject to the Cloud Run `allUsers` invoker org policy
// that blocks 2nd-gen callables in projects with domain-restricted sharing.

import * as functionsV1 from 'firebase-functions/v1';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getMessaging } from 'firebase-admin/messaging';
import { AccessToken } from 'livekit-server-sdk';

// Initialize the Admin SDK once
if (getApps().length === 0) {
  initializeApp();
}

interface TokenRequest {
  roomName: string;
  displayName: string;
  /** Native Firebase ID token (used when the callable auth context is absent) */
  idToken?: string;
}

/**
 * Callable function: generateLiveKitToken (1st gen)
 *
 * Resolves the caller's UID from the callable auth context when available, and
 * otherwise from an explicitly-passed Firebase ID token (this app uses native
 * Firebase Auth, whose context is not always attached to JS-SDK callables).
 */
export const generateLiveKitToken = functionsV1
  // Pin the region: the client (web + native) calls the default us-central1.
  // This function currently exists in multiple regions in the project, which
  // makes deploys ambiguous ("Cannot resolve default region"). Pinning here
  // resolves that and lets deploy clean up the stray copy in the other region.
  .region('us-central1')
  .runWith({ secrets: ['LIVEKIT_API_KEY', 'LIVEKIT_API_SECRET'] })
  .https.onCall(async (data: TokenRequest, context) => {
    const { roomName, displayName, idToken } = data || ({} as TokenRequest);

    if (!roomName || typeof roomName !== 'string') {
      throw new functionsV1.https.HttpsError('invalid-argument', 'roomName is required.');
    }

    // Resolve the caller identity
    let uid = context.auth?.uid;

    if (!uid && idToken) {
      try {
        const decoded = await getAuth().verifyIdToken(idToken);
        uid = decoded.uid;
      } catch (err) {
        console.error('[generateLiveKitToken] ID token verification failed:', err);
        throw new functionsV1.https.HttpsError('unauthenticated', 'Invalid authentication token.');
      }
    }

    if (!uid) {
      throw new functionsV1.https.HttpsError(
        'unauthenticated',
        'You must be signed in to join a call.'
      );
    }

    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;

    if (!apiKey || !apiSecret) {
      console.error('[generateLiveKitToken] Missing LiveKit secrets');
      throw new functionsV1.https.HttpsError('internal', 'Server is not configured.');
    }

    try {
      const at = new AccessToken(apiKey, apiSecret, {
        identity: uid,
        name: displayName || 'Guest',
        ttl: 6 * 60 * 60, // 6 hours
      });

      at.addGrant({
        room: roomName,
        roomJoin: true,
        canPublish: true,
        canSubscribe: true,
        canPublishData: true,
      });

      const token = await at.toJwt();

      return { token };
    } catch (err) {
      console.error('[generateLiveKitToken] Failed to generate token:', err);
      throw new functionsV1.https.HttpsError('internal', 'Failed to generate access token.');
    }
  });


// ─── Scheduled Cleanup Functions ───────────────────────────────────────────
// Reliable server-side maintenance jobs (1st gen, on a Cloud Scheduler cron).
// The client performs best-effort cleanup too, but these guarantee that
// expired/stale data is removed even when no client is running.

import { getFirestore, Timestamp as AdminTimestamp } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

const FIRESTORE_BATCH_LIMIT = 500;

// ─── Group Call Participant Threshold Check ─────────────────────────────────
// Trigger: When a group call's activeParticipants array changes
// Purpose: Auto-end group calls when only 1 participant remains (fixes Bug 2)
export const checkGroupCallParticipants = functionsV1.firestore
  .document('groupCalls/{callId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    
    // Only proceed if the call is still active
    if (!after || after.status !== 'active') {
      return null;
    }
    
    const beforeParticipants = before?.activeParticipants || [];
    const activeParticipants = after.activeParticipants || [];

    // Only end the call when participants DROP to <= 1 from a previously-joined
    // state of >= 2. This is critical: during connect, participants are added
    // one at a time (callee: 1, then caller: 2). Ending at <= 1 unconditionally
    // would kill every call the moment the first participant is added.
    const droppedToOneOrFewer =
      beforeParticipants.length >= 2 && activeParticipants.length <= 1;

    if (droppedToOneOrFewer) {
      console.log(`[checkGroupCallParticipants] Participants dropped from ${beforeParticipants.length} to ${activeParticipants.length} in call ${context.params.callId} - ending call`);
      
      await change.after.ref.update({
        status: 'ended',
        activeParticipants: [],
      });
      
      console.log(`[checkGroupCallParticipants] Call ${context.params.callId} ended successfully`);
    }
    
    return null;
  });

/** Delete a list of document refs in chunks that respect the 500-write batch limit. */
async function deleteRefsInBatches(
  refs: FirebaseFirestore.DocumentReference[],
): Promise<number> {
  const dbAdmin = getFirestore();
  let deleted = 0;
  for (let i = 0; i < refs.length; i += FIRESTORE_BATCH_LIMIT) {
    const slice = refs.slice(i, i + FIRESTORE_BATCH_LIMIT);
    const batch = dbAdmin.batch();
    slice.forEach((ref) => batch.delete(ref));
    await batch.commit();
    deleted += slice.length;
  }
  return deleted;
}

/** Extract the Storage object path from a Firebase download URL (…/o/<path>?…). */
function storagePathFromUrl(url?: string | null): string | null {
  if (!url || typeof url !== 'string') return null;
  const match = url.match(/\/o\/([^?]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

/** Best-effort deletion of one or more Storage objects by their download URLs. */
async function deleteStorageByUrls(urls: Array<string | null | undefined>): Promise<void> {
  const bucket = getStorage().bucket();
  await Promise.all(
    urls.map(async (url) => {
      const path = storagePathFromUrl(url);
      if (!path) return;
      try {
        await bucket.file(path).delete();
      } catch (err: any) {
        // 404 (already gone) and similar are non-fatal
        if (err?.code !== 404) {
          console.warn('[cleanup] Failed to delete storage object:', path, err?.message);
        }
      }
    }),
  );
}

// ─── 1. Expired statuses (24h) ──────────────────────────────────────────────
// Removes status docs past their expiresAt and the associated Storage media.
export const cleanupExpiredStatuses = functionsV1.pubsub
  .schedule('every 60 minutes')
  .onRun(async () => {
    const dbAdmin = getFirestore();
    const now = AdminTimestamp.now();

    const snap = await dbAdmin
      .collection('statuses')
      .where('expiresAt', '<=', now)
      .limit(1000)
      .get();

    if (snap.empty) {
      console.log('[cleanupExpiredStatuses] Nothing to clean.');
      return null;
    }

    // Delete media first (best-effort), then the docs.
    await deleteStorageByUrls(snap.docs.map((d) => d.data().mediaUrl));
    const deleted = await deleteRefsInBatches(snap.docs.map((d) => d.ref));

    console.log(`[cleanupExpiredStatuses] Deleted ${deleted} expired status(es).`);
    return null;
  });

// ─── 2. Expired messages (72h TTL) ──────────────────────────────────────────
// Deletes messages past their expiresAt across every chat, plus their media.
// Uses a collectionGroup query so it spans all chats/{chatId}/messages.
export const cleanupExpiredMessages = functionsV1.pubsub
  .schedule('every 24 hours')
  .onRun(async () => {
    const dbAdmin = getFirestore();
    const now = AdminTimestamp.now();

    const snap = await dbAdmin
      .collectionGroup('messages')
      .where('expiresAt', '<=', now)
      .limit(2000)
      .get();

    if (snap.empty) {
      console.log('[cleanupExpiredMessages] Nothing to clean.');
      return null;
    }

    // Remove any attached Storage media for these messages.
    const mediaUrls: Array<string | null | undefined> = [];
    snap.docs.forEach((d) => {
      const m = d.data();
      mediaUrls.push(m.imageUrl, m.voiceUrl, m.videoUrl, m.fileUrl, m.thumbnailUrl);
    });
    await deleteStorageByUrls(mediaUrls);

    const deleted = await deleteRefsInBatches(snap.docs.map((d) => d.ref));
    console.log(`[cleanupExpiredMessages] Deleted ${deleted} expired message(s).`);
    return null;
  });

// ─── 3. Stale / ghost calls ─────────────────────────────────────────────────
// Removes 1-on-1 call signaling docs, finished/abandoned group calls, and
// lingering group-call invites that would otherwise resurface as ghost calls.
export const cleanupStaleCalls = functionsV1.pubsub
  .schedule('every 30 minutes')
  .onRun(async () => {
    const dbAdmin = getFirestore();
    const now = Date.now();
    const cutoff3h = AdminTimestamp.fromMillis(now - 3 * 60 * 60 * 1000);
    const cutoff6h = AdminTimestamp.fromMillis(now - 6 * 60 * 60 * 1000);
    const cutoff24h = AdminTimestamp.fromMillis(now - 24 * 60 * 60 * 1000);

    const toDelete: FirebaseFirestore.DocumentReference[] = [];

    // 3a. 1-on-1 calls untouched for 3h (terminal, abandoned, or long-ended).
    const staleCalls = await dbAdmin
      .collection('calls')
      .where('updatedAt', '<=', cutoff3h)
      .limit(1000)
      .get();
    staleCalls.forEach((d) => toDelete.push(d.ref));

    // 3b. Group calls already ended.
    const endedGroupCalls = await dbAdmin
      .collection('groupCalls')
      .where('status', '==', 'ended')
      .limit(1000)
      .get();
    endedGroupCalls.forEach((d) => toDelete.push(d.ref));

    // 3c. Group calls still "active" but older than 6h → ghost calls.
    const ghostGroupCalls = await dbAdmin
      .collection('groupCalls')
      .where('startedAt', '<=', cutoff6h)
      .limit(1000)
      .get();
    ghostGroupCalls.forEach((d) => {
      if (!toDelete.find((r) => r.path === d.ref.path)) toDelete.push(d.ref);
    });

    // 3d. Group-call invites older than 24h (any status).
    const staleInvites = await dbAdmin
      .collectionGroup('groupCallNotifications')
      .where('createdAt', '<=', cutoff24h)
      .limit(2000)
      .get();
    staleInvites.forEach((d) => toDelete.push(d.ref));

    if (toDelete.length === 0) {
      console.log('[cleanupStaleCalls] Nothing to clean.');
      return null;
    }

    const deleted = await deleteRefsInBatches(toDelete);
    console.log(`[cleanupStaleCalls] Deleted ${deleted} stale call/invite doc(s).`);
    return null;
  });


// ─── Push Notification Functions ────────────────────────────────────────────
// Sends push notifications via Expo Push API when messages or calls are created.
// These run server-side so notifications arrive even when the app is closed.

import Expo, { ExpoPushMessage, ExpoPushTicket } from 'expo-server-sdk';

const expo = new Expo();

/**
 * Helper: Send push notifications via Expo Push API
 * Handles batching and error logging automatically.
 */
async function sendExpoPushNotifications(messages: ExpoPushMessage[]): Promise<void> {
  if (messages.length === 0) return;

  // Filter to only valid Expo push tokens
  const validMessages = messages.filter((m) => {
    if (!Expo.isExpoPushToken(m.to as string)) {
      console.warn(`[Push] Invalid Expo push token: ${m.to}`);
      return false;
    }
    return true;
  });

  if (validMessages.length === 0) {
    console.log('[Push] No valid push tokens to send to');
    return;
  }

  // Batch messages (Expo recommends max 100 per request)
  const chunks = expo.chunkPushNotifications(validMessages);

  for (const chunk of chunks) {
    try {
      const tickets: ExpoPushTicket[] = await expo.sendPushNotificationsAsync(chunk);
      
      // Log any errors
      tickets.forEach((ticket, idx) => {
        if (ticket.status === 'error') {
          console.error(`[Push] Error sending to ${chunk[idx].to}:`, ticket.message);
          if (ticket.details?.error === 'DeviceNotRegistered') {
            // TODO: Could remove invalid tokens from Firestore here
            console.log(`[Push] Device not registered, token should be removed: ${chunk[idx].to}`);
          }
        }
      });
    } catch (error) {
      console.error('[Push] Error sending push notifications:', error);
    }
  }
}

/**
 * Get user's push token from Firestore
 */
async function getUserPushToken(userId: string): Promise<string | null> {
  try {
    const dbAdmin = getFirestore();
    const userDoc = await dbAdmin.collection('users').doc(userId).get();
    if (!userDoc.exists) return null;
    return userDoc.data()?.pushToken || null;
  } catch (error) {
    console.error(`[Push] Error fetching push token for user ${userId}:`, error);
    return null;
  }
}

/** Tokens + platform for choosing the right call-push transport. */
interface UserCallTokens {
  expoToken: string | null;
  fcmToken: string | null;
  platform: string | null;
}

/**
 * Fetch a user's Expo push token, native FCM token, and platform in one read.
 * Used to route incoming-call pushes: Android with a native FCM token gets a
 * data-only message (wakes a killed app → CallKeep); everyone else gets the
 * existing Expo push (iOS best-effort in-app UI + system notification).
 */
async function getUserCallTokens(userId: string): Promise<UserCallTokens> {
  try {
    const dbAdmin = getFirestore();
    const userDoc = await dbAdmin.collection('users').doc(userId).get();
    if (!userDoc.exists) return { expoToken: null, fcmToken: null, platform: null };
    const data = userDoc.data() || {};
    return {
      expoToken: data.pushToken || null,
      fcmToken: data.fcmToken || null,
      // Prefer the platform recorded with the FCM token; fall back to the Expo one.
      platform: data.fcmTokenPlatform || data.platform || null,
    };
  } catch (error) {
    console.error(`[Push] Error fetching call tokens for user ${userId}:`, error);
    return { expoToken: null, fcmToken: null, platform: null };
  }
}

/**
 * Send a DATA-ONLY, high-priority FCM message for an incoming call. Data-only
 * (no `notification` block) + android priority 'high' ensures delivery to the
 * app's background handler even when the app is fully killed, which then shows
 * the native CallKeep incoming-call UI. All data values must be strings.
 */
async function sendCallDataFcm(
  fcmToken: string,
  payload: {
    callId: string;
    callerId: string;
    callerName: string;
    callerPhotoUrl: string | null;
    callType: string;
  },
): Promise<void> {
  try {
    await getMessaging().send({
      token: fcmToken,
      data: {
        type: 'incoming-call',
        callId: payload.callId,
        callerId: payload.callerId || '',
        callerName: payload.callerName || '',
        callerPhotoUrl: payload.callerPhotoUrl || '',
        callType: payload.callType || 'audio',
      },
      android: {
        priority: 'high',
      },
    });
    console.log('[Push] Sent data-only call FCM to', fcmToken.slice(0, 12) + '…');
  } catch (error) {
    console.error('[Push] Error sending data-only call FCM:', error);
  }
}

/**
 * Get the display name for a user as seen by a specific recipient.
 * Priority: recipient's saved contact name → user's phone number.
 * This matches the app's naming standard where names come from the viewer's
 * own phone book, not the user's self-set displayName.
 * 
 * @param userId - The user whose name to resolve
 * @param recipientId - The person viewing the notification (whose contacts to check)
 */
async function getDisplayNameForRecipient(userId: string, recipientId: string): Promise<string> {
  try {
    const dbAdmin = getFirestore();
    
    // Check if recipient has saved this user as a contact
    const savedContactDoc = await dbAdmin
      .collection('users')
      .doc(recipientId)
      .collection('savedContacts')
      .doc(userId)
      .get();
    
    if (savedContactDoc.exists) {
      const contactData = savedContactDoc.data();
      if (contactData?.name) {
        return contactData.name;
      }
    }
    
    // Fallback: get the user's phone number
    const userDoc = await dbAdmin.collection('users').doc(userId).get();
    if (!userDoc.exists) return 'Someone';
    const userData = userDoc.data();
    return userData?.phone || userData?.displayName || 'Someone';
  } catch (error) {
    console.error('[getDisplayNameForRecipient] Error:', error);
    return 'Someone';
  }
}

// ─── onMessageCreated: Trigger when a new message is added ──────────────────
// Path: /chats/{chatId}/messages/{messageId}
export const onMessageCreated = functionsV1.firestore
  .document('chats/{chatId}/messages/{messageId}')
  .onCreate(async (snap, context) => {
    const { chatId, messageId } = context.params;
    const message = snap.data();

    if (!message) {
      console.log('[onMessageCreated] No message data');
      return null;
    }

    const senderId = message.senderId;
    if (!senderId) {
      console.log('[onMessageCreated] No sender ID');
      return null;
    }

    // Skip system messages (block/unblock/leave-group notifications, etc.)
    // These are rendered inline in the chat and should not push-notify anyone.
    if (message.type === 'system' || senderId === 'system') {
      console.log(`[onMessageCreated] Skipping system message in chat ${chatId}`);
      return null;
    }

    console.log(`[onMessageCreated] New message in chat ${chatId} from ${senderId}`);

    try {
      const dbAdmin = getFirestore();

      // Get the chat document to find recipients
      const chatDoc = await dbAdmin.collection('chats').doc(chatId).get();
      if (!chatDoc.exists) {
        console.log('[onMessageCreated] Chat not found');
        return null;
      }

      const chatData = chatDoc.data();
      const members: string[] = chatData?.members || [];
      const isGroup = chatData?.type === 'group';
      const groupName = chatData?.groupName;

      // Build notification messages for all recipients (excluding sender)
      const messages: ExpoPushMessage[] = [];

      for (const memberId of members) {
        if (memberId === senderId) continue; // Don't notify the sender

        const pushToken = await getUserPushToken(memberId);
        if (!pushToken) {
          console.log(`[onMessageCreated] No push token for user ${memberId}`);
          continue;
        }

        // Get personalized sender name for this specific recipient
        const senderName = await getDisplayNameForRecipient(senderId, memberId);

        // Determine notification content
        const title = isGroup ? (groupName || 'Group Chat') : senderName;
        let body = message.text || '';
        
        // Handle different message types
        if (message.imageUrl) body = '📷 Photo';
        else if (message.videoUrl) body = '🎥 Video';
        else if (message.voiceUrl) body = '🎤 Voice message';
        else if (message.fileUrl) body = '📎 File';
        else if (message.location) body = '📍 Location';

        // For group chats, prefix with sender name
        if (isGroup && body) {
          body = `${senderName}: ${body}`;
        }

        messages.push({
          to: pushToken,
          title,
          body,
          sound: 'default',
          badge: 1,
          data: {
            type: 'message',
            chatId,
            messageId,
            senderId,
            displayName: title,
            isGroup,
            otherUserId: isGroup ? undefined : senderId,
          },
        });
      }

      // Send all notifications
      await sendExpoPushNotifications(messages);
      console.log(`[onMessageCreated] Sent ${messages.length} push notification(s)`);

    } catch (error) {
      console.error('[onMessageCreated] Error:', error);
    }

    return null;
  });

// ─── onCallCreated: Trigger when a new call is initiated ────────────────────
// Path: /calls/{callId}
export const onCallCreated = functionsV1.firestore
  .document('calls/{callId}')
  .onCreate(async (snap, context) => {
    const { callId } = context.params;
    const callData = snap.data();

    if (!callData) {
      console.log('[onCallCreated] No call data');
      return null;
    }

    // NOTE: SignalingService.createCall stores caller/callee as objects
    // ({ userId, displayName, photoUrl }) and the call `type`. It does NOT store
    // top-level callerId/calleeId — reading those was a latent bug that made
    // this trigger bail out and never send the call push. Derive the ids from
    // the participant objects.
    const caller = callData.caller;
    const callee = callData.callee;
    const type = callData.type || 'audio';
    const callerId: string | undefined = caller?.userId;
    const calleeId: string | undefined = callee?.userId;

    if (!callerId || !calleeId) {
      console.log('[onCallCreated] Missing caller or callee ID');
      return null;
    }

    console.log(`[onCallCreated] New ${type} call ${callId} from ${callerId} to ${calleeId}`);

    try {
      // Get personalized caller name for the callee
      const callerName = await getDisplayNameForRecipient(callerId, calleeId);

      // Resolve the callee's tokens + platform to pick the transport.
      const { expoToken, fcmToken, platform } = await getUserCallTokens(calleeId);

      const callData2 = {
        callId,
        callerId,
        callerName,
        callerPhotoUrl: caller?.photoUrl || null,
        callType: type,
      };

      // Android + native FCM token → data-only high-priority FCM. This wakes a
      // killed app and drives the native CallKeep full-screen call UI. We do
      // NOT also send the Expo push here, to avoid a duplicate notification.
      if (platform === 'android' && fcmToken) {
        await sendCallDataFcm(fcmToken, callData2);
        console.log(`[onCallCreated] Sent data-only call FCM to Android callee ${calleeId}`);
        return null;
      }

      // Otherwise (iOS, or no FCM token) → existing Expo push. iOS is
      // best-effort: in-app IncomingCallScreen when alive, system notification
      // tap otherwise. TODO: PushKit/VoIP for true iOS killed-state CallKit.
      if (!expoToken) {
        console.log(`[onCallCreated] No push token for callee ${calleeId}`);
        return null;
      }

      const isVideo = type === 'video';
      const title = `Incoming ${isVideo ? 'Video ' : ''}Call`;
      const body = `${callerName} is calling you`;

      const messages: ExpoPushMessage[] = [{
        to: expoToken,
        title,
        body,
        sound: 'default',
        badge: 1,
        priority: 'high',
        // Android channel for full-screen intent
        channelId: 'incoming-call',
        // iOS/Android category for action buttons
        categoryId: 'incoming-call',
        data: {
          type: 'incoming-call',
          callId,
          callerId,
          callerName,
          callerPhotoUrl: caller?.photoUrl || null,
          callType: type,
        },
      }];

      await sendExpoPushNotifications(messages);
      console.log(`[onCallCreated] Sent Expo call notification to ${calleeId}`);

    } catch (error) {
      console.error('[onCallCreated] Error:', error);
    }

    return null;
  });

// ─── onGroupCallCreated: Trigger when a group call is initiated ─────────────
// Path: /groupCalls/{callId}
export const onGroupCallCreated = functionsV1.firestore
  .document('groupCalls/{callId}')
  .onCreate(async (snap, context) => {
    const { callId } = context.params;
    const callData = snap.data();

    if (!callData) {
      console.log('[onGroupCallCreated] No call data');
      return null;
    }

    const { initiatorId, participants, groupName, callType } = callData;

    if (!initiatorId || !participants || !Array.isArray(participants)) {
      console.log('[onGroupCallCreated] Missing initiator or participants');
      return null;
    }

    console.log(`[onGroupCallCreated] New group call ${callId} initiated by ${initiatorId}`);

    try {
      const isVideo = callType === 'video';
      // Every call (1-on-1 and group) flows through the groupCalls collection,
      // so distinguish them by participant count: 2 = one-on-one, >2 = group.
      const isGroup = participants.length > 2;

      const messages: ExpoPushMessage[] = [];

      // Notify all participants except the initiator
      for (const participantId of participants) {
        if (participantId === initiatorId) continue;

        const pushToken = await getUserPushToken(participantId);
        if (!pushToken) {
          console.log(`[onGroupCallCreated] No push token for participant ${participantId}`);
          continue;
        }

        // Get personalized initiator name for this specific recipient
        // (their saved contact name, or the initiator's phone if not saved)
        const initiatorName = await getDisplayNameForRecipient(initiatorId, participantId);

        let title: string;
        let body: string;
        if (isGroup) {
          title = isVideo ? 'Group Video Call' : 'Group Call';
          const where = groupName ? ` in ${groupName}` : '';
          body = `${initiatorName} started a group ${isVideo ? 'video ' : ''}call${where}`;
        } else {
          title = isVideo ? 'Incoming Video Call' : 'Incoming Call';
          body = `${initiatorName} is ${isVideo ? 'video ' : ''}calling you`;
        }

        messages.push({
          to: pushToken,
          title,
          body,
          sound: 'default',
          badge: 1,
          priority: 'high',
          // Android channel for full-screen intent
          channelId: 'incoming-call',
          // iOS/Android category for action buttons
          categoryId: 'incoming-call',
          data: {
            type: 'group-call',
            callId,
            initiatorId,
            initiatorName,
            groupName,
            callType,
          },
        });
      }

      await sendExpoPushNotifications(messages);
      console.log(`[onGroupCallCreated] Sent ${messages.length} group call notification(s)`);

    } catch (error) {
      console.error('[onGroupCallCreated] Error:', error);
    }

    return null;
  });

// ─── onMissedCall: Trigger when a call status changes to missed ─────────────
// Path: /calls/{callId}
export const onCallUpdated = functionsV1.firestore
  .document('calls/{callId}')
  .onUpdate(async (change, context) => {
    const { callId } = context.params;
    const before = change.before.data();
    const after = change.after.data();

    // Only trigger on status change to 'missed' or 'rejected'
    if (before.status === after.status) return null;
    if (after.status !== 'missed' && after.status !== 'rejected') return null;

    const { callerId, calleeId, type } = after;

    console.log(`[onCallUpdated] Call ${callId} changed to ${after.status}`);

    try {
      // Get personalized caller name for the callee
      const callerName = await getDisplayNameForRecipient(callerId, calleeId);

      // Notify the callee about the missed call
      const pushToken = await getUserPushToken(calleeId);
      if (!pushToken) {
        console.log(`[onCallUpdated] No push token for callee ${calleeId}`);
        return null;
      }

      const isVideo = type === 'video';
      const statusText = after.status === 'missed' ? 'Missed' : 'Rejected';
      const title = `${statusText} ${isVideo ? 'Video ' : ''}Call`;
      const body = `You ${after.status === 'missed' ? 'missed' : 'declined'} a call from ${callerName}`;

      const messages: ExpoPushMessage[] = [{
        to: pushToken,
        title,
        body,
        sound: 'default',
        badge: 1,
        data: {
          type: 'call',
          callId,
          callerId,
          callerName,
          callType: type,
          callStatus: after.status,
        },
      }];

      await sendExpoPushNotifications(messages);
      console.log(`[onCallUpdated] Sent ${after.status} call notification to ${calleeId}`);

    } catch (error) {
      console.error('[onCallUpdated] Error:', error);
    }

    return null;
  });


// ─── Video Trimming Callable Function ────────────────────────────────────────
// Callable function that trims a video after it's been uploaded
// Called by the client after uploading a video that needs trimming

import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import * as ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import ffmpeg from 'fluent-ffmpeg';

// Set FFmpeg path
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

interface TrimVideoRequest {
  statusId: string;
  mediaUrl: string;
  trimStart: number;  // milliseconds
  trimEnd: number;    // milliseconds
  userId: string;
  idToken?: string;   // Firebase ID token for authentication
}

export const trimStatusVideo = functionsV1.https.onCall(async (data: TrimVideoRequest, context) => {
  const { statusId, mediaUrl, trimStart, trimEnd, userId, idToken } = data;

  // Verify authentication - either from context or ID token
  let uid = context.auth?.uid;

  if (!uid && idToken) {
    try {
      const decoded = await getAuth().verifyIdToken(idToken);
      uid = decoded.uid;
    } catch (err) {
      console.error('[trimStatusVideo] ID token verification failed:', err);
      throw new functionsV1.https.HttpsError('unauthenticated', 'Invalid ID token');
    }
  }

  if (!uid) {
    throw new functionsV1.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  if (uid !== userId) {
    throw new functionsV1.https.HttpsError('permission-denied', 'User can only trim their own videos');
  }

  if (!statusId || !mediaUrl || trimStart === undefined || trimEnd === undefined) {
    throw new functionsV1.https.HttpsError('invalid-argument', 'Missing required parameters');
  }

  console.log(`[trimStatusVideo] Processing status ${statusId} - trim ${trimStart}ms to ${trimEnd}ms`);

  const tempDir = os.tmpdir();
  const inputPath = path.join(tempDir, `input-${statusId}.mp4`);
  const outputPath = path.join(tempDir, `output-${statusId}.mp4`);

  try {
    const bucket = getStorage().bucket();
    const storagePath = storagePathFromUrl(mediaUrl);
    
    if (!storagePath) {
      throw new functionsV1.https.HttpsError('invalid-argument', 'Could not extract storage path from URL');
    }

    // Download the video
    console.log('[trimStatusVideo] Downloading video from Storage');
    await bucket.file(storagePath).download({ destination: inputPath });

    // Trim the video using FFmpeg
    console.log('[trimStatusVideo] Trimming video with FFmpeg');
    await new Promise<void>((resolve, reject) => {
      ffmpeg(inputPath)
        .setStartTime(trimStart / 1000) // Convert ms to seconds
        .setDuration((trimEnd - trimStart) / 1000) // Duration in seconds
        .output(outputPath)
        .videoCodec('libx264')
        .audioCodec('aac')
        .on('end', () => {
          console.log('[trimStatusVideo] FFmpeg processing complete');
          resolve();
        })
        .on('error', (err: Error) => {
          console.error('[trimStatusVideo] FFmpeg error:', err);
          reject(err);
        })
        .run();
    });

    // Upload the trimmed video
    console.log('[trimStatusVideo] Uploading trimmed video');
    const trimmedFileName = `status_${userId}_${Date.now()}_trimmed.mp4`;
    const trimmedPath = `status/${userId}/${trimmedFileName}`;
    
    await bucket.upload(outputPath, {
      destination: trimmedPath,
      metadata: {
        contentType: 'video/mp4',
        metadata: {
          userId,
          statusId,
          originalFile: storagePath,
        },
      },
    });

    // Get the download URL
    const trimmedFile = bucket.file(trimmedPath);
    await trimmedFile.makePublic();
    const trimmedUrl = `https://storage.googleapis.com/${bucket.name}/${trimmedPath}`;

    // Update the status document with the trimmed video URL
    console.log('[trimStatusVideo] Updating status document');
    await getFirestore().doc(`statuses/${statusId}`).update({
      mediaUrl: trimmedUrl,
      originalMediaUrl: mediaUrl,
      needsTrimming: false,
      trimmedAt: AdminTimestamp.now(),
      durationMs: trimEnd - trimStart,
    });

    // Delete the original video to save storage
    console.log('[trimStatusVideo] Deleting original video');
    try {
      await bucket.file(storagePath).delete();
    } catch (err) {
      console.warn('[trimStatusVideo] Could not delete original video:', err);
    }

    // Clean up temp files
    fs.unlinkSync(inputPath);
    fs.unlinkSync(outputPath);

    console.log(`[trimStatusVideo] Successfully trimmed status ${statusId}`);
    
    return {
      success: true,
      trimmedUrl,
      message: 'Video trimmed successfully',
    };

  } catch (error) {
    console.error('[trimStatusVideo] Error:', error);
    
    // Update status to indicate trimming failed
    try {
      await getFirestore().doc(`statuses/${statusId}`).update({
        needsTrimming: false,
        trimmingFailed: true,
        trimmingError: error instanceof Error ? error.message : 'Unknown error',
      });
    } catch (updateErr) {
      console.error('[trimStatusVideo] Could not update status with error:', updateErr);
    }

    // Clean up temp files if they exist
    try {
      if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
      if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
    } catch (cleanupErr) {
      console.warn('[trimStatusVideo] Cleanup error:', cleanupErr);
    }

    throw new functionsV1.https.HttpsError('internal', error instanceof Error ? error.message : 'Unknown error');
  }
});
