// ─── Screen: Group Call (LiveKit) ────────────────────────────────────────────
// Uses LiveKit (SFU) for up to 8 participants. UI matches AudioCallScreen and
// VideoCallScreen so group and 1-on-1 calls look consistent.

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, TouchableOpacity, StyleSheet, Alert, Platform,
  Dimensions, Animated, Modal, Pressable, ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import {
  AudioSession,
  LiveKitRoom,
  VideoTrack,
  isTrackReference,
  useTracks,
  useParticipants,
  useLocalParticipant,
  useRoomContext,
} from '@livekit/react-native';
import { Track } from 'livekit-client';
import { AppText, AppIcon, AppBg } from '../context/ThemeContext';
import { Avatar } from '../components';
import { COLORS, RADIUS, SHADOW } from '../types/theme';
import { RootStackParamList } from '../types';
import { LIVEKIT_CONFIG } from '../config/livekit';
import { generateLiveKitToken } from '../utils/livekitToken';
import { useGroupCall } from '../hooks/useGroupCall';
import { useAuth } from '../hooks/useAuth';

type NavProp = NativeStackNavigationProp<RootStackParamList, 'GroupCall'>;
type RouteP = RouteProp<RootStackParamList, 'GroupCall'>;

const { height } = Dimensions.get('window');
const PIP_W = 100;
const PIP_H = 140;

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function formatDuration(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

// ─── Outer screen: fetch token + provide LiveKit room ───────────────────────
export default function GroupCallScreen() {
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RouteP>();
  const { user } = useAuth();
  const { roomName, displayName, audioOnly, groupName, memberCount, callId } = route.params;

  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Start audio session for the duration of the call
  useEffect(() => {
    let mounted = true;
    const start = async () => {
      try {
        await AudioSession.startAudioSession();
      } catch (e) {
        console.error('[GroupCallScreen] Failed to start audio session:', e);
      }
    };
    start();
    return () => {
      mounted = false;
      AudioSession.stopAudioSession();
    };
  }, []);

  // Fetch access token from backend
  useEffect(() => {
    let mounted = true;
    const fetchToken = async () => {
      try {
        const t = await generateLiveKitToken({ roomName, displayName });
        if (mounted) setToken(t);
      } catch (e: any) {
        console.error('[GroupCallScreen] Token fetch failed:', e);
        if (mounted) setError(e?.message || 'Failed to join call');
      }
    };
    fetchToken();
    return () => { mounted = false; };
  }, [roomName, displayName]);

  if (error) {
    return (
      <View style={styles.root}>
        <AppBg />
        <View style={styles.center}>
          <AppText fixedColor style={styles.errorText}>{error}</AppText>
          <TouchableOpacity style={styles.retryBtn} onPress={() => navigation.goBack()}>
            <AppText fixedColor style={styles.retryText}>Go Back</AppText>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (!token) {
    return (
      <View style={styles.root}>
        <AppBg />
        <LinearGradient
          colors={['rgba(10,22,40,0.75)', 'rgba(13,34,68,0.85)', 'rgba(26,74,138,0.95)']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0.3, y: 0 }}
          end={{ x: 0.7, y: 1 }}
        />
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#fff" />
          <AppText fixedColor style={styles.connectingText}>Connecting…</AppText>
        </View>
      </View>
    );
  }

  return (
    <LiveKitRoom
      serverUrl={LIVEKIT_CONFIG.url}
      token={token}
      connect={true}
      audio={true}
      video={!audioOnly}
      options={{ adaptiveStream: { pixelDensity: 'screen' } }}
      onDisconnected={() => {
        if (callId && user?.uid) {
          // best-effort Firestore cleanup handled in RoomView's end handler
        }
        navigation.goBack();
      }}
    >
      <RoomView
        audioOnly={!!audioOnly}
        groupName={groupName}
        memberCount={memberCount}
        callId={callId}
        userId={user?.uid ?? null}
      />
    </LiveKitRoom>
  );
}

// ─── Helpers to find a participant's camera track ───────────────────────────
function useCameraTrackFor(identity: string | undefined) {
  const tracks = useTracks([Track.Source.Camera]);
  if (!identity) return undefined;
  return tracks.find(
    (t) => isTrackReference(t) && t.participant.identity === identity
  );
}

// ─── PiP tile — tap to swap to main ──────────────────────────────────────────
function PipTile({
  identity,
  name,
  isLocal,
  onTap,
}: {
  identity: string;
  name: string;
  isLocal: boolean;
  onTap: () => void;
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const cameraTrack = useCameraTrackFor(identity);
  const hasVideo = cameraTrack && isTrackReference(cameraTrack);

  const handleTap = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.88, duration: 80, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 80, useNativeDriver: true }),
    ]).start(onTap);
  };

  return (
    <Animated.View style={[styles.pipTile, { transform: [{ scale: scaleAnim }] }]}>
      {hasVideo ? (
        <VideoTrack trackRef={cameraTrack as any} style={StyleSheet.absoluteFill} objectFit="cover" />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.55)' }]} />
      )}
      <TouchableOpacity style={styles.pipTouch} onPress={handleTap} activeOpacity={0.8}>
        {!hasVideo && (
          <View style={styles.pipAvatarWrap}>
            <Avatar initials={getInitials(name)} color={COLORS.blue} size={42} />
            <AppText fixedColor style={styles.pipNamePill} numberOfLines={1}>{name}</AppText>
          </View>
        )}
      </TouchableOpacity>
      {isLocal && <AppText fixedColor style={styles.pipNameBar}>You</AppText>}
    </Animated.View>
  );
}

// ─── RoomView — the actual call UI inside the LiveKit room ───────────────────
function RoomView({
  audioOnly,
  groupName,
  memberCount,
  callId,
  userId,
}: {
  audioOnly: boolean;
  groupName: string;
  memberCount: number;
  callId?: string;
  userId: string | null;
}) {
  const navigation = useNavigation<NavProp>();
  const room = useRoomContext();
  const groupCall = useGroupCall();
  const participants = useParticipants();
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled } = useLocalParticipant();

  const [callDuration, setCallDuration] = useState(0);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [mainIdentity, setMainIdentity] = useState<string | null>(null);

  // Call timer
  useEffect(() => {
    const t = setInterval(() => setCallDuration((p) => p + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // Build display name for a participant
  const nameFor = (p: any) => p?.name || p?.identity || 'Guest';

  // Separate local + remote
  const remotes = participants.filter((p) => !p.isLocal);
  const localId = localParticipant?.identity;

  // Determine main participant (video mode)
  const allIds = participants.map((p) => p.identity);
  const effectiveMain =
    mainIdentity && allIds.includes(mainIdentity)
      ? mainIdentity
      : remotes.length > 0
      ? remotes[0].identity
      : localId;

  const mainParticipant = participants.find((p) => p.identity === effectiveMain);
  const pipParticipants = participants.filter((p) => p.identity !== effectiveMain);
  const mainCameraTrack = useCameraTrackFor(effectiveMain);
  const activeCount = Math.max(participants.length, 1);

  // ── Controls ──────────────────────────────────────────────────────────────
  const handleMuteToggle = useCallback(() => {
    localParticipant?.setMicrophoneEnabled(!isMicrophoneEnabled);
  }, [localParticipant, isMicrophoneEnabled]);

  const handleCameraToggle = useCallback(() => {
    localParticipant?.setCameraEnabled(!isCameraEnabled);
  }, [localParticipant, isCameraEnabled]);

  const handleSpeakerToggle = useCallback(() => {
    // Note: full speaker/earpiece routing requires native audio config.
    // Kept as UI state for now, mirroring the 1-on-1 VideoCallScreen behavior.
    setIsSpeakerOn((prev) => !prev);
  }, []);

  const handleFlipCamera = useCallback(async () => {
    try {
      const track = localParticipant?.getTrackPublication(Track.Source.Camera)?.track;
      // @ts-ignore - switchCamera exists on the local video track
      await track?.switchCamera?.();
    } catch (e) {
      console.warn('[GroupCallScreen] Flip camera failed:', e);
    }
  }, [localParticipant]);

  const handleHangUp = useCallback(() => {
    Alert.alert('End Call', 'Leave this call?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: async () => {
          try {
            if (callId && userId) await groupCall.leaveGroupCall(callId, userId);
          } catch {}
          try { await room.disconnect(); } catch {}
          navigation.goBack();
        },
      },
    ]);
  }, [room, callId, userId, groupCall, navigation]);

  const isMuted = !isMicrophoneEnabled;

  // ── AUDIO-ONLY LAYOUT (matches AudioCallScreen) ─────────────────────────────
  if (audioOnly) {
    return (
      <View style={styles.root}>
        <AppBg />
        <LinearGradient
          colors={['rgba(10,22,40,0.75)', 'rgba(13,34,68,0.85)', 'rgba(26,74,138,0.95)']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0.3, y: 0 }}
          end={{ x: 0.7, y: 1 }}
        />

        {/* Top bar */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={handleHangUp} style={styles.backBtn}>
            <AppIcon name="chevron-back" size={26} color="rgba(255,255,255,0.80)" fixedColor />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <AppText fixedColor style={styles.topName}>{groupName}</AppText>
            <AppText fixedColor style={styles.topStatus}>
              {formatDuration(callDuration)} · {activeCount} participant{activeCount !== 1 ? 's' : ''}
            </AppText>
          </View>
          <TouchableOpacity style={styles.topBtn} activeOpacity={0.75} onPress={() => Alert.alert('Chat', 'Not available during call')}>
            <AppIcon name="chatbubble-outline" size={22} color="rgba(255,255,255,0.80)" fixedColor />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setAddOpen(true)} style={styles.topBtn} activeOpacity={0.75}>
            <AppIcon name="person-add-outline" size={22} color="rgba(255,255,255,0.80)" fixedColor />
          </TouchableOpacity>
        </View>

        {/* Main caller */}
        <View style={styles.callerSection}>
          <View style={styles.avatarRing}>
            <Avatar initials={getInitials(nameFor(mainParticipant))} color={COLORS.blue} size={120} />
          </View>
          <AppText fixedColor style={styles.callerName}>
            {mainParticipant?.isLocal ? 'You' : nameFor(mainParticipant)}
          </AppText>
          <AppText fixedColor style={styles.callStatus}>In call · {formatDuration(callDuration)}</AppText>
        </View>

        {/* PiP avatars for other participants */}
        {pipParticipants.length > 0 && (
          <View style={styles.pipContainer}>
            {pipParticipants.map((p) => (
              <PipTile
                key={p.identity}
                identity={p.identity}
                name={p.isLocal ? 'You' : nameFor(p)}
                isLocal={p.isLocal}
                onTap={() => setMainIdentity(p.identity)}
              />
            ))}
          </View>
        )}

        {/* Bottom controls */}
        <View style={styles.controls}>
          <View style={styles.controlCol}>
            <TouchableOpacity style={[styles.controlBtn, isMuted && styles.controlBtnActive]} onPress={handleMuteToggle}>
              <AppIcon name={isMuted ? 'mic-off' : 'mic-outline'} size={24} color="#fff" fixedColor />
            </TouchableOpacity>
            <AppText fixedColor style={styles.controlLabel}>{isMuted ? 'Unmute' : 'Mute'}</AppText>
          </View>
          <View style={styles.controlCol}>
            <TouchableOpacity style={[styles.controlBtn, isSpeakerOn && styles.controlBtnActive]} onPress={handleSpeakerToggle}>
              <AppIcon name={isSpeakerOn ? 'volume-high-outline' : 'volume-mute-outline'} size={24} color="#fff" fixedColor />
            </TouchableOpacity>
            <AppText fixedColor style={styles.controlLabel}>Speaker</AppText>
          </View>
          <View style={styles.controlCol}>
            <TouchableOpacity style={[styles.controlBtn, isCameraEnabled && styles.controlBtnActive]} onPress={handleCameraToggle}>
              <AppIcon name={isCameraEnabled ? 'videocam-outline' : 'videocam-off-outline'} size={24} color="#fff" fixedColor />
            </TouchableOpacity>
            <AppText fixedColor style={styles.controlLabel}>Camera</AppText>
          </View>
          <View style={styles.controlCol}>
            <TouchableOpacity style={styles.hangUpBtn} onPress={handleHangUp}>
              <AppIcon name="call" size={28} color="#fff" fixedColor />
            </TouchableOpacity>
            <AppText fixedColor style={styles.controlLabel}>End</AppText>
          </View>
        </View>

        <AddModal visible={addOpen} onClose={() => setAddOpen(false)} />
      </View>
    );
  }

  // ── VIDEO LAYOUT (matches VideoCallScreen) ──────────────────────────────────
  const mainHasVideo = mainCameraTrack && isTrackReference(mainCameraTrack);
  const localIsMain = mainParticipant?.isLocal ?? false;

  return (
    <View style={styles.root}>
      <AppBg />
      <View style={styles.darkOverlay} />

      {/* Main view */}
      <View style={styles.mainView}>
        {mainHasVideo ? (
          <VideoTrack trackRef={mainCameraTrack as any} style={StyleSheet.absoluteFill} objectFit="cover" />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: '#0a1a30' }]} />
        )}
        {!mainHasVideo && (
          <View style={styles.mainAvatarOverlay}>
            <Avatar initials={getInitials(nameFor(mainParticipant))} color={COLORS.blue} size={120} />
            <AppText fixedColor style={styles.mainName}>
              {mainParticipant?.isLocal ? 'You' : nameFor(mainParticipant)}
            </AppText>
            <AppText fixedColor style={styles.mainSub}>In call · {formatDuration(callDuration)}</AppText>
          </View>
        )}
      </View>

      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={handleHangUp} style={styles.backBtn}>
          <AppIcon name="chevron-back" size={26} color="rgba(255,255,255,0.80)" fixedColor />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <AppText fixedColor style={styles.topName}>{groupName}</AppText>
          <AppText fixedColor style={styles.topStatus}>
            {formatDuration(callDuration)} · {activeCount} participant{activeCount !== 1 ? 's' : ''}
          </AppText>
        </View>
      </View>

      {/* Right panel: PiPs + actions */}
      <View style={styles.rightPanel}>
        {pipParticipants.map((p) => (
          <PipTile
            key={p.identity}
            identity={p.identity}
            name={p.isLocal ? 'You' : nameFor(p)}
            isLocal={p.isLocal}
            onTap={() => setMainIdentity(p.identity)}
          />
        ))}
        {pipParticipants.length > 0 && <View style={styles.panelDivider} />}
        <TouchableOpacity style={[styles.sideBtn, localIsMain && styles.sideBtnActive]} onPress={handleFlipCamera} activeOpacity={0.75} disabled={!localIsMain || !isCameraEnabled}>
          <AppIcon name="camera-reverse-outline" size={22} color="#fff" fixedColor />
          <AppText fixedColor style={styles.sideBtnLabel}>Flip</AppText>
        </TouchableOpacity>
        <TouchableOpacity style={styles.sideBtn} onPress={() => setAddOpen(true)} activeOpacity={0.75}>
          <AppIcon name="person-add-outline" size={20} color="#fff" fixedColor />
          <AppText fixedColor style={styles.sideBtnLabel}>Add</AppText>
        </TouchableOpacity>
      </View>

      {/* Bottom controls */}
      <View style={styles.controls}>
        <View style={styles.controlCol}>
          <TouchableOpacity style={[styles.controlBtn, isMuted && styles.controlBtnActive]} onPress={handleMuteToggle}>
            <AppIcon name={isMuted ? 'mic-off' : 'mic-outline'} size={24} color="#fff" fixedColor />
          </TouchableOpacity>
          <AppText fixedColor style={styles.controlLabel}>{isMuted ? 'Unmute' : 'Mute'}</AppText>
        </View>
        <View style={styles.controlCol}>
          <TouchableOpacity style={[styles.controlBtn, isSpeakerOn && styles.controlBtnActive]} onPress={handleSpeakerToggle}>
            <AppIcon name={isSpeakerOn ? 'volume-high-outline' : 'volume-mute-outline'} size={24} color="#fff" fixedColor />
          </TouchableOpacity>
          <AppText fixedColor style={styles.controlLabel}>Speaker</AppText>
        </View>
        <View style={styles.controlCol}>
          <TouchableOpacity style={[styles.controlBtn, !isCameraEnabled && styles.controlBtnActive]} onPress={handleCameraToggle}>
            <AppIcon name={isCameraEnabled ? 'videocam-outline' : 'videocam-off-outline'} size={24} color="#fff" fixedColor />
          </TouchableOpacity>
          <AppText fixedColor style={styles.controlLabel}>Camera</AppText>
        </View>
        <View style={styles.controlCol}>
          <TouchableOpacity style={styles.hangUpBtn} onPress={handleHangUp}>
            <AppIcon name="call" size={28} color="#fff" fixedColor />
          </TouchableOpacity>
          <AppText fixedColor style={styles.controlLabel}>End</AppText>
        </View>
      </View>

      <AddModal visible={addOpen} onClose={() => setAddOpen(false)} />
    </View>
  );
}

// ─── Add participant modal (placeholder) ─────────────────────────────────────
function AddModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.addOverlay} onPress={onClose} />
      <View style={styles.addSheet}>
        <View style={styles.addHandle} />
        <AppText fixedColor style={styles.addTitle}>Add to call</AppText>
        <AppText fixedColor style={styles.addEmpty}>
          Share the group and start a call — members can join from the call notification.
        </AppText>
      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  darkOverlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.35)' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  connectingText: { fontSize: 16, color: 'rgba(255,255,255,0.8)' },
  errorText: { fontSize: 16, color: '#fff', textAlign: 'center', paddingHorizontal: 40 },
  retryBtn: { backgroundColor: COLORS.blue, paddingHorizontal: 28, paddingVertical: 12, borderRadius: 8 },
  retryText: { color: '#fff', fontSize: 15, fontWeight: '600' },

  mainView: { ...StyleSheet.absoluteFill },
  mainAvatarOverlay: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', gap: 14 },
  mainName: { fontSize: 24, fontWeight: '700', color: '#fff' },
  mainSub: { fontSize: 13, color: 'rgba(255,255,255,0.60)' },

  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center',
    paddingTop: Platform.OS === 'web' ? 16 : Platform.OS === 'ios' ? 54 : 36,
    paddingBottom: 12, paddingHorizontal: 12,
    backgroundColor: 'rgba(0,0,0,0.28)', gap: 10,
  },
  backBtn: { padding: 6 },
  topName: { fontSize: 15, fontWeight: '700', color: '#fff' },
  topStatus: { fontSize: 11, color: 'rgba(255,255,255,0.60)', marginTop: 1 },
  topBtn: { padding: 6, width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },

  callerSection: {
    position: 'absolute',
    top: Platform.OS === 'web' ? 140 : Platform.OS === 'ios' ? 180 : 160,
    left: 0, right: 0, alignItems: 'center', gap: 14,
  },
  avatarRing: {
    padding: 6, borderRadius: 70, borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.45)', borderTopColor: 'rgba(255,255,255,0.70)',
    ...SHADOW.glow,
  },
  callerName: { fontSize: 28, fontWeight: '700', color: '#fff' },
  callStatus: { fontSize: 16, color: 'rgba(255,255,255,0.65)' },

  pipContainer: {
    position: 'absolute',
    top: Platform.OS === 'web' ? 72 : Platform.OS === 'ios' ? 110 : 90,
    right: 10, gap: 8,
  },

  pipTile: {
    width: PIP_W, height: PIP_H, borderRadius: RADIUS.md, overflow: 'hidden',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.30)', ...SHADOW.glow,
  },
  pipTouch: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  pipAvatarWrap: { alignItems: 'center', gap: 5 },
  pipNamePill: {
    fontSize: 10, color: '#fff', fontWeight: '600',
    backgroundColor: 'rgba(0,0,0,0.45)', paddingHorizontal: 7, paddingVertical: 2,
    borderRadius: RADIUS.full, overflow: 'hidden',
  },
  pipNameBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0, textAlign: 'center',
    fontSize: 10, color: '#fff', backgroundColor: 'rgba(0,0,0,0.45)', paddingVertical: 3,
  },

  rightPanel: {
    position: 'absolute',
    top: Platform.OS === 'web' ? 72 : Platform.OS === 'ios' ? 110 : 90,
    right: 10, alignItems: 'center', gap: 8,
  },
  panelDivider: { width: 36, height: 1, backgroundColor: 'rgba(255,255,255,0.20)', marginVertical: 2 },
  sideBtn: {
    width: 48, height: 52, borderRadius: RADIUS.sm, backgroundColor: 'rgba(0,0,0,0.40)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center', gap: 3,
  },
  sideBtnActive: { backgroundColor: 'rgba(30,156,240,0.35)', borderColor: 'rgba(30,156,240,0.55)' },
  sideBtnLabel: { fontSize: 9, color: 'rgba(255,255,255,0.75)', fontWeight: '600' },

  controls: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end',
    paddingBottom: Platform.OS === 'ios' ? 40 : 24, paddingTop: 16, paddingHorizontal: 8,
    backgroundColor: 'rgba(0,0,0,0.42)',
  },
  controlCol: { alignItems: 'center', gap: 6 },
  controlLabel: { fontSize: 10, color: 'rgba(255,255,255,0.70)' },
  controlBtn: {
    width: 54, height: 54, borderRadius: 27, backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', borderTopColor: 'rgba(255,255,255,0.75)',
    alignItems: 'center', justifyContent: 'center', ...SHADOW.card,
  },
  controlBtnActive: { backgroundColor: 'rgba(30,156,240,0.35)', borderColor: 'rgba(30,156,240,0.55)' },
  hangUpBtn: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: '#e84343',
    alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '135deg' }], ...SHADOW.button,
  },

  addOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.50)' },
  addSheet: {
    backgroundColor: '#0d2040', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: height * 0.65, paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    paddingHorizontal: 16, paddingTop: 12, ...SHADOW.glow,
  },
  addHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.25)', alignSelf: 'center', marginBottom: 14 },
  addTitle: { fontSize: 17, fontWeight: '700', color: '#fff', marginBottom: 14 },
  addEmpty: { fontSize: 14, color: 'rgba(255,255,255,0.55)', textAlign: 'center', paddingVertical: 24 },
});
