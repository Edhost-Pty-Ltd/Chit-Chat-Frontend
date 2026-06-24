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
