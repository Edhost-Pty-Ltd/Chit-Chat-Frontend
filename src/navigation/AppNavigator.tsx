// ─── Navigation ──────────────────────────────────────────────────────────────
import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { useAuth } from '../context/AuthContext';
import { COLORS } from '../types/theme';
import { AppBg } from '../context/ThemeContext';

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

  // While hydrating from AsyncStorage show a branded splash
  if (loading) {
    return (
      <View style={styles.splash}>
        <AppBg />
        <ActivityIndicator size="large" color={COLORS.blue} />
      </View>
    );
  }

  return (
    <Stack.Navigator
      // Authenticated users skip the Sign In screen; unauthenticated users
      // start there.  Using initialRouteName + conditional screen registration
      // is the recommended React Navigation v7 pattern.
      initialRouteName={isSignedIn ? 'Chats' : 'Splash'}
      screenOptions={{ headerShown: false }}
    >
      {isSignedIn ? (
        // ── Authenticated screens ────────────────────────────────────────
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
  splash: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
