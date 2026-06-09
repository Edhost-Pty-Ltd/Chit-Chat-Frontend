// ─── Screen: Chat ────────────────────────────────────────────────────────────
import React, { useState, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '../components';
import { MESSAGES } from '../data/mockData';
import { COLORS, RADIUS, SHADOW, GRADIENTS, GLASS } from '../types/theme';
import { Message, RootStackParamList } from '../types';

type NavProp       = NativeStackNavigationProp<RootStackParamList, 'Chat'>;
type RoutePropType = RouteProp<RootStackParamList, 'Chat'>;

export default function ChatScreen() {
  const navigation  = useNavigation<NavProp>();
  const route       = useRoute<RoutePropType>();
  const { contact } = route.params;

  const [input,    setInput]    = useState('');
  const [messages, setMessages] = useState<Message[]>(MESSAGES);
  const listRef = useRef<FlatList>(null);

  const sendMessage = () => {
    if (!input.trim()) return;
    setMessages((prev) => [...prev, {
      id: prev.length + 1, from: 'me', text: input.trim(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      type: 'out',
    }]);
    setInput('');
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isOut = item.type === 'out';
    return (
      <View style={[styles.msgRow, isOut ? styles.msgRowOut : styles.msgRowIn]}>

        {/* Received bubble — vivid blue gradient */}
        {!isOut && (
          <LinearGradient colors={GRADIENTS.chatSent} style={[styles.bubble, styles.bubbleIn]}>
            {item.image && (
              <View style={styles.imagePlaceholder}>
                <Ionicons name="image-outline" size={32} color="rgba(255,255,255,0.70)" />
              </View>
            )}
            {item.voice && (
              <View style={styles.voiceRow}>
                <TouchableOpacity style={styles.playBtn}>
                  <Ionicons name="play" size={14} color="#fff" />
                </TouchableOpacity>
                <View style={styles.waveform}>
                  {Array.from({ length: 20 }).map((_, i) => (
                    <View key={i} style={[styles.waveBar, { height: 4 + Math.abs(Math.sin(i * 0.7) * 12) }]} />
                  ))}
                </View>
                <Text style={styles.waveDurationIn}>0:12</Text>
              </View>
            )}
            {item.text && <Text style={styles.bubbleTextIn}>{item.text}</Text>}
            <Text style={styles.timeIn}>{item.time}</Text>
          </LinearGradient>
        )}

        {/* Sent bubble — white frosted glass */}
        {isOut && (
          <View style={[styles.bubble, styles.bubbleOut]}>
            {item.text && <Text style={styles.bubbleTextOut}>{item.text}</Text>}
            <View style={styles.timeOutRow}>
              <Text style={styles.timeOut}>{item.time}</Text>
              <Ionicons name="checkmark-done" size={13} color={COLORS.blue} />
            </View>
          </View>
        )}
      </View>
    );
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <LinearGradient colors={GRADIENTS.bg} style={StyleSheet.absoluteFill} />

      {/* ── Top bar ── */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={COLORS.blue} />
        </TouchableOpacity>

        <Avatar initials={contact.avatar} color={contact.color} size={40} status="online" />

        <View style={styles.contactInfo}>
          <Text style={styles.contactName}>{contact.name}</Text>
          <Text style={[
            styles.onlineText,
            contact.status === 'online' && styles.onlineGreen,
          ]}>
            {contact.status === 'online' ? 'Online' :
             contact.status === 'away'   ? 'Last seen recently' :
                                           `Last seen ${contact.time}`}
          </Text>
        </View>

        <TouchableOpacity style={styles.iconBtn}>
          <Ionicons name="call-outline" size={20} color={COLORS.blue} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconBtn}>
          <Ionicons name="videocam-outline" size={20} color={COLORS.blue} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconBtn}>
          <Ionicons name="ellipsis-vertical" size={20} color={COLORS.blue} />
        </TouchableOpacity>
      </View>

      {/* ── Messages ── */}
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

      {/* ── Input bar — single flat row like the reference ── */}
      <View style={styles.inputBar}>

        {/* + button far left */}
        <TouchableOpacity style={styles.inputSideBtn}>
          <Ionicons name="add" size={26} color={COLORS.sub} />
        </TouchableOpacity>

        {/* Glass text field — flex fills the space */}
        <View style={styles.inputFieldWrap}>
          <TextInput
            style={styles.inputField}
            placeholder="Message"
            placeholderTextColor={COLORS.sub}
            value={input}
            onChangeText={setInput}
            multiline
            maxLength={500}
          />
        </View>

        {/* Emoji icon */}
        <TouchableOpacity style={styles.inputSideBtn}>
          <Ionicons name="happy-outline" size={22} color={COLORS.sub} />
        </TouchableOpacity>

        {/* Camera icon */}
        <TouchableOpacity style={styles.inputSideBtn}>
          <Ionicons name="camera-outline" size={22} color={COLORS.sub} />
        </TouchableOpacity>

        {/* Light blue mic / blue send circle — switches on typing */}
        <TouchableOpacity onPress={sendMessage} activeOpacity={0.85} style={styles.sendBtn}>
          <LinearGradient
            colors={input.trim() ? GRADIENTS.primary : ['#7dd3fc', '#38bdf8']}
            style={styles.sendBtnInner}
          >
            <Ionicons
              name={input.trim() ? 'send' : 'mic'}
              size={19}
              color="#fff"
            />
          </LinearGradient>
        </TouchableOpacity>

      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.sky1 },

  // ── Top bar ───────────────────────────────────────────────────────────────
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 52,
    paddingBottom: 12,
    paddingHorizontal: 14,
    gap: 8,
    ...GLASS.header,
  },
  backBtn:     { padding: 2 },
  contactInfo: { flex: 1 },
  contactName: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  onlineText:  { fontSize: 12, color: COLORS.sub, marginTop: 2 },
  onlineGreen: { color: COLORS.green },
  iconBtn:     { padding: 4 },

  // ── Messages ──────────────────────────────────────────────────────────────
  messageList:  { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 8, gap: 8 },
  datePillWrap: { alignItems: 'center', marginBottom: 10 },
  datePill: {
    ...GLASS.card,
    borderRadius: RADIUS.full,
    paddingHorizontal: 16, paddingVertical: 5,
  },
  datePillText: { fontSize: 11, color: COLORS.sub },

  msgRow:    { flexDirection: 'row', marginBottom: 4 },
  msgRowIn:  { justifyContent: 'flex-start' },
  msgRowOut: { justifyContent: 'flex-end' },

  bubble: {
    maxWidth: '75%',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },

  // Received — vivid blue gradient
  bubbleIn: {
    borderBottomLeftRadius: 4,
    ...SHADOW.card,
  },
  bubbleTextIn:  { fontSize: 14, color: '#fff', lineHeight: 20 },
  timeIn:        { fontSize: 10, color: 'rgba(255,255,255,0.75)', marginTop: 5, textAlign: 'right' },

  // Sent — clear glass, sky blue shows through
  bubbleOut: {
    backgroundColor: 'rgba(255,255,255,0.28)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.50)',
    borderBottomRightRadius: 4,
    ...SHADOW.card,
  },
  bubbleTextOut: { fontSize: 14, color: COLORS.text, lineHeight: 20 },
  timeOutRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: 5 },
  timeOut:       { fontSize: 10, color: COLORS.sub },

  // Voice / image
  imagePlaceholder: {
    width: 160, height: 100, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  voiceRow:      { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 2 },
  playBtn:       { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
  waveform:      { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 2, height: 24 },
  waveBar:       { width: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.60)' },
  waveDurationIn:{ fontSize: 11, color: 'rgba(255,255,255,0.80)' },

  // ── Input bar ─────────────────────────────────────────────────────────────
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 8,
    paddingVertical: 8,
    paddingBottom: Platform.OS === 'ios' ? 28 : 10,
    gap: 4,
    ...GLASS.header,
  },

  // Side icon buttons (+, emoji, camera)
  inputSideBtn: {
    width: 38, height: 42,
    alignItems: 'center', justifyContent: 'center',
  },

  // Glass text field
  inputFieldWrap: {
    flex: 1,
    ...GLASS.card,
    borderRadius: RADIUS.xl,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 42,
    maxHeight: 110,
    justifyContent: 'center',
  },
  inputField: {
    fontSize: 14,
    color: COLORS.text,
    padding: 0,
    maxHeight: 90,
  },

  // Green circle send / mic button
  sendBtn: {
    width: 42, height: 42,
    borderRadius: 21,
    ...SHADOW.button,
  },
  sendBtnInner: {
    flex: 1,
    borderRadius: 21,
    alignItems: 'center', justifyContent: 'center',
  },

  // Kept for legacy — unused now
  inputCard:    {},
  inputActions: {},
  attachBtn:    {},
  searchPill:   {},
  searchPillText: {},
});
