// ─── Navigation ──────────────────────────────────────────────────────────────
// Stack navigator wiring all 5 screens together.

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';

import SignInScreen from '../screens/SignInScreen';
import ChatsScreen  from '../screens/ChatsScreen';
import ChatScreen   from '../screens/ChatScreen';
import CallsScreen  from '../screens/CallsScreen';
import StatusScreen from '../screens/StatusScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="SignIn"
      screenOptions={{ headerShown: false }}   // each screen owns its own header
    >
      <Stack.Screen name="SignIn"  component={SignInScreen} />
      <Stack.Screen name="Chats"   component={ChatsScreen}  />
      <Stack.Screen name="Chat"    component={ChatScreen}   />
      <Stack.Screen name="Calls"   component={CallsScreen}  />
      <Stack.Screen name="Status"  component={StatusScreen} />
    </Stack.Navigator>
  );
}