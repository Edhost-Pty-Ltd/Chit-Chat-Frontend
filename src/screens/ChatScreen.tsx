// ─── Screen: Chat ────────────────────────────────────────────────────────────
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View, FlatList, TouchableOpacity, ScrollView,
  StyleSheet, TextInput, KeyboardAvoidingView, Platform,
  ActivityIndicator, PanResponder, Linking, Modal, Alert,
  GestureResponderEvent, PanResponderGestureState,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { collection, doc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Avatar } from '../components';
import { VoiceMessageBubble } from '../components/VoiceMessageBubble';
import { VoiceRecordingOverlay } from '../components/VoiceRecordingOverlay';
import { useAuth } from '../hooks/useAuth';
import { useMessages, FireMessage } from '../hooks/useMessages';
import { useVoicePlayer } from '../hooks/useVoicePlayer';
import { useVoiceRecorder, RecordingResult } from '../hooks/useVoiceRecorder';
import { uploadVoiceNote, UploadProgress } from '../utils/voiceNoteStorage';
import { sendVoiceMessage } from '../hooks/useChatActions';
import { COLORS, RADIUS, SHADOW, GRADIENTS, GLASS } from '../types/theme';
import { RootStackParamList } from '../types';
import { AppBg, AppText, AppIcon, useForeground, useTypography } from '../context/ThemeContext';

type NavProp       = NativeStackNavigationProp<RootStackParamList, 'Chat'>;
type RoutePropType = RouteProp<RootStackParamList, 'Chat'>;

// ── Constants ────────────────────────────────────────────────────────────────
const CANCEL_THRESHOLD_DP = 50;
const MAX_UPLOAD_RETRIES = 3;
const PERMISSION_MESSAGE_DURATION_MS = 3000;

// Common emoji picks
const EMOJI_LIST = [
  '😀','😂','😍','🥰','😎','😢','😡','👍','👎','❤️',
  '🔥','🎉','🙏','💯','✅','🤣','😅','🤔','👀','💪',
  '🥳','😭','🫡','💀','🤯','🫶','😴','🤩','😏','🙈',
];

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Extract up to 2-char initials from a display name */
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

/** Format a Date to a short time string like "14:32" */
function formatTime(date: Date | null): string {
  if (!date) return '';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function ChatScreen() {
  const navigation = useNavigation<NavProp>();
  const route      = useRoute<RoutePropType>();
  const { chatId, displayName, isGroup } = route.params;
  const { FG }     = useForeground();
  const { fontFamily, textColor } = useTypography();

  const [permission, requestPermission] = useCameraPermissions();

  // ── Auth — get current user ID ──────────────────────────────────
  const { user } = useAuth();
  const userId = user?.uid ?? null;

  // ── Messages — real-time Firestore stream ───────────────────────
  const { messages, loading, sendMessage } = useMessages(chatId, userId);

  // ── Voice player — single-active-player management ─────────────
  const player = useVoicePlayer();

  // ── Voice recorder ─────────────────────────────────────────────
  const recorder = useVoiceRecorder();

  const [input, setInput] = useState('');
  const listRef = useRef<FlatList>(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showAttach, setShowAttach] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);

  // ── Upload & retry state ────────────────────────────────────────
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const pendingRecordingRef = useRef<RecordingResult | null>(null);

  // ── Permission message state ────────────────────────────────────
  const [permissionMessage, setPermissionMessage] = useState<string | null>(null);
  const [showSettingsButton, setShowSettingsButton] = useState(false);
  const permissionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Track if recording was cancelled via gesture ─────────────────
  const isCancelledRef = useRef(false);

  // ── Stop playback on unmount / navigation away ──────────────────
  useEffect(() => {
    return () => {
      player.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Auto-scroll when new messages arrive ────────────────────────
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length]);

  // ── Handle permission denied states ─────────────────────────────
  useEffect(() => {
    if (recorder.state.permissionDenied) {
      if (recorder.state.permissionDeniedPermanently) {
        setShowSettingsButton(true);
        setPermissionMessage('Microphone access is required for voice notes. Please enable it in Settings.');
      } else {
        setShowSettingsButton(false);
        setPermissionMessage('Microphone access is required for voice notes.');
        if (permissionTimerRef.current) clearTimeout(permissionTimerRef.current);
        permissionTimerRef.current = setTimeout(() => {
          setPermissionMessage(null);
        }, PERMISSION_MESSAGE_DURATION_MS);
      }
    }

    return () => {
      if (permissionTimerRef.current) clearTimeout(permissionTimerRef.current);
    };
  }, [recorder.state.permissionDenied, recorder.state.permissionDeniedPermanently]);

  // ── Upload and send voice note ──────────────────────────────────
  const handleVoiceUploadAndSend = useCallback(async (result: RecordingResult) => {
    if (!userId) return;

    const messageId = doc(collection(db, 'chats', chatId, 'messages')).id;

    setIsUploading(true);
    setUploadProgress(0);
    setUploadError(null);
    pendingRecordingRef.current = result;

    try {
      const uploadResult = await uploadVoiceNote(
        result.uri,
        chatId,
        messageId,
        (progress: UploadProgress) => {
          setUploadProgress(progress.percentage);
        },
      );

      await sendVoiceMessage(chatId, userId, uploadResult.downloadUrl, result.durationMs);

      setIsUploading(false);
      setUploadProgress(0);
      setRetryCount(0);
      pendingRecordingRef.current = null;
    } catch (error: any) {
      console.error('[ChatScreen] Voice upload failed:', error);
      setIsUploading(false);

      const isNetworkError = error.message === 'UPLOAD_TIMEOUT' ||
        error.code === 'storage/retry-limit-exceeded' ||
        error.code === 'storage/canceled';

      if (isNetworkError && retryCount < MAX_UPLOAD_RETRIES - 1) {
        setUploadError('Upload failed. Tap to retry.');
      } else {
        setUploadError('Upload could not be completed.');
        pendingRecordingRef.current = null;
      }
    }
  }, [userId, chatId, retryCount]);

  // ── Retry upload handler ────────────────────────────────────────
  const handleRetryUpload = useCallback(() => {
    const pendingResult = pendingRecordingRef.current;
    if (!pendingResult || retryCount >= MAX_UPLOAD_RETRIES) return;

    setRetryCount((prev) => prev + 1);
    setUploadError(null);
    handleVoiceUploadAndSend(pendingResult);
  }, [retryCount, handleVoiceUploadAndSend]);

  // ── Send handler ────────────────────────────────────────────────
  const handleSend = async (text?: string) => {
    const trimmed = (text ?? input).trim();
    if (!trimmed) return;

    const success = await sendMessage(trimmed);
    if (success) {
      setInput('');
      setShowEmoji(false);
    }
  };

  // ── PanResponder for mic button ─────────────────────────────────
  const micPanResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,

    onPanResponderGrant: (_evt: GestureResponderEvent, _gestureState: PanResponderGestureState) => {
      isCancelledRef.current = false;
      recorder.startRecording();
    },

    onPanResponderMove: (_evt: GestureResponderEvent, gestureState: PanResponderGestureState) => {
      const distance = Math.sqrt(gestureState.dx * gestureState.dx + gestureState.dy * gestureState.dy);
      if (distance >= CANCEL_THRESHOLD_DP && !isCancelledRef.current) {
        isCancelledRef.current = true;
        recorder.cancelRecording();
      }
    },

    onPanResponderRelease: async (_evt: GestureResponderEvent, _gestureState: PanResponderGestureState) => {
      if (isCancelledRef.current) return;

      const result = await recorder.stopRecording();
      if (result) {
        handleVoiceUploadAndSend(result);
      }
    },

    onPanResponderTerminate: () => {
      if (!isCancelledRef.current) {
        isCancelledRef.current = true;
        recorder.cancelRecording();
      }
    },
  }), [recorder, handleVoiceUploadAndSend]);

  // ── Dismiss permission message ──────────────────────────────────
  const dismissPermissionMessage = useCallback(() => {
    setPermissionMessage(null);
    setShowSettingsButton(false);
  }, []);

  // ── Open device settings ────────────────────────────────────────
  const handleOpenSettings = useCallback(() => {
    Linking.openSettings();
    dismissPermissionMessage();
  }, [dismissPermissionMessage]);

  // ── Camera / gallery / documents ────────────────────────────────
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

  // ── Check if recording is active ────────────────────────────────
  const isRecording = recorder.state.status === 'recording';

  // ── Render a single message bubble ──────────────────────────────
  const renderMessage = ({ item }: { item: FireMessage }) => {
    const isOut = item.senderId === userId;
    return (
      <View style={[styles.msgRow, isOut ? styles.msgRowOut : styles.msgRowIn]}>
        {!isOut && (
          item.type === 'voice' && item.voiceUrl && item.duration ? (
            <VoiceMessageBubble
              messageId={item.messageId}
              voiceUrl={item.voiceUrl}
              durationMs={item.duration}
              isOutgoing={false}
              playerState={player.state}
              onPlay={() => {
                if (player.state.activeMessageId === item.messageId && player.state.status === 'paused') {
                  player.resume();
                } else {
                  player.play(item.voiceUrl!, item.messageId, item.duration!);
                }
              }}
              onPause={() => player.pause()}
            />
          ) : (
            <LinearGradient colors={GRADIENTS.chatSent} style={[styles.bubble, styles.bubbleIn]}>
              {item.type === 'image' && (
                <View style={styles.imagePlaceholder}>
                  <AppIcon name="image-outline" size={32} color="rgba(255,255,255,0.70)" fixedColor />
                </View>
              )}
              {item.text && <AppText fixedColor style={styles.bubbleTextIn}>{item.text}</AppText>}
              <AppText fixedColor style={styles.timeIn}>{formatTime(item.timestamp)}</AppText>
            </LinearGradient>
          )
        )}
        {isOut && (
          item.type === 'voice' && item.voiceUrl && item.duration ? (
            <VoiceMessageBubble
              messageId={item.messageId}
              voiceUrl={item.voiceUrl}
              durationMs={item.duration}
              isOutgoing={true}
              playerState={player.state}
              onPlay={() => {
                if (player.state.activeMessageId === item.messageId && player.state.status === 'paused') {
                  player.resume();
                } else {
                  player.play(item.voiceUrl!, item.messageId, item.duration!);
                }
              }}
              onPause={() => player.pause()}
            />
          ) : (
            <View style={[styles.bubble, styles.bubbleOut]}>
              {item.text && <AppText style={[styles.bubbleTextOut, { color: textColor, fontFamily }]}>{item.text}</AppText>}
              <View style={styles.timeOutRow}>
                <AppText style={styles.timeOut}>{formatTime(item.timestamp)}</AppText>
                <AppIcon
                  name={item.readBy.length > 1 ? 'checkmark-done' : 'checkmark'}
                  size={13}
                  color={item.readBy.length > 1 ? COLORS.blue : COLORS.sub}
                  fixedColor
                />
              </View>
            </View>
          )
        )}
      </View>
    );
  };

  // ── Loading state ───────────────────────────────────────────────
  const renderLoading = () => (
    <View style={styles.centerState}>
      <ActivityIndicator size="large" color={COLORS.blue} />
    </View>
  );

  // ── Empty state ─────────────────────────────────────────────────
  const renderEmpty = () => (
    <View style={styles.centerState}>
      <AppText style={styles.emptyEmoji}>👋</AppText>
      <AppText style={styles.emptyText}>Say hello!</AppText>
    </View>
  );

  return (
    <>
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <AppBg />

        {/* ── Top bar ── */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <AppIcon name="chevron-back" size={24} color={COLORS.blue} fixedColor />
          </TouchableOpacity>

          <Avatar initials={getInitials(displayName)} color={COLORS.blue} size={40} />

          <View style={styles.contactInfo}>
            <AppText style={[styles.contactName, { color: textColor, fontFamily }]}>{displayName}</AppText>
            <AppText style={styles.onlineText}>
              {isGroup ? 'Group chat' : 'Tap here for info'}
            </AppText>
          </View>

          <TouchableOpacity style={styles.iconBtn}>
            <AppIcon name="call-outline" size={20} color={COLORS.blue} fixedColor />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn}>
            <AppIcon name="videocam-outline" size={20} color={COLORS.blue} fixedColor />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn}>
            <AppIcon name="ellipsis-vertical" size={20} color={COLORS.blue} />
          </TouchableOpacity>
        </View>

        {/* ── Messages ── */}
        {loading ? renderLoading() : messages.length === 0 ? renderEmpty() : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(item) => item.messageId}
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
        )}

        {/* ── Permission denied message ── */}
        {permissionMessage && (
          <View style={styles.permissionBanner}>
            <AppText style={styles.permissionText}>{permissionMessage}</AppText>
            {showSettingsButton ? (
              <View style={styles.permissionActions}>
                <TouchableOpacity onPress={handleOpenSettings} style={styles.permissionBtn}>
                  <AppText fixedColor style={styles.permissionBtnText}>Open Settings</AppText>
                </TouchableOpacity>
                <TouchableOpacity onPress={dismissPermissionMessage} style={styles.permissionDismissBtn}>
                  <AppIcon name="close" size={18} color={COLORS.sub} />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity onPress={dismissPermissionMessage} style={styles.permissionDismissBtn}>
                <AppIcon name="close" size={18} color={COLORS.sub} />
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* ── Upload error / retry banner ── */}
        {uploadError && (
          <View style={styles.uploadErrorBanner}>
            <AppIcon name="alert-circle-outline" size={16} color={COLORS.missed} fixedColor />
            <AppText style={styles.uploadErrorText}>{uploadError}</AppText>
            {pendingRecordingRef.current && retryCount < MAX_UPLOAD_RETRIES && (
              <TouchableOpacity onPress={handleRetryUpload} style={styles.retryBtn}>
                <AppText fixedColor style={styles.retryBtnText}>Retry</AppText>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={() => { setUploadError(null); pendingRecordingRef.current = null; }} style={styles.permissionDismissBtn}>
              <AppIcon name="close" size={18} color={COLORS.sub} />
            </TouchableOpacity>
          </View>
        )}

        {/* ── Emoji panel ── */}
        {showEmoji && (
          <View style={[styles.emojiPanel, { backgroundColor: FG.glassBg, borderTopColor: FG.glassBorder }]}>
            <ScrollView horizontal={false} showsVerticalScrollIndicator={false}>
              <View style={styles.emojiGrid}>
                {EMOJI_LIST.map((e) => (
                  <TouchableOpacity key={e} style={styles.emojiItem} onPress={() => handleSend(e)}>
                    <AppText fixedColor style={styles.emojiChar}>{e}</AppText>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>
        )}

        {/* ── Input bar ── */}
        <View style={styles.inputBar}>
          {isRecording ? (
            <View style={styles.recordingOverlayContainer}>
              <VoiceRecordingOverlay
                durationMs={recorder.state.durationMs}
                isWarning={recorder.state.isWarning}
                onCancel={() => recorder.cancelRecording()}
              />
            </View>
          ) : (
            <>
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
                  multiline
                  maxLength={500}
                  onFocus={() => { setShowEmoji(false); setShowAttach(false); }}
                />
                <TouchableOpacity style={styles.emojiBtn} onPress={() => { setShowAttach(false); setShowEmoji((e) => !e); }}>
                  <AppIcon name={showEmoji ? 'keypad-outline' : 'happy-outline'} size={22} color={COLORS.sub} />
                </TouchableOpacity>
              </View>

              {/* Camera */}
              <TouchableOpacity style={styles.inputSideBtn} onPress={openCamera}>
                <AppIcon name="camera-outline" size={22} color={COLORS.sub} />
              </TouchableOpacity>
            </>
          )}

          {/* Mic / Send button */}
          {input.trim() ? (
            <TouchableOpacity onPress={() => handleSend()} activeOpacity={0.85} style={styles.sendBtn}>
              <LinearGradient colors={GRADIENTS.primary} style={styles.sendBtnInner}>
                <AppIcon name="send" size={19} color="#fff" fixedColor />
              </LinearGradient>
            </TouchableOpacity>
          ) : (
            <View {...micPanResponder.panHandlers} style={styles.sendBtn}>
              <LinearGradient
                colors={isRecording ? ['#ef4444', '#dc2626'] : ['#7dd3fc', '#38bdf8']}
                style={styles.sendBtnInner}
              >
                <AppIcon name="mic" size={19} color="#fff" fixedColor />
              </LinearGradient>
            </View>
          )}
        </View>

        {/* ── Upload progress indicator ── */}
        {isUploading && (
          <View style={styles.uploadProgressBar}>
            <View style={[styles.uploadProgressFill, { width: `${uploadProgress}%` }]} />
          </View>
        )}
      </KeyboardAvoidingView>

      {/* ── Attachments sheet ── */}
      <Modal visible={showAttach} transparent animationType="slide" onRequestClose={() => setShowAttach(false)}>
        <TouchableOpacity style={styles.attachOverlay} activeOpacity={1} onPress={() => setShowAttach(false)} />
        <View style={[styles.attachSheet, { backgroundColor: FG.glassBg }]}>
          <View style={styles.attachHandle} />
          <AppText style={[styles.attachTitle, { color: textColor, fontFamily }]}>Share</AppText>
          <View style={styles.attachGrid}>
            {[
              { icon: 'images-outline'   as const, label: 'Photos',   action: openGallery },
              { icon: 'document-outline' as const, label: 'Files',    action: openDocuments },
              { icon: 'camera-outline'   as const, label: 'Camera',   action: () => { setShowAttach(false); openCamera(); } },
              { icon: 'mic-outline'      as const, label: 'Audio',    action: () => Alert.alert('Audio', 'Record audio message') },
              { icon: 'location-outline' as const, label: 'Location', action: () => Alert.alert('Location', 'Share location') },
              { icon: 'person-outline'   as const, label: 'Contact',  action: () => Alert.alert('Contact', 'Share contact') },
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
  iconBtn:     { padding: 4 },

  // ── Center states (loading / empty) ───────────────────────────────────────
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyEmoji:  { fontSize: 48, marginBottom: 8 },
  emptyText:   { fontSize: 16, color: COLORS.sub, fontWeight: '500' },

  // ── Messages ──────────────────────────────────────────────────────────────
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

  // Voice / image
  imagePlaceholder: {
    width: 160, height: 100, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },

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

  // ── Recording overlay ─────────────────────────────────────────────────────
  recordingOverlayContainer: {
    flex: 1,
  },

  // ── Permission banner ─────────────────────────────────────────────────────
  permissionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245,158,11,0.12)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
  },
  permissionText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.text,
  },
  permissionActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  permissionBtn: {
    backgroundColor: COLORS.blue,
    borderRadius: RADIUS.md,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  permissionBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  permissionDismissBtn: {
    padding: 4,
  },

  // ── Upload error banner ───────────────────────────────────────────────────
  uploadErrorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239,68,68,0.10)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
  },
  uploadErrorText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.text,
  },
  retryBtn: {
    backgroundColor: COLORS.blue,
    borderRadius: RADIUS.md,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  retryBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },

  // ── Upload progress ───────────────────────────────────────────────────────
  uploadProgressBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  uploadProgressFill: {
    height: 3,
    backgroundColor: COLORS.blue,
  },
});
