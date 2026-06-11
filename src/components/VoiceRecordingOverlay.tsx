// ─── VoiceRecordingOverlay ────────────────────────────────────────────────────
// Renders over the input bar during recording. Shows a pulsing red dot,
// elapsed time in MM:SS, and a "Slide to cancel" hint. Transitions to a warning
// state at ≥110s and displays a max-duration message at 120s.

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS } from '../types/theme';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface VoiceRecordingOverlayProps {
  durationMs: number;
  isWarning: boolean;
  onCancel: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Format milliseconds to MM:SS */
function formatMmSs(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function VoiceRecordingOverlay({
  durationMs,
  isWarning,
  onCancel: _onCancel,
}: VoiceRecordingOverlayProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const chevronAnim = useRef(new Animated.Value(0)).current;

  const isMaxReached = durationMs >= 120000;

  // Pulsing red dot animation
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.3,
          duration: 600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim]);

  // Chevron sliding animation
  useEffect(() => {
    const slide = Animated.loop(
      Animated.sequence([
        Animated.timing(chevronAnim, {
          toValue: -8,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(chevronAnim, {
          toValue: 0,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    slide.start();
    return () => slide.stop();
  }, [chevronAnim]);

  // ── Colors based on warning state ───────────────────────────────────────
  const backgroundColor = isWarning
    ? 'rgba(245,158,11,0.18)'
    : 'rgba(160,215,240,0.35)';
  const dotColor = isWarning ? COLORS.amber : COLORS.missed;
  const textColor = isWarning ? COLORS.amber : COLORS.white;
  const hintColor = isWarning ? COLORS.amber : 'rgba(255,255,255,0.70)';

  return (
    <View style={[styles.overlay, { backgroundColor }]}>
      {isMaxReached ? (
        // Maximum duration reached notification
        <View style={styles.maxReachedContainer}>
          <Ionicons name="time-outline" size={16} color={textColor} />
          <Text style={[styles.maxReachedText, { color: textColor }]}>
            Maximum duration reached
          </Text>
        </View>
      ) : (
        <>
          {/* Left: Pulsing dot + elapsed time */}
          <View style={styles.leftSection}>
            <Animated.View
              style={[
                styles.dot,
                { backgroundColor: dotColor, opacity: pulseAnim },
              ]}
            />
            <Text style={[styles.timer, { color: textColor }]}>
              {formatMmSs(durationMs)}
            </Text>
          </View>

          {/* Right: Slide to cancel hint */}
          <View style={styles.rightSection}>
            <Animated.View style={{ transform: [{ translateX: chevronAnim }] }}>
              <Ionicons name="chevron-back" size={16} color={hintColor} />
            </Animated.View>
            <Text style={[styles.hintText, { color: hintColor }]}>
              Slide to cancel
            </Text>
          </View>
        </>
      )}
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 52,
    borderRadius: RADIUS.md,
    paddingHorizontal: 16,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  timer: {
    fontSize: 16,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  hintText: {
    fontSize: 13,
    fontWeight: '500',
  },
  maxReachedContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  maxReachedText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
