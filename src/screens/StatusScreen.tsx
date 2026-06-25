// ─── Screen: Status ──────────────────────────────────────────────────────────
import React, { useState } from 'react';
import { View, FlatList, TouchableOpacity, StyleSheet, Platform, ActivityIndicator, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BottomNav, UserAvatar, StatusViewer, CreateStatusModal } from '../components';
import { COLORS, RADIUS, SHADOW, GRADIENTS } from '../types/theme';
import { useAuth } from '../hooks/useAuth';
import { useStatus, type StatusGroup } from '../hooks/useStatus';
import { AppBg, AppText, AppIcon, useForeground, useTypography, useGlass } from '../context/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// ─── Helper Functions ─────────────────────────────────────────────────────────

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return 'Today';
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function stringToColor(str: string): string {
  const colors = ['#f97316','#8b5cf6','#ec4899','#06b6d4','#10b981','#f59e0b','#6366f1','#e11d48'];
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function StatusScreen() {
  const { user } = useAuth();
  const userId = user?.uid ?? null;
  const displayName = user?.displayName || user?.email || 'Unknown';
  const photoURL = user?.photoURL || null;

  const { FG } = useForeground();
  const { fontFamily, textColor } = useTypography();
  const { bevel } = useGlass();
  const insets = useSafeAreaInsets();

  const {
    myStatuses,
    contactStatuses,
    loading,
    error,
    createStatus,
    markAsViewed,
    deleteStatus,
  } = useStatus(userId);

  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewingStatuses, setViewingStatuses] = useState<StatusGroup | null>(null);
  const [viewingMyStatus, setViewingMyStatus] = useState(false);

  // ── Handle create status ────────────────────────────────────────────────────
  const handleCreateStatus = async (
    mediaType: 'image' | 'video' | 'text',
    mediaUri: string | null,
    caption: string | null,
    backgroundColor: string | null,
    textColor: string | null,
    durationMs?: number
  ) => {
    if (!userId) return;
    await createStatus(displayName, photoURL, mediaType, mediaUri, caption, backgroundColor, textColor, durationMs);
  };

  // ── Handle view status ──────────────────────────────────────────────────────
  const handleViewMyStatus = () => {
    if (myStatuses.length === 0) return;
    setViewingMyStatus(true);
    setViewerVisible(true);
  };

  const handleViewContactStatus = (group: StatusGroup) => {
    setViewingStatuses(group);
    setViewingMyStatus(false);
    setViewerVisible(true);
  };

  const handleCloseViewer = () => {
    setViewerVisible(false);
    setViewingStatuses(null);
    setViewingMyStatus(false);
  };

  const handleDeleteStatus = async (statusId: string) => {
    const status = myStatuses.find((s) => s.statusId === statusId);
    if (status) {
      await deleteStatus(statusId, status.mediaUrl);
    }
  };

  // ── Render status row ───────────────────────────────────────────────────────
  const renderStatus = ({ item }: { item: StatusGroup }) => {
    const color = stringToColor(item.displayName);
    const initials = getInitials(item.displayName);

    return (
      <TouchableOpacity
        style={[styles.statusCard, bevel]}
        activeOpacity={0.75}
        onPress={() => handleViewContactStatus(item)}
      >
        {/* Avatar with gradient ring */}
        <LinearGradient
          colors={item.hasUnviewed ? [color, COLORS.blue] : ['#888888', '#666666']}
          style={styles.ring}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.ringInner}>
            {item.photoURL ? (
              <Image source={{ uri: item.photoURL }} style={styles.avatarImage} />
            ) : (
              <View style={[styles.avatarCircle, { backgroundColor: color }]}>
                <AppText style={styles.avatarText}>{initials}</AppText>
              </View>
            )}
          </View>
        </LinearGradient>

        <View style={styles.statusMeta}>
          <AppText style={[styles.statusName, { color: textColor, fontFamily }]}>
            {item.displayName}
          </AppText>
          <AppText style={[styles.statusTime, { color: FG.secondary }]}>
            {formatTimeAgo(item.latestTimestamp)}
          </AppText>
        </View>

        {item.hasUnviewed && (
          <View style={styles.unreadDot} />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.root}>
      <AppBg />

      <View style={[styles.header, { backgroundColor: FG.glassBg, borderBottomColor: FG.glassBorder, borderBottomWidth: 1, paddingTop: Platform.OS === 'web' ? 16 : insets.top + 14 }]}>
        <AppText style={[styles.title, { color: textColor, fontFamily }]}>Updates</AppText>
      </View>

      {/* My Status glass card */}
      <TouchableOpacity
        style={[styles.myCard, bevel]}
        activeOpacity={0.8}
        onPress={myStatuses.length > 0 ? handleViewMyStatus : () => setCreateModalVisible(true)}
      >
        <View style={styles.meAvatarWrap}>
          {myStatuses.length > 0 ? (
            <LinearGradient colors={GRADIENTS.primary} style={styles.statusRing}>
              <View style={styles.statusRingInner}>
                <UserAvatar size={52} />
              </View>
            </LinearGradient>
          ) : (
            <UserAvatar size={52} />
          )}
          {myStatuses.length === 0 && (
            <LinearGradient colors={GRADIENTS.primary} style={styles.mePlusBadge}>
              <AppIcon name="add" size={12} color="#fff" fixedColor />
            </LinearGradient>
          )}
        </View>
        <View style={styles.myCardText}>
          <AppText style={[styles.myCardTitle, { color: FG.primary }]}>My Status</AppText>
          <AppText style={[styles.myCardSub, { color: FG.secondary }]}>
            {myStatuses.length > 0
              ? `${formatTimeAgo(myStatuses[0].createdAt)} • Tap to view`
              : 'Tap to add status update'}
          </AppText>
        </View>
        {myStatuses.length > 0 && (
          <TouchableOpacity
            onPress={() => setCreateModalVisible(true)}
            style={styles.addMoreBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <AppIcon name="add-circle" size={28} color={COLORS.blue} />
          </TouchableOpacity>
        )}
      </TouchableOpacity>

      {/* Loading / Error / Empty states */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.blue} />
          <AppText style={[styles.emptyText, { color: FG.secondary }]}>Loading statuses...</AppText>
        </View>
      ) : error ? (
        <View style={styles.centerContainer}>
          <AppIcon name="alert-circle-outline" size={52} color={COLORS.sub} />
          <AppText style={[styles.emptyText, { color: FG.secondary }]}>{error}</AppText>
        </View>
      ) : contactStatuses.length === 0 ? (
        <>
          <AppText style={[styles.sectionText, { color: FG.secondary }]}>RECENT UPDATES</AppText>
          <View style={styles.centerContainer}>
            <AppIcon name="radio-button-off-outline" size={52} color={COLORS.sub} />
            <AppText style={[styles.emptyText, { color: FG.secondary }]}>
              No status updates yet
            </AppText>
            <AppText style={[styles.emptySubText, { color: FG.secondary }]}>
              Status updates from your contacts will appear here
            </AppText>
          </View>
        </>
      ) : (
        <>
          <AppText style={[styles.sectionText, { color: FG.secondary }]}>
            RECENT UPDATES ({contactStatuses.length})
          </AppText>

          <FlatList
            data={contactStatuses}
            keyExtractor={(item) => item.userId}
            renderItem={renderStatus}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
            ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          />
        </>
      )}

      <BottomNav active="status" />

      {/* Create Status Modal */}
      <CreateStatusModal
        visible={createModalVisible}
        onClose={() => setCreateModalVisible(false)}
        onCreate={handleCreateStatus}
      />

      {/* Status Viewer */}
      {viewerVisible && (viewingMyStatus ? myStatuses.length > 0 : viewingStatuses) && (
        <StatusViewer
          visible={viewerVisible}
          onClose={handleCloseViewer}
          statuses={viewingMyStatus ? myStatuses : viewingStatuses?.statuses || []}
          initialIndex={0}
          currentUserId={userId || ''}
          onStatusViewed={markAsViewed}
          onDeleteStatus={viewingMyStatus ? handleDeleteStatus : undefined}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 0, paddingBottom: 14,
  },
  title: { fontSize: 26, fontWeight: '800', color: COLORS.text },

  myCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    marginHorizontal: 14, marginBottom: 18, marginTop: 10,
    borderRadius: RADIUS.lg, padding: 14,
  },
  meAvatarWrap: { position: 'relative' },
  statusRing: {
    borderRadius: 999,
    padding: 3,
  },
  statusRingInner: {
    borderRadius: 999,
    padding: 2,
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  mePlusBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 20, height: 20, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: COLORS.sky1,
  },
  myCardText: { flex: 1 },
  myCardTitle: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  myCardSub:   { fontSize: 12, color: COLORS.sub, marginTop: 2 },
  addMoreBtn: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },

  sectionText: {
    fontSize: 10, fontWeight: '700', color: COLORS.sub,
    letterSpacing: 1.2, paddingHorizontal: 20, paddingBottom: 10,
  },

  listContent: { paddingHorizontal: 14, paddingBottom: 100 },

  statusCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: RADIUS.lg, paddingHorizontal: 14, paddingVertical: 12,
  },
  ring:       { borderRadius: 999, padding: 2.5 },
  ringInner:  { borderRadius: 999, padding: 2, backgroundColor: 'rgba(255,255,255,0.9)' },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  statusMeta: { flex: 1 },
  statusName: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  statusTime: { fontSize: 12, color: COLORS.sub, marginTop: 2 },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.blue,
  },

  // Empty states
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    gap: 12,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.sub,
    textAlign: 'center',
  },
  emptySubText: {
    fontSize: 13,
    color: COLORS.sub,
    textAlign: 'center',
    marginTop: -6,
  },
});
