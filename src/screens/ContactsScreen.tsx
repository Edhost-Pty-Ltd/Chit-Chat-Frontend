// ─── Screen: Contacts ────────────────────────────────────────────────────────
import React, { useState, useRef } from 'react';
import {
  View, FlatList, TouchableOpacity, StyleSheet, TextInput,
  Modal, Animated, Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { Avatar } from '../components';
import { CONTACTS } from '../data/mockData';
import { COLORS, RADIUS, SHADOW, GRADIENTS, GLASS } from '../types/theme';
import { Contact, RootStackParamList } from '../types';
import { AppBg, AppText, AppIcon, useForeground, useTypography } from '../context/ThemeContext';
import { useContacts } from '../context/ContactsContext';

type NavProp = NativeStackNavigationProp<RootStackParamList, 'Contacts'>;

export default function ContactsScreen() {
  const navigation = useNavigation<NavProp>();
  const { FG }     = useForeground();
  const { fontFamily, textColor, iconColor } = useTypography();
  const { contacts, addContact } = useContacts();

  const [query,       setQuery]       = useState('');
  const [searchOpen,  setSearchOpen]  = useState(false);
  const [menuOpen,    setMenuOpen]    = useState(false);
  const [refreshKey,  setRefreshKey]  = useState(0); // bump to force list re-render

  const searchAnim = useRef(new Animated.Value(0)).current;
  const searchRef  = useRef<TextInput>(null);

  // ── Search toggle ──────────────────────────────────────────────────────────
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

  // ── Refresh — resets to initial contacts list ─────────────────────────────
  const handleRefresh = () => {
    setMenuOpen(false);
    closeSearch();
    setRefreshKey((k) => k + 1); // causes FlatList to remount with fresh data
  };

  const data = query.trim()
    ? contacts.filter((c) => c.name.toLowerCase().includes(query.toLowerCase()))
    : contacts;

  // ── Contact row ────────────────────────────────────────────────────────────
  const renderItem = ({ item }: { item: Contact }) => (
    <TouchableOpacity
      style={[styles.contactCard, { backgroundColor: FG.glassBg, borderColor: FG.glassBorder }]}
      activeOpacity={0.75}
      onPress={() => navigation.navigate('Chat', { contact: item })}
    >
      <Avatar initials={item.avatar} color={item.color} size={48} status={item.status} />
      <View style={styles.contactMeta}>
        <AppText style={[styles.contactName, { color: textColor, fontFamily }]}>{item.name}</AppText>
        <AppText style={[styles.contactSub, { color: FG.secondary }]} numberOfLines={1}>
          {item.status === 'online' ? 'Online' : item.lastMsg}
        </AppText>
      </View>
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => navigation.navigate('AudioCall', { contact: item })}
      >
        <LinearGradient colors={GRADIENTS.primary} style={styles.callBtn}>
          <AppIcon name="call" size={15} color="#fff" fixedColor />
        </LinearGradient>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <View style={styles.root}>
      <AppBg />

      {/* ── Header ── */}
      <View style={[styles.header, { backgroundColor: FG.glassBg, borderBottomColor: FG.glassBorder }]}>
        {/* Title or animated search bar */}
        {!searchOpen && (
          <AppText style={[styles.title, { color: textColor, fontFamily }]}>Contacts</AppText>
        )}

        {searchOpen && (
          <Animated.View
            style={[
              styles.searchBubble,
              { backgroundColor: FG.glassBg, borderColor: FG.glassBorder },
              {
                opacity: searchAnim,
                transform: [{
                  translateY: searchAnim.interpolate({ inputRange: [0, 1], outputRange: [-10, 0] }),
                }],
              },
            ]}
          >
            <AppIcon name="search-outline" size={15} color={COLORS.sub} />
            <TextInput
              ref={searchRef}
              style={[styles.searchInput, { color: textColor }]}
              placeholder="Search contacts"
              placeholderTextColor={COLORS.sub}
              value={query}
              onChangeText={setQuery}
            />
            <TouchableOpacity onPress={closeSearch} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <AppIcon name="close-circle" size={18} color={COLORS.sub} />
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* Right icons: search + 3-dot */}
        <View style={styles.headerIcons}>
          {!searchOpen && (
            <TouchableOpacity
              style={[styles.iconBtn, { borderColor: `${iconColor}40`, backgroundColor: FG.glassBg }]}
              onPress={openSearch}
              activeOpacity={0.8}
            >
              <AppIcon name="search-outline" size={20} color={COLORS.blue} fixedColor />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.iconBtn, { borderColor: `${iconColor}40`, backgroundColor: FG.glassBg }]}
            onPress={() => setMenuOpen(true)}
            activeOpacity={0.8}
          >
            <AppIcon name="ellipsis-vertical" size={20} color={COLORS.blue} fixedColor />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Contact list ── */}
      <FlatList
        key={refreshKey}
        data={data}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListHeaderComponent={
          <AppText style={[styles.countLabel, { color: FG.secondary }]}>
            {data.length} contact{data.length !== 1 ? 's' : ''}
          </AppText>
        }
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <AppIcon name="people-outline" size={48} color={FG.secondary} />
            <AppText style={[styles.emptyText, { color: FG.secondary }]}>
              {query ? 'No contacts match your search' : 'No contacts yet'}
            </AppText>
          </View>
        }
      />

      {/* ── 3-dot dropdown menu ── */}
      <Modal
        visible={menuOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuOpen(false)}
      >
        <TouchableOpacity
          style={styles.menuOverlay}
          activeOpacity={1}
          onPress={() => setMenuOpen(false)}
        />
        <View style={[styles.menuCard, { backgroundColor: FG.glassBg, borderColor: FG.glassBorder }]}>
          <AppBg />
          {[
            {
              icon: 'refresh-outline' as const,
              label: 'Refresh Contact List',
              onPress: handleRefresh,
            },
            {
              icon: 'person-add-outline' as const,
              label: 'New Contact',
              onPress: () => {
                setMenuOpen(false);
                navigation.navigate('Chats' as any); // opens ChatsScreen where new contact is created
              },
            },
          ].map((item, idx, arr) => (
            <TouchableOpacity
              key={item.label}
              style={[
                styles.menuItem,
                idx < arr.length - 1 && { borderBottomWidth: 1, borderBottomColor: FG.glassBorder },
              ]}
              onPress={item.onPress}
              activeOpacity={0.75}
            >
              <AppIcon name={item.icon} size={18} color={COLORS.blue} fixedColor />
              <AppText style={[styles.menuItemTxt, { color: textColor, fontFamily }]}>
                {item.label}
              </AppText>
            </TouchableOpacity>
          ))}
        </View>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1 },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingTop: Platform.OS === 'web' ? 20 : 56,
    paddingBottom: 12, paddingHorizontal: 14,
    borderBottomWidth: 1, gap: 8,
  },
  title:       { flex: 1, fontSize: 24, fontWeight: '800' },
  headerIcons: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBtn: {
    width: 38, height: 38, borderRadius: 19,
    borderWidth: 1, alignItems: 'center', justifyContent: 'center',
  },

  // Animated search bubble — fills the header
  searchBubble: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: RADIUS.full, borderWidth: 1,
    paddingHorizontal: 14, height: 42,
    overflow: 'hidden',
  },
  searchInput: { flex: 1, fontSize: 14, color: COLORS.text, padding: 0 },

  listContent: { paddingHorizontal: 14, paddingBottom: 32, paddingTop: 8 },
  countLabel:  { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: 10, paddingHorizontal: 2 },

  contactCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: RADIUS.lg, borderWidth: 1,
    paddingHorizontal: 14, paddingVertical: 13, ...SHADOW.card,
  },
  contactMeta: { flex: 1 },
  contactName: { fontSize: 14, fontWeight: '700' },
  contactSub:  { fontSize: 12, marginTop: 3 },
  callBtn:     { width: 34, height: 34, borderRadius: RADIUS.sm, alignItems: 'center', justifyContent: 'center', ...SHADOW.button },

  emptyWrap: { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyText: { fontSize: 15 },

  // 3-dot dropdown
  menuOverlay: { ...StyleSheet.absoluteFill, backgroundColor: 'transparent' },
  menuCard: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 100 : 78,
    right: 12,
    minWidth: 220,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    overflow: 'hidden',
    ...SHADOW.glow,
  },
  menuItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
  },
  menuItemTxt: { fontSize: 14, fontWeight: '500' },
});
