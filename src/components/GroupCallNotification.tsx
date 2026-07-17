// ─── Component: Group Call Notification ─────────────────────────────────────
// WhatsApp-style full-screen incoming call with Answer / Decline buttons.

import React, { useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Platform,
  Animated,
  Vibration,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AppText, AppIcon } from '../context/ThemeContext';
import { Avatar } from '.';
import { COLORS, SHADOW } from '../types/theme';
import { GroupCallNotification as GroupCallNotificationType } from '../hooks/useGroupCallNotifications';

interface GroupCallNotificationProps {
  notification: GroupCallNotificationType;
  memberCount?: number;
  /** Resolved display name for the caller (contact name for saved, phone number for unsaved) */
  resolvedCallerName?: string;
  /** Avatar initials override (from signup username for unsaved contacts) */
  callerInitials?: string;
  onJoin: () => void;
  onDismiss: () => void;
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export default function GroupCallNotification({
  notification,
  memberCount = 2,
  resolvedCallerName,
  callerInitials,
  onJoin,
  onDismiss,
}: GroupCallNotificationProps) {
  const isVideo = notification.callType === 'video';
  const isGroup = memberCount > 2;
  const callLabel = `${isGroup ? 'Group ' : ''}${isVideo ? 'video' : 'voice'} call`;

  const callerName = resolvedCallerName || notification.initiatorName || 'Unknown';
  const initials = callerInitials || getInitials(callerName);

  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Pulse the avatar + vibrate while the call is ringing.
  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.1, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ]),
    );
    animation.start();
    Vibration.vibrate([0, 600, 600], true);
    return () => {
      animation.stop();
      Vibration.cancel();
    };
  }, [pulseAnim]);

  const handleAnswer = () => {
    Vibration.cancel();
    onJoin();
  };

  const handleDecline = () => {
    Vibration.cancel();
    onDismiss();
  };

  return (
    <Modal transparent visible animationType="fade" statusBarTranslucent onRequestClose={handleDecline}>
      <View style={styles.overlay}>
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(10, 22, 40, 0.96)' }]} />

        <LinearGradient
          colors={['rgba(10, 22, 40, 0.3)', 'rgba(13, 34, 68, 0.5)', 'rgba(26, 74, 138, 0.3)']}
          style={styles.content}
          start={{ x: 0.3, y: 0 }}
          end={{ x: 0.7, y: 1 }}
        >
          {/* Caller info */}
          <View style={styles.callerSection}>
            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
              <View style={styles.avatarRing}>
                <Avatar initials={initials} color={COLORS.blue} size={120} />
              </View>
            </Animated.View>

            <AppText fixedColor style={styles.callerName} numberOfLines={1}>
              {callerName}
            </AppText>
            <AppText fixedColor style={styles.callStatus}>
              Incoming {callLabel}…
            </AppText>
          </View>

          {/* Action buttons */}
          <View style={styles.actionsRow}>
            {/* Decline / hang up */}
            <TouchableOpacity style={styles.actionButton} onPress={handleDecline} activeOpacity={0.8}>
              <View style={[styles.actionIcon, styles.rejectIcon]}>
                <AppIcon name="call" size={32} color="#fff" fixedColor />
              </View>
              <AppText fixedColor style={styles.actionLabel}>Decline</AppText>
            </TouchableOpacity>

            {/* Answer */}
            <TouchableOpacity style={styles.actionButton} onPress={handleAnswer} activeOpacity={0.8}>
              <View style={[styles.actionIcon, styles.answerIcon]}>
                <AppIcon name={isVideo ? 'videocam' : 'call'} size={32} color="#fff" fixedColor />
              </View>
              <AppText fixedColor style={styles.actionLabel}>Answer</AppText>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center' },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    paddingTop: 110,
    paddingBottom: Platform.OS === 'ios' ? 70 : 50,
    paddingHorizontal: 20,
  },
  callerSection: { alignItems: 'center', gap: 18 },
  avatarRing: {
    padding: 8,
    borderRadius: 80,
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    marginBottom: 10,
    ...SHADOW.glow,
  },
  callerName: { fontSize: 30, fontWeight: '700', color: '#fff', textAlign: 'center' },
  callStatus: { fontSize: 17, color: 'rgba(255, 255, 255, 0.75)', textAlign: 'center' },

  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  actionButton: { alignItems: 'center', gap: 12 },
  actionIcon: {
    width: 70,
    height: 70,
    borderRadius: 35,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOW.button,
  },
  rejectIcon: { backgroundColor: '#e84343', transform: [{ rotate: '135deg' }] },
  answerIcon: { backgroundColor: '#34C759' },
  actionLabel: { fontSize: 16, fontWeight: '600', color: '#fff' },
});
