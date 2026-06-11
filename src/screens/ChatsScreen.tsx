// ─── Screen: Chats ───────────────────────────────────────────────────────────
import React, { useState, useRef, useMemo, useEffect } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  TextInput, Modal, Pressable, ScrollView, Animated,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { BottomNav } from '../components';
import { useAuth } from '../hooks/useAuth';
import { useChats, ChatPreview } from '../hooks/useChats';
import { useContacts, AppContact } from '../hooks/useContacts';
import { getOrCreateDirectChat } from '../hooks/useChatActions';
import { resolveDisplayName } from '../utils/resolveDisplayName';
import { db } from '../config/firebase';
import { COLORS, RADIUS, SHADOW, GRADIENTS, GLASS } from '../types/theme';
import { RootStackParamList } from '../types';

import { AppBg, AppText, AppIcon, useForeground, useTypography } from '../context/ThemeContext';
type NavProp   = NativeStackNavigationProp<RootStackParamList, 'Chats'>;
type TabType   = 'Chats' | 'Groups';
type SheetMode = 'select' | 'newContact' | 'newGroup';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(date: Date | null): string {
  if (!date) return '';
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (days === 1) return 'Yesterday';
  if (days < 7) return date.toLocaleDateString([], { weekday: 'long' });
  return date.toLocaleDateString([], { day: '2-digit', month: '2-digit' });
}

function stringToColor(str: string): string {
  const colors = ['#f97316','#8b5cf6','#ec4899','#06b6d4','#10b981','#f59e0b','#6366f1','#e11d48'];
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

// ─── Chat Avatar ──────────────────────────────────────────────────────────────
function ChatAvatar({ displayName }: { displayName: string }) {
  const color = stringToColor(displayName);
  const initials = getInitials(displayName);
  return (
    <View style={[styles.avatarCircle, { backgroundColor: color }]}>
      <Text style={styles.avatarText}>{initials}</Text>
    </View>
  );
}

// ─── Dial-pad keypad ──────────────────────────────────────────────────────────
const KEY_ROWS = [
  [{ d: '1', s: '' },    { d: '2', s: 'ABC' },  { d: '3', s: 'DEF'  }],
  [{ d: '4', s: 'GHI' }, { d: '5', s: 'JKL' },  { d: '6', s: 'MNO'  }],
  [{ d: '7', s: 'PQRS'}, { d: '8', s: 'TUV' },  { d: '9', s: 'WXYZ' }],
  [{ d: '*', s: '' },    { d: '0', s: '+' },     { d: '#', s: ''     }],
];

function NewContactSheet({ onBack, onDone }: { onBack: () => void; onDone: () => void }) {
  const [number, setNumber] = useState('');
  const [name,   setName]   = useState('');
  const press = (k: string) => setNumber((n) => n + k);
  const del   = () => setNumber((n) => n.slice(0, -1));

  return (
    <>
      <View style={styles.sheetSubHeader}>
        <TouchableOpacity onPress={onBack} style={styles.iconPad}>
          <AppIcon name="chevron-back" size={22} color={COLORS.blue} />
        </TouchableOpacity>
        <AppText style={styles.sheetTitle}>New Contact</AppText>
      </View>

      {/* Name input — glass */}
      <View style={styles.glassInput}>
        <AppIcon name="person-outline" size={18} color={COLORS.sub} />
        <TextInput style={styles.inputField} placeholder="Contact name"
          placeholderTextColor={COLORS.sub} value={name} onChangeText={setName} />
      </View>

      {/* Number display */}
      <View style={styles.numberRow}>
        <AppText style={styles.numberText} numberOfLines={1}>{number || ' '}</AppText>
        {number.length > 0 && (
          <TouchableOpacity onPress={del} style={styles.iconPad}>
            <AppIcon name="backspace-outline" size={22} color={COLORS.blue} />
          </TouchableOpacity>
        )}
      </View>

      {/* Keypad */}
      <View style={styles.keyGrid}>
        {KEY_ROWS.map((row, ri) => (
          <View key={ri} style={styles.keyRow}>
            {row.map((k) => (
              <TouchableOpacity key={k.d} style={styles.keyBtn} activeOpacity={0.65}
                onPress={() => press(k.d)}>
                <AppText style={styles.keyDigit}>{k.d}</AppText>
                {k.s ? <AppText style={styles.keySub}>{k.s}</AppText> : null}
              </TouchableOpacity>
            ))}
          </View>
        ))}
      </View>

      <View style={styles.rowActions}>
        <TouchableOpacity style={styles.cancelBtn} onPress={onBack} activeOpacity={0.8}>
          <AppText style={styles.cancelText}>Cancel</AppText>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.confirmBtn, (!number || !name) && styles.dimmed]}
          activeOpacity={number && name ? 0.85 : 1}
          onPress={() => { if (number && name) onDone(); }}>
          <LinearGradient colors={GRADIENTS.primary} style={styles.confirmGrad}>
            <AppIcon name="person-add-outline" size={18} color="#fff" fixedColor />
            <AppText fixedColor style={styles.confirmText}>Save Contact</AppText>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </>
  );
}

// ─── New Group sheet ──────────────────────────────────────────────────────────
function NewGroupSheet({
  onBack,
  onDone,
  contacts,
}: {
  onBack: () => void;
  onDone: () => void;
  contacts: AppContact[];
}) {
  const [selected,  setSelected]  = useState<string[]>([]);
  const [groupName, setGroupName] = useState('');
  const [nameError, setNameError] = useState('');

  const toggle = (userId: string) =>
    setSelected((prev) => prev.includes(userId) ? prev.filter((x) => x !== userId) : [...prev, userId]);

  const handleCreate = () => {
    if (!groupName.trim()) { setNameError('Please enter a group name.'); return; }
    if (selected.length < 1) { setNameError('Select at least one contact.'); return; }
    onDone();
  };

  return (
    <>
      <View style={styles.sheetSubHeader}>
        <TouchableOpacity onPress={onBack} style={styles.iconPad}>
          <AppIcon name="chevron-back" size={22} color={COLORS.blue} />
        </TouchableOpacity>
        <AppText style={styles.sheetTitle}>New Group</AppText>
        {selected.length > 0 && groupName.trim() && (
          <TouchableOpacity onPress={handleCreate} activeOpacity={0.85}>
            <LinearGradient colors={GRADIENTS.primary} style={styles.nextBtnGrad}>
              <AppText style={styles.nextBtnText}>Create</AppText>
              <AppIcon name="arrow-forward" size={15} color="#fff" fixedColor />
            </LinearGradient>
          </TouchableOpacity>
        )}
      </View>

      {/* Group name — glass */}
      <View style={styles.glassInput}>
        <AppIcon name="people-outline" size={18} color={COLORS.sub} />
        <TextInput style={styles.inputField} placeholder="Group name"
          placeholderTextColor={COLORS.sub} value={groupName}
          onChangeText={(t) => { setGroupName(t); setNameError(''); }} />
      </View>
      {nameError ? (
        <AppText style={styles.nameError}>{nameError}</AppText>
      ) : null}

      {/* Selected contacts chips */}
      {selected.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsRow}>
          {selected.map((userId) => {
            const c = contacts.find((x) => x.userId === userId);
            if (!c) return null;
            const color = stringToColor(c.displayName);
            return (
              <TouchableOpacity key={userId} style={styles.chip} onPress={() => toggle(userId)}>
                <View style={[styles.chipDot, { backgroundColor: color }]}>
                  <Text style={styles.chipInit}>{getInitials(c.displayName)}</Text>
                </View>
                <Text style={styles.chipName}>{c.displayName.split(' ')[0]}</Text>
                <Ionicons name="close" size={13} color={COLORS.sub} />
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      <Text style={styles.sectionHint}>{selected.length} / {contacts.length} selected</Text>

      <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
        {contacts.map((c) => {
          const sel = selected.includes(c.userId);
          return (
            <TouchableOpacity key={c.userId} style={styles.contactRow} activeOpacity={0.75}
              onPress={() => toggle(c.userId)}>
              <ChatAvatar displayName={c.displayName} />
              <View style={styles.contactMeta}>
                <Text style={styles.contactName}>{c.displayName}</Text>
                <Text style={styles.contactSub} numberOfLines={1}>{c.phone}</Text>
              </View>
              <View style={[styles.checkbox, sel && styles.checkboxOn]}>
                {sel && <Ionicons name="checkmark" size={14} color="#fff" />}
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </>
  );
}

// ─── Select-contact sheet ─────────────────────────────────────────────────────
function SelectContactSheet({
  onClose,
  onNavigate,
  contacts,
  contactsLoading,
}: {
  onClose: () => void;
  onNavigate: (contact: AppContact) => void;
  contacts: AppContact[];
  contactsLoading: boolean;
}) {
  const [mode, setMode] = useState<SheetMode>('select');

  if (mode === 'newContact') {
    return <NewContactSheet onBack={() => setMode('select')} onDone={onClose} />;
  }
  if (mode === 'newGroup') {
    return <NewGroupSheet onBack={() => setMode('select')} onDone={onClose} contacts={contacts} />;
  }

  return (
    <>
      {/* Header */}
      <View style={styles.sheetSubHeader}>
        <TouchableOpacity onPress={onClose} style={styles.iconPad}>
          <AppIcon name="close" size={22} color={COLORS.sub} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.sheetTitle}>Select contact</Text>
          <Text style={styles.sheetSub}>{contacts.length} contacts</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 14 }}>
          <AppIcon name="search-outline" size={22} color={COLORS.sub} />
          <AppIcon name="ellipsis-vertical" size={22} color={COLORS.sub} />
        </View>
      </View>

      {/* Action rows */}
      <View style={styles.actionBlock}>
        {[
          { icon: 'people'     as const, label: 'New group',   onPress: () => setMode('newGroup')   },
          { icon: 'person-add' as const, label: 'New contact', onPress: () => setMode('newContact') },
        ].map((a) => (
          <TouchableOpacity key={a.label} style={styles.actionRow} activeOpacity={0.75} onPress={a.onPress}>
            <View style={styles.actionIconWrap}>
              <LinearGradient colors={GRADIENTS.primary} style={styles.actionIcon}>
                <AppIcon name={a.icon} size={20} color="#fff" fixedColor />
              </LinearGradient>
            </View>
            <AppText style={styles.actionLabel}>{a.label}</AppText>
            <AppIcon name="chevron-forward" size={16} color={COLORS.sub} />
          </TouchableOpacity>
        ))}
      </View>

      <AppText style={styles.sectionHint}>Contacts</AppText>

      {/* Contact list */}
      {contactsLoading ? (
        <View style={styles.emptyWrap}>
          <ActivityIndicator size="large" color={COLORS.blue} />
          <Text style={styles.emptyText}>Loading contacts…</Text>
        </View>
      ) : contacts.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Ionicons name="people-outline" size={52} color={COLORS.sub} />
          <Text style={styles.emptyText}>No registered contacts found</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
          {contacts.map((c) => (
            <TouchableOpacity key={c.userId} style={styles.contactRow} activeOpacity={0.75}
              onPress={() => onNavigate(c)}>
              <ChatAvatar displayName={c.displayName} />
              <View style={styles.contactMeta}>
                <Text style={styles.contactName}>{c.displayName}</Text>
                <Text style={styles.contactSub} numberOfLines={1}>{c.phone}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function ChatsScreen() {
  const navigation  = useNavigation<NavProp>();
  const { user }    = useAuth();
  const userId      = user?.uid ?? null;
  const { FG } = useForeground();
  const { fontFamily, textColor, iconColor } = useTypography();

  const { chats, loading: chatsLoading } = useChats(userId);
  const { contacts, loading: contactsLoading } = useContacts();

  const [tab,        setTab]        = useState<TabType>('Chats');
  const [query,      setQuery]      = useState('');
  const [sheetOpen,  setSheetOpen]  = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  // Extra member info fetched from Firestore for users not in device contacts
  const [memberInfo, setMemberInfo] = useState<Map<string, { displayName: string; phone: string }>>(new Map());

  // Animated width: 0 → 1 (multiplied by max width in style)
  const searchAnim = useRef(new Animated.Value(0)).current;
  const searchRef  = useRef<TextInput>(null);

  // Build contacts map: phone → displayName (for resolveDisplayName)
  const contactsMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of contacts) {
      map.set(c.phone, c.displayName);
    }
    return map;
  }, [contacts]);

  // Build firestoreUsers map: userId → { displayName, phone }
  const firestoreUsersMap = useMemo(() => {
    const map = new Map<string, { displayName: string; phone: string }>();
    for (const c of contacts) {
      map.set(c.userId, { displayName: c.displayName, phone: c.phone });
    }
    for (const [uid, info] of memberInfo) {
      if (!map.has(uid)) map.set(uid, info);
    }
    return map;
  }, [contacts, memberInfo]);

  // Fetch Firestore user info for chat members not in contacts
  useEffect(() => {
    if (!chats.length || !userId) return;

    const knownIds = new Set(contacts.map((c) => c.userId));
    const unknownIds = new Set<string>();

    for (const chat of chats) {
      for (const memberId of chat.members) {
        if (memberId !== userId && !knownIds.has(memberId) && !memberInfo.has(memberId)) {
          unknownIds.add(memberId);
        }
      }
    }

    if (unknownIds.size === 0) return;

    (async () => {
      const { doc, getDoc } = await import('firebase/firestore');
      const newInfo = new Map(memberInfo);

      for (const uid of unknownIds) {
        try {
          const userDoc = await getDoc(doc(db, 'users', uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            newInfo.set(uid, {
              displayName: data.displayName ?? data.phone ?? uid,
              phone: data.phone ?? '',
            });
          }
        } catch (_) {}
      }

      setMemberInfo(newInfo);
    })();
  }, [chats, userId, contacts]);

  // Resolve display name for a chat
  const getDisplayName = (chat: ChatPreview): string => {
    if (!userId) return 'Unknown';
    return resolveDisplayName(chat, userId, contactsMap, firestoreUsersMap);
  };

  // Filter chats by tab
  const directChats = useMemo(() => chats.filter((c) => c.type === 'direct'), [chats]);
  const groupChats  = useMemo(() => chats.filter((c) => c.type === 'group'), [chats]);

  const base = tab === 'Chats' ? directChats : groupChats;
  const data = query.trim()
    ? base.filter((c) => getDisplayName(c).toLowerCase().includes(query.toLowerCase()))
    : base;

  const openSearch = () => {
    setSearchOpen(true);
    Animated.spring(searchAnim, {
      toValue: 1, useNativeDriver: false,
      friction: 7, tension: 60,
    }).start(() => searchRef.current?.focus());
  };

  const closeSearch = () => {
    setQuery('');
    Animated.spring(searchAnim, {
      toValue: 0, useNativeDriver: false,
      friction: 7, tension: 60,
    }).start(() => setSearchOpen(false));
  };

  // Called when a contact is tapped in the sheet
  const handleSelectContact = async (contact: AppContact) => {
    if (!userId) return;
    setSheetOpen(false);
    try {
      const chatId = await getOrCreateDirectChat(userId, contact.userId);
      navigation.navigate('Chat', { chatId, displayName: contact.displayName, isGroup: false });
    } catch (err) {
      console.error('Failed to create/get chat:', err);
    }
  };

  const renderChat = ({ item }: { item: ChatPreview }) => {
    const displayName = getDisplayName(item);
    const isGroup = item.type === 'group';
    const isVoiceNote = item.lastMessage === '[Voice Note]';

    const getSenderPrefix = (): string => {
      if (!item.lastSenderId) return '';
      if (item.lastSenderId === userId) return 'You: ';
      if (isGroup) {
        const senderInfo = firestoreUsersMap.get(item.lastSenderId);
        if (senderInfo) return `${senderInfo.displayName.split(' ')[0]}: `;
      }
      return '';
    };

    const renderLastMessagePreview = () => {
      if (isVoiceNote) {
        const prefix = getSenderPrefix();
        return (
          <View style={styles.voiceNotePreview}>
            {prefix ? <Text style={styles.chatPreview}>{prefix}</Text> : null}
            <Ionicons name="mic" size={14} color={COLORS.sub} style={{ marginRight: 3 }} />
            <Text style={styles.chatPreview}>Voice Note</Text>
          </View>
        );
      }
      return <Text style={styles.chatPreview} numberOfLines={2}>{item.lastMessage}</Text>;
    };

    return (
      <TouchableOpacity style={[styles.chatCard, { backgroundColor: FG.glassBg, borderColor: FG.glassBorder }]} activeOpacity={0.75}
        onPress={() => navigation.navigate('Chat', { chatId: item.chatId, displayName, isGroup })}>
        <ChatAvatar displayName={displayName} />
        <View style={styles.chatMeta}>
          <AppText style={[styles.chatName, { color: textColor, fontFamily }]} numberOfLines={1}>{displayName}</AppText>
          {renderLastMessagePreview()}
        </View>
        <View style={styles.chatRight}>
          <AppText style={[styles.chatTime, { color: FG.secondary }]}>{formatTime(item.timestamp)}</AppText>
          {item.unreadCount > 0 && (
            <View style={styles.badge}>
              <AppText fixedColor style={styles.badgeText}>{item.unreadCount}</AppText>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.root}>
      <AppBg />

      {/* ── Bottom sheet modal ── */}
      <Modal visible={sheetOpen} transparent animationType="slide"
        onRequestClose={() => setSheetOpen(false)} statusBarTranslucent>
        <Pressable style={styles.overlay} onPress={() => setSheetOpen(false)} />

        <View style={styles.sheet}>
          <AppBg />
          <View style={styles.handle} />
          <SelectContactSheet
            onClose={() => setSheetOpen(false)}
            onNavigate={handleSelectContact}
            contacts={contacts}
            contactsLoading={contactsLoading}
          />
        </View>
      </Modal>

      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <AppText style={[styles.appName, { color: textColor, fontFamily }]}>ChitChat</AppText>

          {!searchOpen && (
            <TouchableOpacity
                style={[styles.searchIconBtn, { borderColor: `${iconColor}40` }]}
                onPress={openSearch}
                activeOpacity={0.8}
              >
              <AppIcon name="search-outline" size={20} color={COLORS.blue} />
            </TouchableOpacity>
          )}
        </View>

        {searchOpen && (
          <Animated.View
            style={[
              styles.searchBubble,
              {
                opacity: searchAnim,
                transform: [{
                  translateY: searchAnim.interpolate({
                    inputRange: [0, 1], outputRange: [-12, 0],
                  }),
                }],
              },
            ]}
          >
            <AppIcon name="search-outline" size={15} color={COLORS.sub} />
            <TextInput
              ref={searchRef}
              style={styles.searchInput}
              placeholder="Search"
              placeholderTextColor={COLORS.sub}
              value={query}
              onChangeText={setQuery}
            />
            <TouchableOpacity onPress={closeSearch} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <AppIcon name="close-circle" size={18} color={COLORS.sub} />
            </TouchableOpacity>
          </Animated.View>
        )}
      </View>

      {/* ── Tabs ── */}
      <View style={styles.tabBar}>
        {(['Chats', 'Groups'] as TabType[]).map((t) => {
          const active = tab === t;
          return active ? (
            <TouchableOpacity key={t} onPress={() => setTab(t)} activeOpacity={0.85}>
              <LinearGradient colors={GRADIENTS.primary} style={styles.tabPillActive}>
                <AppText style={styles.tabLabelActive}>{t}</AppText>
              </LinearGradient>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity key={t} style={styles.tabPillInactive}
              onPress={() => setTab(t)} activeOpacity={0.7}>
              <AppText style={[styles.tabLabel, { color: FG.secondary }]}>{t}</AppText>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── Chat list ── */}
      {chatsLoading ? (
        <View style={styles.emptyWrap}>
          <ActivityIndicator size="large" color={COLORS.blue} />
          <Text style={styles.emptyText}>Loading chats…</Text>
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item) => item.chatId}
          renderItem={renderChat}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <AppIcon name="chatbubbles-outline" size={52} color={COLORS.sub} />
              <AppText style={styles.emptyText}>No {tab.toLowerCase()} yet</AppText>
            </View>
          }
        />
      )}

      {/* ── FAB ── */}
      <TouchableOpacity style={styles.fab} activeOpacity={0.85}
        onPress={() => setSheetOpen(true)}>
        <LinearGradient colors={GRADIENTS.primary} style={styles.fabInner}>
          <AppIcon name="add" size={28} color="#fff" fixedColor />
        </LinearGradient>
      </TouchableOpacity>

      <BottomNav active="chats" />
    </View>
  );
}


// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.sky1 },

  // ── Avatar ───────────────────────────────────────────────────────────────
  avatarCircle: {
    width: 50, height: 50, borderRadius: 25,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.50)',
  },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 18 },

  // ── Header ───────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'column',
    paddingHorizontal: 14,
    paddingTop: 56,
    paddingBottom: 10,
    gap: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  appName: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.text, letterSpacing: -0.5,
  },
  searchBubble: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    ...GLASS.card,
    borderRadius: RADIUS.full,
    paddingHorizontal: 14, height: 42,
    overflow: 'hidden',
  },
  searchInput: { flex: 1, fontSize: 14, color: COLORS.text, padding: 0 },
  searchIconBtn: {
    width: 38, height: 38, borderRadius: 19,
    ...GLASS.card, alignItems: 'center', justifyContent: 'center',
  },

  // ── Tabs ─────────────────────────────────────────────────────────────────
  tabBar:          { flexDirection: 'row', paddingHorizontal: 14, marginBottom: 10, gap: 6 },
  tabPillActive:   { paddingHorizontal: 22, paddingVertical: 9, borderRadius: RADIUS.full, ...SHADOW.button },
  tabPillInactive: { paddingHorizontal: 22, paddingVertical: 9, borderRadius: RADIUS.full, ...GLASS.card },
  tabLabel:        { fontSize: 14, fontWeight: '600', color: COLORS.sub },
  tabLabelActive:  { fontSize: 14, fontWeight: '700', color: '#fff' },

  // ── Chat cards ────────────────────────────────────────────────────────────
  listContent: { paddingHorizontal: 14, paddingBottom: 110 },
  chatCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: RADIUS.lg,
    paddingHorizontal: 14, paddingVertical: 10,
    shadowColor: '#0d6e9e',
    shadowOffset: { width: 2, height: 4 },
    shadowOpacity: 0.20,
    shadowRadius: 8,
    elevation: 4,
    backgroundColor: 'rgba(180,225,245,0.22)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.45)',
  },
  chatMeta:    { flex: 1, gap: 4 },
  chatName:    { fontSize: 14, fontWeight: '700', color: COLORS.text },
  chatPreview: { fontSize: 12, color: COLORS.sub, lineHeight: 18 },
  voiceNotePreview: { flexDirection: 'row', alignItems: 'center' },
  chatRight:   { alignItems: 'flex-end', gap: 6, minWidth: 50 },
  chatTime:    { fontSize: 11, color: COLORS.sub },
  badge:       { width: 20, height: 20, borderRadius: 10, backgroundColor: COLORS.blue, alignItems: 'center', justifyContent: 'center' },
  badgeText:   { color: '#fff', fontSize: 11, fontWeight: '700' },

  // ── FAB ──────────────────────────────────────────────────────────────────
  fab:      { position: 'absolute', right: 20, bottom: 90, width: 56, height: 56, borderRadius: 28, ...SHADOW.glow },
  fabInner: { flex: 1, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },

  // ── Bottom sheet ──────────────────────────────────────────────────────────
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.22)' },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    height: '88%',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    overflow: 'hidden',
    ...SHADOW.glow,
  },
  handle: {
    alignSelf: 'center', width: 40, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(30,156,240,0.30)', marginTop: 10, marginBottom: 4,
  },

  // ── Sheet shared ──────────────────────────────────────────────────────────
  sheetSubHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12, gap: 10,
  },
  iconPad:    { padding: 4 },
  sheetTitle: { flex: 1, fontSize: 17, fontWeight: '700', color: COLORS.text },
  sheetSub:   { fontSize: 12, color: COLORS.sub, marginTop: 1 },

  // Action rows
  actionBlock: { paddingHorizontal: 14, gap: 8, marginBottom: 4 },
  actionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    ...GLASS.card, borderRadius: RADIUS.lg,
    paddingHorizontal: 14, paddingVertical: 13,
    ...SHADOW.card,
  },
  actionIconWrap: {},
  actionIcon: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
    ...SHADOW.button,
  },
  actionLabel: { flex: 1, fontSize: 15, fontWeight: '600', color: COLORS.text },

  sectionHint: {
    fontSize: 11, fontWeight: '600', color: COLORS.sub,
    letterSpacing: 0.5, paddingHorizontal: 20, paddingVertical: 8,
  },

  // Contact rows in sheet
  contactRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    marginHorizontal: 14, marginBottom: 8,
    ...GLASS.card, borderRadius: RADIUS.lg,
    paddingHorizontal: 14, paddingVertical: 11,
    ...SHADOW.card,
  },
  contactMeta: { flex: 1 },
  contactName: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  contactSub:  { fontSize: 12, color: COLORS.sub, marginTop: 2 },

  // Group checkbox
  checkbox:   { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: COLORS.sub, alignItems: 'center', justifyContent: 'center' },
  checkboxOn: { backgroundColor: COLORS.blue, borderColor: COLORS.blue },

  // Error text for group name
  nameError: {
    fontSize: 12, color: COLORS.missed,
    marginHorizontal: 14, marginTop: -6, marginBottom: 8,
  },

  // Group chips
  chipsRow: { paddingHorizontal: 14, paddingBottom: 10, gap: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    ...GLASS.card, borderRadius: RADIUS.full,
    paddingHorizontal: 10, paddingVertical: 6,
  },
  chipDot:  { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  chipInit: { fontSize: 9, color: '#fff', fontWeight: '700' },
  chipName: { fontSize: 12, fontWeight: '600', color: COLORS.text },

  // Create group button
  nextBtnGrad: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.full,
    ...SHADOW.button,
  },
  nextBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },

  // Glass text input
  glassInput: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 14, marginBottom: 10,
    ...GLASS.card, borderRadius: RADIUS.md,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  inputField: { flex: 1, fontSize: 14, color: COLORS.text, padding: 0 },

  // Keypad number display
  numberRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    marginHorizontal: 20, marginBottom: 12, minHeight: 52,
  },
  numberText: {
    flex: 1, textAlign: 'center',
    fontSize: 34, fontWeight: '200', color: COLORS.text, letterSpacing: 5,
  },

  // Keypad grid
  keyGrid: { marginHorizontal: 14, gap: 10, marginBottom: 16 },
  keyRow:  { flexDirection: 'row', gap: 10 },
  keyBtn:  {
    flex: 1, paddingVertical: 14,
    ...GLASS.card, borderRadius: RADIUS.lg,
    alignItems: 'center', justifyContent: 'center',
    ...SHADOW.card,
  },
  keyDigit: { fontSize: 26, fontWeight: '300', color: COLORS.text, lineHeight: 30 },
  keySub:   { fontSize: 9, fontWeight: '600', color: COLORS.sub, letterSpacing: 1 },

  // Action buttons row
  rowActions:  { flexDirection: 'row', gap: 10, marginHorizontal: 14, marginBottom: 20 },
  cancelBtn:   { flex: 1, paddingVertical: 14, ...GLASS.card, borderRadius: RADIUS.lg, alignItems: 'center', justifyContent: 'center' },
  cancelText:  { fontSize: 14, fontWeight: '600', color: COLORS.sub },
  confirmBtn:  { flex: 2 },
  dimmed:      { opacity: 0.4 },
  confirmGrad: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, borderRadius: RADIUS.lg, ...SHADOW.button,
  },
  confirmText: { fontSize: 14, fontWeight: '700', color: '#fff' },

  // Empty state
  emptyWrap: { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyText: { fontSize: 15, color: COLORS.sub },
});
