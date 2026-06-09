// ─── Screen: Status ──────────────────────────────────────────────────────────
import React from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Avatar, BottomNav } from '../components';
import { STATUSES } from '../data/mockData';
import { COLORS, RADIUS, SHADOW, GRADIENTS, GLASS } from '../types/theme';
import { StatusUpdate } from '../types';

export default function StatusScreen() {
  const renderStatus = ({ item }: { item: StatusUpdate }) => (
    <TouchableOpacity style={styles.statusCard} activeOpacity={0.75}>
      {/* Gradient ring */}
      <LinearGradient colors={[item.color, COLORS.blue]} style={styles.ring} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <View style={styles.ringInner}>
          <Avatar initials={item.avatar} color={item.color} size={44} />
        </View>
      </LinearGradient>
      <View style={styles.statusMeta}>
        <Text style={styles.statusName}>{item.name}</Text>
        <Text style={styles.statusTime}>{item.time}</Text>
      </View>
      <Ionicons name="ellipsis-vertical" size={18} color={COLORS.sub} />
    </TouchableOpacity>
  );

  return (
    <View style={styles.root}>
      <LinearGradient colors={GRADIENTS.bg} style={StyleSheet.absoluteFill} />

      <View style={styles.header}>
        <Text style={styles.title}>Updates</Text>
      </View>

      {/* My Status glass card */}
      <TouchableOpacity style={styles.myCard} activeOpacity={0.8}>
        <View style={styles.meAvatarWrap}>
          <Avatar initials="ME" color={COLORS.blue} size={52} />
          <LinearGradient colors={GRADIENTS.primary} style={styles.mePlusBadge}>
            <Ionicons name="add" size={12} color="#fff" />
          </LinearGradient>
        </View>
        <View style={styles.myCardText}>
          <Text style={styles.myCardTitle}>My Status</Text>
          <Text style={styles.myCardSub}>Tap to add status update</Text>
        </View>
      </TouchableOpacity>

      <Text style={styles.sectionText}>RECENT UPDATES</Text>

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
