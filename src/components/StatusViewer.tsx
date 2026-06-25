// ─── Component: StatusViewer ──────────────────────────────────────────────────
// Full-screen WhatsApp-style story viewer with progress bars, tap navigation,
// video playback support, and auto-advance timer.

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Pressable,
  ActivityIndicator,
  StatusBar,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEvent } from 'expo';
import type { FireStatus } from '../types';
import { COLORS, SHADOW } from '../types/theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface StatusViewerProps {
  visible: boolean;
  onClose: () => void;
  statuses: FireStatus[];
  initialIndex?: number;
  currentUserId: string;
  onStatusViewed: (statusId: string) => void;
  onDeleteStatus?: (statusId: string) => void;
}

// ─── Helper Functions ─────────────────────────────────────────────────────────

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

// ─── Component ────────────────────────────────────────────────────────────────

export function StatusViewer({
  visible,
  onClose,
  statuses,
  initialIndex = 0,
  currentUserId,
  onStatusViewed,
  onDeleteStatus,
}: StatusViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isPaused, setIsPaused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showOptions, setShowOptions] = useState(false);

  const progress = useRef(new Animated.Value(0)).current;
  const animRef = useRef<Animated.CompositeAnimation | null>(null);
  const progressValueRef = useRef(0);

  const currentStatus = statuses[currentIndex];
  const isOwner = currentStatus?.userId === currentUserId;
  const isExcluded = currentStatus?.excludedUsers?.includes(currentUserId) || false;
  const viewCount = currentStatus?.viewedBy?.length || 0;
  const isVideo = currentStatus?.mediaType === 'video';
  const isImage = currentStatus?.mediaType === 'image';
  const isText = currentStatus?.mediaType === 'text';

  const DURATION = currentStatus?.durationMs || (isVideo ? 15000 : isText ? 5000 : 5000);

  // Video player for video statuses
  const player = useVideoPlayer(
    isVideo && currentStatus?.mediaUrl ? currentStatus.mediaUrl : null,
    (p) => {
      p.loop = false;
      p.timeUpdateEventInterval = 0.2;
    }
  );

  // Track animated progress value
  useEffect(() => {
    const id = progress.addListener(({ value }) => {
      progressValueRef.current = value;
    });
    return () => progress.removeListener(id);
  }, [progress]);

  // ── Navigation handlers ─────────────────────────────────────────────────────
  const goNext = useCallback(() => {
    if (currentIndex < statuses.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      onClose();
    }
  }, [currentIndex, statuses.length, onClose]);

  const goPrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  }, [currentIndex]);

  const pause = useCallback(() => {
    setIsPaused(true);
    if (isVideo) {
      try {
        player.pause();
      } catch {}
    } else if (animRef.current) {
      animRef.current.stop();
    }
  }, [isVideo, player]);

  const resume = useCallback(() => {
    setIsPaused(false);
    if (isVideo) {
      try {
        player.play();
      } catch {}
    } else if (isImage || isText) {
      const remaining = DURATION * (1 - progressValueRef.current);
      const anim = Animated.timing(progress, {
        toValue: 1,
        duration: Math.max(remaining, 0),
        useNativeDriver: false,
      });
      animRef.current = anim;
      anim.start(({ finished }) => {
        if (finished) goNext();
      });
    }
  }, [isVideo, isImage, isText, player, DURATION, progress, goNext]);

  // ── Mark as viewed when opening ─────────────────────────────────────────────
  useEffect(() => {
    if (currentStatus && !currentStatus.viewedBy.includes(currentUserId)) {
      onStatusViewed(currentStatus.statusId);
    }
  }, [currentStatus?.statusId, currentUserId, onStatusViewed]);

  // ── Drive playback / timing for current item ────────────────────────────────
  useEffect(() => {
    if (!visible || !currentStatus) return;

    progress.setValue(0);
    progressValueRef.current = 0;
    if (animRef.current) {
      animRef.current.stop();
      animRef.current = null;
    }

    // If user is excluded, show for default duration then auto-advance
    if (isExcluded) {
      const anim = Animated.timing(progress, {
        toValue: 1,
        duration: 3000, // Show blocked message for 3 seconds
        useNativeDriver: false,
      });
      animRef.current = anim;
      anim.start(({ finished }) => {
        if (finished && !isPaused) goNext();
      });
      return () => anim.stop();
    }

    if (isImage || isText) {
      // Animate progress for image/text statuses
      const anim = Animated.timing(progress, {
        toValue: 1,
        duration: DURATION,
        useNativeDriver: false,
      });
      animRef.current = anim;
      anim.start(({ finished }) => {
        if (finished && !isPaused) goNext();
      });
      return () => anim.stop();
    } else if (isVideo && currentStatus.mediaUrl) {
      // Video playback handled by expo-video player
      let cancelled = false;
      (async () => {
        try {
          await player.replace(currentStatus.mediaUrl);
          if (!cancelled && !isPaused) {
            player.play();
          }
        } catch (e) {
          console.warn('[StatusViewer] video load failed:', e);
          if (!cancelled) goNext();
        }
      })();
      return () => {
        cancelled = true;
        try {
          player.pause();
        } catch {}
      };
    }
  }, [currentStatus?.statusId, visible, isPaused, isExcluded]);

  // ── Video progress tracking ─────────────────────────────────────────────────
  useEvent(player, 'timeUpdate', (payload: { currentTime: number }) => {
    if (!isVideo) return;
    const dur =
      player.duration && player.duration > 0 ? player.duration : DURATION / 1000;
    if (dur > 0) {
      progress.setValue(Math.min(payload.currentTime / dur, 1));
    }
  });

  useEvent(player, 'playToEnd', () => {
    if (isVideo) goNext();
  });

  // Reset index when opening
  useEffect(() => {
    if (visible) {
      setCurrentIndex(initialIndex);
      progress.setValue(0);
      setShowOptions(false);
      setIsPaused(false);
    }
  }, [visible, initialIndex]);

  const handleDelete = () => {
    if (onDeleteStatus && currentStatus) {
      onDeleteStatus(currentStatus.statusId);
      if (statuses.length > 1) {
        if (currentIndex === statuses.length - 1) {
          setCurrentIndex(currentIndex - 1);
        }
      } else {
        onClose();
      }
    }
  };

  if (!visible || !currentStatus) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <StatusBar hidden />
      <View style={styles.container}>
        {/* Background */}
        <View style={styles.background}>
          {isExcluded ? (
            /* Blocked message */
            <View style={styles.blockedContainer}>
              <Ionicons name="ban-outline" size={64} color="rgba(255,255,255,0.6)" />
              <Text style={styles.blockedTitle}>Status Hidden</Text>
              <Text style={styles.blockedMessage}>
                {currentStatus.displayName} blocked you from seeing this status
              </Text>
            </View>
          ) : isImage && currentStatus.mediaUrl ? (
            <Image
              source={{ uri: currentStatus.mediaUrl }}
              style={styles.media}
              resizeMode="contain"
              onLoadStart={() => setLoading(true)}
              onLoadEnd={() => setLoading(false)}
            />
          ) : isVideo && currentStatus.mediaUrl ? (
            <VideoView
              player={player}
              style={styles.media}
              contentFit="contain"
              nativeControls={false}
            />
          ) : isText ? (
            <LinearGradient
              colors={[currentStatus.backgroundColor || '#1a7fe8', '#0a5bb8']}
              style={styles.textBackground}
            >
              <Text style={[styles.textContent, { color: currentStatus.textColor || '#ffffff' }]}>
                {currentStatus.caption}
              </Text>
            </LinearGradient>
          ) : null}
        </View>

        {/* Loading indicator */}
        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#ffffff" />
          </View>
        )}

        {/* Top gradient overlay */}
        <LinearGradient colors={['rgba(0,0,0,0.6)', 'transparent']} style={styles.topGradient}>
          {/* Progress bars */}
          <View style={styles.progressContainer}>
            {statuses.map((_, index) => (
              <View key={index} style={styles.progressBarBg}>
                <Animated.View
                  style={[
                    styles.progressBarFill,
                    {
                      width:
                        index < currentIndex
                          ? '100%'
                          : index === currentIndex
                          ? progress.interpolate({
                              inputRange: [0, 1],
                              outputRange: ['0%', '100%'],
                            })
                          : '0%',
                    },
                  ]}
                />
              </View>
            ))}
          </View>

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.userInfo}>
              <View style={styles.avatar}>
                {currentStatus.photoURL ? (
                  <Image source={{ uri: currentStatus.photoURL }} style={styles.avatarImage} />
                ) : (
                  <View style={[styles.avatarPlaceholder, { backgroundColor: COLORS.blue }]}>
                    <Text style={styles.avatarText}>
                      {currentStatus.displayName.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
              </View>
              <View style={styles.userMeta}>
                <Text style={styles.userName}>{currentStatus.displayName}</Text>
                <Text style={styles.timestamp}>{formatTimeAgo(currentStatus.createdAt)}</Text>
              </View>
            </View>

            <View style={styles.headerActions}>
              {isOwner && (
                <TouchableOpacity
                  onPress={() => setShowOptions(!showOptions)}
                  style={styles.iconButton}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="ellipsis-vertical" size={22} color="#ffffff" />
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={onClose}
                style={styles.iconButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={28} color="#ffffff" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Options menu */}
          {showOptions && isOwner && (
            <View style={styles.optionsMenu}>
              <TouchableOpacity style={styles.optionItem} onPress={handleDelete}>
                <Ionicons name="trash-outline" size={20} color="#ff4444" />
                <Text style={styles.optionText}>Delete</Text>
              </TouchableOpacity>
            </View>
          )}
        </LinearGradient>

        {/* Bottom gradient overlay */}
        {(currentStatus.caption || isOwner) && (
          <LinearGradient colors={['transparent', 'rgba(0,0,0,0.6)']} style={styles.bottomGradient}>
            {currentStatus.caption && !isText && (
              <Text style={styles.caption}>{currentStatus.caption}</Text>
            )}
            {isOwner && (
              <View style={styles.viewsContainer}>
                <Ionicons name="eye-outline" size={16} color="#ffffff" />
                <Text style={styles.viewsText}>
                  {viewCount} {viewCount === 1 ? 'view' : 'views'}
                </Text>
              </View>
            )}
          </LinearGradient>
        )}

        {/* Tap zones for navigation */}
        <View style={styles.tapZones}>
          <Pressable
            style={styles.tapLeft}
            onPress={goPrev}
            onLongPress={pause}
            onPressOut={resume}
            delayLongPress={150}
          />
          <Pressable
            style={styles.tapRight}
            onPress={goNext}
            onLongPress={pause}
            onPressOut={resume}
            delayLongPress={150}
          />
        </View>
      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  background: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  media: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  textBackground: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  textContent: {
    fontSize: 32,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 42,
  },
  blockedContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  blockedTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
    marginTop: 20,
    marginBottom: 12,
  },
  blockedMessage: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    lineHeight: 22,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  topGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 50,
    paddingBottom: 20,
  },
  progressContainer: {
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 8,
    marginBottom: 12,
  },
  progressBarBg: {
    flex: 1,
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 1,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    ...SHADOW.card,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
  },
  userMeta: {
    flex: 1,
  },
  userName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },
  timestamp: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  iconButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionsMenu: {
    position: 'absolute',
    top: 100,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.9)',
    borderRadius: 12,
    padding: 8,
    minWidth: 150,
    ...SHADOW.card,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  optionText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
  },
  bottomGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: 40,
    paddingBottom: 30,
  },
  caption: {
    fontSize: 15,
    color: '#ffffff',
    marginBottom: 12,
    lineHeight: 20,
  },
  viewsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  viewsText: {
    fontSize: 13,
    color: '#ffffff',
    fontWeight: '600',
  },
  tapZones: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
  },
  tapLeft: {
    flex: 1,
  },
  tapRight: {
    flex: 1,
  },
});
