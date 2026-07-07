// ─── Screen: Outgoing Call ──────────────────────────────────────────────────
// Navigable screen wrapper for RingingCallScreen component
// Handles call cancellation logic and navigation

import React, { useEffect, useState, useRef } from 'react';
import { BackHandler } from 'react-native';
import { useRoute, RouteProp, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { doc, updateDoc, onSnapshot } from 'firebase/firestore';
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

  const callEndedRef = useRef(false);
  const delayTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCancel = async () => {
    if (callEndedRef.current) {
      // Already ended by remote party or other reason
      return;
    }
    
    console.log('[OutgoingCall] Cancelling call:', callId);
    callEndedRef.current = true;
    
    // Update call status to 'cancelled'
    try {
      const callRef = doc(db, 'groupCalls', callId);
      await updateDoc(callRef, { status: 'cancelled' });
    } catch (err) {
      console.error('[OutgoingCall] Failed to cancel call:', err);
    }
    navigation.goBack();
  };

  // Listen for call status changes
  useEffect(() => {
    const callRef = doc(db, 'groupCalls', callId);
    
    const unsubscribe = onSnapshot(callRef, (snapshot) => {
      if (!snapshot.exists()) {
        // Call document deleted - navigate back
        console.log('[OutgoingCall] Call document deleted');
        if (callEndedRef.current) return;
        callEndedRef.current = true;
        navigation.goBack();
        return;
      }

      const data = snapshot.data();
      console.log('[OutgoingCall] Status update:', data.status);

      if (data.status === 'active') {
        // Call was answered - wait 150ms for CallHost to mount before dismissing
        console.log('[OutgoingCall] Call answered - waiting 150ms before dismissing');
        if (callEndedRef.current) return;
        callEndedRef.current = true;
        
        delayTimeoutRef.current = setTimeout(() => {
          navigation.goBack();
        }, 150);
      } else if (data.status === 'declined' || data.status === 'missed') {
        // Call was declined or missed - no delay needed
        console.log('[OutgoingCall] Call ended:', data.status);
        if (callEndedRef.current) return;
        callEndedRef.current = true;
        navigation.goBack();
      }
    });

    return () => {
      console.log('[OutgoingCall] Cleaning up listener');
      unsubscribe();
      // Clean up delay timeout on unmount
      if (delayTimeoutRef.current) {
        clearTimeout(delayTimeoutRef.current);
        delayTimeoutRef.current = null;
      }
    };
  }, [callId, navigation]);

  // Handle Android back button
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      handleCancel();
      return true; // Prevent default back behavior
    });

    return () => backHandler.remove();
  }, [callId, callEnded]);

  // Handle navigation back button
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      // Allow navigation if call already ended
      if (callEndedRef.current) {
        return;
      }
      
      // callEndedRef.current is already true at this point if handleCancel fired,
      // but this GO_BACK guard is kept as an extra safety net
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
