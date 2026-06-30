// ─── TypingIndicator ─────────────────────────────────────────────────────────
// WhatsApp-style "someone is typing" bubble with three bouncing dots.
// Appears left-aligned (incoming side) at the bottom of the message list.

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GRADIENTS, RADIUS, SHADOW } from '../types/theme';

interface TypingIndicatorProps {
  names: string[];   // display names of users currently typing
}

const DOT_SIZE    = 8;
const BOUNCE_UP   = -6;   // how far the dot travels upward (px)
const DURATION_MS = 500;  // one bounce cycle duration
const STAGGER_MS  = 150;  // delay between each dot

export function TypingIndicator({ names }: TypingIndicatorProps) {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const makeBounce = (val: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(val, {
            toValue: BOUNCE_UP,
            duration: DURATION_MS / 2,
            useNativeDriver: true,
          }),
          Animated.timing(val, {
            toValue: 0,
            duration: DURATION_MS / 2,
            useNativeDriver: true,
          }),
          // pause before the next loop so the whole cycle feels natural
          Animated.delay(STAGGER_MS * (3 - 1)),
        ]),
      );

    const anim = Animated.parallel([
      makeBounce(dot1, 0),
      makeBounce(dot2, STAGGER_MS),
      makeBounce(dot3, STAGGER_MS * 2),
    ]);

    anim.start();
    return () => anim.stop();
  }, [dot1, dot2, dot3]);

  // Label: "Alice is typing…"  /  "Alice & Bob are typing…"
  const label = buildLabel(names);

  return (
    <View style={styles.wrapper}>
      <LinearGradient colors={GRADIENTS.chatSent} style={styles.bubble}>
        {/* Three bouncing dots */}
        <View style={styles.dotsRow}>
          {[dot1, dot2, dot3].map((anim, i) => (
            <Animated.View
              key={i}
              style={[
                styles.dot,
                { transform: [{ translateY: anim }] },
              ]}
            />
          ))}
        </View>
      </LinearGradient>

      {/* Name label below bubble */}
      {label ? (
        <Text style={styles.label}>{label}</Text>
      ) : null}
    </View>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildLabel(names: string[]): string {
  if (names.length === 0) return '';
  if (names.length === 1) return `${names[0]} is typing…`;
  if (names.length === 2) return `${names[0]} & ${names[1]} are typing…`;
  return 'Several people are typing…';
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrapper: {
    alignSelf: 'flex-start',
    marginLeft: 12,
    marginBottom: 8,
    alignItems: 'flex-start',
  },
  bubble: {
    borderRadius: RADIUS.lg,
    borderBottomLeftRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    ...SHADOW.card,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 5,
    height: DOT_SIZE + Math.abs(BOUNCE_UP),
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    backgroundColor: 'rgba(255,255,255,0.90)',
  },
  label: {
    marginTop: 4,
    marginLeft: 4,
    fontSize: 11,
    color: 'rgba(255,255,255,0.65)',
  },
});
