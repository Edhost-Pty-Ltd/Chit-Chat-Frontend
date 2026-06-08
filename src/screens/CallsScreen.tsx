// ─── Screen 4: Calls — Glassmorphism ─────────────────────────────────────────
import React, { useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Avatar, BottomNav, GlassCard } from '../components';
import { CALLS } from '../data/mockData';
import { COLORS, GRADIENTS, RADIUS, SHADOW } from '../types/theme';
import { Call } from '../types';

type CallTab = 'All' | 'Missed' | 'Voicemail';

const CALL_ICON: Record<string, string> = {
  Outgoing: '↗️',
  Incoming: '↙️',
  Missed:   '❌',
};

export default function CallsScreen() {
  const [tab, setTab] = useState<CallTab>('All');
  const filtered = tab === 'Missed' ? CALLS.filter((c) => c.missed) : CALLS;

  const renderCall = ({ item }: { item: Call }) => (
    <TouchableOpacity style={styles.callRow} activeOpacity={0.7}>
      <Avatar initials={item.avatar} color={item.color} size={48} />
      <View style={styles.callMeta}>
        <Text style={styles.callName}>{item.name}</Text>
        <View style={styles.callSubRow}>
          <Text style={{ fontSize: 12 }}>{CALL_ICON[item.type]}</Text>
          <Text style={[styles.callType, item.missed && styles.callTypeMissed]}>
            {item.type}
          </Text>
        </View>
      </View>
      <View style={styles.callRight}>
        <Text style={styles.callTime}>{item.time}</Text>
        <TouchableOpacity style={styles.infoBtn}>
          <Text style={{ fontSize: 15 }}>ℹ️</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  return (
    <LinearGradient colors={GRADIENTS.bg} style={styles.root}>
      {/* Blobs */}
      <View style={[styles.blob, { width: 280, height: 280, top: -80, left: -60 }]} />
      <View style={[styles.blob, { width: 200, height: 200, bottom: 140, right: -60 }]} />

      {/* ── Header ───────────────────────────────────────────────── */}
      <View style={styles.header}>
        <Text style={styles.title}>Calls</Text>
        <TouchableOpacity>
          <LinearGradient colors={GRADIENTS.primary} style={styles.newCallBtn}>
            <Text style={{ fontSize: 18 }}>📞</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* ── Tab pills ────────────────────────────────────────────── */}
      <View style={styles.tabRow}>
        {(['All', 'Missed', 'Voicemail'] as CallTab[]).map((t) => {
          const isActive = tab === t;
          return isActive ? (
            <TouchableOpacity key={t} onPress={() => setTab(t)} activeOpacity={0.85}>
              <LinearGradient colors={GRADIENTS.primary} style={styles.tabPill}>
                <Text style={styles.tabTextActive}>{t}</Text>
              </LinearGradient>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              key={t} onPress={() => setTab(t)}
              style={styles.tabPillInactive} activeOpacity={0.7}
            >
              <Text style={styles.tabTextInactive}>{t}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── Call list ────────────────────────────────────────────── */}
      <GlassCard style={styles.listCard}>
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderCall}
          ItemSeparatorComponent={() => <View style={styles.divider} />}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 8 }}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyIcon}>📵</Text>
              <Text style={styles.emptyText}>No missed calls</Text>
            </View>
          }
        />
      </GlassCard>

      <BottomNav active="calls" />
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
  newCallBtn: { width: 36, height: 36, borderRadius: RADIUS.sm, alignItems: 'center', justifyContent: 'center', ...SHADOW.button },

  // Tabs
  tabRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 22, paddingBottom: 14 },
  tabPill: {
    paddingHorizontal: 20, paddingVertical: 9,
    borderRadius: RADIUS.full, ...SHADOW.button,
  },
  tabPillInactive: {
    paddingHorizontal: 20, paddingVertical: 9,
    borderRadius: RADIUS.full,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.20)',
  },
  tabTextActive:   { fontSize: 13, fontWeight: '700', color: '#fff' },
  tabTextInactive: { fontSize: 13, fontWeight: '500', color: 'rgba(255,255,255,0.65)' },

  // List
  listCard: {
    flex: 1, marginHorizontal: 16, marginBottom: 8,
    borderRadius: RADIUS.xl, overflow: 'hidden',
    zIndex: 1,
  },

  // Call rows
  callRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12, gap: 14,
  },
  callMeta:       { flex: 1 },
  callName:       { fontSize: 15, fontWeight: '700', color: '#fff', marginBottom: 3 },
  callSubRow:     { flexDirection: 'row', alignItems: 'center', gap: 5 },
  callType:       { fontSize: 12, color: 'rgba(255,255,255,0.55)' },
  callTypeMissed: { color: COLORS.missed, fontWeight: '600' },
  callRight:      { alignItems: 'flex-end', gap: 6 },
  callTime:       { fontSize: 12, color: 'rgba(255,255,255,0.45)' },
  infoBtn: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.20)',
  },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginLeft: 78 },

  // Empty
  emptyWrap: { alignItems: 'center', paddingTop: 60 },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyText: { fontSize: 15, color: 'rgba(255,255,255,0.55)' },
});
