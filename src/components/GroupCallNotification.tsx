// ─── Component: Group Call Notification ─────────────────────────────────────
// Displays incoming group call invitation as a banner/modal

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS, SHADOW } from '../types/theme';
import { GroupCallNotification as GroupCallNotificationType } from '../hooks/useGroupCallNotifications';

const { width } = Dimensions.get('window');

interface GroupCallNotificationProps {
  notification: GroupCallNotificationType;
  memberCount?: number;
  onJoin: () => void;
  onDismiss: () => void;
}

export default function GroupCallNotification({
  notification,
  memberCount = 2,
  onJoin,
  onDismiss,
}: GroupCallNotificationProps) {
  const callTypeIcon = notification.callType === 'video' ? 'videocam' : 'call';
  const callTypeLabel = notification.callType === 'video' ? 'Video Call' : 'Voice Call';
  // Only label as "Group" when there are more than 2 participants.
  const isGroup = memberCount > 2;
  const callTypeText = isGroup ? `Group ${callTypeLabel}` : callTypeLabel;

  return (
    <Modal
      transparent
      visible={true}
      animationType="slide"
      onRequestClose={onDismiss}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Call Type Icon */}
          <View style={styles.iconContainer}>
            <Ionicons name={callTypeIcon} size={40} color={COLORS.blue} />
          </View>

          {/* Call Info */}
          <Text style={styles.title}>Incoming {callTypeText}</Text>
          <Text style={styles.subtitle}>
            {isGroup
              ? `${notification.initiatorName} started a group call`
              : `${notification.initiatorName} is calling you`}
          </Text>

          {/* Action Buttons */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.dismissButton]}
              onPress={onDismiss}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={24} color="#fff" />
              <Text style={styles.buttonText}>Dismiss</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.joinButton]}
              onPress={onJoin}
              activeOpacity={0.7}
            >
              <Ionicons name="checkmark" size={24} color="#fff" />
              <Text style={styles.buttonText}>Join</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    width: width - 40,
    maxWidth: 400,
    backgroundColor: 'rgba(180, 225, 245, 0.28)',
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.45)',
    padding: 24,
    alignItems: 'center',
    ...SHADOW.card,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(30, 156, 240, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.50)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    ...SHADOW.glow,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    fontWeight: '400',
    color: 'rgba(255, 255, 255, 0.75)',
    marginBottom: 24,
    textAlign: 'center',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: RADIUS.lg,
    ...SHADOW.button,
  },
  dismissButton: {
    backgroundColor: 'rgba(220, 38, 38, 0.85)',
  },
  joinButton: {
    backgroundColor: COLORS.blue,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
