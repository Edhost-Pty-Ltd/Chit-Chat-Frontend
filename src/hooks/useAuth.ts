// ─── useAuth Hook ─────────────────────────────────────────────────────────────
// Phone OTP authentication via @react-native-firebase/auth.
// Flow: enterPhone → sendOTP → verifyOTP → signed in
//
// Uses the native Firebase Auth module which handles reCAPTCHA automatically
// on both iOS and Android — no WebView or manual recaptcha needed.

import { useState, useEffect } from 'react';
import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';

export type AuthStep = 'idle' | 'sending' | 'verifying' | 'done' | 'error';

export function useAuth() {
  const [user,    setUser]    = useState<FirebaseAuthTypes.User | null>(null);
  const [step,    setStep]    = useState<AuthStep>('idle');
  const [error,   setError]   = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Holds the confirmation result from signInWithPhoneNumber
  const [confirm, setConfirm] = useState<FirebaseAuthTypes.ConfirmationResult | null>(null);

  // ── Listen to auth state changes ──────────────────────────────
  useEffect(() => {
    const unsub = auth().onAuthStateChanged(async (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });
    return unsub;
  }, []);

  // ── Step 1: Send OTP to phone number ──────────────────────────
  // phone must be E.164 format, e.g. "+27658500320"
  async function sendOTP(phone: string): Promise<boolean> {
    try {
      setStep('sending');
      setError(null);

      console.log('[useAuth] Sending OTP to:', phone);
      const confirmation = await auth().signInWithPhoneNumber(phone);
      setConfirm(confirmation);
      setStep('verifying');
      return true;
    } catch (err: any) {
      console.error('[useAuth] sendOTP error:', err.code, err.message);
      setError(getAuthErrorMessage(err.code));
      setStep('error');
      return false;
    }
  }

  // ── Step 2: Verify OTP entered by user ────────────────────────
  async function verifyOTP(otp: string): Promise<boolean> {
    if (!confirm) {
      setError('No confirmation pending — please resend OTP');
      return false;
    }
    try {
      setStep('verifying');
      setError(null);

      const result = await confirm.confirm(otp);

      if (result?.user) {
        // Create or update user profile in Firestore
        await upsertUserProfile(result.user);
        setUser(result.user);
      }

      setStep('done');
      return true;
    } catch (err: any) {
      setError(getAuthErrorMessage(err.code));
      setStep('error');
      return false;
    }
  }

  // ── Sign out ───────────────────────────────────────────────────
  async function signOut() {
    await auth().signOut();
    setUser(null);
    setConfirm(null);
    setStep('idle');
  }

  return { user, step, error, loading, sendOTP, verifyOTP, signOut };
}

// ─── Create user doc in Firestore if it doesn't exist yet ─────────────────────
async function upsertUserProfile(user: FirebaseAuthTypes.User) {
  const ref  = doc(db, 'users', user.uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    await setDoc(ref, {
      uid:         user.uid,
      phone:       user.phoneNumber ?? '',
      displayName: user.phoneNumber ?? '',   // user can update later
      photoURL:    null,
      createdAt:   serverTimestamp(),
      lastSeen:    serverTimestamp(),
    });
  } else {
    // Update lastSeen on every login
    await setDoc(ref, { lastSeen: serverTimestamp() }, { merge: true });
  }
}

// ─── Human-readable error messages ────────────────────────────────────────────
function getAuthErrorMessage(code: string): string {
  const messages: Record<string, string> = {
    'auth/invalid-phone-number':      'Invalid phone number. Use format +27XXXXXXXXX',
    'auth/too-many-requests':         'Too many attempts. Please wait and try again.',
    'auth/invalid-verification-code': 'Incorrect OTP. Please check and try again.',
    'auth/code-expired':              'OTP has expired. Please request a new one.',
    'auth/missing-phone-number':      'Please enter your phone number.',
    'auth/session-expired':           'Session expired. Please request a new OTP.',
    'auth/quota-exceeded':            'SMS quota exceeded. Try again later.',
  };
  return messages[code] ?? 'Something went wrong. Please try again.';
}
