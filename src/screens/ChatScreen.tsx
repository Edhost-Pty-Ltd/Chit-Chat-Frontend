// ─── Screen 3: Chat Conversation — Glassmorphism ─────────────────────────────
import React, { useState, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Avatar } from '../components';
import { MESSAGES } from '../data/mockData';
import { COLORS, GRADIENTS, RADIUS, SHADOW } from '../types/theme';
import { Message, RootStackParamList } from '../types';

type NavProp      = NativeStackNavigationProp<RootStackParamList, 'Chat'>;
type RouteType    = RouteProp<RootStackParamList, 'Chat'>;

function GlassBar({ children, style }: { children: React.ReactNode; style?: any }) {
  if (Platform.OS === 'web') {
    return <View style={[styles.glassBarWeb, style]}>{children}</View>;
  }
  return (
    <BlurView intensity={70} tint="dark" style={[styles.glassBarNative, style]}>
      {children}
    </BlurView>
  );
}

export default function ChatScreen() {
  const navigation = useNavigation<NavProp>();
  const route      = useRoute<RouteType>();
  const { contact } = route.params;

  const [input,    setInput]    = useState('');
  const [messages, setMessages] = useState<Message[]>(MESSAGES);
  const listRef = useRef<FlatList>(null);

  const sendMessage = () => {
    if (!input.trim()) return;
    setMessages((prev) => [...prev, {
      id: prev.length + 1, from: 'me',
      text: input.trim(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      type: 'out',
    }]);
    setInput('');
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isOut = item.type === 'out';
    return (
      <View style={[styles.msgRow, isOut && styles.msgRowOut]}>
        {!isOut && (
          <Avatar
            initials={contact.avatar} color={contact.color}
            size={28} style={{ marginRight: 6, alignSelf: 'flex-end' }}
          />
        )}

        {isOut ? (
          // Outgoing — gradient bubble
          <LinearGradient colors={GRADIENTS.primary} style={[styles.bubble, styles.bubbleOut]}>
            {item.text && <Text style={styles.bubbleTextOut}>{item.text}</Text>}
            <Text style={styles.timeOut}>{item.time} ✓✓</Text>
          </LinearGradient>
        ) : (
          // Incoming — glass bubble
          <View style={[styles.bubble, styles.bubbleIn]}>
            {item.image && (
              <LinearGradient colors={['#38bff8', '#1a4fa0']} style={styles.imagePlaceholder}>
                <Text style={{ fontSize: 36 }}>🏛️</Text>
                <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', marginTop: 4 }}>Santorini</Text>
              </LinearGradient>
            )}
            {item.voice && (
              <View style={styles.voiceRow}>
                <LinearGradient colors={GRADIENTS.primary} style={styles.playBtn}>
                  <Text style={{ color: '#fff', fontSize: 12 }}>▶</Text>
                </LinearGradient>
                <View style={styles.waveform}>
                  {Array.from({ length: 22 }).map((_, i) => (
                    <View key={i} style={[styles.waveBar, {
                      height: 4 + Math.abs(Math.sin(i * 0.9) * 14),
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
    <LinearGradient colors={GRADIENTS.bg} style={styles.root}>
      {/* Blobs */}
      <View style={[styles.blob, { width: 260, height: 260, top: -60, right: -80 }]} />
      <View style={[styles.blob, { width: 180, height: 180, bottom: 80, left: -50 }]} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {/* ── Top bar ──────────────────────────────────────────── */}
        <GlassBar style={styles.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backIcon}>‹</Text>
          </TouchableOpacity>
          <Avatar initials={contact.avatar} color={contact.color} size={40} status="online" />
          <View style={styles.contactInfo}>
            <Text style={styles.contactName}>{contact.name}</Text>
            <Text style={styles.onlineText}>● Online</Text>
          </View>
          <View style={styles.actionIcons}>
            {['📞', '📹', '⋯'].map((icon, i) => (
              <TouchableOpacity key={i} style={styles.iconBtn}>
                <Text style={{ fontSize: 18 }}>{icon}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </GlassBar>

        {/* ── Messages ─────────────────────────────────────────── */}
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

        {/* ── Input bar ────────────────────────────────────────── */}
        <GlassBar style={styles.inputBar}>
          <TouchableOpacity style={styles.attachBtn}>
            <Text style={{ fontSize: 22, color: 'rgba(255,255,255,0.8)' }}>+</Text>
          </TouchableOpacity>
          <View style={styles.inputWrap}>
            <TextInput
              style={styles.input}
              placeholder="Type a message..."
              placeholderTextColor="rgba(255,255,255,0.35)"
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
        </GlassBar>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  blob: {
    position: 'absolute', borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
    zIndex: 0,
  },

  // Top bar
  glassBarWeb: {
    backgroundColor: 'rgba(10,36,99,0.75)',
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.15)',
  },
  glassBarNative: {
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.15)',
  },
  topBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingTop: 56, paddingBottom: 12, paddingHorizontal: 12, gap: 10,
  },
  backBtn:     { paddingHorizontal: 4 },
  backIcon:    { fontSize: 32, color: '#fff', fontWeight: '300', lineHeight: 36 },
  contactInfo: { flex: 1 },
  contactName: { fontSize: 15, fontWeight: '700', color: '#fff' },
  onlineText:  { fontSize: 11, color: COLORS.green, marginTop: 1 },
  actionIcons: { flexDirection: 'row', gap: 14 },
  iconBtn:     { padding: 4 },

  // Messages
  messageList:  { padding: 16, gap: 8, paddingBottom: 8 },
  datePillWrap: { alignItems: 'center', marginBottom: 12 },
  datePill: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: RADIUS.full, paddingHorizontal: 14, paddingVertical: 5,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.20)',
  },
  datePillText: { fontSize: 11, color: 'rgba(255,255,255,0.65)' },

  // Bubbles
  msgRow:    { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 6 },
  msgRowOut: { justifyContent: 'flex-end' },
  bubble:    { maxWidth: '72%', borderRadius: 18, padding: 10 },
  bubbleOut: {
    borderBottomRightRadius: 4,
    ...SHADOW.button,
  },
  bubbleIn: {
    borderBottomLeftRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
    ...SHADOW.card,
  },
  bubbleTextOut: { fontSize: 14, color: '#fff', lineHeight: 20 },
  bubbleTextIn:  { fontSize: 14, color: '#fff', lineHeight: 20 },
  timeOut: { fontSize: 10, color: 'rgba(255,255,255,0.65)', textAlign: 'right', marginTop: 4 },
  timeIn:  { fontSize: 10, color: 'rgba(255,255,255,0.50)', textAlign: 'right', marginTop: 4 },

  // Image placeholder
  imagePlaceholder: {
    width: 180, height: 120, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },

  // Voice
  voiceRow:     { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  playBtn:      { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  waveform:     { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 2, height: 28 },
  waveBar:      { width: 3, borderRadius: 2, backgroundColor: 'rgba(56,191,248,0.7)' },
  voiceDuration:{ fontSize: 11, color: 'rgba(255,255,255,0.55)' },

  // Input bar
  inputBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 10,
    paddingBottom: Platform.OS === 'ios' ? 30 : 12,
    gap: 8,
  },
  attachBtn: { padding: 4 },
  inputWrap: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderRadius: RADIUS.full,
    paddingHorizontal: 14, paddingVertical: 9,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.20)',
    gap: 8,
  },
  input:    { flex: 1, fontSize: 14, color: '#fff', maxHeight: 90 },
  sendBtn:  { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', ...SHADOW.button },
  sendIcon: { fontSize: 16, color: '#fff' },
});
