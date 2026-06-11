// ─── Screen: Chat ────────────────────────────────────────────────────────────
import React, { useState, useRef } from 'react';
import {
  View, FlatList, TouchableOpacity, ScrollView,
  StyleSheet, TextInput, KeyboardAvoidingView, Platform,
  Modal, Image, Alert,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Avatar } from '../components';
import { MESSAGES } from '../data/mockData';
import { COLORS, RADIUS, SHADOW, GRADIENTS, GLASS } from '../types/theme';
import { Message, RootStackParamList } from '../types';
import { AppBg, AppText, AppIcon, useForeground, useTypography } from '../context/ThemeContext';

type NavProp       = NativeStackNavigationProp<RootStackParamList, 'Chat'>;
type RoutePropType = RouteProp<RootStackParamList, 'Chat'>;

// Common emoji picks
const EMOJI_LIST = [
  '😀','😂','😍','🥰','😎','😢','😡','👍','👎','❤️',
  '🔥','🎉','🙏','💯','✅','🤣','😅','🤔','👀','💪',
  '🥳','😭','🫡','💀','🤯','🫶','😴','🤩','😏','🙈',
];

export default function ChatScreen() {
  const navigation  = useNavigation<NavProp>();
  const route       = useRoute<RoutePropType>();
  const { contact } = route.params;
  const { FG }     = useForeground();
  const { fontFamily, textColor } = useTypography();

  const [permission, requestPermission] = useCameraPermissions();

  const [input,         setInput]         = useState('');
  const [messages,      setMessages]      = useState<Message[]>(MESSAGES);
  const [showEmoji,     setShowEmoji]     = useState(false);
  const [showAttach,    setShowAttach]    = useState(false);
  const [cameraOpen,    setCameraOpen]    = useState(false);
  const listRef = useRef<FlatList>(null);

  const sendMessage = (text?: string) => {
    const msg = text ?? input.trim();
    if (!msg) return;
    setMessages((prev) => [...prev, {
      id: prev.length + 1, from: 'me', text: msg,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      type: 'out',
    }]);
    setInput('');
    setShowEmoji(false);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const openCamera = async () => {
    if (Platform.OS === 'web') {
      Alert.alert('Camera', 'Camera is not available on web.');
      return;
    }
    const { granted } = permission ?? await requestPermission();
    if (!granted) { Alert.alert('Permission needed', 'Allow camera access to take photos.'); return; }
    setCameraOpen(true);
  };

  const openGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsMultipleSelection: true,
      quality: 0.85,
    });
    if (!result.canceled) {
      setShowAttach(false);
      Alert.alert('Photos selected', `${result.assets.length} item(s) selected.\n(Would be sent as messages)`);
    }
  };

  const openDocuments = async () => {
    const result = await DocumentPicker.getDocumentAsync({ multiple: true });
    if (!result.canceled) {
      setShowAttach(false);
      Alert.alert('Files selected', `${result.assets.length} file(s) selected.\n(Would be sent as messages)`);
    }
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isOut = item.type === 'out';
    return (
      <View style={[styles.msgRow, isOut ? styles.msgRowOut : styles.msgRowIn]}>
        {!isOut && (
          <LinearGradient colors={GRADIENTS.chatSent} style={[styles.bubble, styles.bubbleIn]}>
            {item.image && (
              <View style={styles.imagePlaceholder}>
                <AppIcon name="image-outline" size={32} color="rgba(255,255,255,0.70)" fixedColor />
              </View>
            )}
            {item.voice && (
              <View style={styles.voiceRow}>
                <TouchableOpacity style={styles.playBtn}>
                  <AppIcon name="play" size={14} color="#fff" fixedColor />
                </TouchableOpacity>
                <View style={styles.waveform}>
                  {Array.from({ length: 20 }).map((_, i) => (
                    <View key={i} style={[styles.waveBar, { height: 4 + Math.abs(Math.sin(i * 0.7) * 12) }]} />
                  ))}
                </View>
                <AppText fixedColor style={styles.waveDurationIn}>0:12</AppText>
              </View>
            )}
            {item.text && <AppText fixedColor style={styles.bubbleTextIn}>{item.text}</AppText>}
            <AppText fixedColor style={styles.timeIn}>{item.time}</AppText>
          </LinearGradient>
        )}
        {isOut && (
          <View style={[styles.bubble, styles.bubbleOut]}>
            {item.text && <AppText style={[styles.bubbleTextOut, { color: textColor, fontFamily }]}>{item.text}</AppText>}
            <View style={styles.timeOutRow}>
              <AppText style={styles.timeOut}>{item.time}</AppText>
              <AppIcon name="checkmark-done" size={13} color={COLORS.blue} fixedColor />
            </View>
          </View>
        )}
      </View>
    );
  };

  return (
    <>
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <AppBg />

        {/* ── Top bar ── */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <AppIcon name="chevron-back" size={24} color={COLORS.blue} fixedColor />
          </TouchableOpacity>
          <Avatar initials={contact.avatar} color={contact.color} size={40} status="online" />
          <View style={styles.contactInfo}>
            <AppText style={[styles.contactName, { color: textColor, fontFamily }]}>{contact.name}</AppText>
            <AppText style={[styles.onlineText, contact.status === 'online' && styles.onlineGreen, { color: contact.status !== 'online' ? FG.secondary : undefined }]}>
              {contact.status === 'online' ? 'Online' : contact.status === 'away' ? 'Last seen recently' : `Last seen ${contact.time}`}
            </AppText>
          </View>
          {/* Audio call */}
          <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('AudioCall', { contact })}>
            <AppIcon name="call-outline" size={20} color={COLORS.blue} fixedColor />
          </TouchableOpacity>
          {/* Video call */}
          <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('VideoCall', { contact })}>
            <AppIcon name="videocam-outline" size={20} color={COLORS.blue} fixedColor />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn}>
            <AppIcon name="ellipsis-vertical" size={20} color={COLORS.blue} />
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
                <AppText style={styles.datePillText}>Today</AppText>
              </View>
            </View>
          }
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        />

        {/* ── Emoji panel ── */}
        {showEmoji && (
          <View style={[styles.emojiPanel, { backgroundColor: FG.glassBg, borderTopColor: FG.glassBorder }]}>
            <ScrollView horizontal={false} showsVerticalScrollIndicator={false}>
              <View style={styles.emojiGrid}>
                {EMOJI_LIST.map((e) => (
                  <TouchableOpacity key={e} style={styles.emojiItem} onPress={() => sendMessage(e)}>
                    <AppText fixedColor style={styles.emojiChar}>{e}</AppText>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>
        )}

        {/* ── Input bar ── */}
        <View style={styles.inputBar}>
          {/* Attachments */}
          <TouchableOpacity style={styles.inputSideBtn} onPress={() => { setShowEmoji(false); setShowAttach(true); }}>
            <AppIcon name="add" size={26} color={COLORS.sub} />
          </TouchableOpacity>

          {/* Text field + emoji */}
          <View style={styles.inputFieldWrap}>
            <TextInput
              style={[styles.inputField, { color: FG.primary }]}
              placeholder="Message"
              placeholderTextColor={FG.faint}
              value={input}
              onChangeText={setInput}
              multiline={false}
              maxLength={500}
              returnKeyType="send"
              onSubmitEditing={() => sendMessage()}
              onFocus={() => { setShowEmoji(false); setShowAttach(false); }}
            />
            <TouchableOpacity style={styles.emojiBtn} onPress={() => { setShowAttach(false); setShowEmoji((e) => !e); }}>
              <AppIcon name={showEmoji ? 'keypad-outline' : 'happy-outline'} size={22} color={COLORS.sub} />
            </TouchableOpacity>
          </View>

          {/* Camera — opens camera directly */}
          <TouchableOpacity style={styles.inputSideBtn} onPress={openCamera}>
            <AppIcon name="camera-outline" size={22} color={COLORS.sub} />
          </TouchableOpacity>

          {/* Send / mic */}
          <TouchableOpacity onPress={() => sendMessage()} activeOpacity={0.85} style={styles.sendBtn}>
            <LinearGradient
              colors={input.trim() ? GRADIENTS.primary : ['#7dd3fc', '#38bdf8']}
              style={styles.sendBtnInner}
            >
              <AppIcon name={input.trim() ? 'send' : 'mic'} size={19} color="#fff" fixedColor />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* ── Attachments sheet ── */}
      <Modal visible={showAttach} transparent animationType="slide" onRequestClose={() => setShowAttach(false)}>
        <TouchableOpacity style={styles.attachOverlay} activeOpacity={1} onPress={() => setShowAttach(false)} />
        <View style={[styles.attachSheet, { backgroundColor: FG.glassBg }]}>
          <View style={styles.attachHandle} />
          <AppText style={[styles.attachTitle, { color: textColor, fontFamily }]}>Share</AppText>
          <View style={styles.attachGrid}>
            {[
              { icon: 'images-outline'       as const, label: 'Photos',    action: openGallery   },
              { icon: 'document-outline'     as const, label: 'Files',     action: openDocuments },
              { icon: 'camera-outline'       as const, label: 'Camera',    action: () => { setShowAttach(false); openCamera(); } },
              { icon: 'mic-outline'          as const, label: 'Audio',     action: () => Alert.alert('Audio', 'Record audio message') },
              { icon: 'location-outline'     as const, label: 'Location',  action: () => Alert.alert('Location', 'Share location') },
              { icon: 'person-outline'       as const, label: 'Contact',   action: () => Alert.alert('Contact', 'Share contact') },
            ].map((item) => (
              <TouchableOpacity key={item.label} style={[styles.attachItem, { backgroundColor: FG.glassBg, borderColor: FG.glassBorder }]}
                onPress={item.action} activeOpacity={0.8}>
                <View style={styles.attachIconWrap}>
                  <AppIcon name={item.icon} size={26} color={COLORS.blue} fixedColor />
                </View>
                <AppText style={[styles.attachLabel, { color: textColor, fontFamily }]}>{item.label}</AppText>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

      {/* ── In-app camera ── */}
      {cameraOpen && Platform.OS !== 'web' && (
        <Modal visible animationType="slide" onRequestClose={() => setCameraOpen(false)}>
          <View style={{ flex: 1, backgroundColor: '#000' }}>
            <CameraView style={{ flex: 1 }} facing="back">
              <View style={styles.cameraControls}>
                <TouchableOpacity onPress={() => setCameraOpen(false)} style={styles.cameraCloseBtn}>
                  <AppIcon name="close" size={28} color="#fff" fixedColor />
                </TouchableOpacity>
                <TouchableOpacity style={styles.cameraShutterBtn} onPress={() => setCameraOpen(false)}>
                  <View style={styles.cameraShutter} />
                </TouchableOpacity>
                <View style={{ width: 52 }} />
              </View>
            </CameraView>
          </View>
        </Modal>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  topBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingTop: 52, paddingBottom: 12, paddingHorizontal: 14,
    gap: 8, ...GLASS.header,
  },
  backBtn:     { padding: 2 },
  contactInfo: { flex: 1 },
  contactName: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  onlineText:  { fontSize: 12, color: COLORS.sub, marginTop: 2 },
  onlineGreen: { color: COLORS.green },
  iconBtn:     { padding: 4 },

  messageList:  { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 8, gap: 8 },
  datePillWrap: { alignItems: 'center', marginBottom: 10 },
  datePill:     { ...GLASS.card, borderRadius: RADIUS.full, paddingHorizontal: 16, paddingVertical: 5 },
  datePillText: { fontSize: 11, color: COLORS.sub },

  msgRow:    { flexDirection: 'row', marginBottom: 4 },
  msgRowIn:  { justifyContent: 'flex-start' },
  msgRowOut: { justifyContent: 'flex-end' },

  bubble:       { maxWidth: '75%', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleIn:     { borderBottomLeftRadius: 4, ...SHADOW.card },
  bubbleTextIn: { fontSize: 14, color: '#fff', lineHeight: 20 },
  timeIn:       { fontSize: 10, color: 'rgba(255,255,255,0.75)', marginTop: 5, textAlign: 'right' },

  bubbleOut:     { backgroundColor: 'rgba(255,255,255,0.28)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.50)', borderBottomRightRadius: 4, ...SHADOW.card },
  bubbleTextOut: { fontSize: 14, color: COLORS.text, lineHeight: 20 },
  timeOutRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: 5 },
  timeOut:       { fontSize: 10, color: COLORS.sub },

  imagePlaceholder: { width: 160, height: 100, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  voiceRow:      { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 2 },
  playBtn:       { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
  waveform:      { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 2, height: 24 },
  waveBar:       { width: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.60)' },
  waveDurationIn:{ fontSize: 11, color: 'rgba(255,255,255,0.80)' },

  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end',
    paddingHorizontal: 8, paddingVertical: 8,
    paddingBottom: Platform.OS === 'ios' ? 28 : 10,
    gap: 4, ...GLASS.header,
  },
  inputSideBtn:   { width: 38, height: 42, alignItems: 'center', justifyContent: 'center' },
  inputFieldWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', ...GLASS.card, borderRadius: RADIUS.xl, paddingHorizontal: 14, height: 42 },
  inputField:     { flex: 1, fontSize: 14, color: COLORS.text, padding: 0, margin: 0, height: 42 },
  emojiBtn:       { paddingLeft: 8, alignSelf: 'center' },
  sendBtn:        { width: 42, height: 42, borderRadius: 21, ...SHADOW.button },
  sendBtnInner:   { flex: 1, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },

  // Emoji panel
  emojiPanel: {
    maxHeight: 160, borderTopWidth: 1,
    paddingVertical: 8,
  },
  emojiGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, gap: 2 },
  emojiItem: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  emojiChar: { fontSize: 26 },

  // Attachment sheet
  attachOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.30)' },
  attachSheet: {
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    paddingHorizontal: 20, paddingTop: 12,
    ...SHADOW.glow,
  },
  attachHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(30,156,240,0.30)', alignSelf: 'center', marginBottom: 14 },
  attachTitle:  { fontSize: 16, fontWeight: '700', color: COLORS.text, marginBottom: 16 },
  attachGrid:   { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  attachItem: {
    width: 90, paddingVertical: 14, alignItems: 'center', gap: 8,
    borderRadius: RADIUS.lg, borderWidth: 1, ...SHADOW.card,
  },
  attachIconWrap: { width: 48, height: 48, borderRadius: 14, backgroundColor: 'rgba(30,156,240,0.10)', alignItems: 'center', justifyContent: 'center' },
  attachLabel:    { fontSize: 11, fontWeight: '600', color: COLORS.sub, textAlign: 'center' },

  // Camera UI
  cameraControls: {
    position: 'absolute', bottom: 40, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center',
  },
  cameraCloseBtn:  { width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  cameraShutterBtn:{ alignItems: 'center', justifyContent: 'center' },
  cameraShutter:   { width: 72, height: 72, borderRadius: 36, backgroundColor: '#fff', borderWidth: 4, borderColor: 'rgba(255,255,255,0.60)' },

  // Legacy unused
  inputCard: {}, inputActions: {}, attachBtn: {}, searchPill: {}, searchPillText: {},
});
