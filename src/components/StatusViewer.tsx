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
  ScrollView,
  GestureResponderEvent,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEventListener } from 'expo';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { usePhoneBook } from '../hooks/usePhoneBook';
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
  // Viewers ("seen by") sheet state — owner only.
  const [showViewers, setShowViewers] = useState(false);
  const [viewers, setViewers] = useState<{ userId: string; name: string; photoURL: string | null }[]>([]);
  const [viewersLoading, setViewersLoading] = useState(false);

  const insets = useSafeAreaInsets();
  const { resolveName } = usePhoneBook();

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
    
    console.log('[StatusViewer] Loading status:', {
      statusId: currentStatus.statusId,
      mediaType: currentStatus.mediaType,
      hasTrimStart: 'trimStart' in currentStatus,
      hasTrimEnd: 'trimEnd' in currentStatus,
      hasNeedsTrimming: 'needsTrimming' in currentStatus,
      trimStart: currentStatus.trimStart,
      trimEnd: currentStatus.trimEnd,
      needsTrimming: currentStatus.needsTrimming,
      allKeys: Object.keys(currentStatus),
    });
    
    if (isVideo && currentStatus.mediaUrl) {
      videoReadyRef.current = false;   // block premature playToEnd
      player.replace(currentStatus.mediaUrl);
      
      // If video has trim metadata, start at trimStart time
      if (currentStatus.trimStart !== undefined && currentStatus.trimStart > 0) {
        const startTimeSec = currentStatus.trimStart / 1000;
        console.log('[StatusViewer] Video has trim metadata:', {
          trimStart: currentStatus.trimStart,
          trimEnd: currentStatus.trimEnd,
          startTimeSec,
        });
        player.currentTime = startTimeSec; // Convert ms to seconds
      } else {
        console.log('[StatusViewer] Video has no trim metadata');
      }
      
      if (!isPaused) player.play();
    } else {
      try { player.pause(); } catch {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStatus?.statusId, visible, isVideo]);

  // Video: update progress bar from timeUpdate; mark ready on first tick
  // Also check if we've reached trimEnd and advance
  useEventListener(player, 'timeUpdate', ({ currentTime }: { currentTime: number }) => {
    if (!isVideo) return;
    if (currentTime > 0) videoReadyRef.current = true;  // video is genuinely playing
    
    // Check if video has trim metadata
    const hasTrim = currentStatus.trimStart !== undefined && currentStatus.trimEnd !== undefined;
    const trimStart = hasTrim ? (currentStatus.trimStart || 0) / 1000 : 0; // Convert ms to seconds
    const trimEnd = hasTrim ? (currentStatus.trimEnd || player.duration) / 1000 : player.duration;
    
    // If we've reached or passed the trim end time, advance to next status
    if (hasTrim && currentTime >= trimEnd) {
      console.log('[StatusViewer] Reached trim end, advancing:', { currentTime, trimEnd });
      goNext();
      return;
    }
    
    // Calculate progress based on trimmed duration
    const effectiveDuration = hasTrim ? (trimEnd - trimStart) : (player.duration && player.duration > 0 ? player.duration : 30);
    const effectiveCurrentTime = hasTrim ? (currentTime - trimStart) : currentTime;
    setProgress(Math.min(effectiveCurrentTime / effectiveDuration, 1));
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

    // Mark as viewed — but never count the owner viewing their own status.
    if (!isOwner && !currentStatus.viewedBy.includes(currentUserId)) {
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
  }, [visible, currentIndex, isPaused, isVideo, currentStatus, currentUserId, onStatusViewed, goNext, isOwner]);

  // Mark video statuses viewed immediately on open
  useEffect(() => {
    if (!visible || !currentStatus || !isVideo) return;
    // Never count the owner viewing their own status.
    if (!isOwner && !currentStatus.viewedBy.includes(currentUserId)) {
      onStatusViewed(currentStatus.statusId);
    }
  }, [visible, currentIndex, isVideo, currentStatus, currentUserId, onStatusViewed, isOwner]);

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

  // ── Viewers ("seen by") sheet ───────────────────────────────────────────────
  // Resolve each viewer's name via the phone book (saved contact name → phone
  // number), fetching their phone/photo from their Firestore profile.
  const handleOpenViewers = useCallback(async () => {
    if (!currentStatus) return;
    const ids = currentStatus.viewedBy || [];
    if (ids.length === 0) return;

    setIsPaused(true); // pause auto-advance while the sheet is open
    setShowViewers(true);
    setViewersLoading(true);

    try {
      const results = await Promise.all(
        ids.map(async (uid) => {
          try {
            const snap = await getDoc(doc(db, 'users', uid));
            const data = snap.exists() ? snap.data() : {};
            const phone = data.phone ?? null;
            const name = resolveName(phone, phone ?? 'Unknown');
            return { userId: uid, name, photoURL: data.photoURL ?? null };
          } catch {
            return { userId: uid, name: 'Unknown', photoURL: null };
          }
        })
      );
      setViewers(results);
    } catch {
      setViewers([]);
    } finally {
      setViewersLoading(false);
    }
  }, [currentStatus, resolveName]);

  const handleCloseViewers = useCallback(() => {
    setShowViewers(false);
    setIsPaused(false);
  }, []);

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

        {/* Layer 5: bottom info (caption + view count) */}
        {(currentStatus.caption || isOwner) && (
          <View
            style={[styles.bottomInfo, { paddingBottom: insets.bottom + 24 }]}
            pointerEvents="box-none"
          >
            {currentStatus.caption && currentStatus.mediaType !== 'text' && (
              <Text style={styles.caption}>{currentStatus.caption}</Text>
            )}
            {isOwner && (
              <TouchableOpacity
                style={styles.viewsContainer}
                onPress={handleOpenViewers}
                activeOpacity={0.7}
                disabled={viewCount === 0}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Ionicons name="eye-outline" size={16} color="#ffffff" />
                <Text style={styles.viewsText}>
                  {viewCount} {viewCount === 1 ? 'view' : 'views'}
                </Text>
                {viewCount > 0 && (
                  <Ionicons name="chevron-up" size={14} color="#ffffff" />
                )}
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Viewers ("seen by") bottom sheet — owner only */}
        {showViewers && (
          <View style={styles.viewersOverlay}>
            <Pressable style={styles.viewersBackdrop} onPress={handleCloseViewers} />
            <View style={[styles.viewersSheet, { paddingBottom: insets.bottom + 16 }]}>
              <View style={styles.viewersHandle} />
              <View style={styles.viewersTitleRow}>
                <Ionicons name="eye-outline" size={18} color={COLORS.blue} />
                <Text style={styles.viewersTitle}>
                  Viewed by {viewers.length}
                </Text>
              </View>

              {viewersLoading ? (
                <ActivityIndicator color={COLORS.blue} style={{ marginVertical: 24 }} />
              ) : viewers.length === 0 ? (
                <Text style={styles.viewersEmpty}>No views yet</Text>
              ) : (
                <ScrollView
                  style={{ maxHeight: SCREEN_HEIGHT * 0.4 }}
                  showsVerticalScrollIndicator={false}
                >
                  {viewers.map((v) => (
                    <View key={v.userId} style={styles.viewerRow}>
                      <View style={styles.viewerAvatar}>
                        {v.photoURL ? (
                          <Image source={{ uri: v.photoURL }} style={styles.avatarImage} />
                        ) : (
                          <View style={[styles.avatarPlaceholder, { backgroundColor: COLORS.blue }]}>
                            <Text style={styles.avatarText}>
                              {v.name.charAt(0).toUpperCase()}
                            </Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.viewerName} numberOfLines={1}>{v.name}</Text>
                    </View>
                  ))}
                </ScrollView>
              )}
            </View>
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
  viewersOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
  },
  viewersBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  viewersSheet: {
    backgroundColor: '#1c1c1e',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  viewersHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginBottom: 16,
  },
  viewersTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  viewersTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  viewersEmpty: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    marginVertical: 24,
  },
  viewerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  viewerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
  },
  viewerName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
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
