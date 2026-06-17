// ─── Screen: Chat ────────────────────────────────────────────────────────────
import React, { useState, useRef } from 'react';
import {
  View, FlatList, TouchableOpacity, ScrollView,
  StyleSheet, TextInput, KeyboardAvoidingView, Platform,
  Modal, Alert, Animated,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Avatar } from '../components';
import { MESSAGES } from '../data/mockData';
import { COLORS, RADIUS, SHADOW, GRADIENTS, GLASS } from '../types/theme';
import { Message, RootStackParamList } from '../types';
import { AppBg, AppText, AppIcon, useForeground, useTypography } from '../context/ThemeContext';
import { useMessages } from '../context/MessagesContext';
import { useBlocked } from '../context/BlockedContext';

// ─── Lazy-load native-only modules so the JS bundle doesn't hard-crash ────────
// expo-camera and expo-audio require native builds; they are not available in
// Expo Go SDK 53+. We import them lazily so any "module not found" error is
// caught at runtime (inside a try/catch) rather than at parse time.
let CameraView: any = null;
let useCameraPermissions: (() => [any, () => Promise<any>]) | null = null;
let AudioModule: any = null;

try {
  // expo-camera — may throw "Cannot find native module 'ExponentCamera'" in Expo Go
  const cam = require('expo-camera');
  CameraView = cam.CameraView;
  useCameraPermissions = cam.useCameraPermissions;
} catch { /* running in Expo Go or web — camera not available */ }

try {
  // expo-audio — replacement for deprecated expo-av
  AudioModule = require('expo-audio');
} catch { /* running in Expo Go or web — audio not available */ }

// ─── Helpers ──────────────────────────────────────────────────────────────────
function useCameraPerms(): [any, () => Promise<any>] {
  if (useCameraPermissions) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useCameraPermissions();
  }
  return [null, async () => ({ granted: false })];
}

type NavProp       = NativeStackNavigationProp<RootStackParamList, 'Chat'>;
type RoutePropType = RouteProp<RootStackParamList, 'Chat'>;

const EMOJI_LIST = [
  '😀','😂','😍','🥰','😎','😢','😡','👍','👎','❤️',
  '🔥','🎉','🙏','💯','✅','🤣','😅','🤔','👀','💪',
  '🥳','😭','🫡','💀','🤯','🫶','😴','🤩','😏','🙈',
];

interface VoiceMessage extends Message {
  voiceUri?: string;
  voiceDuration?: number;
}

export default function ChatScreen() {
  const navigation  = useNavigation<NavProp>();
  const route       = useRoute<RoutePropType>();
  const { contact } = route.params;
  const { FG }      = useForeground();
  const { fontFamily, textColor } = useTypography();
  const { getMessages, appendMessages } = useMessages();
  const { isBlocked, blockContact }     = useBlocked();

  const [cameraPermission, requestCameraPermission] = useCameraPerms();

  const [input,      setInput]      = useState('');
  // Use context messages so injected system messages (number-change etc.) appear
  const messages = getMessages(contact.id);
  const [showEmoji,  setShowEmoji]  = useState(false);
  const [showAttach, setShowAttach] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<'front' | 'back'>('back');
  const cameraRef = useRef<any>(null);
  // Contact info panel
  const [infoOpen,   setInfoOpen]   = useState(false);
  // 3-dot dropdown menu
  const [menuOpen,   setMenuOpen]   = useState(false);
  // Muted state (per-chat)
  const [muted,      setMuted]      = useState(false);
  // Leave group / block — confirm mode shown inside the info panel
  const [confirmMode, setConfirmMode] = useState<null | 'block' | 'leave'>(null);
  // Former members (mock — in a real app this would come from the server)
  const [formerMembers] = useState(() =>
    contact.members
      ? [
          { id: 901, name: 'James Okafor',  avatar: 'JO', color: '#64748b', leftAt: '2 weeks ago' },
          { id: 902, name: 'Tanya Mokoena', avatar: 'TM', color: '#78716c', leftAt: '1 month ago'  },
        ]
      : []
  );

  // Voice recording state
  const [isRecording,   setIsRecording]   = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const recordingRef   = useRef<any>(null);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const micScale = useRef(new Animated.Value(1)).current;

  // Voice playback
  const [playingId, setPlayingId] = useState<number | null>(null);
  const playerRef   = useRef<any>(null);

  const listRef = useRef<FlatList>(null);

  // ── Send text ──────────────────────────────────────────────────────────────
  const sendMessage = (text?: string) => {
    const msg = text ?? input.trim();
    if (!msg) return;
    // If we've blocked this contact, silently drop their incoming messages
    // (the input bar is hidden when blocked, so this guard is belt-and-braces)
    appendMessages(contact.id, [{
      id: 0, from: 'me', text: msg,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      type: 'out',
    }]);
    setInput('');
    setShowEmoji(false);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  };

  // ── Voice recording (expo-audio) ───────────────────────────────────────────
  const startRecording = async () => {
    if (Platform.OS === 'web') {
      Alert.alert('Voice notes', 'Voice recording is not available on web.');
      return;
    }
    if (!AudioModule) {
      Alert.alert('Not available', 'Voice recording requires a development build.');
      return;
    }
    try {
      const { useAudioRecorder, AudioQuality, RecordingPresets } = AudioModule;
      // Request mic permission
      const perm = await AudioModule.requestRecordingPermissionsAsync?.();
      if (perm && !perm.granted) {
        Alert.alert('Permission needed', 'Allow microphone access to send voice notes.');
        return;
      }

      const recorder = AudioModule.createRecording ? AudioModule.createRecording() : null;
      if (!recorder) throw new Error('createRecording not found');
      await recorder.prepareToRecordAsync();
      await recorder.startAsync();
      recordingRef.current = recorder;
      setIsRecording(true);
      setRecordSeconds(0);
      recordTimerRef.current = setInterval(() => setRecordSeconds((s) => s + 1), 1000);

      Animated.loop(
        Animated.sequence([
          Animated.timing(micScale, { toValue: 1.25, duration: 400, useNativeDriver: true }),
          Animated.timing(micScale, { toValue: 1,    duration: 400, useNativeDriver: true }),
        ])
      ).start();
    } catch {
      Alert.alert('Error', 'Could not start recording.');
    }
  };

  const stopRecording = async () => {
    micScale.stopAnimation();
    micScale.setValue(1);
    if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    setIsRecording(false);

    const rec = recordingRef.current;
    recordingRef.current = null;
    if (!rec) return;
    try {
      await rec.stopAsync();
      const uri      = rec.getURI?.() ?? null;
      const duration = recordSeconds;
      if (uri && duration >= 1) {
        appendMessages(contact.id, [{
          id: 0, from: 'me', voice: true,
          voiceUri: uri, voiceDuration: duration,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          type: 'out',
        } as VoiceMessage]);
        setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
      }
    } catch {}
    setRecordSeconds(0);
  };

  // ── Voice playback (expo-audio) ────────────────────────────────────────────
  const playVoice = async (msg: VoiceMessage) => {
    if (!AudioModule || !msg.voiceUri) return;
    try {
      // Stop current
      if (playerRef.current) {
        await playerRef.current.remove?.();
        playerRef.current = null;
        if (playingId === msg.id) { setPlayingId(null); return; }
      }
      setPlayingId(msg.id);
      const { createAudioPlayer } = AudioModule;
      const player = createAudioPlayer({ uri: msg.voiceUri });
      playerRef.current = player;
      player.play();
      player.addListener?.('playbackStatusUpdate', (status: any) => {
        if (status.didJustFinish) {
          setPlayingId(null);
          player.remove?.();
          playerRef.current = null;
        }
      });
    } catch { setPlayingId(null); }
  };

  const fmtDuration = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  // ── Camera ─────────────────────────────────────────────────────────────────
  const openCamera = async () => {
    if (Platform.OS === 'web') { Alert.alert('Camera', 'Not available on web.'); return; }
    if (!CameraView) { Alert.alert('Not available', 'Camera requires a development build.'); return; }
    const { granted } = cameraPermission ?? await requestCameraPermission();
    if (!granted) { Alert.alert('Permission needed', 'Allow camera access to take photos.'); return; }
    setCameraFacing('back');
    setCameraOpen(true);
  };

  const takePicture = async () => {
    if (!cameraRef.current) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.85, base64: false });
      setCameraOpen(false);
      if (photo?.uri) {
        // Add a photo message to the chat
        appendMessages(contact.id, [{
          id: Date.now(), from: 'me', image: true,
          imageUri: photo.uri,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          type: 'out',
        } as any]);
        setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
      }
    } catch {
      Alert.alert('Error', 'Could not take photo.');
    }
  };

  const openGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'] as any,
      allowsMultipleSelection: true, quality: 0.85,
    });
    if (!result.canceled) { setShowAttach(false); Alert.alert('Photos selected', `${result.assets.length} item(s) selected.`); }
  };

  const openDocuments = async () => {
    const result = await DocumentPicker.getDocumentAsync({ multiple: true });
    if (!result.canceled) { setShowAttach(false); Alert.alert('Files selected', `${result.assets.length} file(s) selected.`); }
  };

  // ── Render message ─────────────────────────────────────────────────────────
  const renderMessage = ({ item }: { item: VoiceMessage }) => {
    const isOut     = item.type === 'out';
    const isSystem  = item.from === 'system';
    const isPlaying = playingId === item.id;

    // ── System message — centred pill ──────────────────────────────────────
    if (isSystem) {
      // Rich number-change message
      if (item.numberChange) {
        const { oldNumber, newNumber, displayName: dName } = item.numberChange;
        return (
          <View style={styles.systemMsgWrap}>
            <View style={styles.numberChangePill}>
              <AppIcon name="phone-portrait-outline" size={16} color={COLORS.blue} fixedColor
                style={{ marginBottom: 4 }} />
              <AppText fixedColor style={styles.systemMsgText}>
                {dName} changed their number
              </AppText>
              <AppText fixedColor style={styles.numberChangeOld}>
                From: {oldNumber}
              </AppText>
              {/* Tappable new number */}
              <TouchableOpacity
                activeOpacity={0.75}
                onPress={() => {
                  // Build a synthetic contact for the new number and open a chat
                  const newContact = {
                    ...contact,
                    id:      contact.id + 10000, // synthetic id
                    lastMsg: newNumber,
                    time:    'Now',
                    unread:  0,
                    // Store new number as lastMsg so it's visible in chats list
                  };
                  navigation.replace('Chat', { contact: { ...newContact } });
                }}
              >
                <View style={styles.numberChangeNewBtn}>
                  <AppText fixedColor style={styles.numberChangeNewText}>
                    {newNumber}
                  </AppText>
                  <AppIcon name="arrow-forward" size={13} color="#fff" fixedColor />
                </View>
              </TouchableOpacity>
              <AppText fixedColor style={styles.numberChangeTip}>
                Tap number to chat on new number
              </AppText>
            </View>
          </View>
        );
      }

      // Group-left rich card
      if (item.groupLeft) {
        const { groupName, displayName } = item.groupLeft;
        return (
          <View style={styles.systemMsgWrap}>
            <View style={styles.numberChangePill}>
              <AppIcon name="exit-outline" size={16} color={COLORS.missed} fixedColor
                style={{ marginBottom: 4 }} />
              <AppText fixedColor style={styles.systemMsgText}>
                {displayName} left the group
              </AppText>
              <View style={styles.groupLeftBadge}>
                <AppIcon name="people-outline" size={13} color="#fff" fixedColor />
                <AppText fixedColor style={styles.groupLeftBadgeTxt}>{groupName}</AppText>
              </View>
              <AppText fixedColor style={styles.numberChangeTip}>
                This member is no longer in the group
              </AppText>
            </View>
          </View>
        );
      }

      // Plain system message
      return (
        <View style={styles.systemMsgWrap}>
          <View style={styles.systemMsgPill}>
            <AppText fixedColor style={styles.systemMsgText}>{item.text}</AppText>
          </View>
        </View>
      );
    }

    return (
      <View style={[styles.msgRow, isOut ? styles.msgRowOut : styles.msgRowIn]}>
        {!isOut && (
          <LinearGradient colors={GRADIENTS.chatSent} style={[styles.bubble, styles.bubbleIn]}>
            {item.voice && (
              <TouchableOpacity style={styles.voiceRow} onPress={() => playVoice(item)}>
                <View style={[styles.playBtn, isPlaying && styles.playBtnActive]}>
                  <AppIcon name={isPlaying ? 'pause' : 'play'} size={14} color="#fff" fixedColor />
                </View>
                <View style={styles.waveform}>
                  {Array.from({ length: 20 }).map((_, i) => (
                    <View key={i} style={[styles.waveBar, { height: 4 + Math.abs(Math.sin(i * 0.7) * 12) }]} />
                  ))}
                </View>
                <AppText fixedColor style={styles.waveDurationIn}>
                  {item.voiceDuration ? fmtDuration(item.voiceDuration) : '0:00'}
                </AppText>
              </TouchableOpacity>
            )}
            {item.text && <AppText fixedColor style={styles.bubbleTextIn}>{item.text}</AppText>}
            <AppText fixedColor style={styles.timeIn}>{item.time}</AppText>
          </LinearGradient>
        )}
        {isOut && (
          <View style={[styles.bubble, styles.bubbleOut]}>
            {item.voice && (
              <TouchableOpacity style={styles.voiceRowOut} onPress={() => playVoice(item)}>
                <View style={[styles.playBtnOut, isPlaying && styles.playBtnActive]}>
                  <AppIcon name={isPlaying ? 'pause' : 'play'} size={14} color={COLORS.blue} fixedColor />
                </View>
                <View style={styles.waveformOut}>
                  {Array.from({ length: 20 }).map((_, i) => (
                    <View key={i} style={[styles.waveBarOut, { height: 4 + Math.abs(Math.sin(i * 0.7) * 12) }]} />
                  ))}
                </View>
                <AppText style={[styles.waveDurationOut, { color: FG.secondary }]}>
                  {item.voiceDuration ? fmtDuration(item.voiceDuration) : '0:00'}
                </AppText>
              </TouchableOpacity>
            )}
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

  const isSending = input.trim().length > 0;

  return (
    <>
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <AppBg />

        {/* Top bar */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <AppIcon name="chevron-back" size={24} color={COLORS.blue} fixedColor />
          </TouchableOpacity>
          {/* Tapping the avatar/name opens Contact Info */}
          <TouchableOpacity
            style={styles.topBarContact}
            onPress={() => setInfoOpen(true)}
            activeOpacity={0.75}
          >
            <Avatar initials={contact.avatar} color={contact.color} size={40} status="online" />
            <View style={styles.contactInfo}>
              <AppText style={[styles.contactName, { color: textColor, fontFamily }]}>{contact.name}</AppText>
              <AppText style={[styles.onlineText,
                contact.status === 'online' && styles.onlineGreen,
                { color: contact.status !== 'online' ? FG.secondary : undefined }]}>
                {contact.status === 'online' ? 'Online'
                  : contact.status === 'away' ? 'Last seen recently'
                  : `Last seen ${contact.time}`}
              </AppText>
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('AudioCall', { contact, participants: contact.members })}>
            <AppIcon name="call-outline" size={20} color={COLORS.blue} fixedColor />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('VideoCall', { contact, participants: contact.members })}>
            <AppIcon name="videocam-outline" size={20} color={COLORS.blue} fixedColor />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={() => setMenuOpen(true)}>
            <AppIcon name="ellipsis-vertical" size={20} color={COLORS.blue} fixedColor />
          </TouchableOpacity>
        </View>

        {/* Messages */}
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

        {/* Recording indicator */}
        {isRecording && (
          <View style={[styles.recordingBar, { backgroundColor: FG.glassBg, borderTopColor: FG.glassBorder }]}>
            <Animated.View style={{ transform: [{ scale: micScale }] }}>
              <AppIcon name="mic" size={20} color={COLORS.missed} fixedColor />
            </Animated.View>
            <AppText fixedColor style={styles.recordingText}>
              Recording… {fmtDuration(recordSeconds)}
            </AppText>
            <TouchableOpacity onPress={stopRecording}>
              <AppIcon name="stop-circle-outline" size={22} color={COLORS.missed} fixedColor />
            </TouchableOpacity>
          </View>
        )}

        {/* Emoji panel */}
        {showEmoji && (
          <View style={[styles.emojiPanel, { backgroundColor: FG.glassBg, borderTopColor: FG.glassBorder }]}>
            <View style={styles.emojiGrid}>
              {EMOJI_LIST.map((e) => (
                <TouchableOpacity key={e} style={styles.emojiItem} onPress={() => sendMessage(e)}>
                  <AppText fixedColor style={styles.emojiChar}>{e}</AppText>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Blocked banner — replaces input bar when this contact is blocked */}
        {isBlocked(contact.id) ? (
          <View style={[styles.blockedBar, { backgroundColor: FG.glassBg, borderTopColor: FG.glassBorder }]}>
            <AppIcon name="ban-outline" size={18} color={COLORS.missed} fixedColor />
            <AppText style={[styles.blockedBarTxt, { color: FG.secondary }]}>
              You have blocked{' '}
              <AppText style={{ fontWeight: '700', color: textColor }}>{contact.name}</AppText>.
              Messages cannot be sent.
            </AppText>
          </View>
        ) : (
        <>
        {/* Input bar */}
        <View style={styles.inputBar}>
          <TouchableOpacity style={styles.inputSideBtn}
            onPress={() => { setShowEmoji(false); setShowAttach(true); }}>
            <AppIcon name="add" size={26} color={COLORS.sub} />
          </TouchableOpacity>

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
            <TouchableOpacity style={styles.emojiBtn}
              onPress={() => { setShowAttach(false); setShowEmoji((e) => !e); }}>
              <AppIcon name={showEmoji ? 'keypad-outline' : 'happy-outline'} size={22} color={COLORS.sub} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.inputSideBtn} onPress={openCamera}>
            <AppIcon name="camera-outline" size={22} color={COLORS.sub} />
          </TouchableOpacity>

          {isSending ? (
            <TouchableOpacity onPress={() => sendMessage()} activeOpacity={0.85} style={styles.sendBtn}>
              <LinearGradient colors={GRADIENTS.primary} style={styles.sendBtnInner}>
                <AppIcon name="send" size={19} color="#fff" fixedColor />
              </LinearGradient>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPressIn={startRecording}
              onPressOut={stopRecording}
              activeOpacity={0.85}
              style={styles.sendBtn}
            >
              <LinearGradient
                colors={isRecording ? [COLORS.missed, '#c0392b'] : ['#7dd3fc', '#38bdf8']}
                style={styles.sendBtnInner}
              >
                <Animated.View style={{ transform: [{ scale: isRecording ? micScale : new Animated.Value(1) }] }}>
                  <AppIcon name="mic" size={19} color="#fff" fixedColor />
                </Animated.View>
              </LinearGradient>
            </TouchableOpacity>
          )}
        </View>
        </> /* end !isBlocked */
        )}
      </KeyboardAvoidingView>

      {/* Attachments sheet */}
      <Modal visible={showAttach} transparent animationType="slide"
        onRequestClose={() => setShowAttach(false)}>
        <TouchableOpacity style={styles.attachOverlay} activeOpacity={1}
          onPress={() => setShowAttach(false)} />
        <View style={[styles.attachSheet, { backgroundColor: FG.glassBg }]}>
          <View style={styles.attachHandle} />
          <AppText style={[styles.attachTitle, { color: textColor, fontFamily }]}>Share</AppText>
          <View style={styles.attachGrid}>
            {[
              { icon: 'images-outline'   as const, label: 'Photos',   action: openGallery },
              { icon: 'document-outline' as const, label: 'Files',    action: openDocuments },
              { icon: 'camera-outline'   as const, label: 'Camera',   action: () => { setShowAttach(false); openCamera(); } },
              { icon: 'mic-outline'      as const, label: 'Audio',    action: () => { setShowAttach(false); startRecording(); } },
              { icon: 'location-outline' as const, label: 'Location', action: () => Alert.alert('Location', 'Share location') },
              { icon: 'person-outline'   as const, label: 'Contact',  action: () => Alert.alert('Contact', 'Share contact') },
            ].map((item) => (
              <TouchableOpacity key={item.label}
                style={[styles.attachItem, { backgroundColor: FG.glassBg, borderColor: FG.glassBorder }]}
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

      {/* ── Contact Info panel ── */}
      <Modal
        visible={infoOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setInfoOpen(false)}
      >
        <View style={styles.infoOverlay}>
          <TouchableOpacity style={styles.infoBackdrop} activeOpacity={1} onPress={() => { setInfoOpen(false); setConfirmMode(null); }} />
          <View style={[styles.infoSheet, { backgroundColor: FG.glassBg, borderColor: FG.glassBorder }]}>
            <AppBg />
            {/* Handle */}
            <View style={styles.infoHandle} />

            {/* Close */}
            <TouchableOpacity style={styles.infoCloseBtn} onPress={() => { setInfoOpen(false); setConfirmMode(null); }}>
              <AppIcon name="close" size={20} color={FG.secondary} />
            </TouchableOpacity>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.infoScroll}>
              {/* Avatar + name */}
              <View style={styles.infoAvatarWrap}>
                <Avatar initials={contact.avatar} color={contact.color} size={80} />
              </View>
              <AppText style={[styles.infoName, { color: textColor, fontFamily }]}>{contact.name}</AppText>
              <AppText style={[styles.infoStatus, { color: FG.secondary }]}>
                {contact.status === 'online' ? '🟢 Online'
                  : contact.status === 'away' ? '🟡 Last seen recently'
                  : `⚫ Last seen ${contact.time}`}
              </AppText>

              {/* Action buttons */}
              <View style={styles.infoActions}>
                {[
                  { icon: 'call-outline'     as const, label: 'Audio Call', onPress: () => { setInfoOpen(false); navigation.navigate('AudioCall', { contact, participants: contact.members }); } },
                  { icon: 'videocam-outline' as const, label: 'Video Call', onPress: () => { setInfoOpen(false); navigation.navigate('VideoCall', { contact, participants: contact.members }); } },
                ].map((a) => (
                  <TouchableOpacity key={a.label} style={[styles.infoActionBtn, { backgroundColor: FG.glassBg, borderColor: FG.glassBorder }]} onPress={a.onPress} activeOpacity={0.8}>
                    <LinearGradient colors={GRADIENTS.primary} style={styles.infoActionIcon}>
                      <AppIcon name={a.icon} size={20} color="#fff" fixedColor />
                    </LinearGradient>
                    <AppText style={[styles.infoActionLabel, { color: textColor }]}>{a.label}</AppText>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Group participants */}
              {contact.members && contact.members.length > 0 && (
                <>
                  <AppText style={[styles.infoSectionLabel, { color: FG.secondary }]}>
                    PARTICIPANTS ({contact.members.length})
                  </AppText>
                  {contact.members.map((member) => (
                    <View key={member.id} style={[styles.infoMemberRow, { backgroundColor: FG.glassBg, borderColor: FG.glassBorder }]}>
                      <Avatar initials={member.avatar} color={member.color} size={42} status={member.status} />
                      <View style={{ flex: 1 }}>
                        <AppText style={[styles.infoMemberName, { color: textColor, fontFamily }]}>{member.name}</AppText>
                        <AppText style={[styles.infoMemberStatus, { color: FG.secondary }]}>
                          {member.status === 'online' ? '🟢 Online' : member.status === 'away' ? '🟡 Away' : '⚫ Offline'}
                        </AppText>
                      </View>
                    </View>
                  ))}
                </>
              )}

              {/* Shared media placeholder */}
              <AppText style={[styles.infoSectionLabel, { color: FG.secondary }]}>SHARED MEDIA</AppText>
              <View style={[styles.infoMediaBox, { backgroundColor: FG.glassBg, borderColor: FG.glassBorder }]}>
                <AppIcon name="images-outline" size={28} color={FG.secondary} />
                <AppText style={[styles.infoMediaEmpty, { color: FG.secondary }]}>No media shared yet</AppText>
              </View>

              {/* Block / Leave — inline confirmation inside the profile panel */}
              <AppText style={[styles.infoSectionLabel, { color: FG.secondary }]}>PRIVACY</AppText>

              {confirmMode === null && (
                <>
                  <TouchableOpacity
                    style={[styles.infoBlockBtn, { backgroundColor: FG.glassBg, borderColor: FG.glassBorder }]}
                    activeOpacity={0.8}
                    onPress={() => setConfirmMode('block')}
                  >
                    <AppIcon name="ban-outline" size={20} color={COLORS.missed} fixedColor />
                    <AppText fixedColor style={styles.infoBlockTxt}>Block {contact.name}</AppText>
                  </TouchableOpacity>

                  {contact.members && (
                    <TouchableOpacity
                      style={[styles.infoBlockBtn, { backgroundColor: FG.glassBg, borderColor: FG.glassBorder, marginTop: 8 }]}
                      activeOpacity={0.8}
                      onPress={() => setConfirmMode('leave')}
                    >
                      <AppIcon name="exit-outline" size={20} color={COLORS.missed} fixedColor />
                      <AppText fixedColor style={styles.infoBlockTxt}>Leave Group</AppText>
                    </TouchableOpacity>
                  )}
                </>
              )}

              {/* ── Block confirmation card — shown in-place on the profile ── */}
              {confirmMode === 'block' && (
                <View style={[styles.inlineConfirmCard, { borderColor: 'rgba(232,67,67,0.35)', backgroundColor: 'rgba(232,67,67,0.08)' }]}>
                  <LinearGradient colors={['#e84343', '#c0392b']} style={styles.inlineConfirmIcon}>
                    <AppIcon name="ban-outline" size={22} color="#fff" fixedColor />
                  </LinearGradient>
                  <AppText style={[styles.inlineConfirmTitle, { color: textColor, fontFamily }]}>
                    Block {contact.name}?
                  </AppText>
                  <AppText style={[styles.inlineConfirmBody, { color: FG.secondary }]}>
                    They will no longer be able to message you or see your status.
                  </AppText>
                  <View style={styles.inlineConfirmActions}>
                    <TouchableOpacity
                      style={[styles.inlineConfirmBtn, { borderColor: FG.glassBorder, borderWidth: 1 }]}
                      onPress={() => setConfirmMode(null)}
                      activeOpacity={0.8}
                    >
                      <AppText style={[styles.inlineConfirmBtnTxt, { color: textColor }]}>Cancel</AppText>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.inlineConfirmBtn}
                      onPress={() => {
                        blockContact(contact.id);
                        setConfirmMode(null);
                        setInfoOpen(false);
                      }}
                      activeOpacity={0.8}
                    >
                      <LinearGradient colors={['#e84343', '#c0392b']} style={styles.inlineConfirmBtnGrad}>
                        <AppIcon name="ban-outline" size={15} color="#fff" fixedColor />
                        <AppText fixedColor style={[styles.inlineConfirmBtnTxt, { color: '#fff' }]}>Block</AppText>
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* ── Leave confirmation card — shown in-place on the profile ── */}
              {confirmMode === 'leave' && (
                <View style={[styles.inlineConfirmCard, { borderColor: 'rgba(232,67,67,0.35)', backgroundColor: 'rgba(232,67,67,0.08)' }]}>
                  <LinearGradient colors={['#e84343', '#c0392b']} style={styles.inlineConfirmIcon}>
                    <AppIcon name="exit-outline" size={22} color="#fff" fixedColor />
                  </LinearGradient>
                  <AppText style={[styles.inlineConfirmTitle, { color: textColor, fontFamily }]}>
                    Leave {contact.name}?
                  </AppText>
                  <AppText style={[styles.inlineConfirmBody, { color: FG.secondary }]}>
                    You will stop receiving messages from this group.
                  </AppText>
                  <View style={styles.inlineConfirmActions}>
                    <TouchableOpacity
                      style={[styles.inlineConfirmBtn, { borderColor: FG.glassBorder, borderWidth: 1 }]}
                      onPress={() => setConfirmMode(null)}
                      activeOpacity={0.8}
                    >
                      <AppText style={[styles.inlineConfirmBtnTxt, { color: textColor }]}>Cancel</AppText>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.inlineConfirmBtn}
                      onPress={() => {
                        // Inject the rich "group left" system message
                        appendMessages(contact.id, [{
                          id: Date.now(),
                          from: 'system',
                          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                          type: 'out',
                          groupLeft: {
                            groupName:   contact.name,
                            displayName: 'You',
                          },
                        }]);
                        setConfirmMode(null);
                        setInfoOpen(false);
                        navigation.goBack();
                      }}
                      activeOpacity={0.8}
                    >
                      <LinearGradient colors={['#e84343', '#c0392b']} style={styles.inlineConfirmBtnGrad}>
                        <AppIcon name="exit-outline" size={15} color="#fff" fixedColor />
                        <AppText fixedColor style={[styles.inlineConfirmBtnTxt, { color: '#fff' }]}>Leave</AppText>
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Past members — only shown for groups */}
              {contact.members && formerMembers.length > 0 && (
                <>
                  <AppText style={[styles.infoSectionLabel, { color: FG.secondary }]}>
                    PAST MEMBERS
                  </AppText>
                  {formerMembers.map((former) => (
                    <View key={former.id} style={[styles.infoMemberRow, { backgroundColor: FG.glassBg, borderColor: FG.glassBorder, opacity: 0.7 }]}>
                      <Avatar initials={former.avatar} color={former.color} size={42} />
                      <View style={{ flex: 1 }}>
                        <AppText style={[styles.infoMemberName, { color: textColor, fontFamily }]}>{former.name}</AppText>
                        <AppText style={[styles.infoMemberStatus, { color: FG.secondary }]}>
                          Left {former.leftAt}
                        </AppText>
                      </View>
                      <AppIcon name="exit-outline" size={16} color={FG.secondary} />
                    </View>
                  ))}
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── 3-dot dropdown menu ── */}
      <Modal
        visible={menuOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuOpen(false)}
      >
        <TouchableOpacity style={styles.menuOverlay} activeOpacity={1} onPress={() => setMenuOpen(false)} />
        <View style={[styles.menuCard, { backgroundColor: FG.glassBg, borderColor: FG.glassBorder }]}>
          <AppBg />
          {[
            {
              icon: muted ? 'notifications-outline' as const : 'notifications-off-outline' as const,
              label: muted ? 'Unmute Notifications' : 'Mute Notifications',
              onPress: () => { setMuted((m) => !m); setMenuOpen(false); },
            },
            {
              icon: 'search-outline' as const,
              label: 'Search',
              onPress: () => { setMenuOpen(false); Alert.alert('Search', 'Search in chat coming soon.'); },
            },
            {
              icon: 'trash-outline' as const,
              label: 'Clear Chat',
              danger: true,
              onPress: () => {
                setMenuOpen(false);
                Alert.alert(
                  'Clear Chat',
                  `Clear all messages with ${contact.name}? This cannot be undone.`,
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Clear', style: 'destructive', onPress: () => appendMessages(contact.id, []) },
                  ]
                );
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
              <AppIcon name={item.icon} size={18} color={item.danger ? COLORS.missed : COLORS.blue} fixedColor />
              <AppText style={[styles.menuItemTxt, { color: item.danger ? COLORS.missed : textColor, fontFamily }]}>
                {item.label}
              </AppText>
            </TouchableOpacity>
          ))}
        </View>
      </Modal>

      {/* In-app camera — only rendered when CameraView native module is available */}
      {cameraOpen && Platform.OS !== 'web' && CameraView && (
        <Modal visible animationType="slide" onRequestClose={() => setCameraOpen(false)}>
          <View style={{ flex: 1, backgroundColor: '#000' }}>
            {/* CameraView must not have children — controls are absolute siblings */}
            <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing={cameraFacing} />
            <View style={styles.cameraControls}>
              <TouchableOpacity onPress={() => setCameraOpen(false)} style={styles.cameraCloseBtn}>
                <AppIcon name="close" size={28} color="#fff" fixedColor />
              </TouchableOpacity>
              <TouchableOpacity style={styles.cameraShutterBtn} onPress={takePicture}>
                <View style={styles.cameraShutter} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.cameraCloseBtn}
                onPress={() => setCameraFacing((f) => (f === 'back' ? 'front' : 'back'))}
              >
                <AppIcon name="camera-reverse-outline" size={28} color="#fff" fixedColor />
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingTop: Platform.OS === 'web' ? 16 : 52, paddingBottom: 12, paddingHorizontal: 14, gap: 8, ...GLASS.header },
  backBtn:       { padding: 2 },
  topBarContact: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  contactInfo:   { flex: 1 },
  contactName:   { fontSize: 15, fontWeight: '700', color: COLORS.text },
  onlineText:    { fontSize: 12, color: COLORS.sub, marginTop: 2 },
  onlineGreen:   { color: COLORS.green },
  iconBtn:       { padding: 4 },

  messageList:  { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 8, gap: 8 },
  datePillWrap: { alignItems: 'center', marginBottom: 10 },
  datePill:     { ...GLASS.card, borderRadius: RADIUS.full, paddingHorizontal: 16, paddingVertical: 5 },
  datePillText: { fontSize: 11, color: COLORS.sub },

  msgRow:    { flexDirection: 'row', marginBottom: 4 },
  msgRowIn:  { justifyContent: 'flex-start' },
  msgRowOut: { justifyContent: 'flex-end' },

  // System message — centred notification pill
  systemMsgWrap: { alignItems: 'center', marginVertical: 6, paddingHorizontal: 20 },
  systemMsgPill: {
    backgroundColor: 'rgba(30,156,240,0.15)',
    borderRadius: RADIUS.full,
    paddingHorizontal: 14, paddingVertical: 6,
    borderWidth: 1, borderColor: 'rgba(30,156,240,0.25)',
  },
  systemMsgText: { fontSize: 12, color: COLORS.sub, textAlign: 'center', lineHeight: 17 },

  // Number-change rich card
  numberChangePill: {
    backgroundColor: 'rgba(30,156,240,0.12)',
    borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: 'rgba(30,156,240,0.30)',
    paddingHorizontal: 18, paddingVertical: 14,
    alignItems: 'center', gap: 4,
    maxWidth: 280,
    ...SHADOW.card,
  },
  numberChangeOld: {
    fontSize: 12, color: COLORS.sub, textAlign: 'center',
  },
  numberChangeNewBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.blue,
    borderRadius: RADIUS.full,
    paddingHorizontal: 16, paddingVertical: 7,
    marginTop: 4,
    ...SHADOW.button,
  },
  numberChangeNewText: {
    fontSize: 14, fontWeight: '700', color: '#fff',
  },
  numberChangeTip: {
    fontSize: 10, color: COLORS.sub, marginTop: 4, textAlign: 'center',
  },

  // Group-left badge (inside the rich system card)
  groupLeftBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: COLORS.missed,
    borderRadius: RADIUS.full,
    paddingHorizontal: 12, paddingVertical: 5,
    marginTop: 4,
    ...SHADOW.button,
  },
  groupLeftBadgeTxt: { fontSize: 13, fontWeight: '700', color: '#fff' },

  bubble:        { maxWidth: '75%', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleIn:      { borderBottomLeftRadius: 4, ...SHADOW.card },
  bubbleTextIn:  { fontSize: 14, color: '#fff', lineHeight: 20 },
  timeIn:        { fontSize: 10, color: 'rgba(255,255,255,0.75)', marginTop: 5, textAlign: 'right' },
  bubbleOut:     { backgroundColor: 'rgba(30,156,240,0.08)', borderWidth: 1, borderColor: 'rgba(30,156,240,0.20)', borderBottomRightRadius: 4, ...SHADOW.card },
  bubbleTextOut: { fontSize: 14, color: COLORS.text, lineHeight: 20 },
  timeOutRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: 5 },
  timeOut:       { fontSize: 10, color: COLORS.sub },

  voiceRow:       { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 2 },
  playBtn:        { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
  playBtnActive:  { backgroundColor: 'rgba(255,255,255,0.45)' },
  waveform:       { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 2, height: 24 },
  waveBar:        { width: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.60)' },
  waveDurationIn: { fontSize: 11, color: 'rgba(255,255,255,0.80)' },

  voiceRowOut:     { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 2 },
  playBtnOut:      { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(30,156,240,0.15)', borderWidth: 1, borderColor: 'rgba(30,156,240,0.30)', alignItems: 'center', justifyContent: 'center' },
  waveformOut:     { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 2, height: 24 },
  waveBarOut:      { width: 3, borderRadius: 2, backgroundColor: 'rgba(30,156,240,0.50)' },
  waveDurationOut: { fontSize: 11 },

  recordingBar:  { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: 1 },
  recordingText: { flex: 1, fontSize: 13, color: COLORS.missed, fontWeight: '600' },

  inputBar:       { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 8, paddingVertical: 8, paddingBottom: Platform.OS === 'ios' ? 28 : 10, gap: 4, ...GLASS.header },
  blockedBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 14,
    borderTopWidth: 1,
  },
  blockedBarTxt: { flex: 1, fontSize: 13, lineHeight: 19 },
  inputSideBtn:   { width: 38, height: 42, alignItems: 'center', justifyContent: 'center' },
  inputFieldWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', ...GLASS.card, borderRadius: RADIUS.xl, paddingHorizontal: 14, height: 42 },
  inputField:     { flex: 1, fontSize: 14, color: COLORS.text, padding: 0, margin: 0, height: 42 },
  emojiBtn:       { paddingLeft: 8, alignSelf: 'center' },
  sendBtn:        { width: 42, height: 42, borderRadius: 21, ...SHADOW.button },
  sendBtnInner:   { flex: 1, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },

  emojiPanel: { maxHeight: 160, borderTopWidth: 1, paddingVertical: 8 },
  emojiGrid:  { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, gap: 2 },
  emojiItem:  { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  emojiChar:  { fontSize: 26 },

  attachOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.30)' },
  attachSheet:   { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 24, paddingHorizontal: 20, paddingTop: 12, ...SHADOW.glow },
  attachHandle:  { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(30,156,240,0.30)', alignSelf: 'center', marginBottom: 14 },
  attachTitle:   { fontSize: 16, fontWeight: '700', color: COLORS.text, marginBottom: 16 },
  attachGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  attachItem:    { width: 90, paddingVertical: 14, alignItems: 'center', gap: 8, borderRadius: RADIUS.lg, borderWidth: 1, ...SHADOW.card },
  attachIconWrap:{ width: 48, height: 48, borderRadius: 14, backgroundColor: 'rgba(30,156,240,0.10)', alignItems: 'center', justifyContent: 'center' },
  attachLabel:   { fontSize: 11, fontWeight: '600', color: COLORS.sub, textAlign: 'center' },

  cameraControls: { position: 'absolute', bottom: 40, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  cameraCloseBtn: { width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  cameraShutterBtn: { alignItems: 'center', justifyContent: 'center' },
  cameraShutter:  { width: 72, height: 72, borderRadius: 36, backgroundColor: '#fff', borderWidth: 4, borderColor: 'rgba(255,255,255,0.60)' },

  // ── Contact info panel ───────────────────────────────────────────────────
  infoOverlay:   { flex: 1, justifyContent: 'flex-end' },
  infoBackdrop:  { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.40)' },
  infoSheet: {
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    borderWidth: 1, overflow: 'hidden',
    maxHeight: '90%',
    ...SHADOW.glow,
  },
  infoHandle: {
    alignSelf: 'center', width: 40, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(30,156,240,0.30)', marginTop: 12, marginBottom: 4,
  },
  infoCloseBtn: {
    position: 'absolute', top: 14, right: 16, zIndex: 10,
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  infoScroll:     { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40, alignItems: 'center', gap: 8 },
  infoAvatarWrap: { marginTop: 8, marginBottom: 4 },
  infoName:       { fontSize: 20, fontWeight: '800', textAlign: 'center' },
  infoStatus:     { fontSize: 13, textAlign: 'center', marginBottom: 8 },
  infoActions:    { flexDirection: 'row', gap: 12, marginVertical: 8, width: '100%', justifyContent: 'center' },
  infoActionBtn: {
    flex: 1, maxWidth: 150, alignItems: 'center', gap: 8,
    borderRadius: RADIUS.lg, borderWidth: 1,
    paddingVertical: 14, ...SHADOW.card,
  },
  infoActionIcon: {
    width: 48, height: 48, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center', ...SHADOW.button,
  },
  infoActionLabel: { fontSize: 12, fontWeight: '600', textAlign: 'center' },
  infoSectionLabel: {
    fontSize: 10, fontWeight: '700', letterSpacing: 1.1,
    alignSelf: 'flex-start', marginTop: 12, marginBottom: 4,
  },
  infoMediaBox: {
    width: '100%', height: 90, borderRadius: RADIUS.lg, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  infoMediaEmpty: { fontSize: 13 },
  infoBlockBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    width: '100%', borderRadius: RADIUS.lg, borderWidth: 1,
    paddingHorizontal: 16, paddingVertical: 14, ...SHADOW.card,
  },
  infoBlockTxt: { fontSize: 14, fontWeight: '600', color: COLORS.missed },

  infoMemberRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    width: '100%', borderRadius: RADIUS.lg, borderWidth: 1,
    paddingHorizontal: 14, paddingVertical: 10, ...SHADOW.card,
  },
  infoMemberName:   { fontSize: 14, fontWeight: '600' },
  infoMemberStatus: { fontSize: 12, marginTop: 2 },

  // ── Inline confirm card (block / leave — shown inside the profile panel) ──
  inlineConfirmCard: {
    width: '100%', borderRadius: RADIUS.lg, borderWidth: 1,
    alignItems: 'center', padding: 20, gap: 10,
    marginTop: 8, overflow: 'hidden', ...SHADOW.card,
  },
  inlineConfirmIcon: {
    width: 52, height: 52, borderRadius: 26,
    alignItems: 'center', justifyContent: 'center', ...SHADOW.button,
  },
  inlineConfirmTitle: { fontSize: 17, fontWeight: '800', textAlign: 'center' },
  inlineConfirmBody:  { fontSize: 13, lineHeight: 20, textAlign: 'center' },
  inlineConfirmActions: { flexDirection: 'row', gap: 10, width: '100%' },
  inlineConfirmBtn:     { flex: 1, borderRadius: RADIUS.full, overflow: 'hidden' },
  inlineConfirmBtnGrad: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 6, paddingVertical: 12,
  },
  inlineConfirmBtnTxt: { fontSize: 14, fontWeight: '700', textAlign: 'center', paddingVertical: 12 },

  // ── 3-dot dropdown menu ──────────────────────────────────────────────────
  menuOverlay: { ...StyleSheet.absoluteFill, backgroundColor: 'transparent' },
  menuCard: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 104 : 80,
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
