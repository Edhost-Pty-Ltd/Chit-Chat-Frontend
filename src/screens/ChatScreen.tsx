// ─── Screen 3: Chat (Conversation) ───────────────────────────────────────────
import React, { useState, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, TextInput, KeyboardAvoidingView,
  Platform, Image,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { Avatar } from '../components';
import { MESSAGES } from '../data/mockData';
import { COLORS, RADIUS, SHADOW, GRADIENTS } from '../types/theme';
import { Message, RootStackParamList } from '../types';

type NavProp  = NativeStackNavigationProp<RootStackParamList, 'Chat'>;
type RoutePropType = RouteProp<RootStackParamList, 'Chat'>;

export default function ChatScreen() {
  const navigation = useNavigation<NavProp>();
  const route      = useRoute<RoutePropType>();
  const { contact } = route.params;

  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>(MESSAGES);
  const listRef = useRef<FlatList>(null);

  const sendMessage = () => {
    if (!input.trim()) return;
    const newMsg: Message = {
      id:   messages.length + 1,
      from: 'me',
      text: input.trim(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      type: 'out',
    };
    setMessages((prev) => [...prev, newMsg]);
    setInput('');
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  };

  // ── Message bubble ───────────────────────────────────────────────────────
  const renderMessage = ({ item }: { item: Message }) => {
    const isOut = item.type === 'out';

    return (
      <View style={[styles.msgRow, isOut && styles.msgRowOut]}>
        {/* Incoming avatar */}
        {!isOut && (
          <Avatar initials={contact.avatar} color={contact.color} size={28} style={{ marginRight: 6, alignSelf: 'flex-end' }} />
        )}

        {/* Bubble */}
        {isOut ? (
          <LinearGradient colors={GRADIENTS.primary} style={[styles.bubble, styles.bubbleOut]}>
            {item.text && <Text style={styles.bubbleTextOut}>{item.text}</Text>}
            <Text style={styles.timeOut}>{item.time} ✓✓</Text>
          </LinearGradient>
        ) : (
          <View style={[styles.bubble, styles.bubbleIn]}>
            {/* Image placeholder */}
            {item.image && (
              <View style={styles.imagePlaceholder}>
                <Text style={{ fontSize: 36 }}>🏛️</Text>
                <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)', marginTop: 4 }}>Santorini</Text>
              </View>
            )}

            {/* Voice message */}
            {item.voice && (
              <View style={styles.voiceRow}>
                <LinearGradient colors={GRADIENTS.primary} style={styles.playBtn}>
                  <Text style={{ color: '#fff', fontSize: 13 }}>▶</Text>
                </LinearGradient>
                <View style={styles.waveform}>
                  {Array.from({ length: 22 }).map((_, i) => (
                    <View key={i} style={[styles.waveBar, {
                      height: 4 + (Math.sin(i * 0.8) * 7 + 8),
                    }]} />
                  ))}
                </View>
                <Text style={styles.voiceDuration}>0:12</Text>
              </View>
            )}

            {item.text && <Text style={styles.bubbleTextIn}>{item.text}</Text>}
            <Text style={styles.timeIn}>{item.time}</Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      {/* ── Top bar ──────────────────────────────────────────────── */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>

        <Avatar initials={contact.avatar} color={contact.color} size={40} status="online" />

        <View style={styles.contactInfo}>
          <Text style={styles.contactName}>{contact.name}</Text>
          <Text style={styles.onlineText}>Online</Text>
        </View>

        <View style={styles.actionIcons}>
          {['📞', '📹', '⋯'].map((icon, i) => (
            <TouchableOpacity key={i} style={styles.iconBtn}>
              <Text style={{ fontSize: 18 }}>{icon}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* ── Messages ─────────────────────────────────────────────── */}
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderMessage}
        contentContainerStyle={styles.messageList}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.datePillWrap}>
            <View style={styles.datePill}>
              <Text style={styles.datePillText}>Today</Text>
            </View>
          </View>
        }
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
      />

      {/* ── Input bar ────────────────────────────────────────────── */}
      <View style={styles.inputBar}>
        <TouchableOpacity style={styles.attachBtn}>
          <Text style={{ fontSize: 22, color: COLORS.blue }}>+</Text>
        </TouchableOpacity>

        <View style={styles.inputWrap}>
          <TextInput
            style={styles.input}
            placeholder="Type a message..."
            placeholderTextColor={COLORS.sub}
            value={input}
            onChangeText={setInput}
            multiline
            maxLength={500}
          />
          <TouchableOpacity>
            <Text style={{ fontSize: 18 }}>😊</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={sendMessage} activeOpacity={0.8}>
          <LinearGradient colors={GRADIENTS.primary} style={styles.sendBtn}>
            <Text style={styles.sendIcon}>{input.trim() ? '➤' : '🎤'}</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.sky1 },

  // Top bar
  topBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingTop: 56, paddingBottom: 12, paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
    gap: 10,
  },
  backBtn:     { paddingHorizontal: 4 },
  backIcon:    { fontSize: 30, color: COLORS.blue, fontWeight: '300' },
  contactInfo: { flex: 1 },
  contactName: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  onlineText:  { fontSize: 12, color: COLORS.green, marginTop: 1 },
  actionIcons: { flexDirection: 'row', gap: 12 },
  iconBtn:     { padding: 4 },

  // Messages
  messageList: { padding: 16, gap: 10, paddingBottom: 8 },
  datePillWrap: { alignItems: 'center', marginBottom: 12 },
  datePill: {
    backgroundColor: 'rgba(26,127,232,0.1)',
    borderRadius: RADIUS.full,
    paddingHorizontal: 14, paddingVertical: 4,
  },
  datePillText: { fontSize: 11, color: COLORS.sub },

  // Message rows
  msgRow:    { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 8 },
  msgRowOut: { justifyContent: 'flex-end' },

  // Bubbles
  bubble: { maxWidth: '72%', borderRadius: 18, padding: 10 },
  bubbleOut: {
    borderBottomRightRadius: 4,
    ...SHADOW.button,
  },
  bubbleIn: {
    borderBottomLeftRadius: 4,
    backgroundColor: COLORS.cardBg,
    borderWidth: 1, borderColor: COLORS.border,
    ...SHADOW.card,
  },
  bubbleTextOut: { fontSize: 14, color: '#fff', lineHeight: 20 },
  bubbleTextIn:  { fontSize: 14, color: COLORS.text, lineHeight: 20 },
  timeOut: { fontSize: 10, color: 'rgba(255,255,255,0.7)', textAlign: 'right', marginTop: 4 },
  timeIn:  { fontSize: 10, color: COLORS.sub, textAlign: 'right', marginTop: 4 },

  // Image placeholder
  imagePlaceholder: {
    width: 180, height: 120, borderRadius: 14,
    backgroundColor: COLORS.blue,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 4,
  },

  // Voice
  voiceRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  playBtn:  { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  waveform: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 2, height: 28 },
  waveBar:  { width: 3, borderRadius: 2, backgroundColor: 'rgba(26,127,232,0.5)' },
  voiceDuration: { fontSize: 11, color: COLORS.sub },

  // Input bar
  inputBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 10,
    paddingBottom: Platform.OS === 'ios' ? 30 : 12,
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderTopWidth: 1, borderTopColor: COLORS.border,
    gap: 8,
  },
  attachBtn: { padding: 4 },
  inputWrap: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.inputBg,
    borderRadius: RADIUS.full,
    paddingHorizontal: 14, paddingVertical: 8,
    borderWidth: 1, borderColor: COLORS.border,
    gap: 8,
  },
  input: { flex: 1, fontSize: 14, color: COLORS.text, maxHeight: 90 },
  sendBtn: {
    width: 42, height: 42, borderRadius: 21,
    alignItems: 'center', justifyContent: 'center',
    ...SHADOW.button,
  },
  sendIcon: { fontSize: 16, color: '#fff' },
});