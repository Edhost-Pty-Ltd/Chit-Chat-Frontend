// ─── Biometric helpers ───────────────────────────────────────────────────────
// Thin wrapper around expo-local-authentication (SDK 56) with safe web/no-module
// fallbacks. Persists the user's "biometric login enabled" preference in
// AsyncStorage under the same key used across the app.
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const BIOMETRIC_KEY = 'auth_biometric_enabled';

// Platform-specific import for native-only module.
let LocalAuthentication: any = null;
if (Platform.OS !== 'web') {
  try {
    LocalAuthentication = require('expo-local-authentication');
  } catch (err) {
    console.warn('[biometrics] expo-local-authentication not available:', err);
  }
} else {
  // Web fallback — biometrics unsupported.
  LocalAuthentication = {
    hasHardwareAsync: () => Promise.resolve(false),
    isEnrolledAsync: () => Promise.resolve(false),
    supportedAuthenticationTypesAsync: () => Promise.resolve([]),
    authenticateAsync: () => Promise.resolve({ success: false }),
    AuthenticationType: { FINGERPRINT: 1, FACIAL_RECOGNITION: 2, IRIS: 3 },
  };
}

/** True when the device has biometric hardware AND the user has enrolled at least one credential. */
export async function isBiometricAvailable(): Promise<boolean> {
  try {
    if (!LocalAuthentication) return false;
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    if (!hasHardware) return false;
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    return !!enrolled;
  } catch (err) {
    console.warn('[biometrics] isBiometricAvailable error:', err);
    return false;
  }
}

/** Human-readable label for the strongest available biometric method.
 *  Note: expo-local-authentication reports HARDWARE support, not enrollment.
 *  On Android, phones often advertise face-recognition hardware even when the
 *  user only has fingerprint enrolled, so we prefer Fingerprint on Android.
 *  On iOS, Face ID and Touch ID are distinct devices, so hardware === enrolled. */
export async function getBiometricLabel(): Promise<string> {
  try {
    if (!LocalAuthentication) return 'Biometrics';
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
    const AT = LocalAuthentication.AuthenticationType ?? { FINGERPRINT: 1, FACIAL_RECOGNITION: 2, IRIS: 3 };

    if (Platform.OS === 'ios') {
      // iOS: hardware maps directly to enrollment.
      if (types.includes(AT.FACIAL_RECOGNITION)) return 'Face ID';
      if (types.includes(AT.FINGERPRINT)) return 'Touch ID';
      if (types.includes(AT.IRIS)) return 'Iris';
      return 'Biometrics';
    }

    // Android: prefer Fingerprint since it's the more commonly enrolled option
    // and the hardware list is unreliable for face recognition enrollment.
    if (types.includes(AT.FINGERPRINT)) return 'Fingerprint';
    if (types.includes(AT.FACIAL_RECOGNITION)) return 'Face Unlock';
    if (types.includes(AT.IRIS)) return 'Iris';
    return 'Biometrics';
  } catch (err) {
    console.warn('[biometrics] getBiometricLabel error:', err);
    return 'Biometrics';
  }
}

/** Prompt the user for biometric authentication. Returns true only on a confirmed success. */
export async function authenticateBiometric(promptMessage = 'Authenticate to continue'): Promise<boolean> {
  try {
    if (!LocalAuthentication) return false;
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      fallbackLabel: 'Use PIN',
      cancelLabel: 'Cancel',
      disableDeviceFallback: false,
    });
    return !!result?.success;
  } catch (err) {
    console.warn('[biometrics] authenticateBiometric error:', err);
    return false;
  }
}

/** Read the persisted "biometric login enabled" preference. */
export async function isBiometricEnabled(): Promise<boolean> {
  try {
    const v = await AsyncStorage.getItem(BIOMETRIC_KEY);
    return v === 'true';
  } catch {
    return false;
  }
}

/** Persist the "biometric login enabled" preference. */
export async function setBiometricEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(BIOMETRIC_KEY, enabled ? 'true' : 'false');
}
