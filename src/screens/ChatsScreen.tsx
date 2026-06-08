// ─── Screen 2: Chats — Glassmorphism ─────────────────────────────────────────
import React from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, TextInput, ScrollView, Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Avatar, BottomNav, GlassCard } from '../components';
import { CONTACTS } from '../data/mockData';
import { COLORS, GRADIENTS, RADIUS, SHADOW } from '../types/theme';
import { Contact, RootStackParamList } from '../types';

type NavProp = NativeStackNavigationProp<RootStackParamList, 'Chats'>;

export default function ChatsScreen() {
  const navigation = useNavigation<NavProp>();

  const renderStory = ({ item }: { item: Contact }) => (
    <TouchableOpacity style={styles.storyItem} activeOpacity={0.8}>
      <LinearGradient colors={[item.color, '#1a7fe8']} style={styles.storyRing}>
        <View style={styles.storyInner}>
          <Avatar initials={item.avatar} color={item.color} size={44} />
        </View>
      </LinearGradient>
      <Text style={styles.storyName} numberOfLines={1}>
        {item.name.split(' ')[0]}
      </Text>
    </TouchableOpacity>
  );

  const renderChat = ({ item }: { item: Contact }) => (
    <TouchableOpacity
      style={styles.chatRow}
      activeOpacity={0.7}
      onPress={() => navigation.navigate('Chat', { contact: item })}
    >
      <Avatar initials={item.avatar} color={item.color} size={50} status={item.status} />
      <View style={styles.chatMeta}>
        <View style={styles.rowBetween}>
          <Text style={styles.chatName}>{item.name}</Text>
          <Text style={[styles.chatTime, item.unread > 0 && styles.chatTimeUnread]}>
            {item.time}
          </Text>
        </View>
        <View style={styles.rowBetween}>
          <Text style={styles.chatPreview} numberOfLines={1}>{item.lastMsg}</Text>
          {item.unread > 0 && (
            <LinearGradient colors={GRADIENTS.primary} style={styles.badge}>
              <Text style={styles.badgeText}>{item.unread}</Text>
            </LinearGradient>
          )}
          {item.pinned && !item.unread && <Text style={{ fontSize: 12 }}>📌</Text>}
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <LinearGradient colors={GRADIENTS.bg} style={styles.root}>
      {/* Blobs */}
      <View style={[styles.blob, { width: 300, height: 300, top: -100, right: -80 }]} />
      <View style={[styles.blob, { width: 200, height: 200, bottom: 100, left: -60 }]} />

      {/* ── Header ───────────────────────────────────────────────── */}
      <View style={styles.header}>
        <Text style={styles.title}>Chats</Text>
        <TouchableOpacity>
          <LinearGradient colors={GRADIENTS.primary} style={styles.addBtn}>
            <Text style={styles.addBtnText}>+</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* ── Search ───────────────────────────────────────────────── */}
      <View style={styles.searchWrap}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search conversations..."
          placeholderTextColor="rgba(255,255,255,0.40)"
        />
      </View>

      {/* ── Stories ──────────────────────────────────────────────── */}
      <ScrollView
        horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.storiesRow}
      >
        {/* My story */}
        <View style={styles.storyItem}>
          <LinearGradient colors={['rgba(255,255,255,0.25)', 'rgba(255,255,255,0.08)']} style={[styles.storyRing, { borderStyle: 'dashed' }]}>
            <View style={styles.storyInner}>
              <View style={styles.myStoryCircle}>
                <Text style={styles.myStoryPlus}>+</Text>
              </View>
            </View>
          </LinearGradient>
          <Text style={styles.storyName}>My Story</Text>
        </View>
        {CONTACTS.slice(0, 5).map((c) => (
          <View key={c.id}>{renderStory({ item: c })}</View>
        ))}
      </ScrollView>

      {/* ── Chat list ─────────────────────────────────────────────── */}
      <GlassCard style={styles.listCard}>
        <FlatList
          data={CONTACTS}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderChat}
          ItemSeparatorComponent={() => <View style={styles.divider} />}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 8 }}
        />
      </GlassCard>

      <BottomNav active="chats" />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  blob: {
    position: 'absolute', borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },

  // Header
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 22, paddingTop: 58, paddingBottom: 12,
  },
  title:      { fontSize: 28, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
  addBtn:     { width: 36, height: 36, borderRadius: RADIUS.sm, alignItems: 'center', justifyContent: 'center', ...SHADOW.button },
  addBtnText: { color: '#fff', fontSize: 24, lineHeight: 28 },

  // Search
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 22, marginBottom: 14,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderRadius: RADIUS.full,
    paddingHorizontal: 16, paddingVertical: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.20)',
  },
  searchIcon:  { fontSize: 14 },
  searchInput: { flex: 1, fontSize: 14, color: '#fff' },

  // Stories
  storiesRow:    { paddingHorizontal: 18, paddingVertical: 4, gap: 14, paddingBottom: 12 },
  storyItem:     { alignItems: 'center', gap: 6, width: 64 },
  storyName:     { fontSize: 10, color: 'rgba(255,255,255,0.70)', textAlign: 'center' },
  storyRing:     { borderRadius: 999, padding: 2.5 },
  storyInner:    { backgroundColor: 'rgba(10,36,99,0.5)', borderRadius: 999, padding: 2 },
  myStoryCircle: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
  },
  myStoryPlus: { fontSize: 22, color: '#fff', lineHeight: 26 },

  // List card
  listCard: {
    flex: 1, marginHorizontal: 16, marginBottom: 8,
    borderRadius: RADIUS.xl, overflow: 'hidden',
  },

  // Chat rows
  chatRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12, gap: 12,
  },
  chatMeta:       { flex: 1, gap: 4 },
  rowBetween:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chatName:       { fontSize: 15, fontWeight: '700', color: '#fff' },
  chatTime:       { fontSize: 11, color: 'rgba(255,255,255,0.45)' },
  chatTimeUnread: { color: '#7dd3fc' },
  chatPreview:    { fontSize: 13, color: 'rgba(255,255,255,0.60)', flex: 1, marginRight: 8 },
  badge:          { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', ...SHADOW.button },
  badgeText:      { color: '#fff', fontSize: 11, fontWeight: '700' },
  divider:        { height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginLeft: 78 },
});
