// ─── Screen 5: Status ────────────────────────────────────────────────────────
import React from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Avatar, BottomNav } from '../components';
import { STATUSES } from '../data/mockData';
import { COLORS, RADIUS, SHADOW, GRADIENTS } from '../types/theme';
import { StatusUpdate } from '../types';

export default function StatusScreen() {

  // ── Recent status row ────────────────────────────────────────────────────
  const renderStatus = ({ item }: { item: StatusUpdate }) => (
    <TouchableOpacity style={styles.statusRow} activeOpacity={0.7}>
      {/* Progress ring — simple gradient border technique */}
      <LinearGradient
        colors={[item.color, COLORS.blue]}
        style={styles.ring}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.ringInner}>
          <Avatar initials={item.avatar} color={item.color} size={46} />
        </View>
      </LinearGradient>

      <View style={styles.statusMeta}>
        <Text style={styles.statusName}>{item.name}</Text>
        <Text style={styles.statusTime}>{item.time}</Text>
      </View>

      {/* Three-dot menu */}
      <TouchableOpacity style={styles.menuBtn}>
        <Text style={styles.menuDots}>⋯</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <View style={styles.root}>
      {/* ── Header ───────────────────────────────────────────────── */}
      <View style={styles.header}>
        <Text style={styles.title}>Status</Text>
        <TouchableOpacity>
          <LinearGradient colors={GRADIENTS.primary} style={styles.addBtn}>
            <Text style={styles.addBtnText}>+</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* ── My Status card ────────────────────────────────────────── */}
      <TouchableOpacity style={styles.myCard} activeOpacity={0.8}>
        <View style={{ position: 'relative' }}>
          <Avatar initials="ME" color={COLORS.blue} size={54} />
          {/* Add badge */}
          <LinearGradient colors={GRADIENTS.primary} style={styles.addBadge}>
            <Text style={styles.addBadgeText}>+</Text>
          </LinearGradient>
        </View>
        <View style={styles.myCardText}>
          <Text style={styles.myCardTitle}>My Status</Text>
          <Text style={styles.myCardSub}>Tap to add status update</Text>
        </View>
      </TouchableOpacity>

      {/* ── Section label ─────────────────────────────────────────── */}
      <View style={styles.sectionLabel}>
        <Text style={styles.sectionText}>RECENT UPDATES</Text>
      </View>

      {/* ── Status list ───────────────────────────────────────────── */}
      <FlatList
        data={STATUSES}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderStatus}
        ItemSeparatorComponent={() => <View style={styles.divider} />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 12 }}
      />

      <BottomNav active="status" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.sky1 },

  // Header
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 56, paddingBottom: 14,
  },
  title:      { fontSize: 26, fontWeight: '800', color: COLORS.blueDeep },
  addBtn:     { width: 34, height: 34, borderRadius: RADIUS.sm, alignItems: 'center', justifyContent: 'center', ...SHADOW.button },
  addBtnText: { color: '#fff', fontSize: 22, lineHeight: 26 },

  // My Status card
  myCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    marginHorizontal: 20, marginBottom: 18,
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.xl, padding: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.9)',
    ...SHADOW.card,
  },
  addBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 22, height: 22, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: COLORS.sky1,
  },
  addBadgeText: { color: '#fff', fontSize: 13, lineHeight: 15, fontWeight: '700' },
  myCardText:  { flex: 1 },
  myCardTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  myCardSub:   { fontSize: 13, color: COLORS.sub, marginTop: 2 },

  // Section label
  sectionLabel: { paddingHorizontal: 20, paddingBottom: 8 },
  sectionText:  { fontSize: 11, fontWeight: '700', color: COLORS.sub, letterSpacing: 0.8 },

  // Status rows
  statusRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 10, gap: 14,
  },
  ring: { borderRadius: 999, padding: 3 },
  ringInner: {
    backgroundColor: COLORS.sky1,
    borderRadius: 999, padding: 2,
  },
  statusMeta: { flex: 1 },
  statusName: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  statusTime: { fontSize: 12, color: COLORS.sub, marginTop: 2 },
  menuBtn:    { padding: 4 },
  menuDots:   { fontSize: 18, color: COLORS.sub, fontWeight: '700' },
  divider:    { height: 1, backgroundColor: COLORS.border, marginLeft: 88 },
});