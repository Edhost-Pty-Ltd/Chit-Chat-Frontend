// ─── Component: Call Ended Screen ────────────────────────────────────────────
// Momentary screen shown when call ends before navigating back

import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AppText, AppIcon } from '../context/ThemeContext';
import { GRADIENTS } from '../types/theme';

interface CallEndedScreenProps {
  reason?: 'ended' | 'rejected' | 'missed' | 'busy' | 'failed';
  onDismiss: () => void;
  dismissDelay?: number; // milliseconds
}

export function CallEndedScreen({ 
  reason = 'ended', 
  onDismiss, 
  dismissDelay = 1500 
}: CallEndedScreenProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss();
    }, dismissDelay);

    return () => clearTimeout(timer);
  }, [dismissDelay, onDismiss]);

  const getMessage = () => {
    switch (reason) {
      case 'rejected':
        return 'Call Declined';
      case 'missed':
        return 'No Answer';
      case 'busy':
        return 'Busy';
      case 'failed':
        return 'Call Failed';
      default:
        return 'Call Ended';
    }
  };

  return (
    <LinearGradient colors={GRADIENTS.dark} style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <AppIcon 
            name={reason === 'ended' ? 'phone-hangup' : 'phone-missed'} 
            size={48} 
            color="#FFFFFF" 
          />
        </View>
        <AppText fixedColor style={styles.message}>
          {getMessage()}
        </AppText>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    gap: 24,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  message: {
    fontSize: 24,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
