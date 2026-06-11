// ─── Firebase Configuration (Hybrid) ──────────────────────────────────────────
// Auth:      @react-native-firebase/auth (native module, supports phone OTP)
// Firestore: firebase/firestore (JS SDK)
//
// IMPORTANT: The JS SDK Firestore and @react-native-firebase/auth are separate
// Firebase instances. The JS Firestore won't see the native auth state.
// For this to work, Firestore rules must allow access without auth checks,
// OR we need to bridge the auth. We use signInWithCustomToken approach below.

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import {
  initializeAuth,
  getReactNativePersistence,
  signInWithCredential,
  PhoneAuthProvider,
} from 'firebase/auth';
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';
import rnAuth from '@react-native-firebase/auth';

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

// Firebase Storage — voice note audio file hosting
export const storage = getStorage(app);

export default app;
