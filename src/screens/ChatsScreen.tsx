// ─── Screen 2: Chats — Firebase Real-time ────────────────────────────────────
import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, TextInput, ScrollView,
  ActivityIndicator, Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { collection, query, where, orderBy, onSnapshot, Timestamp } from 'firebase/firestore';
import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import { db } from '../config/firebase';
import { getOrCreateDirectChat } from '../hooks/useChatActions';
import { useContacts, AppContact } from '../hooks/useContacts';
import { Avatar, BottomNav, GlassCard } from '../components';
import { COLORS, GRADIENTS, RADIUS, SHADOW } from '../types/theme';
import { RootStackParamList } from '../types';

type NavProp = NativeStackNavigationProp<RootStackParamList, 'Chats'>;

interface ChatPreview {
  chatId:       string;
  type:         'direct' | 'group';
  members:      string[];
  groupName:    string | null;
  displayName:  string;   // resolved from contacts
  lastMessage:  string;
  timestamp:    Date | null;
  unreadCount:  number;
}

function formatTime(date: Date | null): string {
  if (!date) return '';
  const now   = new Date();
  const diff  = now.getTime() - date.getTime();
  const days  = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (days === 1) return 'Yesterday';
  if (days < 7)  return date.toLocaleDateString([], { weekday: 'long' });
  return date.toLocaleDateString([], { day: '2-digit', month: '2-digit' });
}

export default function ChatsScreen() {
  const navigation = useNavigation<NavProp>();
  const [currentUser,  setCurrentUser]  = useState<FirebaseAuthTypes.User | null>(null);
  const [chats,        setChats]        = useState<ChatPreview[]>([]);
  const [loadingChats, setLoadingChats] = useState(true);
  const [search,       setSearch]       = useState('');

  const { contacts, loading: loadingContacts } = useContacts();

  // ── Auth state ────────────────────────────────────────────────
  useEffect(() => {
    const unsub = auth().onAuthStateChanged(setCurrentUser);
    return unsub;
  }, []);

  // ── Real-time chat listener ───────────────────────────────────
  useEffect(() => {
    if (!currentUser) return;

    const q = query(
      collection(db, 'chats'),
      where('members', 'array-contains', currentUser.uid),
      orderBy('lastMessage.timestamp', 'desc'),
    );

    const unsub = onSnapshot(q, (snap) => {
      const result: ChatPreview[] = snap.docs.map((doc) => {
        const d  = doc.data();
        const lm = d.lastMessage;

        // Resolve display name from contacts
        let displayName = d.groupName ?? 'Unknown';
        if (d.type === 'direct') {
          const otherId = (d.members as string[]).find(
            (id: string) => id !== currentUser.uid
          );
          const match = contacts.find((c) => c.userId === otherId);
          displayName = match?.displayName ?? otherId ?? 'Unknown';
        }

        return {
          chatId:      doc.id,
          type:        d.type ?? 'direct',
          members:     d.members ?? [],
          groupName:   d.groupName ?? null,
          displayName,
          lastMessage: lm?.text ?? '',
          timestamp:   lm?.timestamp
            ? (lm.timestamp as Timestamp).toDate()
            : null,
          unreadCount: d.unreadCounts?.[currentUser.uid] ?? 0,
        };
      });
      setChats(result);
      setLoadingChats(false);
    });

    return () => unsub();
  }, [currentUser, contacts]);

  // ── Open or create a direct chat ─────────────────────────────
  async function openChat(contact: AppContact) {
    if (!currentUser) return;
    const chatId = await getOrCreateDirectChat(currentUser.uid, contact.userId);
    navigation.navigate('Chat', {
      chatId,
      displayName: contact.displayName,
      isGroup: false,
    });
  }

  const filtered = chats.filter((c) =>
    c.displayName.toLowerCase().includes(search.toLowerCase())
  );

  // ── Render chat row ───────────────────────────────────────────
  const renderChat = ({ item }: { item: ChatPreview }) => {
    const initials = item.displayName.slice(0, 2).toUpperCase();
    const color    = stringToColor(item.chatId);

    return (
      <TouchableOpacity
        style={styles.chatRow}
        activeOpacity={0.7}
        onPress={() => navigation.navigate('Chat', {
          chatId:      item.chatId,
          displayName: item.displayName,
          isGroup:     item.type === 'group',
        })}
      >
        <Avatar initials={initials} color={color} size={50} />
        <View style={styles.chatMeta}>
          <View style={styles.rowBetween}>
            <Text style={styles.chatName}>{item.displayName}</Text>
            <Text style={[styles.chatTime, item.unreadCount > 0 && styles.chatTimeUnread]}>
              {formatTime(item.timestamp)}
            </Text>
          </View>
          <View style={styles.rowBetween}>
            <Text style={styles.chatPreview} numberOfLines={1}>
              {item.lastMessage || 'No messages yet'}
            </Text>
            {item.unreadCount > 0 && (
              <LinearGradient colors={GRADIENTS.primary} style={styles.badge}>
                <Text style={styles.badgeText}>
                  {item.unreadCount > 99 ? '99+' : item.unreadCount}
                </Text>
              </LinearGradient>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // ── Render contact story ──────────────────────────────────────
  const renderStory = ({ item }: { item: AppContact }) => (
    <TouchableOpacity style={styles.storyItem} onPress={() => openChat(item)}>
      <LinearGradient colors={[stringToColor(item.userId), COLORS.blue]} style={styles.storyRing}>
        <View style={styles.storyInner}>
          <Avatar
            initials={item.displayName.slice(0, 2).toUpperCase()}
            color={stringToColor(item.userId)}
            size={44}
          />
        </View>
      </LinearGradient>
      <Text style={styles.storyName} numberOfLines={1}>
        {item.displayName.split(' ')[0]}
      </Text>
    </TouchableOpacity>
  );

  return (
    <LinearGradient colors={GRADIENTS.bg} style={styles.root}>
      <View style={[styles.blob, { width: 300, height: 300, top: -100, right: -80 }]} />
      <View style={[styles.blob, { width: 200, height: 200, bottom: 100, left: -60 }]} />

      {/* ── Header ─────────────────────────────────────────────── */}
      <View style={styles.header}>
        <Text style={styles.title}>Chats</Text>
        <TouchableOpacity onPress={() => navigation.navigate('NewGroup' as any)}>
          <LinearGradient colors={GRADIENTS.primary} style={styles.addBtn}>
            <Text style={styles.addBtnText}>+</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* ── Search ─────────────────────────────────────────────── */}
      <View style={styles.searchWrap}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search conversations..."
          placeholderTextColor="rgba(255,255,255,0.40)"
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* ── Contact stories row ────────────────────────────────── */}
      {!loadingContacts && contacts.length > 0 && (
        <ScrollView
          horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.storiesRow}
        >
          {/* My story */}
          <View style={styles.storyItem}>
            <LinearGradient
              colors={['rgba(255,255,255,0.25)', 'rgba(255,255,255,0.08)']}
              style={styles.storyRing}
            >
              <View style={styles.storyInner}>
                <View style={styles.myStoryCircle}>
                  <Text style={styles.myStoryPlus}>+</Text>
                </View>
              </View>
            </LinearGradient>
            <Text style={styles.storyName}>My Story</Text>
          </View>
          {contacts.slice(0, 8).map((c) => (
            <View key={c.userId}>{renderStory({ item: c })}</View>
          ))}
        </ScrollView>
      )}

      {/* ── Chat list ──────────────────────────────────────────── */}
      <GlassCard style={styles.listCard}>
        {loadingChats ? (
          <View style={styles.centerWrap}>
            <ActivityIndicator color="#fff" size="large" />
            <Text style={styles.loadingText}>Loading chats...</Text>
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.centerWrap}>
            <Text style={styles.emptyIcon}>💬</Text>
            <Text style={styles.emptyTitle}>No chats yet</Text>
            <Text style={styles.emptyText}>
              Tap a contact above to start a conversation
            </Text>
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.chatId}
            renderItem={renderChat}
            ItemSeparatorComponent={() => <View style={styles.divider} />}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 8 }}
          />
        )}
      </GlassCard>

      <BottomNav active="chats" />
    </LinearGradient>
  );
}

// Deterministic color from any string
function stringToColor(str: string): string {
  const colors = [
    '#f97316','#8b5cf6','#ec4899','#06b6d4',
    '#10b981','#f59e0b','#6366f1','#e11d48',
  ];
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  blob: { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.07)', zIndex: 0 },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 22, paddingTop: 58, paddingBottom: 12, zIndex: 1,
  },
  title:      { fontSize: 28, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
  addBtn:     { width: 36, height: 36, borderRadius: RADIUS.sm, alignItems: 'center', justifyContent: 'center', ...SHADOW.button },
  addBtnText: { color: '#fff', fontSize: 24, lineHeight: 28 },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 22, marginBottom: 14,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderRadius: RADIUS.full, paddingHorizontal: 16, paddingVertical: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.20)', zIndex: 1,
  },
  searchIcon:  { fontSize: 14 },
  searchInput: { flex: 1, fontSize: 14, color: '#fff' },

  storiesRow:    { paddingHorizontal: 18, paddingBottom: 12, gap: 14 },
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

  listCard: { flex: 1, marginHorizontal: 16, marginBottom: 8, borderRadius: RADIUS.xl, overflow: 'hidden', zIndex: 1 },

  chatRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  chatMeta:       { flex: 1, gap: 4 },
  rowBetween:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chatName:       { fontSize: 15, fontWeight: '700', color: '#fff' },
  chatTime:       { fontSize: 11, color: 'rgba(255,255,255,0.45)' },
  chatTimeUnread: { color: '#7dd3fc' },
  chatPreview:    { fontSize: 13, color: 'rgba(255,255,255,0.60)', flex: 1, marginRight: 8 },
  badge:          { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  badgeText:      { color: '#fff', fontSize: 10, fontWeight: '700' },
  divider:        { height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginLeft: 78 },

  centerWrap:   { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  loadingText:  { color: 'rgba(255,255,255,0.6)', marginTop: 12, fontSize: 14 },
  emptyIcon:    { fontSize: 40, marginBottom: 12 },
  emptyTitle:   { fontSize: 16, fontWeight: '700', color: '#fff', marginBottom: 6 },
  emptyText:    { fontSize: 13, color: 'rgba(255,255,255,0.55)', textAlign: 'center' },
});
