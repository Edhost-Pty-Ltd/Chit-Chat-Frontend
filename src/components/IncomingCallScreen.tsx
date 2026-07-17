// ─── Component: Incoming Call Screen ─────────────────────────────────────────
// Reusable, self-contained full-screen incoming-call UI styled like a native
// call screen (caller name/avatar, ringing state, Answer / Hang Up buttons).
//
// This renders whenever the app process is alive and an incoming 1-on-1 call
// event/push arrives (foreground OR background), on both iOS and Android.
// It owns its own ringtone + vibration so it can be dropped in anywhere and
// "just ring" — callers must NOT also start the ringtone (avoids double-ring).
//
// Native killed-state call UI (CallKit/PushKit on iOS, CallKeep+ConnectionService
// on Android) is handled separately; this component is the in-app experience.

import React, { useEffect, useRef } from 'react';
import {
  View, StyleSheet, TouchableOpacity, Modal, Platform, Animated, Vibration,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { AppText, AppIcon } from '../context/ThemeContext';
import { Avatar } from '.';
import { useRingtone } from '../hooks/useRingtone';
import { COLORS, SHADOW } from '../types/theme';
import type { IncomingCallData } from '../types/call';

export interface IncomingCallScreenProps {
  /** Whether the incoming-call UI is visible. */
  visible: boolean;
  /** The incoming call to display (caller + type). */
  call: IncomingCallData | null;
  /** Invoked when the user accepts the call. */
  onAnswer: () => void;
  /** Invoked when the user declines/hangs up the call. */
  onDecline: () => void;
  /**
   * When true, this component plays the ringtone + vibration while visible.
   * Set to false if the ringtone is already being driven elsewhere.
   * Defaults to true so the component is self-contained.
   */
  playRingtone?: boolean;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export function IncomingCallScreen({
  visible,
  call,
  onAnswer,
  onDecline,
  playRingtone = true,
}: IncomingCallScreenProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const ringtone = useRingtone();

  // Pulsing halo around the caller avatar while ringing.
  useEffect(() => {
    if (!visible) return;
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.1, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [visible, pulseAnim]);

  // Ringtone + vibration while the call is ringing.
  useEffect(() => {
    if (!visible || !call || !playRingtone) return;

    ringtone.play();
    // Repeating vibration pattern: [wait, vibrate, pause].
    Vibration.vibrate([0, 500, 500], true);

    return () => {
      ringtone.stop();
      Vibration.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, call?.callId, playRingtone]);

  const stopRinging = () => {
    if (!playRingtone) return;
    ringtone.stop();
    Vibration.cancel();
  };

  const handleAnswer = () => {
    stopRinging();
    onAnswer();
  };

  const handleDecline = () => {
    stopRinging();
    onDecline();
  };

  if (!visible || !call) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.overlay}>
        {Platform.OS === 'ios' ? (
          <BlurView intensity={90} style={StyleSheet.absoluteFill} />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(10, 22, 40, 0.95)' }]} />
        )}

        <LinearGradient
          colors={['rgba(10, 22, 40, 0.3)', 'rgba(13, 34, 68, 0.5)', 'rgba(26, 74, 138, 0.3)']}
          style={styles.content}
          start={{ x: 0.3, y: 0 }}
          end={{ x: 0.7, y: 1 }}
        >
          {/* Caller info */}
          <View style={styles.callerSection}>
            <Animated.View style={[styles.avatarContainer, { transform: [{ scale: pulseAnim }] }]}>
              <View style={styles.avatarRing}>
                <Avatar
                  initials={getInitials(call.caller.displayName)}
                  color={COLORS.blue}
                  size={120}
                  imageUrl={call.caller.photoUrl}
                />
              </View>
            </Animated.View>

            <AppText fixedColor style={styles.callerName}>
              {call.caller.displayName}
            </AppText>
            <AppText fixedColor style={styles.callStatus}>
              Incoming {call.type} call...
            </AppText>
          </View>

          {/* Action buttons */}
          <View style={styles.actionsRow}>
            {/* Decline / Hang Up */}
            <TouchableOpacity style={styles.actionButton} onPress={handleDecline} activeOpacity={0.8}>
              <View style={[styles.actionIcon, styles.rejectIcon]}>
                <AppIcon name="call" size={32} color="#fff" fixedColor />
              </View>
              <AppText fixedColor style={styles.actionLabel}>
                Decline
              </AppText>
            </TouchableOpacity>

            {/* Answer */}
            <TouchableOpacity style={styles.actionButton} onPress={handleAnswer} activeOpacity={0.8}>
              <View style={[styles.actionIcon, styles.answerIcon]}>
                <AppIcon name="call" size={32} color="#fff" fixedColor />
              </View>
              <AppText fixedColor style={styles.actionLabel}>
                Accept
              </AppText>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    paddingTop: 100,
    paddingBottom: Platform.OS === 'ios' ? 60 : 40,
    paddingHorizontal: 20,
  },

  callerSection: {
    alignItems: 'center',
    gap: 20,
  },
  avatarContainer: {
    marginBottom: 10,
  },
  avatarRing: {
    padding: 8,
    borderRadius: 80,
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    ...SHADOW.glow,
  },
  callerName: {
    fontSize: 32,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
  },
  callStatus: {
    fontSize: 18,
    color: 'rgba(255, 255, 255, 0.75)',
    textAlign: 'center',
  },

  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  actionButton: {
    alignItems: 'center',
    gap: 12,
  },
  actionIcon: {
    width: 70,
    height: 70,
    borderRadius: 35,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOW.button,
  },
  rejectIcon: {
    backgroundColor: '#e84343',
    transform: [{ rotate: '135deg' }],
  },
  answerIcon: {
    backgroundColor: '#34C759',
  },
  actionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
