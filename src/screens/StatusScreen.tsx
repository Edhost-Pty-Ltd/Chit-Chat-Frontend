// ─── Screen 5: Status — Glassmorphism ────────────────────────────────────────
import React from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Avatar, BottomNav, GlassCard } from '../components';
import { STATUSES } from '../data/mockData';
import { COLORS, GRADIENTS, RADIUS, SHADOW } from '../types/theme';
import { StatusUpdate } from '../types';

export default function StatusScreen() {
  const renderStatus = ({ item }: { item: StatusUpdate }) => (
    <TouchableOpacity style={styles.statusRow} activeOpacity={0.7}>
      {/* Gradient progress ring */}
      <LinearGradient
        colors={[item.color, '#38bff8']}
        style={styles.ring}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      >
        <View style={styles.ringInner}>
          <Avatar initials={item.avatar} color={item.color} size={46} />
        </View>
      </LinearGradient>
      <View style={styles.statusMeta}>
        <Text style={styles.statusName}>{item.name}</Text>
        <Text style={styles.statusTime}>{item.time}</Text>
      </View>
      <TouchableOpacity style={styles.menuBtn}>
        <Text style={styles.menuDots}>⋯</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <LinearGradient colors={GRADIENTS.bg} style={styles.root}>
      {/* Blobs */}
      <View style={[styles.blob, { width: 300, height: 300, top: -100, right: -80 }]} />
      <View style={[styles.blob, { width: 180, height: 180, bottom: 120, left: -50 }]} />

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
      <GlassCard style={styles.myCard}>
        <View style={{ position: 'relative' }}>
          <Avatar initials="ME" color={COLORS.blue} size={56} />
          <LinearGradient colors={GRADIENTS.primary} style={styles.addBadge}>
            <Text style={styles.addBadgeText}>+</Text>
          </LinearGradient>
        </View>
        <View style={styles.myCardText}>
          <Text style={styles.myCardTitle}>My Status</Text>
          <Text style={styles.myCardSub}>Tap to add status update</Text>
        </View>
        <View style={styles.cameraBtn}>
          <Text style={{ fontSize: 18 }}>📷</Text>
        </View>
      </GlassCard>

      {/* ── Section label ─────────────────────────────────────────── */}
      <View style={styles.sectionLabel}>
        <Text style={styles.sectionText}>RECENT UPDATES</Text>
        <View style={styles.sectionLine} />
      </View>

      {/* ── Status list ───────────────────────────────────────────── */}
      <GlassCard style={styles.listCard}>
        <FlatList
          data={STATUSES}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderStatus}
          ItemSeparatorComponent={() => <View style={styles.divider} />}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 8 }}
        />
      </GlassCard>

      <BottomNav active="status" />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  blob: {
    position: 'absolute', borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.07)',
    zIndex: 0,
  },

  // Header
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 22, paddingTop: 58, paddingBottom: 14,
  },
  title:      { fontSize: 28, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
  addBtn:     { width: 36, height: 36, borderRadius: RADIUS.sm, alignItems: 'center', justifyContent: 'center', ...SHADOW.button },
  addBtnText: { color: '#fff', fontSize: 24, lineHeight: 28 },

  // My Status card
  myCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    marginHorizontal: 16, marginBottom: 16,
    borderRadius: RADIUS.xl, padding: 16,
  },
  addBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 22, height: 22, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'rgba(10,36,99,0.8)',
  },
  addBadgeText: { color: '#fff', fontSize: 13, lineHeight: 15, fontWeight: '700' },
  myCardText:   { flex: 1 },
  myCardTitle:  { fontSize: 15, fontWeight: '700', color: '#fff' },
  myCardSub:    { fontSize: 13, color: 'rgba(255,255,255,0.60)', marginTop: 2 },
  cameraBtn:    {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.20)',
  },

  // Section label
  sectionLabel: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 20, paddingBottom: 10,
  },
  sectionText: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.45)', letterSpacing: 1 },
  sectionLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.12)' },

  // Status list
  listCard: {
    flex: 1, marginHorizontal: 16, marginBottom: 8,
    borderRadius: RADIUS.xl, overflow: 'hidden',
    zIndex: 1,
  },
  statusRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12, gap: 14,
  },
  ring:      { borderRadius: 999, padding: 3 },
  ringInner: {
    backgroundColor: 'rgba(10,36,99,0.6)',
    borderRadius: 999, padding: 2,
  },
  statusMeta: { flex: 1 },
  statusName: { fontSize: 15, fontWeight: '700', color: '#fff' },
  statusTime: { fontSize: 12, color: 'rgba(255,255,255,0.55)', marginTop: 2 },
  menuBtn:    { padding: 8 },
  menuDots:   { fontSize: 18, color: 'rgba(255,255,255,0.50)', fontWeight: '700' },
  divider:    { height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginLeft: 88 },
});
