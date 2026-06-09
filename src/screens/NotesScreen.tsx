// ─── Screen: Notes ───────────────────────────────────────────────────────────
import React, { useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, TextInput } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { AppHeader } from '../components';
import { NOTES } from '../data/mockData';
import { COLORS, RADIUS, SHADOW, GRADIENTS, GLASS } from '../types/theme';
import { Note } from '../types';

export default function NotesScreen() {
  const [notes, setNotes] = useState<Note[]>(NOTES);
  const [query, setQuery] = useState('');

  const filtered = query.trim()
    ? notes.filter((n) =>
        n.title.toLowerCase().includes(query.toLowerCase()) ||
        n.preview.toLowerCase().includes(query.toLowerCase()))
    : notes;

  const toggleCheck = (id: number) =>
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, checked: !n.checked } : n)));

  const renderNote = ({ item }: { item: Note }) => (
    <TouchableOpacity style={styles.noteCard} activeOpacity={0.75}>
      <View style={styles.noteTop}>
        <Text style={styles.noteTitle}>{item.title}</Text>
        <TouchableOpacity onPress={() => toggleCheck(item.id)}>
          {item.checked ? (
            <LinearGradient colors={GRADIENTS.primary} style={styles.checkboxFilled}>
              <Ionicons name="checkmark" size={13} color="#fff" />
            </LinearGradient>
          ) : (
            <View style={styles.checkboxEmpty} />
          )}
        </TouchableOpacity>
      </View>
      <Text style={styles.notePreview} numberOfLines={2}>{item.preview}</Text>
      <Text style={styles.noteDate}>{item.date}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.root}>
      <LinearGradient colors={GRADIENTS.bg} style={StyleSheet.absoluteFill} />
      <AppHeader title="Notes" showBack rightIcon="+" />

      {/* Glass search bar */}
      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={16} color={COLORS.sub} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search notes"
          placeholderTextColor={COLORS.sub}
          value={query}
          onChangeText={setQuery}
        />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderNote}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Ionicons name="document-text-outline" size={48} color={COLORS.sub} />
            <Text style={styles.emptyText}>No notes yet</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.sky1 },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 14, marginTop: 8, marginBottom: 10,
    ...GLASS.card, borderRadius: RADIUS.full,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  searchInput: { flex: 1, fontSize: 14, color: COLORS.text, padding: 0 },

  listContent: { paddingHorizontal: 14, paddingBottom: 32 },

  // Each note = glass card
  noteCard: {
    ...GLASS.card, borderRadius: RADIUS.lg,
    padding: 16, ...SHADOW.card,
  },
  noteTop:     { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 },
  noteTitle:   { fontSize: 15, fontWeight: '700', color: COLORS.text, flex: 1, marginRight: 8 },
  notePreview: { fontSize: 13, color: COLORS.sub, lineHeight: 20, marginBottom: 10 },
  noteDate:    { fontSize: 11, color: COLORS.sub },

  checkboxEmpty:  { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: COLORS.blue },
  checkboxFilled: { width: 22, height: 22, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },

  emptyWrap: { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyText: { fontSize: 15, color: COLORS.sub },
});
