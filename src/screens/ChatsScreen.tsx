// ─── Screen: Chats ───────────────────────────────────────────────────────────
import React, { useState, useRef } from 'react';
import {
  View, FlatList, TouchableOpacity, StyleSheet, Platform,
  TextInput, Modal, Pressable, ScrollView, Animated,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { Avatar, BottomNav } from '../components';
import { CONTACTS, STATUSES } from '../data/mockData';
import { COLORS, RADIUS, SHADOW, GRADIENTS, GLASS } from '../types/theme';
import { Contact, RootStackParamList } from '../types';
import { AppBg, AppText, AppIcon, useForeground, useTypography } from '../context/ThemeContext';
import { useContacts } from '../context/ContactsContext';
type NavProp   = NativeStackNavigationProp<RootStackParamList, 'Chats'>;
type TabType   = 'Chats' | 'Groups';
type SheetMode = 'select' | 'newContact' | 'newGroup';

const CHATS          = CONTACTS.filter((c) => !['Team Office', 'Family Group', 'Design Team'].includes(c.name));
const INITIAL_GROUPS = CONTACTS.filter((c) =>  ['Team Office', 'Family Group', 'Design Team'].includes(c.name));
const STATUS_NAMES   = new Set(STATUSES.map((s) => s.name));

// ─── Avatar with status ring ──────────────────────────────────────────────────
// Only draws the gradient ring for contacts who have a status story.
// The online/away dot is handled in renderChat to keep the overlay logic central.
function ChatAvatar({ contact }: { contact: Contact }) {
  if (!STATUS_NAMES.has(contact.name)) {
    return <Avatar initials={contact.avatar} color={contact.color} size={50} />;
  }
  return (
    <LinearGradient colors={[contact.color, COLORS.blue]} style={styles.ring}
      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
      <View style={styles.ringInner}>
        <Avatar initials={contact.avatar} color={contact.color} size={42} />
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

function NewContactSheet({ onBack, onDone }: { onBack: () => void; onDone: (c: Contact) => void }) {
  const [number, setNumber] = useState('');
  const [name,   setName]   = useState('');
  const { textColor } = useTypography();

  const press = (k: string) => setNumber((n) => {
    const digits = (n + k).replace(/\D/g, '');
    return digits.slice(0, 9);
  });
  const del = () => setNumber((n) => n.slice(0, -1));

  const formatSA = (raw: string) => {
    const d = raw.replace(/\D/g, '');
    if (d.length <= 3) return d;
    if (d.length <= 6) return `${d.slice(0, 3)} ${d.slice(3)}`;
    return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6, 9)}`;
  };

  const handleSave = () => {
    if (!number || !name) return;
    const initials = name.trim().split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
    const colours = ['#f97316','#8b5cf6','#ec4899','#06b6d4','#10b981','#f59e0b','#6366f1','#e11d48'];
    const newContact: Contact = {
      id:      Date.now(),
      name:    name.trim(),
      avatar:  initials,
      color:   colours[Math.floor(Math.random() * colours.length)],
      status:  'offline',
      lastMsg: `+27${number}`,
      time:    'New',
      unread:  0,
    };
    onDone(newContact);
  };

  return (
    <>
      <View style={styles.sheetSubHeader}>
        <TouchableOpacity onPress={onBack} style={styles.iconPad}>
          <AppIcon name="chevron-back" size={22} color={COLORS.blue} fixedColor />
        </TouchableOpacity>
        <AppText style={styles.sheetTitle}>New Contact</AppText>
      </View>

      <View style={styles.glassInput}>
        <AppIcon name="person-outline" size={18} color={COLORS.sub} />
        <TextInput
          style={[styles.inputField, { color: textColor }]}
          placeholder="Contact name"
          placeholderTextColor={COLORS.sub}
          value={name}
          onChangeText={setName}
        />
      </View>

      <View style={styles.numberRow}>
        <AppText style={styles.numberLabel}>+27</AppText>
        <AppText style={styles.numberText} numberOfLines={1}>{formatSA(number) || ' '}</AppText>
        {number.length > 0 && (
          <TouchableOpacity onPress={del} style={styles.iconPad}>
            <AppIcon name="backspace-outline" size={22} color={COLORS.blue} fixedColor />
          </TouchableOpacity>
        )}
      </View>

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
        <TouchableOpacity
          style={[styles.confirmBtn, (!number || !name) && styles.dimmed]}
          activeOpacity={number && name ? 0.85 : 1}
          onPress={handleSave}
        >
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
  const { contacts } = useContacts();
  const { textColor } = useTypography();

  const toggle = (id: number) =>
    setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  const handleCreate = () => {
    if (!groupName.trim()) { setNameError('Please enter a group name.'); return; }
    if (selected.length < 1) { setNameError('Select at least one contact.'); return; }
    const members = selected.map((id) => contacts.find((c) => c.id === id)!);
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
          <AppIcon name="chevron-back" size={22} color={COLORS.blue} fixedColor />
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

      <View style={styles.glassInput}>
        <AppIcon name="people-outline" size={18} color={COLORS.sub} />
        <TextInput
          style={[styles.inputField, { color: textColor }]}
          placeholder="Group name"
          placeholderTextColor={COLORS.sub}
          value={groupName}
          onChangeText={(t) => { setGroupName(t); setNameError(''); }}
        />
      </View>
      {nameError ? <AppText style={styles.nameError}>{nameError}</AppText> : null}

      {selected.length > 0 && (
        <View style={styles.selectedAvatarsRow}>
          {selected.map((id) => {
            const c = contacts.find((x) => x.id === id)!;
            return (
              <TouchableOpacity key={id} onPress={() => toggle(id)} style={styles.selectedAvatarWrap}>
                <Avatar initials={c.avatar} color={c.color} size={48} />
                <View style={styles.removeBadge}>
                  <AppIcon name="close" size={10} color="#fff" fixedColor />
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      <AppText style={styles.sectionHint}>{selected.length} selected — tap to add or remove</AppText>

      <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
        {contacts.map((c) => {
          const sel = selected.includes(c.id);
          return (
            <TouchableOpacity key={c.id}
              style={[styles.contactRow, sel && styles.contactRowSelected]}
              activeOpacity={0.75} onPress={() => toggle(c.id)}>
              <Avatar initials={c.avatar} color={c.color} size={46} status={c.status} />
              <View style={styles.contactMeta}>
                <AppText style={styles.contactName}>{c.name}</AppText>
                <AppText style={styles.contactSub} numberOfLines={1}>{c.lastMsg}</AppText>
              </View>
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
  onClose, onNavigate, onGroupCreated,
}: {
  onClose: () => void;
  onNavigate: (c: Contact) => void;
  onGroupCreated: (group: Contact) => void;
}) {
  const [mode,        setMode]        = useState<SheetMode>('select');
  const [searchOpen,  setSearchOpen]  = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [menuOpen,    setMenuOpen]    = useState(false);
  const { addContact, contacts } = useContacts();
  const { FG } = useForeground();
  const { textColor } = useTypography();

  const searchAnim = useRef(new Animated.Value(0)).current;
  const searchRef  = useRef<TextInput>(null);

  const openSearch = () => {
    setSearchOpen(true);
    setMenuOpen(false);
    Animated.spring(searchAnim, { toValue: 1, useNativeDriver: false, friction: 7, tension: 60 })
      .start(() => searchRef.current?.focus());
  };

  const closeSearch = () => {
    setSearchQuery('');
    Animated.spring(searchAnim, { toValue: 0, useNativeDriver: false, friction: 7, tension: 60 })
      .start(() => setSearchOpen(false));
  };

  const refreshContacts = () => {
    setMenuOpen(false);
    closeSearch();
    // Closing + reopening returns the sheet to a clean select state
    setMode('select');
    setSearchQuery('');
  };

  const filtered = searchQuery.trim()
    ? contacts.filter((c) => c.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : contacts;

  if (mode === 'newContact') {
    return (
      <NewContactSheet
        onBack={() => setMode('select')}
        onDone={(c) => { addContact(c); setMode('select'); }}
      />
    );
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

        {searchOpen ? (
          <Animated.View
            style={[
              styles.sheetSearchBubble,
              { backgroundColor: FG.glassBg, borderColor: FG.glassBorder },
              {
                opacity: searchAnim,
                transform: [{
                  translateY: searchAnim.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }),
                }],
              },
            ]}
          >
            <AppIcon name="search-outline" size={15} color={COLORS.sub} />
            <TextInput
              ref={searchRef}
              style={[styles.sheetSearchInput, { color: textColor }]}
              placeholder="Search contacts…"
              placeholderTextColor={COLORS.sub}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            <TouchableOpacity onPress={closeSearch} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <AppIcon name="close-circle" size={17} color={COLORS.sub} />
            </TouchableOpacity>
          </Animated.View>
        ) : (
          <View style={{ flex: 1 }}>
            <AppText style={styles.sheetTitle}>Select contact</AppText>
            <AppText style={styles.sheetSub}>{contacts.length} contacts</AppText>
          </View>
        )}

        <View style={{ flexDirection: 'row', gap: 14 }}>
          {!searchOpen && (
            <TouchableOpacity onPress={openSearch} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <AppIcon name="search-outline" size={22} color={COLORS.sub} />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={() => setMenuOpen((v) => !v)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <AppIcon name="ellipsis-vertical" size={22} color={COLORS.sub} />
          </TouchableOpacity>
        </View>
      </View>

      {/* 3-dot dropdown — shown inline below the header */}
      {menuOpen && (
        <View style={[styles.sheetDropdown, { backgroundColor: FG.glassBg, borderColor: FG.glassBorder }]}>
          <TouchableOpacity
            style={styles.sheetDropdownItem}
            onPress={refreshContacts}
            activeOpacity={0.75}
          >
            <AppIcon name="refresh-outline" size={18} color={COLORS.blue} fixedColor />
            <AppText style={[styles.sheetDropdownTxt, { color: textColor }]}>Refresh contacts</AppText>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.actionBlock}>
        {[
          { icon: 'people'     as const, label: 'New group',   onPress: () => { setMenuOpen(false); setMode('newGroup');   } },
          { icon: 'person-add' as const, label: 'New contact', onPress: () => { setMenuOpen(false); setMode('newContact'); } },
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

      <AppText style={styles.sectionHint}>
        {searchQuery.trim() ? `${filtered.length} result${filtered.length !== 1 ? 's' : ''}` : 'Contacts'}
      </AppText>

      <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
        {filtered.map((c) => (
          <TouchableOpacity key={c.id} style={styles.contactRow} activeOpacity={0.75}
            onPress={() => { setMenuOpen(false); onNavigate(c); }}>
            <Avatar initials={c.avatar} color={c.color} size={46} status={c.status} />
            <View style={styles.contactMeta}>
              <AppText style={styles.contactName}>{c.name}</AppText>
              <AppText style={styles.contactSub} numberOfLines={1}>{c.lastMsg}</AppText>
            </View>
          </TouchableOpacity>
        ))}
        {filtered.length === 0 && (
          <View style={styles.emptySheet}>
            <AppIcon name="people-outline" size={40} color={COLORS.sub} />
            <AppText style={styles.emptySheetTxt}>No contacts match "{searchQuery}"</AppText>
          </View>
        )}
      </ScrollView>
    </>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function ChatsScreen() {
  const navigation = useNavigation<NavProp>();
  const { FG, isDark } = useForeground();
  const { fontFamily, textColor, iconColor } = useTypography();

  const [tab,        setTab]        = useState<TabType>('Chats');
  const [query,      setQuery]      = useState('');
  const [sheetOpen,  setSheetOpen]  = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [groups,     setGroups]     = useState<Contact[]>(INITIAL_GROUPS);

  const searchAnim = useRef(new Animated.Value(0)).current;
  const searchRef  = useRef<TextInput>(null);

  const openSearch = () => {
    setSearchOpen(true);
    Animated.spring(searchAnim, { toValue: 1, useNativeDriver: false, friction: 7, tension: 60 })
      .start(() => searchRef.current?.focus());
  };

  const closeSearch = () => {
    setQuery('');
    Animated.spring(searchAnim, { toValue: 0, useNativeDriver: false, friction: 7, tension: 60 })
      .start(() => setSearchOpen(false));
  };

  const base = tab === 'Chats' ? CHATS : groups;
  const data = query.trim()
    ? base.filter((c) => c.name.toLowerCase().includes(query.toLowerCase()))
    : base;

  const handleSelectContact = (contact: Contact) => {
    setSheetOpen(false);
    navigation.navigate('Chat', { contact });
  };

  // ── Chat row ───────────────────────────────────────────────────────────────
  const renderChat = ({ item }: { item: Contact }) => (
    <TouchableOpacity
      style={[
        styles.chatCard,
        {
          backgroundColor: isDark
            ? 'rgba(255,255,255,0.08)'
            : 'transparent',
          borderColor: isDark
            ? 'rgba(255,255,255,0.14)'
            : 'rgba(255,255,255,0.55)',
        },
      ]}
      activeOpacity={0.75}
      onPress={() => navigation.navigate('Chat', { contact: item })}
    >
      {/* Avatar */}
      <View style={styles.chatAvatarWrap}>
        <ChatAvatar contact={item} />
        {/* Online dot */}
        {item.status === 'online' && <View style={styles.onlineDot} />}
        {item.status === 'away'   && <View style={[styles.onlineDot, styles.awayDot]} />}
      </View>

      {/* Name + preview */}
      <View style={styles.chatMeta}>
        <View style={styles.chatTopRow}>
          <AppText style={[styles.chatName, { color: textColor, fontFamily }]} numberOfLines={1}>
            {item.name}
          </AppText>
          <AppText style={[styles.chatTime, { color: FG.secondary }]}>{item.time}</AppText>
        </View>
        <View style={styles.chatBottomRow}>
          <AppText style={[styles.chatPreview, { color: FG.secondary, fontFamily }]} numberOfLines={1}>
            {item.lastMsg}
          </AppText>
          {item.unread > 0 ? (
            <View style={styles.badge}>
              <AppText fixedColor style={styles.badgeText}>{item.unread}</AppText>
            </View>
          ) : item.pinned ? (
            <AppIcon name="pin" size={12} color={FG.secondary} fixedColor />
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );

  // ── Layout ─────────────────────────────────────────────────────────────────
  // On web we cap the max width and center the content for a desktop-friendly layout
  const isWeb = Platform.OS === 'web';

  return (
    <View style={styles.root}>
      <AppBg />

      {/* ── Bottom sheet modal ── */}
      <Modal visible={sheetOpen} transparent animationType="slide"
        onRequestClose={() => setSheetOpen(false)} statusBarTranslucent>
        <Pressable style={styles.overlay} onPress={() => setSheetOpen(false)} />
        <View style={[styles.sheet, isWeb && styles.sheetWeb]}>
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

      {/* ── Content column — centred on web ── */}
      <View style={[styles.column, isWeb && styles.columnWeb]}>

        {/* ── Header ── */}
        <View style={[styles.header, { borderBottomColor: FG.glassBorder, backgroundColor: FG.glassBg }]}>
          <View style={styles.headerRow}>
            <AppText style={[styles.appName, { color: textColor, fontFamily }]}>ChitChat</AppText>

            <View style={styles.headerIcons}>
              {!searchOpen && (
                <TouchableOpacity
                  style={[styles.searchIconBtn, { borderColor: `${iconColor}40`, backgroundColor: FG.glassBg }]}
                  onPress={openSearch}
                  activeOpacity={0.8}
                >
                  <AppIcon name="search-outline" size={20} color={COLORS.blue} fixedColor />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {searchOpen && (
            <Animated.View
              style={[
                styles.searchBubble,
                { backgroundColor: FG.glassBg, borderColor: FG.glassBorder },
                {
                  opacity: searchAnim,
                  transform: [{
                    translateY: searchAnim.interpolate({ inputRange: [0, 1], outputRange: [-12, 0] }),
                  }],
                },
              ]}
            >
              <AppIcon name="search-outline" size={15} color={COLORS.sub} />
              <TextInput
                ref={searchRef}
                style={[styles.searchInput, { color: textColor }]}
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
                  <AppText fixedColor style={styles.tabLabelActive}>{t}</AppText>
                </LinearGradient>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity key={t}
                style={[styles.tabPillInactive, { backgroundColor: FG.glassBg, borderColor: FG.glassBorder }]}
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
              <AppText style={[styles.emptyText, { color: FG.secondary }]}>No {tab.toLowerCase()} yet</AppText>
            </View>
          }
        />

        {/* ── FAB ── */}
        <TouchableOpacity
          style={[styles.fab, isWeb && styles.fabWeb]}
          activeOpacity={0.85}
          onPress={() => setSheetOpen(true)}
        >
          <LinearGradient colors={GRADIENTS.primary} style={styles.fabInner}>
            <AppIcon name="add" size={28} color="#fff" fixedColor />
          </LinearGradient>
        </TouchableOpacity>

        <BottomNav active="chats" />
      </View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1 },

  // Centre the content column on wide screens (web)
  column:    { flex: 1 },
  columnWeb: {
    maxWidth: 480,
    alignSelf: 'center',
    width: '100%',
    // On web add a subtle card border so it looks like a phone shell
    ...(Platform.OS === 'web' ? {
      shadowColor: '#0e6ea8',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.15,
      shadowRadius: 24,
    } : {}),
  },

  // Status ring
  ring:      { borderRadius: 999, padding: 2.5, width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
  ringInner: { borderRadius: 999, padding: 1.5, backgroundColor: 'transparent' },

  // ── Header ───────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'column',
    paddingHorizontal: 14,
    paddingTop: Platform.OS === 'web' ? 20 : 56,
    paddingBottom: 10,
    gap: 8,
    borderBottomWidth: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerIcons: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  headerIconBtn: {
    width: 38, height: 38, borderRadius: 19,
    borderWidth: 1, alignItems: 'center', justifyContent: 'center',
    position: 'relative',
  },
  bellBadge: {
    position: 'absolute', top: -4, right: -4,
    minWidth: 18, height: 18, borderRadius: 9,
    backgroundColor: COLORS.missed,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5, borderColor: '#fff',
  },
  bellBadgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },
  appName: {
    fontSize: 22, fontWeight: '800', color: COLORS.text, letterSpacing: -0.5,
  },
  searchBubble: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: RADIUS.full, borderWidth: 1,
    paddingHorizontal: 14, height: 42,
    overflow: 'hidden',
  },
  searchInput:   { flex: 1, fontSize: 14, color: COLORS.text, padding: 0 },
  searchIconBtn: {
    width: 38, height: 38, borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },

  // ── Tabs ─────────────────────────────────────────────────────────────────
  tabBar:          { flexDirection: 'row', paddingHorizontal: 14, marginTop: 10, marginBottom: 10, gap: 6 },
  tabPillActive:   { paddingHorizontal: 22, paddingVertical: 9, borderRadius: RADIUS.full, ...SHADOW.button },
  tabPillInactive: { paddingHorizontal: 22, paddingVertical: 9, borderRadius: RADIUS.full, borderWidth: 1 },
  tabLabel:        { fontSize: 14, fontWeight: '600' },
  tabLabelActive:  { fontSize: 14, fontWeight: '700', color: '#fff' },

  // ── Chat cards ────────────────────────────────────────────────────────────
  listContent: { paddingHorizontal: 14, paddingBottom: 170, paddingTop: 4 },
  chatCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: RADIUS.lg,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    // Richer shadow for depth on both platforms
    shadowColor: '#0d6e9e',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.14,
    shadowRadius: 10,
    elevation: 4,
  },
  // Avatar wrapper — relative for status dot
  chatAvatarWrap: { position: 'relative', width: 52, height: 52 },
  // Status dot absolute-positioned bottom-right of avatar
  onlineDot: {
    position: 'absolute', bottom: 1, right: 1,
    width: 13, height: 13, borderRadius: 7,
    backgroundColor: '#22c55e',
    borderWidth: 2, borderColor: '#fff',
  },
  awayDot: { backgroundColor: '#f59e0b' },

  // Meta takes all remaining space
  chatMeta:      { flex: 1, gap: 4 },
  chatTopRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  chatBottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  chatName:    { flex: 1, fontSize: 14, fontWeight: '700', color: COLORS.text },
  chatPreview: { flex: 1, fontSize: 12, color: COLORS.sub, lineHeight: 17 },
  chatTime:    { fontSize: 11, color: COLORS.sub, flexShrink: 0 },
  chatRight:   { alignItems: 'flex-end', gap: 6, minWidth: 50 },
  badge:       { minWidth: 20, height: 20, borderRadius: 10, backgroundColor: COLORS.blue, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  badgeText:   { color: '#fff', fontSize: 11, fontWeight: '700' },

  // ── Empty state ───────────────────────────────────────────────────────────
  emptyWrap: { paddingTop: 60, alignItems: 'center', gap: 12 },
  emptyText: { fontSize: 14, color: COLORS.sub },

  // ── FAB ──────────────────────────────────────────────────────────────────
  fab:      { position: 'absolute', right: 20, bottom: 130, width: 56, height: 56, borderRadius: 28, ...SHADOW.glow },
  fabWeb:   { right: 16, bottom: 120 },
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
  sheetWeb: Platform.OS === 'web' ? {
    left: 'calc(50% - 240px)' as any,
    right: 'auto' as any,
    width: 480,
  } : {},
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

  // Animated search bubble inside the sheet header
  sheetSearchBubble: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: RADIUS.full, borderWidth: 1,
    paddingHorizontal: 12, height: 38, overflow: 'hidden',
  },
  sheetSearchInput: { flex: 1, fontSize: 14, padding: 0 },

  // Inline dropdown below the header
  sheetDropdown: {
    marginHorizontal: 16, marginBottom: 4,
    borderRadius: RADIUS.lg, borderWidth: 1,
    overflow: 'hidden', ...SHADOW.card,
  },
  sheetDropdownItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 13,
  },
  sheetDropdownTxt: { fontSize: 14, fontWeight: '500' },

  // Empty search state inside the sheet
  emptySheet:    { alignItems: 'center', paddingTop: 40, gap: 10 },
  emptySheetTxt: { fontSize: 14, color: COLORS.sub },

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

  contactRowSelected: {
    borderColor: `${COLORS.blue}50`,
    backgroundColor: 'rgba(30,156,240,0.08)',
  },
  selectedIndicator: { paddingLeft: 4 },
  selectedAvatarsRow: {
    flexDirection: 'row', flexWrap: 'wrap',
    paddingHorizontal: 14, paddingTop: 4, paddingBottom: 8, gap: 10,
  },
  selectedAvatarWrap: { position: 'relative' },
  removeBadge: {
    position: 'absolute', top: -2, right: -2,
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: COLORS.blue,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: '#fff',
  },

  nameError: { fontSize: 12, color: COLORS.missed, marginHorizontal: 14, marginTop: -6, marginBottom: 8 },

  nextBtnGrad: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.full,
    ...SHADOW.button,
  },
  nextBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },

  glassInput: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 14, marginBottom: 10,
    ...GLASS.card, borderRadius: RADIUS.md,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  inputField: { flex: 1, fontSize: 14, color: COLORS.text, padding: 0 },

  numberRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    marginHorizontal: 20, marginBottom: 12, minHeight: 52,
  },
  numberLabel: { fontSize: 26, fontWeight: '300', color: COLORS.sub, marginRight: 6 },
  numberText:  { flex: 1, textAlign: 'center', fontSize: 34, fontWeight: '200', color: COLORS.text, letterSpacing: 5 },

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

  rowActions:  { flexDirection: 'row', gap: 10, marginHorizontal: 14, marginBottom: 20 },
  cancelBtn:   {
    flex: 1, paddingVertical: 14, alignItems: 'center', justifyContent: 'center',
    ...GLASS.card, borderRadius: RADIUS.lg, ...SHADOW.card,
  },
  cancelText:  { fontSize: 15, fontWeight: '600', color: COLORS.sub },
  confirmBtn:  { flex: 2, borderRadius: RADIUS.lg, overflow: 'hidden', ...SHADOW.button },
  confirmGrad: { paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  confirmText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  dimmed:      { opacity: 0.45 },
});
