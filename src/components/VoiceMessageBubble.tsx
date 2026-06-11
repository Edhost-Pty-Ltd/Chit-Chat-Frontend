// ─── VoiceMessageBubble ──────────────────────────────────────────────────────
// Renders a voice note message with play/pause controls, animated waveform
// progress, and duration display. Styles match existing bubble patterns from
// ChatScreen (gradient for incoming, glass for outgoing).

import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, GRADIENTS, SHADOW, RADIUS } from '../types/theme';
import type { PlaybackState } from '../hooks/useVoicePlayer';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface VoiceMessageBubbleProps {
  messageId: string;
  voiceUrl: string;
  durationMs: number;
  isOutgoing: boolean;
  playerState: PlaybackState;
  onPlay: () => void;
  onPause: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Simple deterministic hash from a string to generate waveform bar heights */
function hashSeed(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/** Generate 20 deterministic bar heights (4–18px) seeded from messageId */
function generateBarHeights(messageId: string): number[] {
  const seed = hashSeed(messageId);
  const bars: number[] = [];
  for (let i = 0; i < 20; i++) {
    // Use a simple pseudo-random based on seed + index
    const val = Math.abs(Math.sin(seed * (i + 1) * 0.1)) * 14 + 4;
    bars.push(val);
  }
  return bars;
}

/** Format milliseconds to MM:SS */
function formatMmSs(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function VoiceMessageBubble({
  messageId,
  voiceUrl: _voiceUrl,
  durationMs,
  isOutgoing,
  playerState,
  onPlay,
  onPause,
}: VoiceMessageBubbleProps) {
  const isActiveMessage = playerState.activeMessageId === messageId;
  const status = isActiveMessage ? playerState.status : 'idle';
  const positionMs = isActiveMessage ? playerState.positionMs : 0;

  const barHeights = React.useMemo(() => generateBarHeights(messageId), [messageId]);

  // Progress ratio for waveform fill
  const effectiveDuration = isActiveMessage && playerState.durationMs > 0
    ? playerState.durationMs
    : durationMs;
  const progress = status === 'playing' || status === 'paused'
    ? Math.min(positionMs / effectiveDuration, 1)
    : 0;

  // Number of bars that should be filled
  const filledBars = Math.floor(progress * 20);

  // Duration display
  const displayTime = (status === 'playing' || status === 'paused')
    ? formatMmSs(effectiveDuration - positionMs)
    : formatMmSs(durationMs);

  // ── Color tokens based on direction ─────────────────────────────────────
  const barDefaultColor = isOutgoing
    ? 'rgba(26,40,64,0.25)'
    : 'rgba(255,255,255,0.40)';
  const barFilledColor = isOutgoing
    ? COLORS.blue
    : '#ffffff';
  const durationColor = isOutgoing
    ? COLORS.sub
    : 'rgba(255,255,255,0.80)';
  const iconColor = isOutgoing ? COLORS.blue : '#ffffff';
  const playBtnBg = isOutgoing
    ? 'rgba(30,156,240,0.15)'
    : 'rgba(255,255,255,0.25)';

  // ── Error state ─────────────────────────────────────────────────────────
  if (status === 'error') {
    const content = (
      <View style={styles.errorContainer}>
        <TouchableOpacity style={[styles.playBtn, { backgroundColor: playBtnBg }]} onPress={onPlay}>
          <Ionicons name="refresh" size={16} color={iconColor} />
        </TouchableOpacity>
        <Text style={[styles.errorText, { color: durationColor }]}>
          Voice note unavailable
        </Text>
      </View>
    );

    if (isOutgoing) {
      return <View style={[styles.bubble, styles.bubbleOut]}>{content}</View>;
    }
    return (
      <LinearGradient colors={GRADIENTS.chatSent} style={[styles.bubble, styles.bubbleIn]}>
        {content}
      </LinearGradient>
    );
  }

  // ── Main voice content ──────────────────────────────────────────────────
  const voiceContent = (
    <View style={styles.voiceRow}>
      {/* Play / Pause / Loading button */}
      {status === 'loading' ? (
        <View style={[styles.playBtn, { backgroundColor: playBtnBg }]}>
          <ActivityIndicator size="small" color={iconColor} />
        </View>
      ) : (
        <TouchableOpacity
          style={[styles.playBtn, { backgroundColor: playBtnBg }]}
          onPress={status === 'playing' ? onPause : onPlay}
          activeOpacity={0.7}
        >
          <Ionicons
            name={status === 'playing' ? 'pause' : 'play'}
            size={14}
            color={iconColor}
          />
        </TouchableOpacity>
      )}

      {/* Waveform bars */}
      <View style={styles.waveform}>
        {barHeights.map((height, i) => (
          <View
            key={i}
            style={[
              styles.waveBar,
              {
                height,
                backgroundColor: i < filledBars ? barFilledColor : barDefaultColor,
              },
            ]}
          />
        ))}
      </View>

      {/* Duration label */}
      <Text style={[styles.duration, { color: durationColor }]}>
        {displayTime}
      </Text>
    </View>
  );

  // ── Bubble wrapper ──────────────────────────────────────────────────────
  if (isOutgoing) {
    return <View style={[styles.bubble, styles.bubbleOut]}>{voiceContent}</View>;
  }

  return (
    <LinearGradient colors={GRADIENTS.chatSent} style={[styles.bubble, styles.bubbleIn]}>
      {voiceContent}
    </LinearGradient>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  bubble: {
    maxWidth: '75%',
    borderRadius: RADIUS.lg,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleIn: {
    borderBottomLeftRadius: 4,
    ...SHADOW.card,
  },
  bubbleOut: {
    backgroundColor: 'rgba(255,255,255,0.28)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.50)',
    borderBottomRightRadius: 4,
    ...SHADOW.card,
  },
  voiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 2,
  },
  playBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  waveform: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    height: 24,
  },
  waveBar: {
    width: 3,
    borderRadius: 2,
  },
  duration: {
    fontSize: 11,
    fontWeight: '500',
    minWidth: 32,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 2,
  },
  errorText: {
    fontSize: 12,
    fontWeight: '500',
  },
});
