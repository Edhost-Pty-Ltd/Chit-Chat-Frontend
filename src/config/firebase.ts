// ─── Firebase Configuration (Hybrid) ──────────────────────────────────────────
// Auth:      @react-native-firebase/auth (native module, supports phone OTP)
// Firestore: firebase/firestore (JS SDK, works fine cross-platform)
//
// This hybrid approach uses RNFirebase only for auth (which needs native phone
// verification) and keeps the lighter JS SDK for Firestore queries.

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// Re-export RNFirebase auth for use in useAuth hook
export { default as rnAuth } from '@react-native-firebase/auth';

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

export default app;
