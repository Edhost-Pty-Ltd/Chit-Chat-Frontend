// ─── Screen: Chat ────────────────────────────────────────────────────────────
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, TextInput, KeyboardAvoidingView, Platform,
  ActivityIndicator, PanResponder, Linking,
  GestureResponderEvent, PanResponderGestureState,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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

type NavProp       = NativeStackNavigationProp<RootStackParamList, 'Chat'>;
type RoutePropType = RouteProp<RootStackParamList, 'Chat'>;

// ── Constants ────────────────────────────────────────────────────────────────
const CANCEL_THRESHOLD_DP = 50;
const MAX_UPLOAD_RETRIES = 3;
const PERMISSION_MESSAGE_DURATION_MS = 3000;

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
  const insets     = useSafeAreaInsets();

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
        // Show button to open device settings
        setShowSettingsButton(true);
        setPermissionMessage('Microphone access is required for voice notes. Please enable it in Settings.');
      } else {
        // Show informational message for 3 seconds
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

    // Generate a unique messageId
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

      // Upload succeeded — send the voice message
      await sendVoiceMessage(chatId, userId, uploadResult.downloadUrl, result.durationMs);

      // Clear upload state
      setIsUploading(false);
      setUploadProgress(0);
      setRetryCount(0);
      pendingRecordingRef.current = null;
    } catch (error: any) {
      console.error('[ChatScreen] Voice upload failed:', error);
      setIsUploading(false);

      // Determine if retry is available
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
  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed) return;

    const success = await sendMessage(trimmed);
    if (success) {
      setInput('');
    }
  };

  // ── PanResponder for mic button ─────────────────────────────────
  const micPanResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,

    onPanResponderGrant: (_evt: GestureResponderEvent, _gestureState: PanResponderGestureState) => {
      // Long-press start: begin recording
      isCancelledRef.current = false;
      recorder.startRecording();
    },

    onPanResponderMove: (_evt: GestureResponderEvent, gestureState: PanResponderGestureState) => {
      // Check if finger moved ≥50dp from start position
      const distance = Math.sqrt(gestureState.dx * gestureState.dx + gestureState.dy * gestureState.dy);
      if (distance >= CANCEL_THRESHOLD_DP && !isCancelledRef.current) {
        isCancelledRef.current = true;
        recorder.cancelRecording();
      }
    },

    onPanResponderRelease: async (_evt: GestureResponderEvent, _gestureState: PanResponderGestureState) => {
      // If already cancelled via gesture, nothing to do
      if (isCancelledRef.current) return;

      // Stop recording and get result
      const result = await recorder.stopRecording();
      if (result) {
        // Successful recording — upload and send
        handleVoiceUploadAndSend(result);
      }
      // If result is null, recording was too short — hook already reset state
    },

    onPanResponderTerminate: () => {
      // Another component took over — cancel recording
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

  // ── Check if recording is active ────────────────────────────────
  const isRecording = recorder.state.status === 'recording';

  // ── Render a single message bubble ──────────────────────────────
  const renderMessage = ({ item }: { item: FireMessage }) => {
    const isOut = item.senderId === userId;
    return (
      <View style={[styles.msgRow, isOut ? styles.msgRowOut : styles.msgRowIn]}>

        {/* Received bubble — vivid blue gradient */}
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
                  <Ionicons name="image-outline" size={32} color="rgba(255,255,255,0.70)" />
                </View>
              )}
              {item.text && <Text style={styles.bubbleTextIn}>{item.text}</Text>}
              <Text style={styles.timeIn}>{formatTime(item.timestamp)}</Text>
            </LinearGradient>
          )
        )}

        {/* Sent bubble — white frosted glass */}
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
              {item.text && <Text style={styles.bubbleTextOut}>{item.text}</Text>}
              <View style={styles.timeOutRow}>
                <Text style={styles.timeOut}>{formatTime(item.timestamp)}</Text>
                <Ionicons
                  name={item.readBy.length > 1 ? 'checkmark-done' : 'checkmark'}
                  size={13}
                  color={item.readBy.length > 1 ? COLORS.blue : COLORS.sub}
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
      <Text style={styles.emptyEmoji}>👋</Text>
      <Text style={styles.emptyText}>Say hello!</Text>
    </View>
  );

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <LinearGradient colors={GRADIENTS.bg} style={StyleSheet.absoluteFill} />

      {/* ── Top bar ── */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={COLORS.blue} />
        </TouchableOpacity>

        <Avatar initials={getInitials(displayName)} color={COLORS.blue} size={40} />

        <View style={styles.contactInfo}>
          <Text style={styles.contactName}>{displayName}</Text>
          <Text style={styles.onlineText}>
            {isGroup ? 'Group chat' : 'Tap here for info'}
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
                <Text style={styles.datePillText}>Today</Text>
              </View>
            </View>
          }
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        />
      )}

      {/* ── Permission denied message ── */}
      {permissionMessage && (
        <View style={styles.permissionBanner}>
          <Text style={styles.permissionText}>{permissionMessage}</Text>
          {showSettingsButton ? (
            <View style={styles.permissionActions}>
              <TouchableOpacity onPress={handleOpenSettings} style={styles.permissionBtn}>
                <Text style={styles.permissionBtnText}>Open Settings</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={dismissPermissionMessage} style={styles.permissionDismissBtn}>
                <Ionicons name="close" size={18} color={COLORS.sub} />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity onPress={dismissPermissionMessage} style={styles.permissionDismissBtn}>
              <Ionicons name="close" size={18} color={COLORS.sub} />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* ── Upload error / retry banner ── */}
      {uploadError && (
        <View style={styles.uploadErrorBanner}>
          <Ionicons name="alert-circle-outline" size={16} color={COLORS.missed} />
          <Text style={styles.uploadErrorText}>{uploadError}</Text>
          {pendingRecordingRef.current && retryCount < MAX_UPLOAD_RETRIES && (
            <TouchableOpacity onPress={handleRetryUpload} style={styles.retryBtn}>
              <Text style={styles.retryBtnText}>Retry</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => { setUploadError(null); pendingRecordingRef.current = null; }} style={styles.permissionDismissBtn}>
            <Ionicons name="close" size={18} color={COLORS.sub} />
          </TouchableOpacity>
        </View>
      )}

      {/* ── Input bar — single flat row like the reference ── */}
      <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, 10) }]}>

        {isRecording ? (
          /* ── Recording overlay replaces input bar content ── */
          <>
            <View style={styles.recordingOverlayContainer}>
              <VoiceRecordingOverlay
                durationMs={recorder.state.durationMs}
                isWarning={recorder.state.isWarning}
                onCancel={() => recorder.cancelRecording()}
              />
            </View>
          </>
        ) : (
          /* ── Normal input bar content ── */
          <>
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
          </>
        )}

        {/* Mic / Send button — always visible at the end */}
        {input.trim() ? (
          /* Send button when typing */
          <TouchableOpacity onPress={handleSend} activeOpacity={0.85} style={styles.sendBtn}>
            <LinearGradient
              colors={GRADIENTS.primary}
              style={styles.sendBtnInner}
            >
              <Ionicons name="send" size={19} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        ) : (
          /* Mic button with PanResponder when not typing */
          <View {...micPanResponder.panHandlers} style={styles.sendBtn}>
            <LinearGradient
              colors={isRecording ? ['#ef4444', '#dc2626'] : ['#7dd3fc', '#38bdf8']}
              style={styles.sendBtnInner}
            >
              <Ionicons name="mic" size={19} color="#fff" />
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
  iconBtn:     { padding: 4 },

  // ── Center states (loading / empty) ───────────────────────────────────────
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyEmoji:  { fontSize: 48, marginBottom: 8 },
  emptyText:   { fontSize: 16, color: COLORS.sub, fontWeight: '500' },

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

  // ── Input bar ─────────────────────────────────────────────────────────────
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 8,
    paddingVertical: 8,
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
