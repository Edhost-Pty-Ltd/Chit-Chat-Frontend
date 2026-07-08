// ─── Screen: Group Call (LiveKit) ────────────────────────────────────────────
// Uses LiveKit (SFU) for up to 8 participants. UI matches AudioCallScreen and
// VideoCallScreen so group and 1-on-1 calls look consistent.

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, TouchableOpacity, StyleSheet, Alert, Platform,
  Dimensions, Animated, Modal, Pressable, ActivityIndicator, PermissionsAndroid, FlatList,
  PanResponder, GestureResponderEvent, PanResponderGestureState,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import {
  AudioSession,
  AndroidAudioTypePresets,
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
import { useContacts, AppContact } from '../hooks/useContacts';
import { usePhoneBook } from '../hooks/usePhoneBook';
import { ActiveCallParams } from '../context/ActiveCallContext';
import { SignalingService } from '../services/signalingService';

type NavProp = NativeStackNavigationProp<RootStackParamList, 'GroupCall'>;
type RouteP = RouteProp<RootStackParamList, 'GroupCall'>;

const { width, height } = Dimensions.get('window');
const PIP_W = 100;
const PIP_H = 140;
const FLOAT_W = 110;
const FLOAT_H = 150;

function getInitials(name: string): string {
  if (!name || !name.trim()) return '?';
  
  // Extract letters and get initials from word boundaries
  const cleaned = name.replace(/[^\p{L}\s]/gu, '').trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  if (parts.length === 1) {
    return parts[0][0].toUpperCase();
  }
  
  // No letters — try digits (phone number)
  const digits = name.replace(/\D/g, '');
  if (digits.length >= 2) return digits.slice(-2);
  if (digits.length === 1) return digits;
  
  return '?';
}

function formatDuration(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

// ─── GroupCallContent: token + audio + LiveKit room (hosted at app level) ────
// Renders the full call UI or the floating overlay inside a single persistent
// <LiveKitRoom>, so the connection survives minimize/maximize.
export function GroupCallContent({
  params,
  minimized,
  onMinimize,
  onMaximize,
  onEnded,
}: {
  params: ActiveCallParams;
  minimized: boolean;
  onMinimize: () => void;
  onMaximize: () => void;
  onEnded: () => void;
}) {
  const { user } = useAuth();
  const { roomName, displayName, audioOnly, groupName, memberCount, callId, chatId } = params;

  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false); // permissions + audio session configured

  // Request permissions, configure audio for communication, then start session.
  // configureAudio MUST run before connecting for mic capture + routing to work.
  useEffect(() => {
    let mounted = true;

    const setup = async () => {
      try {
        if (Platform.OS === 'android') {
          const perms = [PermissionsAndroid.PERMISSIONS.RECORD_AUDIO];
          if (!audioOnly) perms.push(PermissionsAndroid.PERMISSIONS.CAMERA);
          const result = await PermissionsAndroid.requestMultiple(perms);
          const micGranted =
            result[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] ===
            PermissionsAndroid.RESULTS.GRANTED;
          if (!micGranted) {
            if (mounted) setError('Microphone permission is required for calls.');
            return;
          }
        }

        await AudioSession.configureAudio({
          android: {
            preferredOutputList: ['speaker'],
            audioTypeOptions: AndroidAudioTypePresets.communication,
          },
          ios: { defaultOutput: 'speaker' },
        });
        await AudioSession.startAudioSession();

        if (mounted) setReady(true);
      } catch (e) {
        console.error('[GroupCall] Audio setup failed:', e);
        if (mounted) setReady(true);
      }
    };

    setup();
    return () => {
      mounted = false;
      AudioSession.stopAudioSession();
    };
  }, [audioOnly]);

  // Fetch access token from backend
  useEffect(() => {
    let mounted = true;
    const fetchToken = async () => {
      try {
        const t = await generateLiveKitToken({ roomName, displayName });
        if (mounted) setToken(t);
      } catch (e: any) {
        console.error('[GroupCall] Token fetch failed:', e);
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
          <TouchableOpacity style={styles.retryBtn} onPress={onEnded}>
            <AppText fixedColor style={styles.retryText}>Close</AppText>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (!token || !ready) {
    // While connecting, if the user minimized, show a tiny placeholder instead
    // of the full-screen connecting view.
    if (minimized) {
      return (
        <View style={styles.connectingPill} pointerEvents="box-none">
          <ActivityIndicator size="small" color="#fff" />
        </View>
      );
    }
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
      options={{ adaptiveStream: false, dynacast: false }}
      onDisconnected={onEnded}
    >
      {minimized ? (
        <FloatingCallView
          groupName={groupName}
          onMaximize={onMaximize}
          onEnded={onEnded}
          callId={callId}
          userId={user?.uid ?? null}
        />
      ) : (
        <RoomView
          audioOnly={!!audioOnly}
          groupName={groupName}
          memberCount={memberCount}
          callId={callId}
          chatId={chatId}
          userId={user?.uid ?? null}
          roomName={roomName}
          localDisplayName={displayName}
          onMinimize={onMinimize}
          onEnded={onEnded}
        />
      )}
    </LiveKitRoom>
  );
}

// ─── Default route export (back-compat; primary path is the app-level host) ──
export default function GroupCallScreen() {
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RouteP>();
  const goBack = () => navigation.goBack();
  return (
    <GroupCallContent
      params={route.params as ActiveCallParams}
      minimized={false}
      onMinimize={goBack}
      onMaximize={() => {}}
      onEnded={goBack}
    />
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
  chatId,
  userId,
  roomName,
  localDisplayName,
  onMinimize,
  onEnded,
}: {
  audioOnly: boolean;
  groupName: string;
  memberCount: number;
  callId?: string;
  chatId?: string;
  userId: string | null;
  roomName: string;
  localDisplayName: string;
  onMinimize: () => void;
  onEnded: () => void;
}) {
  const navigation = useNavigation<NavProp>();
  const room = useRoomContext();
  const groupCall = useGroupCall();
  const participants = useParticipants();
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled } = useLocalParticipant();
  const { resolveName } = usePhoneBook();

  const [callDuration, setCallDuration] = useState(0);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [mainIdentity, setMainIdentity] = useState<string | null>(null);

  // Call timer
  useEffect(() => {
    const t = setInterval(() => setCallDuration((p) => p + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // Listen for call status changes in Firestore (server-side call ending)
  useEffect(() => {
    if (!callId) return;

    console.log('[GroupCallScreen] Setting up Firestore listener for call:', callId);

    const unsubscribe = import('firebase/firestore').then(async ({ doc, onSnapshot }) => {
      const { db } = await import('../config/firebase');
      const callRef = doc(db, 'groupCalls', callId);
      
      return onSnapshot(callRef, (snapshot) => {
        if (!snapshot.exists()) {
          console.log('[GroupCallScreen] Call document no longer exists - ending call');
          onEnded();
          return;
        }

        const data = snapshot.data();
        console.log('[GroupCallScreen] Call status update:', data?.status);

        // If server ended the call (e.g., because only 1 participant remained)
        if (data?.status === 'ended') {
          console.log('[GroupCallScreen] Call ended by server - disconnecting');
          onEnded();
        }
      });
    });

    return () => {
      unsubscribe.then((unsub) => unsub?.()).catch((e) => console.warn('[GroupCallScreen] Listener cleanup failed:', e));
    };
  }, [callId, onEnded]);

  // Ensure mic and camera are publishing once the local participant connects.
  // `LiveKitRoom audio/video` props handle the initial intent, but this safety
  // net ensures the tracks are actually published even if the room connects
  // before the tracks are ready (a common race condition on Android).
  const micInitRef = useRef(false);

  // Tracks the current camera facing mode for the flip control. Camera starts
  // on the front ('user') camera by default.
  const cameraFacingRef = useRef<'user' | 'environment'>('user');
  useEffect(() => {
    if (!localParticipant || micInitRef.current) return;
    micInitRef.current = true;

    const publish = async () => {
      try {
        await localParticipant.setMicrophoneEnabled(true);
      } catch (e) {
        console.warn('[GroupCallScreen] Failed to enable mic:', e);
      }

      // For video calls, explicitly publish the camera so the feed appears
      // immediately without requiring any user interaction.
      if (!audioOnly) {
        try {
          // Small delay — gives the audio session time to fully start before
          // the camera capture begins, avoiding Android audio routing glitches.
          await new Promise<void>((r) => setTimeout(r, 500));
          await localParticipant.setCameraEnabled(true);
        } catch (e) {
          console.warn('[GroupCallScreen] Failed to enable camera:', e);
        }
      }
    };

    publish();
  }, [localParticipant, audioOnly]);

  // Build display name for a participant. The LiveKit participant name is the
  // person's phone number, so resolve it against the device phone book: saved
  // contact name if available, otherwise the phone number.
  const nameFor = (p: any) => resolveName(p?.name || p?.identity, 'Guest');

  // Header title: a real group name passes through unchanged; a 1-on-1's
  // phone-number title resolves to the saved contact name when available.
  const headerTitle = resolveName(groupName, groupName);

  // Separate local + remote
  const remotes = participants.filter((p) => !p.isLocal);
  const localId = localParticipant?.identity;

  // ── Auto-end 1-on-1 calls when the other participant leaves ─────────────────
  // In a 2-person call, when remotes drops to 0 the call is over.
  // We use a ref to avoid firing on the first render (before anyone has joined)
  // and to prevent double-firing if the user already hung up manually.
  const remoteJoinedRef = useRef(false);
  useEffect(() => {
    // Track when the first remote participant has joined
    if (remotes.length > 0) {
      remoteJoinedRef.current = true;
      return;
    }
    // Only auto-end if: it was a 1-on-1 (memberCount <= 2), the remote had
    // already joined at least once, and we haven't already written history.
    if (
      remoteJoinedRef.current &&
      memberCount <= 2 &&
      !historyWrittenRef.current
    ) {
      historyWrittenRef.current = true;
      handleCallEnd(callDuration);
    }
  }, [remotes.length]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Dynamic layout: show the video layout whenever ANY participant has a camera
  // on. So when someone enables their camera during an audio call, everyone's
  // UI switches to video. A call started as video always uses the video layout.
  const allCameraTracks = useTracks([Track.Source.Camera]);
  const anyCameraOn = allCameraTracks.some((t) => isTrackReference(t));
  const isVideoMode = !audioOnly || anyCameraOn;

  // ── Controls ──────────────────────────────────────────────────────────────
  const handleMuteToggle = useCallback(() => {
    localParticipant?.setMicrophoneEnabled(!isMicrophoneEnabled);
  }, [localParticipant, isMicrophoneEnabled]);

  // Write call history then call onEnded (used for both hang-up and remote disconnect)
  const handleCallEnd = useCallback(async (durationSec: number) => {
    if (callId && userId) {
      try {
        const otherParticipant = participants.find((p) => !p.isLocal);
        const otherPartyId = otherParticipant?.identity ?? '';
        const otherPartyName = otherParticipant ? nameFor(otherParticipant) : groupName;
        await SignalingService.saveToCallHistory(
          userId,
          callId,
          { userId: otherPartyId, displayName: otherPartyName, photoUrl: null },
          audioOnly ? 'audio' : 'video',
          'outgoing',
          durationSec > 0 ? 'completed' : 'missed',
          durationSec > 0 ? durationSec : null,
        );
      } catch (e) {
        console.warn('[GroupCallScreen] Failed to save call history:', e);
      }
    }
    onEnded();
  }, [callId, userId, participants, nameFor, groupName, audioOnly, onEnded]);

  const handleCameraToggle = useCallback(async () => {
    const enabling = !isCameraEnabled;

    // Enabling the camera during an audio call needs CAMERA permission, which
    // wasn't requested when the audio call started.
    if (enabling && Platform.OS === 'android') {
      try {
        const res = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA);
        if (res !== PermissionsAndroid.RESULTS.GRANTED) {
          Alert.alert('Camera permission needed', 'Enable camera access to turn on video.');
          return;
        }
      } catch (e) {
        console.warn('[GroupCallScreen] Camera permission request failed:', e);
        return;
      }
    }

    try {
      await localParticipant?.setCameraEnabled(enabling);
    } catch (e) {
      console.warn('[GroupCallScreen] Camera toggle failed:', e);
    }
  }, [localParticipant, isCameraEnabled]);

  const handleSpeakerToggle = useCallback(async () => {
    const next = !isSpeakerOn;
    setIsSpeakerOn(next);
    try {
      if (Platform.OS === 'ios') {
        await AudioSession.selectAudioOutput(next ? 'force_speaker' : 'default');
      } else {
        await AudioSession.selectAudioOutput(next ? 'speaker' : 'earpiece');
      }
    } catch (e) {
      console.warn('[GroupCallScreen] Speaker toggle failed:', e);
    }
  }, [isSpeakerOn]);

  const handleFlipCamera = useCallback(async () => {
    try {
      const pub = localParticipant?.getTrackPublication(Track.Source.Camera);
      // LocalVideoTrack supports restartTrack with new capture options
      const videoTrack: any = (pub as any)?.videoTrack ?? pub?.track;
      if (!videoTrack || typeof videoTrack.restartTrack !== 'function') {
        console.warn('[GroupCallScreen] No local camera track to flip');
        return;
      }
      const next = cameraFacingRef.current === 'user' ? 'environment' : 'user';
      await videoTrack.restartTrack({ facingMode: next });
      cameraFacingRef.current = next;
      console.log('[GroupCallScreen] Camera flipped to:', next);
    } catch (e) {
      console.warn('[GroupCallScreen] Flip camera failed:', e);
    }
  }, [localParticipant]);

  // Open the group chat. Minimizes the call to the floating widget so the chat
  // is visible underneath; the call keeps running.
  const openChat = useCallback(() => {
    if (!chatId) {
      Alert.alert('Chat unavailable', 'Could not open the group chat.');
      return;
    }
    onMinimize();
    navigation.navigate('Chat', { chatId, displayName: groupName, isGroup: true });
  }, [chatId, groupName, navigation, onMinimize]);

  // Invite a contact to the in-progress call.
  const handleInvite = useCallback(
    async (contact: AppContact) => {
      if (!callId || !chatId || !userId) {
        Alert.alert('Cannot invite', 'Call information is missing.');
        return;
      }
      const ok = await groupCall.inviteToGroupCall({
        callId,
        chatId,
        roomName,
        initiatorId: userId,
        initiatorName: localDisplayName,
        callType: audioOnly ? 'audio' : 'video',
        inviteeId: contact.userId,
      });
      setAddOpen(false);
      Alert.alert(
        ok ? 'Invitation sent' : 'Error',
        ok
          ? `${contact.displayName} has been invited to the call.`
          : 'Could not invite this contact. Please try again.'
      );
    },
    [callId, chatId, roomName, userId, localDisplayName, audioOnly, groupCall]
  );

  // Identities already in the call (plus self) — excluded from the invite list.
  const excludeIds = [userId, ...participants.map((p) => p.identity)].filter(
    (x): x is string => !!x
  );

  const handleHangUp = useCallback(() => {
    Alert.alert('End Call', 'Leave this call?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: async () => {
          historyWrittenRef.current = true;
          
          console.log('[GroupCallScreen] Hang up - removing from activeParticipants');
          
          // Step 1: Leave the call in Firestore (updates activeParticipants)
          try {
            if (callId && userId) {
              await groupCall.leaveGroupCall(callId, userId);
              console.log('[GroupCallScreen] Successfully left call in Firestore');
            }
          } catch (e) {
            console.error('[GroupCallScreen] Failed to leave call:', e);
          }
          
          // Step 2: Small delay to let Cloud Function trigger and update status
          // This ensures other participants see the status change before we disconnect
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Step 3: Disconnect from LiveKit room
          try {
            await room.disconnect();
            console.log('[GroupCallScreen] Disconnected from LiveKit room');
          } catch (e) {
            console.error('[GroupCallScreen] Room disconnect failed:', e);
          }
          
          // Step 4: End call locally and navigate away
          await handleCallEnd(callDuration);
        },
      },
    ]);
  }, [room, callId, userId, groupCall, handleCallEnd, callDuration]);

  const isMuted = !isMicrophoneEnabled;
  // Prevent double-writing history if we initiated the disconnect ourselves.
  const historyWrittenRef = useRef(false);

  // ── AUDIO-ONLY LAYOUT (matches AudioCallScreen) ─────────────────────────────
  if (!isVideoMode) {
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
          <TouchableOpacity onPress={onMinimize} style={styles.backBtn}>
            <AppIcon name="chevron-down" size={26} color="rgba(255,255,255,0.80)" fixedColor />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <AppText fixedColor style={styles.topName}>{headerTitle}</AppText>
            <AppText fixedColor style={styles.topStatus}>
              {formatDuration(callDuration)} · {activeCount} participant{activeCount !== 1 ? 's' : ''}
            </AppText>
          </View>
          <TouchableOpacity style={styles.topBtn} activeOpacity={0.75} onPress={openChat}>
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

        {addOpen && (
          <AddContactModal
            onClose={() => setAddOpen(false)}
            onInvite={handleInvite}
            excludeIds={excludeIds}
          />
        )}
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
        <TouchableOpacity onPress={onMinimize} style={styles.backBtn}>
          <AppIcon name="chevron-down" size={26} color="rgba(255,255,255,0.80)" fixedColor />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <AppText fixedColor style={styles.topName}>{headerTitle}</AppText>
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
        <TouchableOpacity style={[styles.sideBtn, isCameraEnabled && styles.sideBtnActive]} onPress={handleFlipCamera} activeOpacity={0.75} disabled={!isCameraEnabled}>
          <AppIcon name="camera-reverse-outline" size={22} color="#fff" fixedColor />
          <AppText fixedColor style={styles.sideBtnLabel}>Flip</AppText>
        </TouchableOpacity>
        <TouchableOpacity style={styles.sideBtn} onPress={openChat} activeOpacity={0.75}>
          <AppIcon name="chatbubble-outline" size={20} color="#fff" fixedColor />
          <AppText fixedColor style={styles.sideBtnLabel}>Chat</AppText>
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

      {addOpen && (
        <AddContactModal
          onClose={() => setAddOpen(false)}
          onInvite={handleInvite}
          excludeIds={excludeIds}
        />
      )}
    </View>
  );
}

// ─── Add participant modal — pick a contact to invite to the call ───────────
function AddContactModal({
  onClose,
  onInvite,
  excludeIds,
}: {
  onClose: () => void;
  onInvite: (contact: AppContact) => void;
  excludeIds: string[];
}) {
  const { contacts, loading, error } = useContacts();
  const available = contacts.filter((c) => !excludeIds.includes(c.userId));

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.addOverlay} onPress={onClose} />
      <View style={styles.addSheet}>
        <View style={styles.addHandle} />
        <AppText fixedColor style={styles.addTitle}>Add to call</AppText>

        {loading ? (
          <ActivityIndicator color="#fff" style={{ paddingVertical: 28 }} />
        ) : error ? (
          <AppText fixedColor style={styles.addEmpty}>{error}</AppText>
        ) : available.length === 0 ? (
          <AppText fixedColor style={styles.addEmpty}>
            No contacts available to add.
          </AppText>
        ) : (
          <FlatList
            data={available}
            keyExtractor={(c) => c.userId}
            style={{ maxHeight: height * 0.5 }}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.contactRow}
                onPress={() => onInvite(item)}
                activeOpacity={0.7}
              >
                <Avatar
                  initials={getInitials(item.displayName)}
                  color={COLORS.blue}
                  size={40}
                />
                <AppText fixedColor style={styles.contactName} numberOfLines={1}>
                  {item.displayName}
                </AppText>
                <AppIcon name="add-circle-outline" size={24} color="#fff" fixedColor />
              </TouchableOpacity>
            )}
          />
        )}
      </View>
    </Modal>
  );
}

// ─── Floating (minimized) call view — draggable, tap to maximize ────────────
function FloatingCallView({
  groupName,
  onMaximize,
  onEnded,
  callId,
  userId,
}: {
  groupName: string;
  onMaximize: () => void;
  onEnded: () => void;
  callId?: string;
  userId: string | null;
}) {
  const room = useRoomContext();
  const groupCall = useGroupCall();
  const participants = useParticipants();
  const cameraTracks = useTracks([Track.Source.Camera]);

  // Prefer a remote participant's camera for the thumbnail; fall back to avatar.
  const remote = participants.find((p) => !p.isLocal);
  const target = remote || participants[0];
  const camTrack = target
    ? cameraTracks.find((t) => isTrackReference(t) && t.participant.identity === target.identity)
    : undefined;
  const hasVideo = !!(camTrack && isTrackReference(camTrack));

  const position = useRef(new Animated.ValueXY({ x: width - FLOAT_W - 16, y: 90 })).current;
  const offset = useRef({ x: width - FLOAT_W - 16, y: 90 });
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_e: GestureResponderEvent, g: PanResponderGestureState) =>
        Math.abs(g.dx) > 4 || Math.abs(g.dy) > 4,
      onPanResponderGrant: () => {
        position.setOffset({ x: offset.current.x, y: offset.current.y });
        position.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: Animated.event([null, { dx: position.x, dy: position.y }], {
        useNativeDriver: false,
      }),
      onPanResponderRelease: (_e: GestureResponderEvent, g: PanResponderGestureState) => {
        position.flattenOffset();
        const isTap = Math.abs(g.dx) < 8 && Math.abs(g.dy) < 8;
        if (isTap) {
          onMaximize();
          return;
        }
        const finalX = offset.current.x + g.dx;
        const finalY = offset.current.y + g.dy;
        const maxY = height - FLOAT_H - 16;
        const targetX = finalX > width / 2 ? width - FLOAT_W - 16 : 16;
        const targetY = Math.max(50, Math.min(maxY, finalY));
        offset.current = { x: targetX, y: targetY };
        Animated.spring(position, {
          toValue: { x: targetX, y: targetY },
          useNativeDriver: false,
          friction: 8,
        }).start();
      },
    })
  ).current;

  const handleEnd = async () => {
    try {
      if (callId && userId) await groupCall.leaveGroupCall(callId, userId);
    } catch {}
    try {
      await room.disconnect();
    } catch {}
    onEnded();
  };

  return (
    <Animated.View
      style={[styles.floatContainer, { transform: position.getTranslateTransform() }]}
      {...panResponder.panHandlers}
    >
      <View style={styles.floatInner}>
        {hasVideo ? (
          <VideoTrack trackRef={camTrack as any} style={StyleSheet.absoluteFill} objectFit="cover" />
        ) : (
          <View style={styles.floatAvatarWrap}>
            <Avatar initials={getInitials(groupName)} color={COLORS.blue} size={44} />
          </View>
        )}
        <View style={styles.floatBadge}>
          <AppIcon name="call" size={11} color="#fff" fixedColor />
        </View>
        <TouchableOpacity style={styles.floatEndBtn} onPress={handleEnd} activeOpacity={0.8}>
          <AppIcon name="call" size={14} color="#fff" fixedColor />
        </TouchableOpacity>
      </View>
    </Animated.View>
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
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.12)',
  },
  contactName: { flex: 1, fontSize: 15, fontWeight: '600', color: '#fff' },

  // Floating (minimized) call widget
  connectingPill: {
    position: 'absolute',
    top: 90,
    right: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(10,26,48,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOW.glow,
  },
  floatContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: FLOAT_W,
    height: FLOAT_H,
    zIndex: 9999,
  },
  floatInner: {
    flex: 1,
    backgroundColor: 'rgba(10,26,48,0.95)',
    borderRadius: RADIUS.lg,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.25)',
    overflow: 'hidden',
    ...SHADOW.glow,
  },
  floatAvatarWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  floatBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: COLORS.blue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatEndBtn: {
    position: 'absolute',
    bottom: 8,
    left: (FLOAT_W - 32) / 2,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#e84343',
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '135deg' }],
    ...SHADOW.button,
  },
});
