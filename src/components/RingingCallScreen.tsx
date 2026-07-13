// ─── Component: Ringing Call Screen ──────────────────────────────────────────
// Animated outgoing call screen shown while waiting for receiver to answer

import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AppText, AppIcon, useTypography } from '../context/ThemeContext';
import { Avatar } from './index';
import { COLORS } from '../types/theme';
import type { CallParticipant } from '../types/call';

interface RingingCallScreenProps {
  otherParty: CallParticipant;
  callType: 'audio' | 'video';
  /** Optional override for avatar initials (e.g. from signup username when contact is unsaved) */
  initials?: string;
  onEndCall: () => void;
}

export function RingingCallScreen({ otherParty, callType, initials, onEndCall }: RingingCallScreenProps) {
  const { fontFamily } = useTypography();

  // Animated values for pulsing rings
  const pulse1 = useRef(new Animated.Value(0)).current;
  const pulse2 = useRef(new Animated.Value(0)).current;
  const pulse3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Create pulsing animation for rings
    const createPulse = (animValue: Animated.Value, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(animValue, {
            toValue: 1,
            duration: 2000,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(animValue, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ])
      );
    };

    const animations = Animated.parallel([
      createPulse(pulse1, 0),
      createPulse(pulse2, 400),
      createPulse(pulse3, 800),
    ]);

    animations.start();

    return () => {
      animations.stop();
    };
  }, []);

  const getInitials = (name: string) => {
    if (!name || !name.trim()) return '?';
    
    const parts = name.trim().split(/\s+/).filter(Boolean);
    
    if (parts.length >= 2) {
      const first = parts[0][0];
      const last = parts[parts.length - 1][0];
      if (/[a-zA-Z]/.test(first) && /[a-zA-Z]/.test(last)) {
        return (first + last).toUpperCase();
      }
    }
    if (parts.length === 1) {
      const first = parts[0][0];
      if (/[a-zA-Z]/.test(first)) {
        return first.toUpperCase();
      }
    }
    
    const match = name.match(/[a-zA-Z]/);
    if (match) return match[0].toUpperCase();
    
    const digits = name.replace(/\D/g, '');
    if (digits.length >= 2) return digits.slice(-2);
    if (digits.length === 1) return digits;
    
    return '?';
  };

  // Use the explicit initials prop if provided (and not '?'), otherwise derive from displayName
  const avatarInitials = (initials && initials !== '?') ? initials : getInitials(otherParty.displayName);

  return (
    <LinearGradient
      colors={['rgba(10,22,40,0.98)', 'rgba(13,34,68,0.98)', 'rgba(26,74,138,0.98)']}
      style={styles.container}
    >
      {/* Pulsing rings */}
      <View style={styles.ringContainer}>
        {[pulse1, pulse2, pulse3].map((pulse, index) => (
          <Animated.View
            key={index}
            style={[
              styles.ring,
              {
                opacity: pulse.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.6, 0],
                }),
                transform: [
                  {
                    scale: pulse.interpolate({
                      inputRange: [0, 1],
                      outputRange: [1, 2],
                    }),
                  },
                ],
              },
            ]}
          />
        ))}

        {/* Avatar */}
        <View style={styles.avatarContainer}>
          <Avatar
            imageUrl={otherParty.photoUrl}
            initials={avatarInitials}
            color={COLORS.blue}
            size={120}
          />
        </View>
      </View>

      {/* Caller info */}
      <View style={styles.info}>
        <AppText fixedColor style={[styles.name, { fontFamily }]}>
          {otherParty.displayName}
        </AppText>
        <AppText fixedColor style={[styles.status, { fontFamily }]}>
          {callType === 'video' ? 'Video calling...' : 'Calling...'}
        </AppText>
      </View>

      {/* End call button */}
      <View style={styles.actions}>
        <View style={styles.endCallButton} onTouchEnd={onEndCall}>
          <LinearGradient colors={['#E74C3C', '#C0392B']} style={styles.endCallGradient}>
            <AppIcon name="call" size={28} color="#FFFFFF" fixedColor />
          </LinearGradient>
          <AppText fixedColor style={[styles.actionLabel, { fontFamily }]}>
            End Call
          </AppText>
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 80,
  },
  ringContainer: {
    width: 240,
    height: 240,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 40,
  },
  ring: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
    borderWidth: 2,
    borderColor: COLORS.blue,
  },
  avatarContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    overflow: 'hidden',
  },
  info: {
    alignItems: 'center',
    gap: 8,
  },
  name: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  status: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 40,
  },
  endCallButton: {
    alignItems: 'center',
    gap: 8,
  },
  endCallGradient: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    transform: [{ rotate: '135deg' }],
  },
  actionLabel: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
  },
});
