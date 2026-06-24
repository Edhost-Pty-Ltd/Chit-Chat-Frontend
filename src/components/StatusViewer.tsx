// ─── Component: Status Viewer ────────────────────────────────────────────────
// Full-screen story-style viewer. Images advance after 7s, videos play to end
// (≤30s). Tap right to skip forward, left to go back. Segmented progress bars.

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, StyleSheet, Image, Dimensions, Animated, Platform,
  TouchableOpacity, Pressable, ActivityIndicator,
} from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEventListener } from 'expo';
import { AppText, AppIcon } from '../context/ThemeContext';
import { StatusItem } from '../hooks/useStatus';

const { width, height } = Dimensions.get('window');

interface Props {
  items: StatusItem[];
  title: string;
  subtitle?: string;
  onClose: () => void;
  onViewed: (statusId: string) => void;
  onDelete?: (statusId: string) => void;
  canDelete?: boolean;
}

export function StatusViewer({
  items, title, subtitle, onClose, onViewed, onDelete, canDelete,
}: Props) {
  const [index, setIndex] = useState(0);
  const progress = useRef(new Animated.Value(0)).current;
  const animRef = useRef<Animated.CompositeAnimation | null>(null);
  const progressValueRef = useRef(0);

  const current = items[index];
  const isVideo = current?.type === 'video';

  // Video player (used only for video items)
  const player = useVideoPlayer(null, (p) => {
    p.loop = false;
    p.timeUpdateEventInterval = 0.2;
  });

  // Track the animated progress value for pause/resume of images
  useEffect(() => {
    const id = progress.addListener(({ value }) => { progressValueRef.current = value; });
    return () => progress.removeListener(id);
  }, [progress]);

  const goNext = useCallback(() => {
    setIndex((i) => {
      if (i < items.length - 1) return i + 1;
      onClose();
      return i;
    });
  }, [items.length, onClose]);

  const goPrev = useCallback(() => {
    setIndex((i) => (i > 0 ? i - 1 : i));
  }, []);

  // Mark the current item viewed
  useEffect(() => {
    if (current) onViewed(current.statusId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.statusId]);

  // Drive playback / timing for the current item
  useEffect(() => {
    if (!current) return;
    progress.setValue(0);
    progressValueRef.current = 0;
    if (animRef.current) { animRef.current.stop(); animRef.current = null; }

    if (current.type === 'image') {
      const anim = Animated.timing(progress, {
        toValue: 1,
        duration: current.durationMs,
        useNativeDriver: false,
      });
      animRef.current = anim;
      anim.start(({ finished }) => { if (finished) goNext(); });
      return () => anim.stop();
    }

    // Video: load and play; progress + advance handled by event listeners
    let cancelled = false;
    (async () => {
      try {
        await player.replaceAsync(current.mediaUrl);
        if (!cancelled) player.play();
      } catch (e) {
        console.warn('[StatusViewer] video load failed:', e);
        if (!cancelled) goNext();
      }
    })();
    return () => {
      cancelled = true;
      try { player.pause(); } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.statusId]);

  // Video progress
  useEventListener(player, 'timeUpdate', (payload: { currentTime: number }) => {
    if (!isVideo) return;
    const dur = player.duration && player.duration > 0
      ? player.duration
      : (current?.durationMs ?? 30000) / 1000;
    if (dur > 0) progress.setValue(Math.min(payload.currentTime / dur, 1));
  });
  useEventListener(player, 'playToEnd', () => { if (isVideo) goNext(); });

  // Pause / resume on press-and-hold
  const pause = () => {
    if (isVideo) { try { player.pause(); } catch {} }
    else if (animRef.current) animRef.current.stop();
  };
  const resume = () => {
    if (isVideo) { try { player.play(); } catch {} }
    else if (current?.type === 'image') {
      const remaining = current.durationMs * (1 - progressValueRef.current);
      const anim = Animated.timing(progress, {
        toValue: 1,
        duration: Math.max(remaining, 0),
        useNativeDriver: false,
      });
      animRef.current = anim;
      anim.start(({ finished }) => { if (finished) goNext(); });
    }
  };

  if (!current) return null;

  return (
    <View style={styles.root}>
      {/* Media */}
      {current.type === 'image' ? (
        <Image source={{ uri: current.mediaUrl }} style={styles.media} resizeMode="contain" />
      ) : (
        <VideoView
          player={player}
          style={styles.media}
          contentFit="contain"
          nativeControls={false}
        />
      )}

      {/* Tap zones: left = back, right = forward; hold to pause */}
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        <View style={styles.tapRow}>
          <Pressable style={styles.tapZone} onPress={goPrev} onLongPress={pause} onPressOut={resume} delayLongPress={150} />
          <Pressable style={styles.tapZone} onPress={goNext} onLongPress={pause} onPressOut={resume} delayLongPress={150} />
        </View>
      </View>

      {/* Top: progress segments + header */}
      <View style={styles.topOverlay} pointerEvents="box-none">
        <View style={styles.segments}>
          {items.map((it, i) => (
            <View key={it.statusId} style={styles.segmentTrack}>
              <Animated.View
                style={[
                  styles.segmentFill,
                  i < index
                    ? { width: '100%' }
                    : i === index
                    ? { width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }
                    : { width: '0%' },
                ]}
              />
            </View>
          ))}
        </View>

        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <AppText fixedColor style={styles.headerTitle} numberOfLines={1}>{title}</AppText>
            {!!subtitle && <AppText fixedColor style={styles.headerSub}>{subtitle}</AppText>}
          </View>
          {canDelete && onDelete && (
            <TouchableOpacity style={styles.headerBtn} onPress={() => onDelete(current.statusId)}>
              <AppIcon name="trash-outline" size={22} color="#fff" fixedColor />
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.headerBtn} onPress={onClose}>
            <AppIcon name="close" size={26} color="#fff" fixedColor />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, backgroundColor: '#000', zIndex: 10000 },
  media: { ...StyleSheet.absoluteFillObject, width, height },
  tapRow: { flex: 1, flexDirection: 'row' },
  tapZone: { flex: 1 },

  topOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0,
    paddingTop: Platform.OS === 'ios' ? 52 : 36,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(0,0,0,0.25)',
    paddingBottom: 8,
  },
  segments: { flexDirection: 'row', gap: 4, marginBottom: 10 },
  segmentTrack: {
    flex: 1, height: 3, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.35)', overflow: 'hidden',
  },
  segmentFill: { height: 3, backgroundColor: '#fff', borderRadius: 2 },

  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4 },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#fff' },
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 1 },
  headerBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
});
