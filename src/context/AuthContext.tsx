// ─── Auth Context ─────────────────────────────────────────────────────────────
//
// Behaviour:
//   Mobile  – once signed in, the session is persisted indefinitely via
//             AsyncStorage. The user never has to sign in again unless they
//             explicitly sign out.
//
//   Web     – session expires after WEB_SESSION_TIMEOUT_MS ms of inactivity
//             (default: 4 hours).  Every auth-guarded interaction refreshes
//             the "last active" timestamp.  When the tab regains focus or the
//             app mounts, we check whether the timeout has elapsed and redirect
//             to Sign In if so.
//
import React, {
  createContext, useContext, useEffect, useState, useCallback, useRef,
} from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAuth, signOut as firebaseSignOut } from '@react-native-firebase/auth';

// 4 hours in milliseconds
const WEB_SESSION_TIMEOUT_MS = 4 * 60 * 60 * 1000;

const KEYS = {
  phone:       'auth_phone',
  signedIn:    'auth_signed_in',
  lastActive:  'auth_last_active',
  displayName: 'auth_display_name',
  avatarUri:   'auth_avatar_uri',
} as const;

interface AuthContextValue {
  isSignedIn: boolean;
  phone: string;
  displayName: string;
  setDisplayName: (name: string) => Promise<void>;
  avatarUri: string | null;
  setAvatarUri: (uri: string) => Promise<void>;
  signIn: (phone: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshActivity: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextValue>({
  isSignedIn: false,
  phone: '',
  displayName: '',
  setDisplayName: async () => {},
  avatarUri: null,
  setAvatarUri: async () => {},
  signIn: async () => {},
  signOut: async () => {},
  refreshActivity: () => {},
  loading: true,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isSignedIn, setIsSignedIn]         = useState(false);
  const [phone, setPhone]                   = useState('');
  const [displayName, setDisplayNameState]  = useState('');
  const [avatarUri, setAvatarUriState]      = useState<string | null>(null);
  const [loading, setLoading]               = useState(true);
  const webTimerRef                 = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Helpers ──────────────────────────────────────────────────────────────

  const clearWebTimer = () => {
    if (webTimerRef.current) clearTimeout(webTimerRef.current);
  };

  const scheduleWebExpiry = useCallback((remainingMs: number) => {
    if (Platform.OS !== 'web') return;
    clearWebTimer();
    webTimerRef.current = setTimeout(async () => {
      await doSignOut();
    }, remainingMs);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const doSignOut = async () => {
    clearWebTimer();
    // Sign out from Firebase Auth
    const authInstance = getAuth();
    await firebaseSignOut(authInstance);
    // Clear AsyncStorage session data
    await AsyncStorage.multiRemove([
      KEYS.phone,
      KEYS.signedIn,
      KEYS.lastActive,
      KEYS.displayName,
      KEYS.avatarUri,
    ]);
    setPhone('');
    setIsSignedIn(false);
    setDisplayNameState('');
    setAvatarUriState(null);
  };

  // ── Hydrate on mount ──────────────────────────────────────────────────────

  useEffect(() => {
    (async () => {
      try {
        const [signedIn, storedPhone, lastActiveStr, storedName, storedAvatar] = await Promise.all([
          AsyncStorage.getItem(KEYS.signedIn),
          AsyncStorage.getItem(KEYS.phone),
          AsyncStorage.getItem(KEYS.lastActive),
          AsyncStorage.getItem(KEYS.displayName),
          AsyncStorage.getItem(KEYS.avatarUri),
        ]);

        if (storedName)   setDisplayNameState(storedName);
        if (storedAvatar) setAvatarUriState(storedAvatar);

        if (signedIn === 'true' && storedPhone) {
          if (Platform.OS === 'web') {
            // Check inactivity timeout
            const lastActive = lastActiveStr ? parseInt(lastActiveStr, 10) : 0;
            const elapsed    = Date.now() - lastActive;

            if (elapsed >= WEB_SESSION_TIMEOUT_MS) {
              // Session expired — clean up and show Sign In
              await doSignOut();
            } else {
              setPhone(storedPhone);
              setIsSignedIn(true);
              scheduleWebExpiry(WEB_SESSION_TIMEOUT_MS - elapsed);
            }
          } else {
            // Mobile — no expiry
            setPhone(storedPhone);
            setIsSignedIn(true);
          }
        }
      } finally {
        setLoading(false);
      }
    })();

    // On web, also check whenever the tab becomes visible again
    if (Platform.OS === 'web') {
      const handleVisibilityChange = async () => {
        if (document.visibilityState === 'visible') {
          const [signedIn, lastActiveStr] = await Promise.all([
            AsyncStorage.getItem(KEYS.signedIn),
            AsyncStorage.getItem(KEYS.lastActive),
          ]);
          if (signedIn === 'true' && lastActiveStr) {
            const elapsed = Date.now() - parseInt(lastActiveStr, 10);
            if (elapsed >= WEB_SESSION_TIMEOUT_MS) {
              await doSignOut();
            } else {
              scheduleWebExpiry(WEB_SESSION_TIMEOUT_MS - elapsed);
            }
          }
        }
      };
      document.addEventListener('visibilitychange', handleVisibilityChange);
      return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Public API ────────────────────────────────────────────────────────────

  const signIn = async (phoneNumber: string) => {
    const now = Date.now().toString();
    await AsyncStorage.multiSet([
      [KEYS.phone,      phoneNumber],
      [KEYS.signedIn,   'true'],
      [KEYS.lastActive, now],
    ]);
    setPhone(phoneNumber);
    setIsSignedIn(true);
    if (Platform.OS === 'web') {
      scheduleWebExpiry(WEB_SESSION_TIMEOUT_MS);
    }
  };

  const setDisplayName = async (name: string) => {
    setDisplayNameState(name);
    await AsyncStorage.setItem(KEYS.displayName, name);
  };

  const setAvatarUri = async (uri: string) => {
    setAvatarUriState(uri);
    await AsyncStorage.setItem(KEYS.avatarUri, uri);
  };

  const signOut = async () => {
    await doSignOut();
  };

  const refreshActivity = useCallback(() => {
    if (Platform.OS !== 'web' || !isSignedIn) return;
    const now = Date.now().toString();
    AsyncStorage.setItem(KEYS.lastActive, now);
    scheduleWebExpiry(WEB_SESSION_TIMEOUT_MS);
  }, [isSignedIn, scheduleWebExpiry]);

  return (
    <AuthContext.Provider value={{
      isSignedIn, phone, displayName, setDisplayName,
      avatarUri, setAvatarUri,
      signIn, signOut, refreshActivity, loading,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
