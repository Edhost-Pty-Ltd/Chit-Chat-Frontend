// ─── Firebase Configuration (Hybrid) ──────────────────────────────────────────
// Auth:      @react-native-firebase/auth (native module, supports phone OTP)  
// Firestore: firebase/firestore (JS SDK)
//
// WORKAROUND: Since bridging auth between native and JS SDK is complex and requires
// a backend to generate custom tokens, we temporarily use permissive Firestore rules
// that allow authenticated users (from either SDK) to access data.
//
// TODO: Implement proper auth bridge or migrate to full JS SDK when phone auth
// supports it without requiring reCAPTCHA manual handling.

import { Platform } from 'react-native';
import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  initializeFirestore,
  enableIndexedDbPersistence,
} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getDatabase } from 'firebase/database';

// Initialize React Native Firebase (native module)
// This ensures the native auth module is loaded before we use it
import './firebaseNative';

const firebaseConfig = {
  apiKey:            'AIzaSyBzstwF1NgQWASsqVa4R5IiZpFLoKZnSJQ',
  authDomain:        'chit-chat-67a7f.firebaseapp.com',
  databaseURL:       'https://chit-chat-67a7f-default-rtdb.firebaseio.com',
  projectId:         'chit-chat-67a7f',
  storageBucket:     'chit-chat-67a7f.firebasestorage.app',
  messagingSenderId: '825582316169',
  appId:             '1:825582316169:web:ea4abdaa918504fe77f458',
};

console.log('[Firebase] Initializing Firebase...');

// Prevent duplicate app initialization on hot reload
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

console.log('[Firebase] Firebase app initialized:', app.name);

// Firestore — real-time database (JS SDK)
// On React Native the default WebChannel streaming transport frequently stalls
// on slow / restrictive mobile networks, which makes listeners hang and appear
// to "not load". Auto-detecting long polling lets the SDK fall back to a more
// resilient transport when streaming isn't reliable.
// initializeFirestore must run before any getFirestore() call and throws if the
// instance already exists (e.g. on Fast Refresh), so we guard with a fallback.
function createFirestore() {
  try {
    return initializeFirestore(app, {
      experimentalAutoDetectLongPolling: true,
    });
  } catch (err) {
    // Already initialized (hot reload) — reuse the existing instance.
    return getFirestore(app);
  }
}

export const db = createFirestore();

console.log('[Firebase] Firestore initialized');

// Firebase Realtime Database — for presence system with better disconnect detection
export const rtdb = getDatabase(app);

console.log('[Firebase] Realtime Database initialized');

// Firebase Storage — voice note audio file hosting
export const storage = getStorage(app);

console.log('[Firebase] Storage initialized');

// Enable offline persistence for better reliability (web only)
// This allows Firestore to work offline and sync when connection is restored
if (Platform.OS === 'web') {
  try {
    enableIndexedDbPersistence(db).catch((err) => {
      if (err.code === 'failed-precondition') {
        console.warn('[Firebase] Persistence failed: Multiple tabs open');
      } else if (err.code === 'unimplemented') {
        console.warn('[Firebase] Persistence not available in this browser');
      }
    });
  } catch (error) {
    console.warn('[Firebase] Persistence initialization error:', error);
  }
}

export default app;
