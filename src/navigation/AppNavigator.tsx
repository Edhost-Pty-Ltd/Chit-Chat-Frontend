// ─── Navigation ──────────────────────────────────────────────────────────────
import React, { useState, useEffect, useCallback } from 'react';
import { View, ActivityIndicator, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { useAuth } from '../context/AuthContext';
import { COLORS } from '../types/theme';
import { AppBg } from '../context/ThemeContext';

import auth, { getAuth, signOut as firebaseSignOut } from '@react-native-firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

import SplashScreen      from '../screens/SplashScreen';
import SignInScreen       from '../screens/SignInScreen';
import ChatsScreen        from '../screens/ChatsScreen';
import ChatScreen         from '../screens/ChatScreen';
import CallsScreen        from '../screens/CallsScreen';
import StatusScreen       from '../screens/StatusScreen';
import ContactsScreen     from '../screens/ContactsScreen';
import CalendarScreen     from '../screens/CalendarScreen';
import NotesScreen        from '../screens/NotesScreen';
import CloudBackupScreen  from '../screens/CloudBackupScreen';
import SettingsScreen     from '../screens/SettingsScreen';
import AppearanceScreen  from '../screens/AppearanceScreen';
import ProfileScreen     from '../screens/ProfileScreen';
import CreateAccountScreen from '../screens/CreateAccountScreen';
import VideoCallScreen    from '../screens/VideoCallScreen';
import AudioCallScreen    from '../screens/AudioCallScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  const { isSignedIn, loading } = useAuth();

  // Profile existence state: null = loading, true/false = checked
  const [profileExists, setProfileExists] = useState<boolean | null>(null);
  const [profileCheckError, setProfileCheckError] = useState<boolean>(false);

  const checkProfileExists = useCallback(async () => {
    const authInstance = getAuth();
    const currentUser = authInstance.currentUser;
    if (!currentUser) {
      setProfileExists(false);
      return;
    }

    try {
      setProfileCheckError(false);
      setProfileExists(null); // reset to loading state
      const userDocRef = doc(db, 'users', currentUser.uid);
      const userDoc = await getDoc(userDocRef);
      setProfileExists(userDoc.exists());
    } catch (error) {
      console.error('[AppNavigator] Profile check failed:', error);
      setProfileCheckError(true);
    }
  }, []);

  // Check profile existence when user is authenticated
  useEffect(() => {
    if (isSignedIn && !loading) {
      checkProfileExists();
    } else if (!isSignedIn) {
      // Reset profile state when signed out
      setProfileExists(null);
      setProfileCheckError(false);
    }
  }, [isSignedIn, loading, checkProfileExists]);

  // While hydrating from AsyncStorage show a branded splash
  if (loading) {
    return (
      <View style={styles.splash}>
        <AppBg />
        <ActivityIndicator size="large" color={COLORS.blue} />
      </View>
    );
  }

  // Show loading while checking profile existence
  if (isSignedIn && profileExists === null && !profileCheckError) {
    return (
      <View style={styles.splash}>
        <AppBg />
        <ActivityIndicator size="large" color={COLORS.blue} />
      </View>
    );
  }

  // Show error screen with retry if profile check failed
  if (isSignedIn && profileCheckError) {
    return (
      <View style={styles.splash}>
        <AppBg />
        <Text style={styles.errorText}>Something went wrong.</Text>
        <Text style={styles.errorSubtext}>Could not verify your profile. Please try again.</Text>
        <TouchableOpacity style={styles.retryButton} onPress={checkProfileExists}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <Stack.Navigator
      initialRouteName={isSignedIn ? (profileExists ? 'Chats' : 'CreateAccount') : 'Splash'}
      screenOptions={{ headerShown: false }}
    >
      {isSignedIn ? (
        // ── Authenticated screens ────────────────────────────────────────
        <>
          {profileExists ? (
            <>
              <Stack.Screen name="Chats"       component={ChatsScreen}       />
              <Stack.Screen name="Chat"        component={ChatScreen}        />
              <Stack.Screen name="Calls"       component={CallsScreen}       />
              <Stack.Screen name="Status"      component={StatusScreen}      />
              <Stack.Screen name="Contacts"    component={ContactsScreen}    />
              <Stack.Screen name="Calendar"    component={CalendarScreen}    />
              <Stack.Screen name="Notes"       component={NotesScreen}       />
              <Stack.Screen name="CloudBackup" component={CloudBackupScreen} />
              <Stack.Screen name="Settings"    component={SettingsScreen}    />
              <Stack.Screen name="Appearance"      component={AppearanceScreen}      />
              <Stack.Screen name="Profile"         component={ProfileScreen}         />
              <Stack.Screen name="VideoCall"       component={VideoCallScreen}       />
              <Stack.Screen name="AudioCall"       component={AudioCallScreen}       />
            </>
          ) : (
            // User is authenticated but has no profile → show CreateAccount
            <Stack.Screen name="CreateAccount" component={CreateAccountScreen} />
          )}
        </>
      ) : (
        // ── Unauthenticated screens ──────────────────────────────────────
        <>
          <Stack.Screen name="Splash"         component={SplashScreen}         />
          <Stack.Screen name="SignIn"         component={SignInScreen}          />
          <Stack.Screen name="CreateAccount"  component={CreateAccountScreen}   />
        </>
      )}
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  errorSubtext: {
    color: COLORS.sub,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 40,
  },
  retryButton: {
    backgroundColor: COLORS.blue,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
  },
});
