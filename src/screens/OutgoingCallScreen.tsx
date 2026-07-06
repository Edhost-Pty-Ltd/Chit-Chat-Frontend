// ─── Screen: Outgoing Call ──────────────────────────────────────────────────
// Navigable screen wrapper for RingingCallScreen component
// Handles call cancellation logic and navigation

import React, { useEffect } from 'react';
import { BackHandler } from 'react-native';
import { useRoute, RouteProp, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { RingingCallScreen } from '../components/RingingCallScreen';
import { RootStackParamList } from '../types';
import type { CallParticipant } from '../types/call';

type RouteP = RouteProp<RootStackParamList, 'OutgoingCall'>;
type NavProp = NativeStackNavigationProp<RootStackParamList, 'OutgoingCall'>;

export default function OutgoingCallScreen() {
  const route = useRoute<RouteP>();
  const navigation = useNavigation<NavProp>();
  const { callId, displayName, callType, photoUrl } = route.params;

  const handleCancel = async () => {
    console.log('[OutgoingCall] Cancelling call:', callId);
    // Update call status to 'cancelled'
    try {
      const callRef = doc(db, 'groupCalls', callId);
      await updateDoc(callRef, { status: 'cancelled' });
    } catch (err) {
      console.error('[OutgoingCall] Failed to cancel call:', err);
    }
    navigation.goBack();
  };

  // Handle Android back button
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      handleCancel();
      return true; // Prevent default back behavior
    });

    return () => backHandler.remove();
  }, [callId]);

  // Handle navigation back button
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      // Allow navigation if it's from our handleCancel
      if (e.data.action.type === 'GO_BACK') {
        return;
      }
      
      e.preventDefault();
      handleCancel();
    });
    
    return unsubscribe;
  }, [navigation, callId]);

  // Create CallParticipant object for RingingCallScreen
  const otherParty: CallParticipant = {
    userId: '', // Not needed for display
    displayName: displayName,
    photoUrl: photoUrl,
  };

  return (
    <RingingCallScreen
      otherParty={otherParty}
      callType={callType}
      onEndCall={handleCancel}
    />
  );
}
