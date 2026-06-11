// ─── Screen: Status ──────────────────────────────────────────────────────────
import React from 'react';
import { View, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Avatar, BottomNav, UserAvatar } from '../components';
import { STATUSES } from '../data/mockData';
import { COLORS, RADIUS, SHADOW, GRADIENTS, GLASS } from '../types/theme';
import { StatusUpdate } from '../types';

import { AppBg, AppText, AppIcon, useForeground, useTypography } from '../context/ThemeContext';

export default function StatusScreen() {
  const { FG } = useForeground();
  const { fontFamily, textColor } = useTypography();
  const renderStatus = ({ item }: { item: StatusUpdate }) => (
    <TouchableOpacity
      style={[styles.statusCard, { backgroundColor: FG.glassBg, borderColor: FG.glassBorder }]}
      activeOpacity={0.75}
    >
      <LinearGradient colors={[item.color, COLORS.blue]} style={styles.ring} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <View style={[styles.ringInner, { backgroundColor: 'transparent' }]}>
          <Avatar initials={item.avatar} color={item.color} size={44} />
        </View>
      </LinearGradient>
      <View style={styles.statusMeta}>
        <AppText style={[styles.statusName, { color: textColor, fontFamily }]}>{item.name}</AppText>
        <AppText style={[styles.statusTime, { color: FG.secondary }]}>{item.time}</AppText>
      </View>
      <AppIcon name="ellipsis-vertical" size={18} color={FG.secondary} />
    </TouchableOpacity>
  );

  return (
    <View style={styles.root}>
      <AppBg />

      <View style={styles.header}>
        <AppText style={[styles.title, { color: textColor, fontFamily }]}>Updates</AppText>
      </View>

      {/* My Status glass card */}
      <TouchableOpacity
        style={[styles.myCard, { backgroundColor: FG.glassBg, borderColor: FG.glassBorder }]}
        activeOpacity={0.8}
      >
        <View style={styles.meAvatarWrap}>
          <UserAvatar size={52} />
          <LinearGradient colors={GRADIENTS.primary} style={styles.mePlusBadge}>
            <AppIcon name="add" size={12} color="#fff" fixedColor />
          </LinearGradient>
        </View>
        <View style={styles.myCardText}>
          <AppText style={[styles.myCardTitle, { color: FG.primary }]}>My Status</AppText>
          <AppText style={[styles.myCardSub, { color: FG.secondary }]}>Tap to add status update</AppText>
        </View>
      </TouchableOpacity>

      <AppText style={[styles.sectionText, { color: FG.secondary }]}>RECENT UPDATES</AppText>

      <FlatList
        data={STATUSES}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderStatus}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
      />

      <BottomNav active="status" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.sky1 },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 56, paddingBottom: 14,
  },
  title:  { fontSize: 26, fontWeight: '800', color: COLORS.text },

  // My status — glass card
  myCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    marginHorizontal: 14, marginBottom: 18,
    ...GLASS.card, borderRadius: RADIUS.lg, padding: 14,
    ...SHADOW.card,
  },
  meAvatarWrap: { position: 'relative' },
  mePlusBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 20, height: 20, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: COLORS.sky1,
  },
  myCardText:  { flex: 1 },
  myCardTitle: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  myCardSub:   { fontSize: 12, color: COLORS.sub, marginTop: 2 },

  sectionText: {
    fontSize: 10, fontWeight: '700', color: COLORS.sub,
    letterSpacing: 1.2, paddingHorizontal: 20, paddingBottom: 10,
  },

  listContent: { paddingHorizontal: 14, paddingBottom: 20 },

  // Glass card per status row
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    ...GLASS.card,
    borderRadius: RADIUS.lg,
    paddingHorizontal: 14,
    paddingVertical: 12,
    ...SHADOW.card,
  },
  ring:       { borderRadius: 999, padding: 2.5 },
  ringInner:  { backgroundColor: COLORS.sky1, borderRadius: 999, padding: 2 },
  statusMeta: { flex: 1 },
  statusName: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  statusTime: { fontSize: 12, color: COLORS.sub, marginTop: 2 },
});
