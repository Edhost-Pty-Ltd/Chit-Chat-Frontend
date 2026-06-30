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
  GestureResponderEvent,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEventListener } from 'expo';
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
  const [progress, setProgress] = useState(0);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Signals that the current item finished and we should advance — avoids
  // calling goNext() inside a setProgress updater (setState during render).
  const shouldAdvanceRef = useRef(false);

  const currentStatus = statuses[currentIndex];
  const isOwner = currentStatus?.userId === currentUserId;
  const isExcluded = currentStatus?.excludedUsers?.includes(currentUserId) || false;
  const viewCount = currentStatus?.viewedBy?.length || 0;
  const isVideo = currentStatus?.mediaType === 'video';

  // Image/text display duration: 7 s (matches original behaviour).
  // Videos run for their natural duration via the player events.
  const IMAGE_DURATION = 7000;

  // ── Video player (always created, loaded only for video items) ──────────────
  // timeUpdateEventInterval: fire timeUpdate every 100ms for smooth progress.
  const player = useVideoPlayer(null, (p) => {
    p.loop = false;
    p.timeUpdateEventInterval = 0.1;
  });
  // Guard: don't advance on playToEnd until the video has actually started.
  // expo-video fires playToEnd when replacing the source (null → new URL),
  // which would otherwise skip the video immediately.
  const videoReadyRef = useRef(false);

  const goNext = useCallback(() => {
    if (currentIndex < statuses.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setProgress(0);
    } else {
      onClose();
    }
  }, [currentIndex, statuses.length, onClose]);

  // ── Load video when current item changes ─────────────────────────────────
  useEffect(() => {
    if (!visible || !currentStatus) return;
    if (isVideo && currentStatus.mediaUrl) {
      videoReadyRef.current = false;   // block premature playToEnd
      player.replace(currentStatus.mediaUrl);
      if (!isPaused) player.play();
    } else {
      try { player.pause(); } catch {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStatus?.statusId, visible, isVideo]);

  // Video: update progress bar from timeUpdate; mark ready on first tick
  useEventListener(player, 'timeUpdate', ({ currentTime }: { currentTime: number }) => {
    if (!isVideo) return;
    if (currentTime > 0) videoReadyRef.current = true;  // video is genuinely playing
    const dur = player.duration && player.duration > 0 ? player.duration : 30;
    setProgress(Math.min(currentTime / dur, 1));
  });

  // Only advance on playToEnd once the video has actually played
  useEventListener(player, 'playToEnd', () => {
    if (isVideo && videoReadyRef.current) goNext();
  });

  // Pause / resume video on long-press hold
  useEffect(() => {
    if (!isVideo) return;
    if (isPaused) { try { player.pause(); } catch {} }
    else { try { player.play(); } catch {} }
  }, [isPaused, isVideo]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Image / text auto-advance timer ────────────────────────────────────────
  useEffect(() => {
    if (!visible || isPaused || !currentStatus || isVideo) return;

    // Mark as viewed
    if (!currentStatus.viewedBy.includes(currentUserId)) {
      onStatusViewed(currentStatus.statusId);
    }

    setProgress(0);
    const interval = 50;
    const increment = interval / IMAGE_DURATION;

    timerRef.current = setInterval(() => {
      setProgress((prev) => {
        const next = prev + increment;
        if (next >= 1) {
          // Signal advance — don't call goNext() here (setState during render).
          shouldAdvanceRef.current = true;
          return 1;
        }
        return next;
      });
    }, interval);

    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [visible, currentIndex, isPaused, isVideo, currentStatus, currentUserId, onStatusViewed, goNext]);

  // Mark video statuses viewed immediately on open
  useEffect(() => {
    if (!visible || !currentStatus || !isVideo) return;
    if (!currentStatus.viewedBy.includes(currentUserId)) {
      onStatusViewed(currentStatus.statusId);
    }
  }, [visible, currentIndex, isVideo, currentStatus, currentUserId, onStatusViewed]);

  // Advance to the next item after the image/text timer completes.
  // Using a separate effect avoids calling goNext() inside the setProgress
  // updater, which would be a setState-during-render violation.
  useEffect(() => {
    if (progress >= 1 && shouldAdvanceRef.current) {
      shouldAdvanceRef.current = false;
      goNext();
    }
  }, [progress, goNext]);

  // ── Reset state when modal opens ────────────────────────────────────────────
  useEffect(() => {
    if (visible) {
      setCurrentIndex(initialIndex);
      setProgress(0);
      setShowOptions(false);
    } else {
      // Stop video when closing
      try { player.pause(); } catch {}
    }
  }, [visible, initialIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Navigation handlers ────────────────────────────────────────────────────
  const handleTapLeft = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setProgress(0);
    } else {
      onClose();
    }
  }, [currentIndex, onClose]);

  const handleTapRight = useCallback(() => {
    goNext();
  }, [goNext]);

  // ── Gesture handling via responder system ──────────────────────────────────
  // Pressable/TouchableOpacity don't work reliably over VideoView (native SurfaceView)
  // on Android. The responder system fires at the JS bridge level BEFORE native views
  // consume the touch, making it work regardless of what's underneath.
  const touchStartXRef    = useRef(0);
  const touchStartTimeRef = useRef(0);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleTouchStart = useCallback((e: GestureResponderEvent) => {
    touchStartXRef.current    = e.nativeEvent.locationX;
    touchStartTimeRef.current = Date.now();
    longPressTimerRef.current = setTimeout(() => {
      setIsPaused(true);
    }, 200);
  }, []);

  const handleTouchEnd = useCallback((e: GestureResponderEvent) => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    const elapsed = Date.now() - touchStartTimeRef.current;
    if (isPaused && elapsed >= 200) {
      setIsPaused(false);
      return;
    }
    if (elapsed > 400) return;
    const tapX = e.nativeEvent.locationX;
    if (tapX < SCREEN_WIDTH / 3) {
      handleTapLeft();
    } else {
      handleTapRight();
    }
  }, [isPaused, handleTapLeft, handleTapRight]);

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

  const displayName = currentStatus.displayName || 'Unknown';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <StatusBar hidden />
      <View
        style={styles.container}
        onStartShouldSetResponder={() => true}
        onResponderGrant={handleTouchStart}
        onResponderRelease={handleTouchEnd}
      >
        {/* Layer 1: media background */}
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
          ) : currentStatus.mediaType === 'image' && currentStatus.mediaUrl ? (
            <Image
              source={{ uri: currentStatus.mediaUrl }}
              style={styles.media}
              resizeMode="contain"
              onLoadStart={() => setLoading(true)}
              onLoadEnd={() => setLoading(false)}
            />
          ) : currentStatus.mediaType === 'video' && currentStatus.mediaUrl ? (
            /* pointerEvents="none" lets touches pass through to the tapZones above */
            <View style={styles.media} pointerEvents="none">
              <VideoView
                player={player}
                style={StyleSheet.absoluteFill}
                contentFit="contain"
                nativeControls={false}
              />
            </View>
          ) : currentStatus.mediaType === 'text' ? (
            <LinearGradient
              colors={[currentStatus.backgroundColor || '#1a7fe8', '#0a5bb8']}
              style={styles.textBackground}
            >
              <Text style={[styles.textContent, { color: currentStatus.textColor || '#ffffff' }]}>
                {currentStatus.caption}
              </Text>
            </LinearGradient>
          ) : (
            <View style={styles.textBackground}>
              <Ionicons name="image-outline" size={64} color="rgba(255,255,255,0.4)" />
              <Text style={styles.missingText}>This status can't be displayed</Text>
            </View>
          )}
        </View>

        {/* Layer 2: decorative gradients — never capture touches */}
        <LinearGradient
          pointerEvents="none"
          colors={['rgba(0,0,0,0.6)', 'transparent']}
          style={styles.topGradient}
        />
        {(currentStatus.caption || isOwner) && (
          <LinearGradient
            pointerEvents="none"
            colors={['transparent', 'rgba(0,0,0,0.6)']}
            style={styles.bottomGradient}
          />
        )}

        {/* Loading indicator */}
        {loading && (
          <View style={styles.loadingOverlay} pointerEvents="none">
            <ActivityIndicator size="large" color="#ffffff" />
          </View>
        )}

        {/* Layer 4: top controls (progress bars + header) — above tap zones */}
        <View style={styles.topControls} pointerEvents="box-none">
          {/* Progress bars */}
          <View style={styles.progressContainer}>
            {statuses.map((_, index) => (
              <View key={index} style={styles.progressBarBg}>
                <View
                  style={[
                    styles.progressBarFill,
                    {
                      width:
                        index < currentIndex
                          ? '100%'
                          : index === currentIndex
                          ? `${Math.round(progress * 100)}%`
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
                      {displayName.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
              </View>
              <View style={styles.userMeta}>
                <Text style={styles.userName}>{displayName}</Text>
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
        </View>

        {/* Layer 5: bottom info (caption + view count) — non-interactive */}
        {(currentStatus.caption || isOwner) && (
          <View style={styles.bottomInfo} pointerEvents="none">
            {currentStatus.caption && currentStatus.mediaType !== 'text' && (
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
          </View>
        )}
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
    height: 160,
  },
  topControls: {
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
    height: 140,
  },
  bottomInfo: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: 40,
    paddingBottom: 30,
  },
  missingText: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 12,
    textAlign: 'center',
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
