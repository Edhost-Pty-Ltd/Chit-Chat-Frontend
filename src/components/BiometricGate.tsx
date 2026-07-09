// ─── Biometric Gate ──────────────────────────────────────────────────────────
// App-level overlay lock. When biometric login is enabled, the app locks:
//   1. On cold start when the user is already signed in
//   2. Every time the app returns from background to foreground
//   3. After 1 minute of inactivity while the app is in the foreground
// Shows a lock screen with the app logo and an unlock button that prompts the
// device's biometric authentication. Unlocks only on a confirmed success.
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Image, StyleSheet, TouchableOpacity, Platform, AppState, AppStateStatus,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Text } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { COLORS, RADIUS, SHADOW, GRADIENTS } from '../types/theme';
import {
  isBiometricEnabled, isBiometricAvailable, authenticateBiometric, getBiometricLabel,
} from '../utils/biometrics';

// Inactivity timeout: lock the app after this many milliseconds of no user interaction.
const INACTIVITY_TIMEOUT_MS = 60 * 1000; // 1 minute
// Grace period to allow the biometric prompt itself to background the app briefly
// without triggering a re-lock loop.
const BG_GRACE_MS = 1500;

export function BiometricGate() {
  const { isSignedIn, loading } = useAuth();

  const [locked, setLocked]         = useState(false);
  const [authing, setAuthing]       = useState(false);
  const [label, setLabel]           = useState('Biometrics');
  const initRef                     = useRef(false);
  const inactivityTimerRef          = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backgroundedAtRef           = useRef<number | null>(null);
  const authingRef                  = useRef(false);

  // Biometrics are mobile-only.
  const supported = Platform.OS !== 'web';

  // ── Lock the app if biometric login is enabled ──────────────────────────────
  const lockIfEnabled = useCallback(async () => {
    if (!supported) return;
    const [enabled, available] = await Promise.all([
      isBiometricEnabled(),
      isBiometricAvailable(),
    ]);
    if (enabled && available) {
      setLabel(await getBiometricLabel());
      setLocked(true);
    }
  }, [supported]);

  // ── Cold start: lock once auth has resolved and the user is signed in ───────
  useEffect(() => {
    if (!supported || loading || initRef.current) return;
    initRef.current = true;
    if (isSignedIn) {
      lockIfEnabled();
    }
  }, [supported, loading, isSignedIn, lockIfEnabled]);

  // ── If the user signs out while locked, clear the lock ──────────────────────
  useEffect(() => {
    if (!isSignedIn) {
      setLocked(false);
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
        inactivityTimerRef.current = null;
      }
    }
  }, [isSignedIn]);

  // ── Re-lock when the app returns from background ────────────────────────────
  // The biometric prompt itself briefly backgrounds the app; we ignore returns
  // that happen within a short grace period to avoid a re-lock loop.
  useEffect(() => {
    if (!supported || !isSignedIn) return;

    const handleAppStateChange = (state: AppStateStatus) => {
      if (state === 'background' || state === 'inactive') {
        // Only record background time if we're not in the middle of authing.
        if (!authingRef.current) {
          backgroundedAtRef.current = Date.now();
        }
      } else if (state === 'active') {
        const bgAt = backgroundedAtRef.current;
        backgroundedAtRef.current = null;
        if (bgAt && Date.now() - bgAt > BG_GRACE_MS && !locked) {
          lockIfEnabled();
        }
      }
    };

    const sub = AppState.addEventListener('change', handleAppStateChange);
    return () => sub.remove();
  }, [supported, isSignedIn, locked, lockIfEnabled]);

  // ── Inactivity timer: lock after N minutes of no interaction ────────────────
  const resetInactivityTimer = useCallback(() => {
    if (!supported || !isSignedIn || locked) return;
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }
    inactivityTimerRef.current = setTimeout(() => {
      lockIfEnabled();
    }, INACTIVITY_TIMEOUT_MS);
  }, [supported, isSignedIn, locked, lockIfEnabled]);

  // Start the inactivity timer when signed in and unlocked.
  useEffect(() => {
    if (!supported || !isSignedIn || locked) {
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
        inactivityTimerRef.current = null;
      }
      return;
    }
    resetInactivityTimer();
    return () => {
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
        inactivityTimerRef.current = null;
      }
    };
  }, [supported, isSignedIn, locked, resetInactivityTimer]);

  const handleUnlock = useCallback(async () => {
    if (authingRef.current) return;
    authingRef.current = true;
    setAuthing(true);
    try {
      const ok = await authenticateBiometric('Unlock ChitChat');
      if (ok) {
        setLocked(false);
        resetInactivityTimer();
      }
    } finally {
      authingRef.current = false;
      setAuthing(false);
    }
  }, [resetInactivityTimer]);

  // Auto-prompt as soon as the lock appears.
  useEffect(() => {
    if (locked) handleUnlock();
  }, [locked]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!locked) {
    // Expose the inactivity reset via a global handler on the root touch listener.
    // The BiometricGateWrapper below intercepts touches to reset the timer.
    return <ActivityTracker onActivity={resetInactivityTimer} />;
  }

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="auto">
      <LinearGradient colors={GRADIENTS.bg} style={StyleSheet.absoluteFill} />
      <View style={styles.center}>
        <Image
          source={require('../../assets/icon.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <View style={styles.iconWrap}>
          <Ionicons name="lock-closed" size={42} color={COLORS.blue} />
        </View>
        <Text style={styles.title}>ChitChat Locked</Text>
        <Text style={styles.sub}>Unlock with {label} to continue.</Text>

        <TouchableOpacity onPress={handleUnlock} activeOpacity={0.85} disabled={authing}>
          <LinearGradient colors={GRADIENTS.primary} style={styles.btn}>
            <Ionicons name="finger-print" size={20} color="#fff" style={{ marginRight: 8 }} />
            <Text style={styles.btnText}>{authing ? 'Verifying…' : `Unlock with ${label}`}</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// Invisible full-screen tracker that detects user interaction (touch anywhere)
// and resets the inactivity timer, without consuming the touch event.
function ActivityTracker({ onActivity }: { onActivity: () => void }) {
  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="box-none"
      onStartShouldSetResponderCapture={() => {
        onActivity();
        return false; // don't capture - let touches pass through
      }}
      onMoveShouldSetResponderCapture={() => {
        onActivity();
        return false;
      }}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  logo:   { width: 96, height: 96, marginBottom: 24 },
  iconWrap: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: 'rgba(30,156,240,0.12)',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.45)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 20,
    ...SHADOW.glow,
  },
  title:  { fontSize: 22, fontWeight: '700', color: COLORS.text, marginBottom: 8 },
  sub:    { fontSize: 14, color: COLORS.sub, textAlign: 'center', marginBottom: 28, lineHeight: 20 },
  btn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderRadius: RADIUS.md, paddingVertical: 15, paddingHorizontal: 28, ...SHADOW.button,
  },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
