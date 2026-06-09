// ─── Screen: Contacts ────────────────────────────────────────────────────────
import React, { useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, TextInput } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '../components';
import { CONTACTS } from '../data/mockData';
import { COLORS, RADIUS, SHADOW, GRADIENTS, GLASS } from '../types/theme';
import { Contact, RootStackParamList } from '../types';

type NavProp = NativeStackNavigationProp<RootStackParamList, 'Contacts'>;

export default function ContactsScreen() {
  const navigation = useNavigation<NavProp>();
  const [query, setQuery] = useState('');

  const data = query.trim()
    ? CONTACTS.filter((c) => c.name.toLowerCase().includes(query.toLowerCase()))
    : CONTACTS;

  const renderItem = ({ item }: { item: Contact }) => (
    <TouchableOpacity
      style={styles.contactCard}
      activeOpacity={0.75}
      onPress={() => navigation.navigate('Chat', { contact: item })}
    >
      <Avatar initials={item.avatar} color={item.color} size={48} status={item.status} />
      <View style={styles.contactMeta}>
        <Text style={styles.contactName}>{item.name}</Text>
        <Text style={styles.contactSub} numberOfLines={1}>
          {item.status === 'online' ? 'Online' : item.lastMsg}
        </Text>
      </View>
      <TouchableOpacity activeOpacity={0.85}>
        <LinearGradient colors={GRADIENTS.primary} style={styles.callBtn}>
          <Ionicons name="call" size={15} color="#fff" />
        </LinearGradient>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <View style={styles.root}>
      <LinearGradient colors={GRADIENTS.bg} style={StyleSheet.absoluteFill} />

      <View style={styles.header}>
        <Text style={styles.title}>Contacts</Text>
        <TouchableOpacity activeOpacity={0.85}>
          <LinearGradient colors={GRADIENTS.primary} style={styles.addBtn}>
            <Ionicons name="add" size={20} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Glass search bar */}
      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={16} color={COLORS.sub} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search contacts"
          placeholderTextColor={COLORS.sub}
          value={query}
          onChangeText={setQuery}
        />
      </View>

      <FlatList
        data={data}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Ionicons name="people-outline" size={48} color={COLORS.sub} />
            <Text style={styles.emptyText}>No contacts found</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.sky1 },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 56, paddingBottom: 10,
  },
  title:  { fontSize: 26, fontWeight: '800', color: COLORS.text },
  addBtn: { width: 34, height: 34, borderRadius: RADIUS.sm, alignItems: 'center', justifyContent: 'center', ...SHADOW.button },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 14, marginBottom: 10,
    ...GLASS.card, borderRadius: RADIUS.full,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  searchInput: { flex: 1, fontSize: 14, color: COLORS.text, padding: 0 },

  listContent: { paddingHorizontal: 14, paddingBottom: 20 },

  // Glass card per contact — same pattern as ChatsScreen
  contactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    ...GLASS.card,
    borderRadius: RADIUS.lg,
    paddingHorizontal: 14,
    paddingVertical: 13,
    ...SHADOW.card,
  },
  contactMeta: { flex: 1 },
  contactName: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  contactSub:  { fontSize: 12, color: COLORS.sub, marginTop: 3 },
  callBtn:     { width: 34, height: 34, borderRadius: RADIUS.sm, alignItems: 'center', justifyContent: 'center', ...SHADOW.button },

  emptyWrap: { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyText: { fontSize: 15, color: COLORS.sub },
});
