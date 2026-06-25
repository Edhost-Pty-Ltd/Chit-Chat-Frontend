// ─── Component: StatusViewer ──────────────────────────────────────────────────
// Full-screen WhatsApp-style story viewer with progress bars, tap navigation,
// swipe gestures, and auto-advance timer.

import React, { useState, useEffect, useRef } from 'react';
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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
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
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showOptions, setShowOptions] = useState(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const currentStatus = statuses[currentIndex];
  const isOwner = currentStatus?.userId === currentUserId;
  const viewCount = currentStatus?.viewedBy?.length || 0;

  const DURATION = currentStatus?.mediaType === 'video' ? 15000 : 5000; // 15s for video, 5s for image/text

  // ── Auto-advance timer ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!visible || isPaused || !currentStatus) return;

    // Mark as viewed when opening
    if (!currentStatus.viewedBy.includes(currentUserId)) {
      onStatusViewed(currentStatus.statusId);
    }

    setProgress(0);
    const interval = 50; // Update every 50ms
    const increment = interval / DURATION;

    timerRef.current = setInterval(() => {
      setProgress((prev) => {
        const next = prev + increment;
        if (next >= 1) {
          // Auto-advance to next status
          if (currentIndex < statuses.length - 1) {
            setCurrentIndex(currentIndex + 1);
          } else {
            onClose();
          }
          return 0;
        }
        return next;
      });
    }, interval);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [visible, currentIndex, isPaused, currentStatus, statuses.length, currentUserId, onStatusViewed, onClose]);

  // Reset index when opening
  useEffect(() => {
    if (visible) {
      setCurrentIndex(initialIndex);
      setProgress(0);
      setShowOptions(false);
    }
  }, [visible, initialIndex]);

  // ── Navigation handlers ─────────────────────────────────────────────────────
  const handleTapLeft = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setProgress(0);
    } else {
      onClose();
    }
  };

  const handleTapRight = () => {
    if (currentIndex < statuses.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setProgress(0);
    } else {
      onClose();
    }
  };

  const handleLongPressStart = () => {
    setIsPaused(true);
  };

  const handleLongPressEnd = () => {
    setIsPaused(false);
  };

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
          {currentStatus.mediaType === 'image' && currentStatus.mediaUrl ? (
            <Image
              source={{ uri: currentStatus.mediaUrl }}
              style={styles.media}
              resizeMode="contain"
              onLoadStart={() => setLoading(true)}
              onLoadEnd={() => setLoading(false)}
            />
          ) : currentStatus.mediaType === 'video' && currentStatus.mediaUrl ? (
            <View style={styles.videoPlaceholder}>
              <Ionicons name="play-circle" size={80} color="#ffffff" />
              <Text style={styles.videoPlaceholderText}>Video playback coming soon</Text>
              <Text style={styles.videoPlaceholderSubtext}>Video statuses are not yet supported</Text>
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
                <View
                  style={[
                    styles.progressBarFill,
                    {
                      width: `${
                        index < currentIndex ? 100 : index === currentIndex ? progress * 100 : 0
                      }%`,
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
          </LinearGradient>
        )}

        {/* Tap zones for navigation */}
        <View style={styles.tapZones}>
          <Pressable
            style={styles.tapLeft}
            onPress={handleTapLeft}
            onLongPress={handleLongPressStart}
            onPressOut={handleLongPressEnd}
          />
          <Pressable
            style={styles.tapRight}
            onPress={handleTapRight}
            onLongPress={handleLongPressStart}
            onPressOut={handleLongPressEnd}
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
  videoPlaceholder: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',
    padding: 40,
  },
  videoPlaceholderText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
    marginTop: 20,
    textAlign: 'center',
  },
  videoPlaceholderSubtext: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 8,
    textAlign: 'center',
  },
});
