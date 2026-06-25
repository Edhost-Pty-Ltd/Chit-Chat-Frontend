// ─── NotificationTestButton Component ─────────────────────────────────────────
// Test button for triggering local notifications (for development/testing)

import React from 'react';
import { TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { GRADIENTS, RADIUS, SHADOW } from '../types/theme';
import { sendLocalNotification } from '../hooks/usePushNotifications';
import { AppText } from '../context/ThemeContext';

interface NotificationTestButtonProps {
  style?: any;
}

export function NotificationTestButton({ style }: NotificationTestButtonProps) {
  const handleTestNotification = async () => {
    try {
      await sendLocalNotification(
        'Test Notification',
        'This is a test notification from Chit-Chat',
        { type: 'test', timestamp: Date.now() }
      );
      Alert.alert('Success', 'Test notification sent!');
    } catch (error) {
      Alert.alert('Error', 'Failed to send notification');
      console.error('[NotificationTestButton] Error:', error);
    }
  };

  return (
    <TouchableOpacity
      style={[styles.container, style]}
      onPress={handleTestNotification}
      activeOpacity={0.8}
    >
      <LinearGradient
        colors={GRADIENTS.primary}
        style={styles.button}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <Ionicons name="notifications" size={20} color="#fff" />
        <AppText style={styles.buttonText} fixedColor>
          Test Notification
        </AppText>
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 10,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: RADIUS.md,
    gap: 8,
    ...SHADOW.button,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
