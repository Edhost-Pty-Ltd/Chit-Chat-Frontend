// ─── Screen 2: Chats ─────────────────────────────────────────────────────────
import React from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, TextInput, ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { Avatar, BottomNav } from '../components';
import { CONTACTS } from '../data/mockData';
import { COLORS, RADIUS, SHADOW, GRADIENTS } from '../types/theme';
import { Contact, RootStackParamList } from '../types';

type NavProp = NativeStackNavigationProp<RootStackParamList, 'Chats'>;

export default function ChatsScreen() {
  const navigation = useNavigation<NavProp>();

  // ── Story row ────────────────────────────────────────────────────────────
  const renderStory = ({ item }: { item: Contact }) => (
    <View style={styles.storyItem}>
      {/* Gradient ring */}
      <LinearGradient colors={[item.color, COLORS.blue]} style={styles.storyRing}>
        <View style={styles.storyInner}>
          <Avatar initials={item.avatar} color={item.color} size={46} />
        </View>
      </LinearGradient>
      <Text style={styles.storyName} numberOfLines={1}>
        {item.name.split(' ')[0]}
      </Text>
    </View>
  );

  // ── Chat row ─────────────────────────────────────────────────────────────
  const renderChat = ({ item }: { item: Contact }) => (
    <TouchableOpacity
      style={styles.chatRow}
      activeOpacity={0.7}
      onPress={() => navigation.navigate('Chat', { contact: item })}
    >
      <Avatar initials={item.avatar} color={item.color} size={50} status={item.status} />

      <View style={styles.chatMeta}>
        {/* Name + time */}
        <View style={styles.rowBetween}>
          <Text style={styles.chatName}>{item.name}</Text>
          <Text style={[styles.chatTime, item.unread > 0 && styles.chatTimeUnread]}>
            {item.time}
          </Text>
        </View>

        {/* Preview + badge */}
        <View style={styles.rowBetween}>
          <Text style={styles.chatPreview} numberOfLines={1}>
            {item.lastMsg}
          </Text>
          {item.unread > 0 && (
            <LinearGradient colors={GRADIENTS.primary} style={styles.badge}>
              <Text style={styles.badgeText}>{item.unread}</Text>
            </LinearGradient>
          )}
          {item.pinned && !item.unread && (
            <Text style={{ fontSize: 13 }}>📌</Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.root}>
      {/* ── Header ───────────────────────────────────────────────── */}
      <View style={styles.header}>
        <Text style={styles.title}>Chats</Text>
        <TouchableOpacity>
          <LinearGradient colors={GRADIENTS.primary} style={styles.addBtn}>
            <Text style={styles.addBtnText}>+</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* ── Search bar ───────────────────────────────────────────── */}
      <View style={styles.searchWrap}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search"
          placeholderTextColor={COLORS.sub}
        />
      </View>

      {/* ── Stories ──────────────────────────────────────────────── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.storiesRow}
      >
        {/* My story */}
        <View style={styles.storyItem}>
          <LinearGradient colors={[COLORS.sky2, COLORS.blue]} style={[styles.storyRing, styles.myStoryRing]}>
            <View style={styles.storyInner}>
              <View style={styles.myStoryCircle}>
                <Text style={styles.myStoryPlus}>+</Text>
              </View>
            </View>
          </LinearGradient>
          <Text style={styles.storyName}>Your Story</Text>
        </View>

        {CONTACTS.slice(0, 5).map((c) => (
          <View key={c.id}>{renderStory({ item: c })}</View>
        ))}
      </ScrollView>

      {/* ── Chat list ─────────────────────────────────────────────── */}
      <FlatList
        data={CONTACTS}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderChat}
        ItemSeparatorComponent={() => <View style={styles.divider} />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 12 }}
      />

      <BottomNav active="chats" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.sky1 },

  // Header
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 56, paddingBottom: 10,
  },
  title:      { fontSize: 26, fontWeight: '800', color: COLORS.blueDeep },
  addBtn:     { width: 34, height: 34, borderRadius: RADIUS.sm, alignItems: 'center', justifyContent: 'center', ...SHADOW.button },
  addBtnText: { color: '#fff', fontSize: 22, lineHeight: 26 },

  // Search
  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 20, marginBottom: 10,
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderRadius: RADIUS.md,
    paddingHorizontal: 12, paddingVertical: 9,
    borderWidth: 1, borderColor: COLORS.border,
    gap: 8,
  },
  searchIcon:  { fontSize: 14, color: COLORS.sub },
  searchInput: { flex: 1, fontSize: 14, color: COLORS.text },

  // Stories
  storiesRow: { paddingHorizontal: 16, paddingVertical: 8, gap: 14 },
  storyItem:  { alignItems: 'center', gap: 5, width: 62 },
  storyName:  { fontSize: 10, color: COLORS.sub, textAlign: 'center' },
  storyRing:  { borderRadius: 999, padding: 2.5 },
  myStoryRing:{ borderStyle: 'dashed' },
  storyInner: { backgroundColor: COLORS.sky1, borderRadius: 999, padding: 2 },
  myStoryCircle: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: COLORS.inputBg,
    alignItems: 'center', justifyContent: 'center',
  },
  myStoryPlus: { fontSize: 22, color: COLORS.blue, lineHeight: 26 },

  // Chat rows
  chatRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 10, gap: 12,
    backgroundColor: 'transparent',
  },
  chatMeta:    { flex: 1, gap: 4 },
  rowBetween:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chatName:    { fontSize: 15, fontWeight: '700', color: COLORS.text },
  chatTime:    { fontSize: 11, color: COLORS.sub },
  chatTimeUnread: { color: COLORS.blue },
  chatPreview: { fontSize: 13, color: COLORS.sub, flex: 1, marginRight: 8 },
  badge:       { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', ...SHADOW.button },
  badgeText:   { color: '#fff', fontSize: 11, fontWeight: '700' },
  divider:     { height: 1, backgroundColor: COLORS.border, marginLeft: 82 },
});