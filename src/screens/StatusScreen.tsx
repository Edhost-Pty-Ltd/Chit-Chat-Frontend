// ─── Screen: Status (Updates) ────────────────────────────────────────────────
import React, { useMemo, useState } from 'react';
import {
  View, FlatList, TouchableOpacity, StyleSheet, Platform, Alert,
  ActivityIndicator, Modal,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { Avatar, BottomNav, UserAvatar } from '../components';
import { StatusViewer } from '../components/StatusViewer';
import { useAuth } from '../hooks/useAuth';
import { usePhoneBook } from '../hooks/usePhoneBook';
import { useStatus, StatusItem, MAX_VIDEO_STATUS_MS } from '../hooks/useStatus';
import { COLORS, RADIUS, SHADOW, GRADIENTS } from '../types/theme';
import { AppBg, AppText, AppIcon, useForeground, useTypography, useGlass } from '../context/ThemeContext';

interface StatusGroup {
  userId: string;
  userPhone: string;
  name: string;
  items: StatusItem[];
  latestAt: number;
  hasUnviewed: boolean;
}

function timeAgo(date: Date | null): string {
  if (!date) return '';
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ago`;
}

export default function StatusScreen() {
  const { FG } = useForeground();
  const { fontFamily, textColor } = useTypography();
  const { bevel } = useGlass();
  const { user } = useAuth();
  const userId = user?.uid ?? null;
  const userPhone = user?.phoneNumber ?? null;
  const { resolveName } = usePhoneBook();

  const { statuses, posting, postImageStatuses, postVideoStatus, markViewed, deleteStatus } =
    useStatus(userId, userPhone);

  // Viewer state: which group's items are open
  const [viewer, setViewer] = useState<{ items: StatusItem[]; title: string; mine: boolean } | null>(null);

  // My own status items (chronological)
  const myItems = useMemo(
    () => statuses.filter((s) => s.userId === userId),
    [statuses, userId]
  );

  // Group others' statuses by user — only show contacts (phone in phone book)
  const groups = useMemo<StatusGroup[]>(() => {
    const map = new Map<string, StatusItem[]>();
    for (const s of statuses) {
      if (s.userId === userId) continue;
      // Only show statuses from saved contacts
      if (!s.userPhone || !resolveNameIsContact(s.userPhone)) continue;
      const arr = map.get(s.userId) ?? [];
      arr.push(s);
      map.set(s.userId, arr);
    }
    const result: StatusGroup[] = [];
    for (const [uid, items] of map) {
      const latestAt = items.reduce((m, it) => Math.max(m, it.createdAt?.getTime() ?? 0), 0);
      const hasUnviewed = items.some((it) => !it.viewedBy.includes(userId ?? ''));
      result.push({
        userId: uid,
        userPhone: items[0].userPhone,
        name: resolveName(items[0].userPhone, items[0].userPhone),
        items,
        latestAt,
        hasUnviewed,
      });
    }
    result.sort((a, b) => b.latestAt - a.latestAt);
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statuses, userId, resolveName]);

  // A contact is someone whose phone resolves to a name different from the raw
  // number (i.e. it's saved in the phone book).
  function resolveNameIsContact(phone: string): boolean {
    return resolveName(phone) !== phone;
  }

  // ── Add to status flow ───────────────────────────────────────────
  const requestPerm = async (): Promise<boolean> => {
    if (Platform.OS === 'web') return true;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo/video access to post a status.');
      return false;
    }
    return true;
  };

  const pickImages = async () => {
    if (!(await requestPerm())) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'] as any,
      allowsMultipleSelection: true,
      quality: 0.85,
    });
    if (result.canceled || result.assets.length === 0) return;
    const ok = await postImageStatuses(result.assets.map((a) => a.uri));
    if (!ok) Alert.alert('Upload failed', 'Could not post your status. Please try again.');
  };

  const pickVideo = async () => {
    if (!(await requestPerm())) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'] as any,
      videoMaxDuration: 30, // hard cap at 30 seconds
      quality: 0.85,
    });
    if (result.canceled || result.assets.length === 0) return;
    const asset = result.assets[0];
    // expo-image-picker duration is in ms; normalize just in case
    const raw = asset.duration ?? MAX_VIDEO_STATUS_MS;
    const durationMs = raw < 1000 ? raw * 1000 : raw;
    if (durationMs > MAX_VIDEO_STATUS_MS + 1500) {
      Alert.alert('Video too long', 'Status videos must be 30 seconds or shorter.');
      return;
    }
    const ok = await postVideoStatus(asset.uri, durationMs);
    if (!ok) Alert.alert('Upload failed', 'Could not post your status. Please try again.');
  };

  const openAddSheet = () => {
    Alert.alert('Add to status', 'Share a photo or video to your status.', [
      { text: 'Photo(s)', onPress: pickImages },
      { text: 'Video', onPress: pickVideo },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleMyStatusPress = () => {
    if (myItems.length > 0) {
      setViewer({ items: myItems, title: 'My Status', mine: true });
    } else {
      openAddSheet();
    }
  };

  const getInitials = (name: string) => {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  const renderGroup = ({ item }: { item: StatusGroup }) => (
    <TouchableOpacity
      style={[styles.statusCard, bevel]}
      activeOpacity={0.75}
      onPress={() => setViewer({ items: item.items, title: item.name, mine: false })}
    >
      <LinearGradient
        colors={item.hasUnviewed ? [COLORS.blue, COLORS.sky2 ?? COLORS.blue] : ['rgba(150,150,150,0.5)', 'rgba(120,120,120,0.5)']}
        style={styles.ring}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.ringInner}>
          <Avatar initials={getInitials(item.name)} color={COLORS.blue} size={44} />
        </View>
      </LinearGradient>
      <View style={styles.statusMeta}>
        <AppText style={[styles.statusName, { color: textColor, fontFamily }]} numberOfLines={1}>
          {item.name}
        </AppText>
        <AppText style={[styles.statusTime, { color: FG.secondary }]}>
          {item.items.length} update{item.items.length !== 1 ? 's' : ''} · {timeAgo(new Date(item.latestAt))}
        </AppText>
      </View>
      <AppIcon name="chevron-forward" size={18} color={FG.secondary} />
    </TouchableOpacity>
  );

  return (
    <View style={styles.root}>
      <AppBg />

      <View style={[styles.header, { backgroundColor: FG.glassBg, borderBottomColor: FG.glassBorder, borderBottomWidth: 1 }]}>
        <AppText style={[styles.title, { color: textColor, fontFamily }]}>Updates</AppText>
      </View>

      {/* My Status card */}
      <TouchableOpacity style={[styles.myCard, bevel]} activeOpacity={0.8} onPress={handleMyStatusPress}>
        <View style={styles.meAvatarWrap}>
          <UserAvatar size={52} />
          <TouchableOpacity onPress={openAddSheet} activeOpacity={0.8}>
            <LinearGradient colors={GRADIENTS.primary} style={styles.mePlusBadge}>
              <AppIcon name="add" size={12} color="#fff" fixedColor />
            </LinearGradient>
          </TouchableOpacity>
        </View>
        <View style={styles.myCardText}>
          <AppText style={[styles.myCardTitle, { color: FG.primary }]}>My Status</AppText>
          <AppText style={[styles.myCardSub, { color: FG.secondary }]}>
            {myItems.length > 0
              ? `${myItems.length} update${myItems.length !== 1 ? 's' : ''} · tap to view`
              : 'Tap to add status update'}
          </AppText>
        </View>
      </TouchableOpacity>

      <AppText style={[styles.sectionText, { color: FG.secondary }]}>RECENT UPDATES</AppText>

      <FlatList
        data={groups}
        keyExtractor={(g) => g.userId}
        renderItem={renderGroup}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListEmptyComponent={
          <AppText style={[styles.empty, { color: FG.secondary }]}>
            No recent updates from your contacts.
          </AppText>
        }
      />

      {/* Uploading overlay */}
      {posting && (
        <View style={styles.uploadOverlay} pointerEvents="auto">
          <View style={styles.uploadBox}>
            <ActivityIndicator size="large" color={COLORS.blue} />
            <AppText fixedColor style={styles.uploadText}>Posting your status…</AppText>
          </View>
        </View>
      )}

      {/* Full-screen viewer */}
      <Modal visible={!!viewer} animationType="fade" transparent onRequestClose={() => setViewer(null)}>
        {viewer && (
          <StatusViewer
            items={viewer.items}
            title={viewer.title}
            onClose={() => setViewer(null)}
            onViewed={markViewed}
            canDelete={viewer.mine}
            onDelete={async (statusId) => {
              await deleteStatus(statusId);
              setViewer((v) => {
                if (!v) return null;
                const remaining = v.items.filter((it) => it.statusId !== statusId);
                if (remaining.length === 0) return null;
                return { ...v, items: remaining };
              });
            }}
          />
        )}
      </Modal>

      <BottomNav active="status" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: Platform.OS === 'web' ? 16 : 56, paddingBottom: 14,
  },
  title: { fontSize: 26, fontWeight: '800', color: COLORS.text },

  myCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    marginHorizontal: 14, marginBottom: 18,
    borderRadius: RADIUS.lg, padding: 14,
  },
  meAvatarWrap: { position: 'relative' },
  mePlusBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 20, height: 20, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: COLORS.sky1,
  },
  myCardText: { flex: 1 },
  myCardTitle: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  myCardSub: { fontSize: 12, color: COLORS.sub, marginTop: 2 },

  sectionText: {
    fontSize: 10, fontWeight: '700', color: COLORS.sub,
    letterSpacing: 1.2, paddingHorizontal: 20, paddingBottom: 10,
  },

  listContent: { paddingHorizontal: 14, paddingBottom: 20 },
  empty: { textAlign: 'center', fontSize: 13, paddingVertical: 30 },

  statusCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: RADIUS.lg, paddingHorizontal: 14, paddingVertical: 12,
  },
  ring: { borderRadius: 999, padding: 2.5 },
  ringInner: { borderRadius: 999, padding: 2, backgroundColor: 'transparent' },
  statusMeta: { flex: 1 },
  statusName: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  statusTime: { fontSize: 12, color: COLORS.sub, marginTop: 2 },

  uploadOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center', justifyContent: 'center', zIndex: 50,
  },
  uploadBox: {
    backgroundColor: '#0d2040', borderRadius: RADIUS.lg, padding: 24,
    alignItems: 'center', gap: 14, ...SHADOW.glow,
  },
  uploadText: { fontSize: 14, color: '#fff' },
});
