// ─── useAuth Hook ─────────────────────────────────────────────────────────────
// Phone OTP authentication via @react-native-firebase/auth.
// Flow: enterPhone → sendOTP → verifyOTP → signed in
//
// Uses the native Firebase Auth module which handles reCAPTCHA automatically
// on both iOS and Android — no WebView or manual recaptcha needed.
//
// NOTE: iOS requires APNs (Apple Push Notification Service) to be configured
// for phone auth. Without APNs, use the web-based auth flow as fallback.

import { useState, useEffect } from 'react';
import { Platform } from 'react-native';
import auth, { FirebaseAuthTypes, getAuth, onAuthStateChanged, signInWithPhoneNumber, signOut as firebaseSignOut } from '@react-native-firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';

export type AuthStep = 'idle' | 'sending' | 'otpSent' | 'verifying' | 'done' | 'error';

export function useAuth() {
  const [user,    setUser]    = useState<FirebaseAuthTypes.User | null>(null);
  const [step,    setStep]    = useState<AuthStep>('idle');
  const [error,   setError]   = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Holds the confirmation result from signInWithPhoneNumber
  const [confirm, setConfirm] = useState<FirebaseAuthTypes.ConfirmationResult | null>(null);

  // ── Listen to auth state changes ──────────────────────────────
  useEffect(() => {
    const authInstance = getAuth();
    const unsub = onAuthStateChanged(authInstance, async (firebaseUser) => {
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
      console.log('[useAuth] Platform:', Platform.OS);
      
      // Check if running on iOS without APNs configured
      if (Platform.OS === 'ios') {
        console.warn('[useAuth] iOS Phone Auth requires APNs to be configured in Firebase Console');
      }
      
      const authInstance = getAuth();
      
      // Wrap in try-catch to prevent crash
      try {
        const confirmation = await signInWithPhoneNumber(authInstance, phone);
        setConfirm(confirmation);
        setStep('otpSent');
        console.log('[useAuth] OTP sent successfully');
        return true;
      } catch (signInError: any) {
        console.error('[useAuth] signInWithPhoneNumber failed:', signInError);
        console.error('[useAuth] Error details:', {
          code: signInError.code,
          message: signInError.message,
          name: signInError.name,
        });
        
        // Provide specific error messages for common iOS issues
        if (Platform.OS === 'ios') {
          if (signInError.code === 'auth/invalid-app-credential' || 
              signInError.code === 'auth/app-not-authorized') {
            throw new Error('Firebase is not properly configured for iOS. Please ensure APNs is set up correctly.');
          } else if (signInError.code === 'auth/missing-client-identifier') {
            throw new Error('iOS configuration error: Missing client identifier. APNs may not be properly configured.');
          } else if (signInError.message?.includes('APNs') || signInError.message?.includes('APNS')) {
            throw new Error('APNs error: ' + signInError.message);
          }
        }
        
        throw signInError;
      }
    } catch (err: any) {
      console.error('[useAuth] sendOTP error:', err);
      console.error('[useAuth] Error code:', err.code);
      console.error('[useAuth] Error message:', err.message);
      
      // Provide iOS-specific error messages
      if (Platform.OS === 'ios' && (
        err.code === 'auth/missing-client-identifier' ||
        err.code === 'auth/internal-error' ||
        err.message?.includes('APNs') ||
        err.message?.includes('APNS')
      )) {
        setError('Phone authentication is not configured for iOS. Please contact support or use Android device.');
      } else {
        setError(getAuthErrorMessage(err.code) || err.message);
      }
      
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

      console.log('[useAuth] Confirming OTP...');
      const result = await confirm.confirm(otp);
      console.log('[useAuth] OTP confirmed, user authenticated:', result?.user?.uid);

      if (result?.user) {
        // Try to create or update user profile in Firestore
        // But don't fail sign-in if Firestore is offline
        try {
          console.log('[useAuth] Creating/updating user profile in Firestore...');
          await upsertUserProfile(result.user);
          console.log('[useAuth] User profile updated successfully');
        } catch (firestoreError: any) {
          console.error('[useAuth] Firestore error (non-critical):', firestoreError);
          // If Firestore is offline, continue with sign-in anyway
          if (firestoreError?.code === 'unavailable' || firestoreError?.message?.includes('offline')) {
            console.warn('[useAuth] Firestore offline - continuing with sign-in');
          } else {
            // For other Firestore errors, log but don't block sign-in
            console.warn('[useAuth] Non-critical Firestore error - continuing with sign-in');
          }
        }
        
        setUser(result.user);
      }

      setStep('done');
      console.log('[useAuth] Sign-in complete');
      return true;
    } catch (err: any) {
      console.error('[useAuth] verifyOTP error:', err.code, err.message);
      setError(getAuthErrorMessage(err.code));
      setStep('error');
      return false;
    }
  }

  // ── Sign out ───────────────────────────────────────────────────
  async function signOut() {
    const authInstance = getAuth();
    await firebaseSignOut(authInstance);
    setUser(null);
    setConfirm(null);
    setStep('idle');
  }

  return { user, step, error, loading, sendOTP, verifyOTP, signOut };
}

// ─── Create user doc in Firestore if it doesn't exist yet ─────────────────────
async function upsertUserProfile(user: FirebaseAuthTypes.User) {
  try {
    const ref  = doc(db, 'users', user.uid);
    
    console.log('[useAuth] Checking if user profile exists...');
    
    // Add timeout for Firestore operations
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Firestore operation timeout')), 15000)
    );
    
    const snap = await Promise.race([
      getDoc(ref),
      timeoutPromise
    ]) as any;

    if (!snap.exists()) {
      console.log('[useAuth] Creating new user profile in Firestore...');
      await Promise.race([
        setDoc(ref, {
          uid:         user.uid,
          phone:       user.phoneNumber ?? '',
          displayName: user.phoneNumber ?? '',   // user can update later
          photoURL:    null,
          createdAt:   serverTimestamp(),
          lastSeen:    serverTimestamp(),
        }),
        timeoutPromise
      ]);
      console.log('[useAuth] New user profile created');
    } else {
      console.log('[useAuth] Updating existing user lastSeen...');
      // Update lastSeen on every login
      await Promise.race([
        setDoc(ref, { lastSeen: serverTimestamp() }, { merge: true }),
        timeoutPromise
      ]);
      console.log('[useAuth] User lastSeen updated');
    }
  } catch (error: any) {
    console.error('[useAuth] upsertUserProfile error:', error);
    throw error; // Re-throw to be handled by caller
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
