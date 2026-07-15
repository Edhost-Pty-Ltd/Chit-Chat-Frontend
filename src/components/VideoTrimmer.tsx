// ─── Component: VideoTrimmer ──────────────────────────────────────────────────
// Modal for trimming videos before posting to status.
// Provides a timeline scrubber with start/end handles to trim videos to max 30s.

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useVideoPlayer, VideoView } from 'expo-video';
import Slider from '@react-native-community/slider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, RADIUS, SHADOW } from '../types/theme';
import { AppBg, AppText, AppIcon, useForeground, useGlass } from '../context/ThemeContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const TIMELINE_WIDTH = SCREEN_WIDTH - 64;

interface VideoTrimmerProps {
  visible: boolean;
  videoUri: string;
  videoDuration: number; // in milliseconds
  onClose: () => void;
  onTrim: (startMs: number, endMs: number) => void;
}

export function VideoTrimmer({
  visible,
  videoUri,
  videoDuration,
  onClose,
  onTrim,
}: VideoTrimmerProps) {
  const MAX_DURATION_MS = 30000; // 30 seconds max for status videos
  
  // Trim range in milliseconds
  const [startMs, setStartMs] = useState(0);
  const [endMs, setEndMs] = useState(Math.min(videoDuration, MAX_DURATION_MS));
  const [currentMs, setCurrentMs] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [processing, setProcessing] = useState(false);

  const { FG } = useForeground();
  const { bevel } = useGlass();
  const insets = useSafeAreaInsets();

  // Video player for preview
  const player = useVideoPlayer(videoUri, (p) => {
    p.loop = false;
    p.volume = 1;
  });

  // Update current time as video plays
  useEffect(() => {
    if (!visible) return;

    const interval = setInterval(() => {
      if (player && isPlaying) {
        const currentTime = player.currentTime * 1000; // Convert to ms
        setCurrentMs(currentTime);

        // Loop within trim range
        if (currentTime >= endMs) {
          player.currentTime = startMs / 1000;
          setCurrentMs(startMs);
        }
      }
    }, 100);

    return () => clearInterval(interval);
  }, [visible, isPlaying, startMs, endMs, player]);

  // Reset when modal opens
  useEffect(() => {
    if (visible) {
      const maxEnd = Math.min(videoDuration, MAX_DURATION_MS);
      setStartMs(0);
      setEndMs(maxEnd);
      setCurrentMs(0);
      setIsPlaying(false);
      if (player) {
        player.currentTime = 0;
        player.pause();
      }
    }
  }, [visible, videoUri, videoDuration]);

  const handlePlayPause = () => {
    if (isPlaying) {
      player.pause();
      setIsPlaying(false);
    } else {
      // Start from trim start position
      if (currentMs < startMs || currentMs >= endMs) {
        player.currentTime = startMs / 1000;
        setCurrentMs(startMs);
      }
      player.play();
      setIsPlaying(true);
    }
  };

  const handleStartChange = (value: number) => {
    const newStart = Math.floor(value);
    // Ensure at least 1 second duration
    if (endMs - newStart >= 1000) {
      setStartMs(newStart);
      if (currentMs < newStart) {
        player.currentTime = newStart / 1000;
        setCurrentMs(newStart);
      }
    }
  };

  const handleEndChange = (value: number) => {
    const newEnd = Math.floor(value);
    // Ensure at least 1 second duration and max 30s
    const maxEnd = Math.min(startMs + MAX_DURATION_MS, videoDuration);
    const clampedEnd = Math.min(newEnd, maxEnd);
    
    if (clampedEnd - startMs >= 1000) {
      setEndMs(clampedEnd);
      if (currentMs >= clampedEnd) {
        player.currentTime = startMs / 1000;
        setCurrentMs(startMs);
      }
    }
  };

  const handleTrim = () => {
    if (endMs - startMs > MAX_DURATION_MS) {
      Alert.alert('Too long', `Status videos must be ${MAX_DURATION_MS / 1000}s or less`);
      return;
    }

    setProcessing(true);
    player.pause();
    setIsPlaying(false);

    // Pass trim times to parent
    onTrim(startMs, endMs);
    
    setProcessing(false);
  };

  const handleClose = () => {
    player.pause();
    setIsPlaying(false);
    onClose();
  };

  const formatTime = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const trimDuration = endMs - startMs;
  const isValidTrim = trimDuration >= 1000 && trimDuration <= MAX_DURATION_MS;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <View style={styles.root}>
        <AppBg />

        {/* Header */}
        <View style={[styles.header, { borderBottomColor: FG.glassBorder }]}>
          <TouchableOpacity onPress={handleClose} style={styles.iconPad}>
            <AppIcon name="close" size={26} color={COLORS.sub} />
          </TouchableOpacity>
          <AppText style={styles.headerTitle}>Trim Video</AppText>
          <TouchableOpacity
            onPress={handleTrim}
            disabled={!isValidTrim || processing}
            style={styles.iconPad}
          >
            {processing ? (
              <ActivityIndicator size="small" color={COLORS.blue} />
            ) : (
              <AppIcon
                name="checkmark"
                size={26}
                color={isValidTrim ? COLORS.blue : COLORS.sub}
              />
            )}
          </TouchableOpacity>
        </View>

        {/* Video Preview */}
        <View style={styles.videoContainer}>
          <VideoView
            player={player}
            style={styles.video}
            contentFit="contain"
            nativeControls={false}
          />

          {/* Play/Pause Overlay */}
          <View
            style={styles.playOverlay}
            pointerEvents="box-none"
          >
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={handlePlayPause}
            >
              <LinearGradient
                colors={['rgba(0,0,0,0.3)', 'rgba(0,0,0,0.5)']}
                style={styles.playButton}
              >
                <AppIcon
                  name={isPlaying ? 'pause' : 'play'}
                  size={48}
                  color="#ffffff"
                  fixedColor
                />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>

        {/* Timeline & Trim Controls */}
        <View style={[styles.trimSection, bevel, { paddingBottom: Math.max(insets.bottom, 20) + 20 }]}>
          <View style={styles.durationInfo}>
            <AppText style={styles.durationLabel}>Selected Duration</AppText>
            <AppText style={[styles.durationValue, {
              color: trimDuration > MAX_DURATION_MS ? COLORS.error : COLORS.blue
            }]}>
              {formatTime(trimDuration)}
              {trimDuration > MAX_DURATION_MS && ' (Too long)'}
            </AppText>
          </View>

          {/* Timeline scrubber */}
          <View style={styles.timelineContainer}>
            <View style={styles.timelineTrack}>
              {/* Selected range indicator */}
              <View
                style={[
                  styles.selectedRange,
                  {
                    left: (startMs / videoDuration) * TIMELINE_WIDTH,
                    width: ((endMs - startMs) / videoDuration) * TIMELINE_WIDTH,
                    backgroundColor: trimDuration > MAX_DURATION_MS ? COLORS.error : COLORS.blue,
                  },
                ]}
              />

              {/* Current playhead */}
              {currentMs >= startMs && currentMs <= endMs && (
                <View
                  style={[
                    styles.playhead,
                    {
                      left: (currentMs / videoDuration) * TIMELINE_WIDTH,
                    },
                  ]}
                />
              )}
            </View>

            {/* Time labels */}
            <View style={styles.timeLabels}>
              <AppText style={styles.timeLabel}>{formatTime(startMs)}</AppText>
              <AppText style={styles.timeLabel}>{formatTime(endMs)}</AppText>
            </View>
          </View>

          {/* Start handle */}
          <View style={styles.sliderRow}>
            <AppIcon name="arrow-forward" size={20} color={COLORS.blue} fixedColor />
            <AppText style={styles.sliderLabel}>Start</AppText>
            <Slider
              style={styles.slider}
              minimumValue={0}
              maximumValue={videoDuration}
              value={startMs}
              onValueChange={handleStartChange}
              minimumTrackTintColor={COLORS.blue}
              maximumTrackTintColor={COLORS.sub}
              thumbTintColor={COLORS.blue}
              step={100}
            />
            <AppText style={styles.sliderValue}>{formatTime(startMs)}</AppText>
          </View>

          {/* End handle */}
          <View style={styles.sliderRow}>
            <AppIcon name="arrow-back" size={20} color={COLORS.blue} fixedColor />
            <AppText style={styles.sliderLabel}>End</AppText>
            <Slider
              style={styles.slider}
              minimumValue={startMs + 1000}
              maximumValue={videoDuration}
              value={endMs}
              onValueChange={handleEndChange}
              minimumTrackTintColor={COLORS.blue}
              maximumTrackTintColor={COLORS.sub}
              thumbTintColor={COLORS.blue}
              step={100}
            />
            <AppText style={styles.sliderValue}>{formatTime(endMs)}</AppText>
          </View>

          {/* Info box */}
          <View style={styles.infoBox}>
            <AppIcon name="information-circle-outline" size={18} color={COLORS.sub} />
            <AppText style={styles.infoText}>
              Status videos can be up to 30 seconds long
            </AppText>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 50 : 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  iconPad: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoContainer: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  playOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOW.card,
  },
  trimSection: {
    padding: 20,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
  },
  durationInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  durationLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.sub,
  },
  durationValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  timelineContainer: {
    marginBottom: 24,
  },
  timelineTrack: {
    height: 6,
    backgroundColor: COLORS.sky4,
    borderRadius: 3,
    position: 'relative',
    width: TIMELINE_WIDTH,
    alignSelf: 'center',
  },
  selectedRange: {
    position: 'absolute',
    height: 6,
    borderRadius: 3,
    opacity: 0.7,
  },
  playhead: {
    position: 'absolute',
    width: 3,
    height: 12,
    backgroundColor: '#ffffff',
    borderRadius: 1.5,
    top: -3,
    ...SHADOW.card,
  },
  timeLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    width: TIMELINE_WIDTH,
    alignSelf: 'center',
  },
  timeLabel: {
    fontSize: 11,
    color: COLORS.sub,
    fontWeight: '600',
  },
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  sliderLabel: {
    fontSize: 13,
    fontWeight: '600',
    width: 40,
  },
  slider: {
    flex: 1,
    height: 40,
  },
  sliderValue: {
    fontSize: 13,
    fontWeight: '600',
    width: 50,
    textAlign: 'right',
    color: COLORS.blue,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: 'rgba(100, 150, 255, 0.1)',
    borderRadius: RADIUS.md,
    marginTop: 8,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    color: COLORS.sub,
  },
});
