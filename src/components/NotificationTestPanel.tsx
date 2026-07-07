// ─── Notification Test Panel ─────────────────────────────────────────────────
// DEVELOPMENT ONLY: Test panel for verifying notification system
// Add this component to any screen to test notifications manually

import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AppText, AppIcon, useForeground, useTypography, useGlass } from '../context/ThemeContext';
import { useNotifications } from '../context/NotificationContext';
import { COLORS, RADIUS, GRADIENTS } from '../types/theme';

export function NotificationTestPanel() {
  const { pushNotification, notifications, unreadCount } = useNotifications();
  const { FG } = useForeground();
  const { fontFamily, textColor } = useTypography();
  const { bevel } = useGlass();

  const testMessage = () => {
    console.log('[TEST] Triggering test message notification');
    pushNotification({
      type: 'message',
      title: 'Test User',
      body: 'This is a test message notification',
      contactId: 'test-user-123',
    });
  };

  const testCall = () => {
    console.log('[TEST] Triggering test call notification');
    pushNotification({
      type: 'call',
      title: 'Missed Call',
      body: 'Test Caller tried to call you',
      contactId: 'test-caller-123',
    });
  };

  const testSystem = () => {
    console.log('[TEST] Triggering test system notification');
    pushNotification({
      type: 'system',
      title: 'System Update',
      body: 'Test system notification',
    });
  };

  return (
    <View style={[styles.container, bevel]}>
      <View style={styles.header}>
        <AppIcon name="notifications-outline" size={20} color={COLORS.blue} fixedColor />
        <AppText style={[styles.title, { color: textColor, fontFamily }]}>
          Notification Test
        </AppText>
      </View>

      <AppText style={[styles.info, { color: FG.secondary }]}>
        {notifications.length} notifications ({unreadCount} unread)
      </AppText>

      <View style={styles.buttons}>
        <TouchableOpacity style={styles.button} onPress={testMessage} activeOpacity={0.8}>
          <LinearGradient colors={GRADIENTS.primary} style={styles.buttonGrad}>
            <AppIcon name="chatbubble-outline" size={16} color="#fff" fixedColor />
            <AppText fixedColor style={styles.buttonText}>Message</AppText>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={testCall} activeOpacity={0.8}>
          <LinearGradient colors={['#10b981', '#059669']} style={styles.buttonGrad}>
            <AppIcon name="call-outline" size={16} color="#fff" fixedColor />
            <AppText fixedColor style={styles.buttonText}>Call</AppText>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={testSystem} activeOpacity={0.8}>
          <LinearGradient colors={['#8b5cf6', '#6366f1']} style={styles.buttonGrad}>
            <AppIcon name="information-circle-outline" size={16} color="#fff" fixedColor />
            <AppText fixedColor style={styles.buttonText}>System</AppText>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 0,
    marginVertical: 8,
    borderRadius: RADIUS.lg,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
  },
  info: {
    fontSize: 12,
    marginBottom: 14,
  },
  buttons: {
    flexDirection: 'row',
    gap: 8,
  },
  button: {
    flex: 1,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
  },
  buttonGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
});
