// ─── Screen 4: Calls ─────────────────────────────────────────────────────────
import React, { useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Avatar, BottomNav } from '../components';
import { CALLS } from '../data/mockData';
import { COLORS, RADIUS, SHADOW, GRADIENTS } from '../types/theme';
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
    <View style={styles.callRow}>
      <Avatar initials={item.avatar} color={item.color} size={46} />

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
          <Text style={{ fontSize: 16 }}>ℹ️</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.root}>
      {/* ── Header ───────────────────────────────────────────────── */}
      <View style={styles.header}>
        <Text style={styles.title}>Calls</Text>
        <TouchableOpacity>
          <LinearGradient colors={GRADIENTS.primary} style={styles.newCallBtn}>
            <Text style={{ fontSize: 16 }}>📞</Text>
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
              key={t}
              onPress={() => setTab(t)}
              style={styles.tabPillInactive}
              activeOpacity={0.7}
            >
              <Text style={styles.tabTextInactive}>{t}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── Call list ────────────────────────────────────────────── */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderCall}
        ItemSeparatorComponent={() => <View style={styles.divider} />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 12 }}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyIcon}>📵</Text>
            <Text style={styles.emptyText}>No missed calls</Text>
          </View>
        }
      />

      <BottomNav active="calls" />
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
  newCallBtn: {
    width: 34, height: 34, borderRadius: RADIUS.sm,
    alignItems: 'center', justifyContent: 'center',
    ...SHADOW.button,
  },

  // Tabs
  tabRow: {
    flexDirection: 'row', gap: 8,
    paddingHorizontal: 20, paddingBottom: 14,
  },
  tabPill: {
    paddingHorizontal: 18, paddingVertical: 8,
    borderRadius: RADIUS.full,
    ...SHADOW.button,
  },
  tabPillInactive: {
    paddingHorizontal: 18, paddingVertical: 8,
    borderRadius: RADIUS.full,
    backgroundColor: 'rgba(26,127,232,0.08)',
  },
  tabTextActive:   { fontSize: 13, fontWeight: '700', color: '#fff' },
  tabTextInactive: { fontSize: 13, fontWeight: '500', color: COLORS.sub },

  // Call rows
  callRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 10, gap: 12,
  },
  callMeta:    { flex: 1 },
  callName:    { fontSize: 15, fontWeight: '700', color: COLORS.text, marginBottom: 3 },
  callSubRow:  { flexDirection: 'row', alignItems: 'center', gap: 4 },
  callType:    { fontSize: 12, color: COLORS.sub },
  callTypeMissed: { color: COLORS.missed, fontWeight: '600' },
  callRight:   { alignItems: 'flex-end', gap: 6 },
  callTime:    { fontSize: 12, color: COLORS.sub },
  infoBtn: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: 'rgba(26,127,232,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },
  divider: { height: 1, backgroundColor: COLORS.border, marginLeft: 78 },

  // Empty state
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyText: { fontSize: 15, color: COLORS.sub },
});