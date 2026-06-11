// ─── Screen: Chats ───────────────────────────────────────────────────────────
import React, { useState, useRef } from 'react';
import {
  View, FlatList, TouchableOpacity, StyleSheet,
  TextInput, Modal, Pressable, ScrollView, Animated, Dimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { Avatar, BottomNav } from '../components';
import { CONTACTS, STATUSES } from '../data/mockData';
import { COLORS, RADIUS, SHADOW, GRADIENTS, GLASS } from '../types/theme';
import { Contact, RootStackParamList } from '../types';

import { AppBg, AppText, AppIcon, useForeground, useTypography } from '../context/ThemeContext';
type NavProp   = NativeStackNavigationProp<RootStackParamList, 'Chats'>;
type TabType   = 'Chats' | 'Groups';
type SheetMode = 'select' | 'newContact' | 'newGroup';

// Search bubble fills from left edge to right (minus padding and search icon)
const SCREEN_W = Dimensions.get('window').width;
const BUBBLE_W = SCREEN_W - 14 - 14 - 10 - 40; // screen - leftPad - rightPad - gap - icon

const CHATS         = CONTACTS.filter((c) => !['Team Office', 'Family Group', 'Design Team'].includes(c.name));
const INITIAL_GROUPS = CONTACTS.filter((c) =>  ['Team Office', 'Family Group', 'Design Team'].includes(c.name));
const STATUS_NAMES = new Set(STATUSES.map((s) => s.name));

// ─── Avatar with status ring ──────────────────────────────────────────────────
function ChatAvatar({ contact }: { contact: Contact }) {
  if (!STATUS_NAMES.has(contact.name)) {
    return <Avatar initials={contact.avatar} color={contact.color} size={50} status={contact.status} />;
  }
  return (
    <LinearGradient colors={[contact.color, COLORS.blue]} style={styles.ring}
      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
      <View style={styles.ringInner}>
        <Avatar initials={contact.avatar} color={contact.color} size={42} status={contact.status} />
      </View>
    </LinearGradient>
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
function NewGroupSheet({ onBack, onDone }: {
  onBack: () => void;
  onDone: (group: Contact) => void;
}) {
  const [selected,  setSelected]  = useState<number[]>([]);
  const [groupName, setGroupName] = useState('');
  const [nameError, setNameError] = useState('');

  const toggle = (id: number) =>
    setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  const handleCreate = () => {
    if (!groupName.trim()) { setNameError('Please enter a group name.'); return; }
    if (selected.length < 1) { setNameError('Select at least one contact.'); return; }
    // Build a new group Contact entry
    const members = selected.map((id) => CONTACTS.find((c) => c.id === id)!);
    const initials = groupName.trim().split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
    const newGroup: Contact = {
      id:      Date.now(),
      name:    groupName.trim(),
      avatar:  initials,
      color:   COLORS.blue,
      status:  'online',
      lastMsg: `${members.length} members`,
      time:    'Now',
      unread:  0,
    };
    onDone(newGroup);
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

      {/* Selected contacts — avatar circles only, tap to deselect */}
      {selected.length > 0 && (
        <View style={styles.selectedAvatarsRow}>
          {selected.map((id) => {
            const c = CONTACTS.find((x) => x.id === id)!;
            return (
              <TouchableOpacity key={id} onPress={() => toggle(id)} style={styles.selectedAvatarWrap}>
                <Avatar initials={c.avatar} color={c.color} size={48} />
                {/* Remove badge */}
                <View style={styles.removeBadge}>
                  <AppIcon name="close" size={10} color="#fff" fixedColor />
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      <AppText style={styles.sectionHint}>
        {selected.length} selected — tap to add or remove
      </AppText>

      <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
        {CONTACTS.map((c) => {
          const sel = selected.includes(c.id);
          return (
            <TouchableOpacity key={c.id} style={[styles.contactRow, sel && styles.contactRowSelected]}
              activeOpacity={0.75} onPress={() => toggle(c.id)}>
              <Avatar initials={c.avatar} color={c.color} size={46} status={c.status} />
              <View style={styles.contactMeta}>
                <AppText style={styles.contactName}>{c.name}</AppText>
                <AppText style={styles.contactSub} numberOfLines={1}>{c.lastMsg}</AppText>
              </View>
              {/* Blue ring indicator when selected — no checkbox */}
              {sel && (
                <View style={styles.selectedIndicator}>
                  <AppIcon name="checkmark-circle" size={22} color={COLORS.blue} fixedColor />
                </View>
              )}
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
  onGroupCreated,
}: {
  onClose: () => void;
  onNavigate: (c: Contact) => void;
  onGroupCreated: (group: Contact) => void;
}) {
  const [mode, setMode] = useState<SheetMode>('select');

  if (mode === 'newContact') {
    return <NewContactSheet onBack={() => setMode('select')} onDone={onClose} />;
  }
  if (mode === 'newGroup') {
    return (
      <NewGroupSheet
        onBack={() => setMode('select')}
        onDone={(group) => { onGroupCreated(group); onClose(); }}
      />
    );
  }

  return (
    <>
      {/* Header */}
      <View style={styles.sheetSubHeader}>
        <TouchableOpacity onPress={onClose} style={styles.iconPad}>
          <AppIcon name="close" size={22} color={COLORS.sub} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <AppText style={styles.sheetTitle}>Select contact</AppText>
          <AppText style={styles.sheetSub}>{CONTACTS.length} contacts</AppText>
        </View>
        <View style={{ flexDirection: 'row', gap: 14 }}>
          <AppIcon name="search-outline" size={22} color={COLORS.sub} />
          <AppIcon name="ellipsis-vertical" size={22} color={COLORS.sub} />
        </View>
      </View>

      {/* Action rows — only New group + New contact (no community) */}
      <View style={styles.actionBlock}>
        {[
          { icon: 'people'     as const, label: 'New group',   onPress: () => setMode('newGroup')   },
          { icon: 'person-add' as const, label: 'New contact', onPress: () => setMode('newContact') },
        ].map((a) => (
          <TouchableOpacity key={a.label} style={styles.actionRow} activeOpacity={0.75} onPress={a.onPress}>
            {/* Glass circle icon background */}
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

      {/* Contact list — tapping navigates to that contact's chat */}
      <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
        {CONTACTS.map((c) => (
          <TouchableOpacity key={c.id} style={styles.contactRow} activeOpacity={0.75}
            onPress={() => onNavigate(c)}>
            <Avatar initials={c.avatar} color={c.color} size={46} status={c.status} />
            <View style={styles.contactMeta}>
              <AppText style={styles.contactName}>{c.name}</AppText>
              <AppText style={styles.contactSub} numberOfLines={1}>{c.lastMsg}</AppText>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function ChatsScreen() {
  const navigation  = useNavigation<NavProp>();
  const { FG } = useForeground();
  const { fontFamily, textColor, iconColor } = useTypography();
  const [tab,        setTab]        = useState<TabType>('Chats');
  const [query,      setQuery]      = useState('');
  const [sheetOpen,  setSheetOpen]  = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [groups,     setGroups]     = useState<Contact[]>(INITIAL_GROUPS);

  // Animated width: 0 → 1 (multiplied by max width in style)
  const searchAnim = useRef(new Animated.Value(0)).current;
  const searchRef  = useRef<TextInput>(null);

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

  const base = tab === 'Chats' ? CHATS : groups;
  const data = query.trim()
    ? base.filter((c) => c.name.toLowerCase().includes(query.toLowerCase()))
    : base;

  // Called when a contact is tapped in the sheet
  const handleSelectContact = (contact: Contact) => {
    setSheetOpen(false);
    navigation.navigate('Chat', { contact });
  };

  const renderChat = ({ item }: { item: Contact }) => (
    <TouchableOpacity style={[styles.chatCard, { backgroundColor: FG.glassBg, borderColor: FG.glassBorder }]} activeOpacity={0.75}
      onPress={() => navigation.navigate('Chat', { contact: item })}>
      <ChatAvatar contact={item} />
      <View style={styles.chatMeta}>
        <AppText style={[styles.chatName, { color: textColor, fontFamily }]} numberOfLines={1}>{item.name}</AppText>
        <AppText style={[styles.chatPreview, { color: FG.secondary, fontFamily }]} numberOfLines={2}>{item.lastMsg}</AppText>
      </View>
      <View style={styles.chatRight}>
        <AppText style={[styles.chatTime, { color: FG.secondary }]}>{item.time}</AppText>
        {item.unread > 0
          ? <View style={styles.badge}><AppText fixedColor style={styles.badgeText}>{item.unread}</AppText></View>
          : item.pinned ? <AppIcon name="pin" size={12} color={FG.secondary} /> : null}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.root}>
      <AppBg />

      {/* ── Bottom sheet modal ── */}
      <Modal visible={sheetOpen} transparent animationType="slide"
        onRequestClose={() => setSheetOpen(false)} statusBarTranslucent>
        <Pressable style={styles.overlay} onPress={() => setSheetOpen(false)} />

        {/* Sheet has its own background — uses user's chosen theme */}
        <View style={styles.sheet}>
          <AppBg />
          <View style={styles.handle} />
          <SelectContactSheet
            onClose={() => setSheetOpen(false)}
            onNavigate={handleSelectContact}
            onGroupCreated={(group) => {
              setGroups((prev) => [group, ...prev]);
              setTab('Groups');
            }}
          />
        </View>
      </Modal>

      {/* ── Header ── */}
      <View style={styles.header}>
        {/* Row 1: always visible — app name */}
        <View style={styles.headerRow}>
          <AppText style={[styles.appName, { color: textColor, fontFamily }]}>ChitChat</AppText>

          {/* Search icon — hidden when bubble is open */}
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

        {/* Row 2: search bubble — slides in below the title when open */}
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
      <FlatList
        data={data}
        keyExtractor={(item) => String(item.id)}
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

  // Status ring
  ring:      { borderRadius: 999, padding: 2.5 },
  ringInner: { backgroundColor: COLORS.sky1, borderRadius: 999, padding: 2 },

  // ── Header ───────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'column',
    paddingHorizontal: 14,
    paddingTop: 56,
    paddingBottom: 10,
    gap: 8,
  },
  // Title row — always shown
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
  headerLogo: {
    width: 110,
    height: 40,
    borderRadius: 8,
  },
  // Glass bubble — full width below title when open
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
    // Outer drop shadow — depth
    shadowColor: '#0d6e9e',
    shadowOffset: { width: 2, height: 4 },
    shadowOpacity: 0.20,
    shadowRadius: 8,
    elevation: 4,
    // Fill + top-light border
    backgroundColor: 'rgba(180,225,245,0.22)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.45)',
  },
  chatMeta:    { flex: 1, gap: 4 },
  chatName:    { fontSize: 14, fontWeight: '700', color: COLORS.text },
  chatPreview: { fontSize: 12, color: COLORS.sub, lineHeight: 18 },
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

  // Action rows — glass card per row
  actionBlock: { paddingHorizontal: 14, gap: 8, marginBottom: 4 },
  actionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    ...GLASS.card, borderRadius: RADIUS.lg,
    paddingHorizontal: 14, paddingVertical: 13,
    ...SHADOW.card,
  },
  actionIconWrap: { /* wrapper so LinearGradient can be flex child */ },
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

  // Contact rows in sheet — glass card
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

  // Group checkbox — removed, using selectedIndicator instead
  checkbox:   { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: COLORS.sub, alignItems: 'center', justifyContent: 'center' },
  checkboxOn: { backgroundColor: COLORS.blue, borderColor: COLORS.blue },

  // Selected contact — highlighted row
  contactRowSelected: {
    borderColor: `${COLORS.blue}50`,
    backgroundColor: 'rgba(30,156,240,0.08)',
  },

  // Blue checkmark circle on selected contact
  selectedIndicator: { paddingLeft: 4 },

  // Selected avatars strip — circles only, no text
  selectedAvatarsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 14,
    paddingTop: 4,
    paddingBottom: 8,
    gap: 10,
  },
  selectedAvatarWrap: { position: 'relative' },
  removeBadge: {
    position: 'absolute',
    top: -2, right: -2,
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: COLORS.blue,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: '#fff',
  },

  // Error text for group name
  nameError: {
    fontSize: 12, color: COLORS.missed,
    marginHorizontal: 14, marginTop: -6, marginBottom: 8,
  },

  // Group chips (legacy — kept for reference)
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

  // Glass text input (name / group name)
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
  deleteBtn: { padding: 8 },

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
