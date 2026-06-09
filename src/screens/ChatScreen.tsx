// ─── Screen 3: Chat Conversation — Firebase Real-time ────────────────────────
import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, TextInput, KeyboardAvoidingView,
  Platform, ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import {
  collection, query, orderBy, onSnapshot,
  Timestamp,
} from 'firebase/firestore';
import authModule, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import { db } from '../config/firebase';
import { sendMessage, markChatAsRead } from '../hooks/useChatActions';
import { Avatar } from '../components';
import { COLORS, GRADIENTS, RADIUS, SHADOW } from '../types/theme';
import { RootStackParamList } from '../types';

// ── Extend nav params to include chatId ──────────────────────────────────────
type ExtendedParams = {
  Chat: {
    chatId:      string;
    displayName: string;
    isGroup:     boolean;
  };
};

type NavProp   = NativeStackNavigationProp<RootStackParamList, 'Chat'>;
type RouteType = RouteProp<ExtendedParams, 'Chat'>;

interface FireMessage {
  messageId: string;
  senderId:  string;
  text:      string | null;
  type:      'text' | 'image' | 'voice';
  timestamp: Date | null;
  readBy:    string[];
}

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

function formatTime(date: Date | null): string {
  if (!date) return '';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function ChatScreen() {
  const navigation  = useNavigation<NavProp>();
  const route       = useRoute<RouteType>();
  const { chatId, displayName, isGroup } = route.params;

  const [currentUser, setCurrentUser] = useState<FirebaseAuthTypes.User | null>(null);
  const [messages,    setMessages]    = useState<FireMessage[]>([]);
  const [input,       setInput]       = useState('');
  const [loading,     setLoading]     = useState(true);
  const [sending,     setSending]     = useState(false);
  const listRef = useRef<FlatList>(null);

  // ── Auth state ────────────────────────────────────────────────
  useEffect(() => {
    const unsub = authModule().onAuthStateChanged(setCurrentUser);
    return unsub;
  }, []);

  // ── Real-time messages listener ───────────────────────────────
  useEffect(() => {
    if (!chatId) return;

    const q = query(
      collection(db, 'chats', chatId, 'messages'),
      orderBy('timestamp', 'asc'),
    );

    const unsub = onSnapshot(q, (snap) => {
      const msgs: FireMessage[] = snap.docs.map((doc) => {
        const d = doc.data();
        return {
          messageId: doc.id,
          senderId:  d.senderId,
          text:      d.text ?? null,
          type:      d.type ?? 'text',
          timestamp: d.timestamp
            ? (d.timestamp as Timestamp).toDate()
            : null,
          readBy: d.readBy ?? [],
        };
      });
      setMessages(msgs);
      setLoading(false);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 100);
    });

    return () => unsub();
  }, [chatId]);

  // ── Mark as read when screen opens ───────────────────────────
  useEffect(() => {
    if (chatId && currentUser) {
      markChatAsRead(chatId, currentUser.uid);
    }
  }, [chatId, currentUser]);

  // ── Send message ──────────────────────────────────────────────
  async function handleSend() {
    if (!input.trim() || !currentUser || sending) return;
    setSending(true);
    const text = input.trim();
    setInput('');
    await sendMessage(chatId, currentUser.uid, text);
    setSending(false);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  }

  // ── Render bubble ─────────────────────────────────────────────
  const renderMessage = ({ item, index }: { item: FireMessage; index: number }) => {
    const isOut    = item.senderId === currentUser?.uid;
    const initials = displayName.slice(0, 2).toUpperCase();

    // Show timestamp if gap > 5 min from previous message
    const prev = messages[index - 1];
    const showTime = !prev || (
      item.timestamp && prev.timestamp &&
      item.timestamp.getTime() - prev.timestamp.getTime() > 5 * 60 * 1000
    );

    return (
      <View>
        {showTime && item.timestamp && (
          <View style={styles.timeSeparator}>
            <Text style={styles.timeSeparatorText}>
              {formatTime(item.timestamp)}
            </Text>
          </View>
        )}
        <View style={[styles.msgRow, isOut && styles.msgRowOut]}>
          {!isOut && (
            <Avatar
              initials={initials}
              color="#1a7fe8"
              size={28}
              style={{ marginRight: 6, alignSelf: 'flex-end' }}
            />
          )}
          {isOut ? (
            <LinearGradient colors={GRADIENTS.primary} style={[styles.bubble, styles.bubbleOut]}>
              <Text style={styles.bubbleTextOut}>{item.text}</Text>
              <View style={styles.msgFooter}>
                <Text style={styles.timeOut}>{formatTime(item.timestamp)}</Text>
                <Text style={styles.readTick}>
                  {item.readBy.length > 1 ? '✓✓' : '✓'}
                </Text>
              </View>
            </LinearGradient>
          ) : (
            <View style={[styles.bubble, styles.bubbleIn]}>
              {isGroup && (
                <Text style={styles.senderName}>{item.senderId.slice(0, 8)}</Text>
              )}
              <Text style={styles.bubbleTextIn}>{item.text}</Text>
              <Text style={styles.timeIn}>{formatTime(item.timestamp)}</Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <LinearGradient colors={GRADIENTS.bg} style={styles.root}>
      <View style={[styles.blob, { width: 260, height: 260, top: -60, right: -80 }]} />
      <View style={[styles.blob, { width: 180, height: 180, bottom: 80, left: -50 }]} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* ── Top bar ────────────────────────────────────────── */}
        <GlassBar style={styles.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backIcon}>‹</Text>
          </TouchableOpacity>
          <Avatar
            initials={displayName.slice(0, 2).toUpperCase()}
            color="#1a7fe8" size={40} status="online"
          />
          <View style={styles.contactInfo}>
            <Text style={styles.contactName}>{displayName}</Text>
            <Text style={styles.onlineText}>
              {isGroup ? 'Group chat' : '● Online'}
            </Text>
          </View>
          <View style={styles.actionIcons}>
            {['📞', '📹', '⋯'].map((icon, i) => (
              <TouchableOpacity key={i} style={styles.iconBtn}>
                <Text style={{ fontSize: 18 }}>{icon}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </GlassBar>

        {/* ── Messages ───────────────────────────────────────── */}
        {loading ? (
          <View style={styles.centerWrap}>
            <ActivityIndicator color="#fff" size="large" />
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(item) => item.messageId}
            renderItem={renderMessage}
            contentContainerStyle={styles.messageList}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyIcon}>👋</Text>
                <Text style={styles.emptyText}>
                  Say hello to {displayName}!
                </Text>
              </View>
            }
            onContentSizeChange={() =>
              listRef.current?.scrollToEnd({ animated: false })
            }
          />
        )}

        {/* ── Input bar ──────────────────────────────────────── */}
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
              maxLength={1000}
              onSubmitEditing={handleSend}
              blurOnSubmit={false}
            />
            <TouchableOpacity>
              <Text style={{ fontSize: 18 }}>😊</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            onPress={handleSend}
            activeOpacity={0.8}
            disabled={sending || !input.trim()}
          >
            <LinearGradient
              colors={input.trim() ? GRADIENTS.primary : ['rgba(255,255,255,0.2)', 'rgba(255,255,255,0.1)']}
              style={styles.sendBtn}
            >
              {sending
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.sendIcon}>{input.trim() ? '➤' : '🎤'}</Text>
              }
            </LinearGradient>
          </TouchableOpacity>
        </GlassBar>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  blob: { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.06)', zIndex: 0 },

  glassBarWeb:    { backgroundColor: 'rgba(10,36,99,0.75)', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.15)' },
  glassBarNative: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.15)' },

  topBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingTop: 56, paddingBottom: 12, paddingHorizontal: 12, gap: 10, zIndex: 1,
  },
  backBtn:     { paddingHorizontal: 4 },
  backIcon:    { fontSize: 32, color: '#fff', fontWeight: '300', lineHeight: 36 },
  contactInfo: { flex: 1 },
  contactName: { fontSize: 15, fontWeight: '700', color: '#fff' },
  onlineText:  { fontSize: 11, color: COLORS.green, marginTop: 1 },
  actionIcons: { flexDirection: 'row', gap: 14 },
  iconBtn:     { padding: 4 },

  messageList: { padding: 16, paddingBottom: 8 },

  // Time separator
  timeSeparator:     { alignItems: 'center', marginVertical: 8 },
  timeSeparatorText: {
    fontSize: 11, color: 'rgba(255,255,255,0.45)',
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20,
  },

  // Bubbles
  msgRow:    { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 6 },
  msgRowOut: { justifyContent: 'flex-end' },
  bubble:    { maxWidth: '72%', borderRadius: 18, padding: 10 },
  bubbleOut: { borderBottomRightRadius: 4, ...SHADOW.button },
  bubbleIn:  {
    borderBottomLeftRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
    ...SHADOW.card,
  },
  bubbleTextOut: { fontSize: 14, color: '#fff', lineHeight: 20 },
  bubbleTextIn:  { fontSize: 14, color: '#fff', lineHeight: 20 },
  senderName:    { fontSize: 11, color: '#7dd3fc', fontWeight: '700', marginBottom: 3 },
  msgFooter:     { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 4, marginTop: 4 },
  timeOut:       { fontSize: 10, color: 'rgba(255,255,255,0.65)' },
  readTick:      { fontSize: 10, color: 'rgba(255,255,255,0.65)' },
  timeIn:        { fontSize: 10, color: 'rgba(255,255,255,0.50)', textAlign: 'right', marginTop: 4 },

  // Empty / loading
  centerWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyWrap:  { alignItems: 'center', paddingTop: 80 },
  emptyIcon:  { fontSize: 40, marginBottom: 12 },
  emptyText:  { fontSize: 14, color: 'rgba(255,255,255,0.55)' },

  // Input bar
  inputBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 10,
    paddingBottom: Platform.OS === 'ios' ? 30 : 12,
    gap: 8, zIndex: 1,
  },
  attachBtn: { padding: 4 },
  inputWrap: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderRadius: RADIUS.full,
    paddingHorizontal: 14, paddingVertical: 9,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.20)', gap: 8,
  },
  input:    { flex: 1, fontSize: 14, color: '#fff', maxHeight: 90 },
  sendBtn:  { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', ...SHADOW.button },
  sendIcon: { fontSize: 16, color: '#fff' },
});
