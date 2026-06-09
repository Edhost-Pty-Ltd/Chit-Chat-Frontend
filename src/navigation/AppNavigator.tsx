// ─── Navigation ──────────────────────────────────────────────────────────────
import React from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { RootStackParamList } from '../types';
import { GRADIENTS, COLORS } from '../types/theme';
import { useAuth } from '../hooks/useAuth';

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

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  const { user, loading } = useAuth();

  // Show loading spinner while auth state is being determined
  if (loading) {
    return (
      <LinearGradient colors={GRADIENTS.bg} style={styles.loading}>
        <ActivityIndicator size="large" color={COLORS.blue} />
      </LinearGradient>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {user ? (
        // Authenticated stack
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
        </>
      ) : (
        // Unauthenticated stack
        <Stack.Screen name="SignIn" component={SignInScreen} />
      )}
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
