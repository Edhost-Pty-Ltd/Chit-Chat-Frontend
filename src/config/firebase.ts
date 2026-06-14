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

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey:            'AIzaSyBzstwF1NgQWASsqVa4R5IiZpFLoKZnSJQ',
  authDomain:        'chit-chat-67a7f.firebaseapp.com',
  projectId:         'chit-chat-67a7f',
  storageBucket:     'chit-chat-67a7f.firebasestorage.app',
  messagingSenderId: '825582316169',
  appId:             '1:825582316169:web:ea4abdaa918504fe77f458',
};

// Prevent duplicate app initialization on hot reload
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Firestore — real-time database (JS SDK)
export const db = getFirestore(app);

// Firebase Storage — voice note audio file hosting
export const storage = getStorage(app);

// Enable offline persistence for better reliability
// This allows Firestore to work offline and sync when connection is restored
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

export default app;
