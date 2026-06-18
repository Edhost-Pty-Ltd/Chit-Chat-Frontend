// ─── Screen: Video Call ──────────────────────────────────────────────────────
// Layout:
//   • Full-screen main view (remote or local camera)
//   • PiP tiles stacked top-right — tap to swap to main
//   • Vertical icon list right side (below PiPs):
//       camera-reverse  → flip camera (only active when local is main)
//       chatbubble      → open chat
//       person-add      → add participant (disabled for 1-on-1)
//   • Bottom bar: mute | speaker | audio-only | end
//   • Integrates with WebRTC hooks for real call functionality
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, TouchableOpacity, StyleSheet, Alert, Platform, Animated, Dimensions, Modal, ScrollView, Pressable,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RTCView } from 'react-native-webrtc';
import { LinearGradient } from 'expo-linear-gradient';
import { AppText, AppIcon, AppBg } from '../context/ThemeContext';
import { Avatar } from '../components';
import { useCallContext } from '../context/CallContext';
import { useOutgoingCall } from '../hooks/useOutgoingCall';
import { useIncomingCallAnswer } from '../hooks/useIncomingCallAnswer';
import { COLORS, RADIUS, SHADOW, GRADIENTS } from '../types/theme';
import { RootStackParamList } from '../types';
import type { NetworkQuality } from '../hooks/useWebRTC';

type NavProp = NativeStackNavigationProp<RootStackParamList, 'VideoCall'>;
type RouteP  = RouteProp<RootStackParamList, 'VideoCall'>;

const { height } = Dimensions.get('window');
const PIP_W = 100;
const PIP_H = 140;

interface Participant { 
  id: string; 
  userId: string;
  displayName: string; 
  photoUrl: string | null;
  initials: string;
  isLocal: boolean; 
}

// ─── PiP tile — tap to swap to main ──────────────────────────────────────────
function PipTile({
  participant: p, 
  stream,
  cameraEnabled, 
  onTap,
}: {
  participant: Participant; 
  stream: any;
  cameraEnabled: boolean;
  onTap: () => void;
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handleTap = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.88, duration: 80, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1,    duration: 80, useNativeDriver: true }),
    ]).start(onTap);
  };

  return (
    <Animated.View style={[styles.pipTile, { transform: [{ scale: scaleAnim }] }]}>
      {/* WebRTC feed or dark background */}
      {p.isLocal && stream && cameraEnabled ? (
        <RTCView
          streamURL={stream.toURL()}
          style={StyleSheet.absoluteFill}
          objectFit="cover"
          mirror={true}
          zOrder={1}
        />
      ) : !p.isLocal && stream ? (
        <RTCView
          streamURL={stream.toURL()}
          style={StyleSheet.absoluteFill}
          objectFit="cover"
          mirror={false}
          zOrder={0}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.55)' }]} />
      )}

      {/* Full-tile touchable — tap to become main */}
      <TouchableOpacity style={styles.pipTouch} onPress={handleTap} activeOpacity={0.8}>
        {/* Show avatar if no stream or camera disabled */}
        {(!stream || (p.isLocal && !cameraEnabled)) && (
          <View style={styles.pipAvatarWrap}>
            <Avatar initials={p.initials} color={COLORS.blue} size={42} />
            <AppText fixedColor style={styles.pipNamePill} numberOfLines={1}>
              {p.displayName}
            </AppText>
          </View>
        )}
      </TouchableOpacity>

      {/* "You" label at bottom for local tile */}
      {p.isLocal && <AppText fixedColor style={styles.pipNameBar}>You</AppText>}
    </Animated.View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function VideoCallScreen() {
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RouteP>();
  const { callId, isOutgoing, otherParty } = route.params;

  const { callStatus, isMuted, isSpeakerOn, callDuration, activeCallId, setMuted, setSpeakerOn, incrementCallDuration, setCallDuration } = useCallContext();
  const outgoingCall = useOutgoingCall();
  const incomingCallAnswer = useIncomingCallAnswer();

  // Access streams directly from hooks
  const localStream = isOutgoing ? outgoingCall.localStream : incomingCallAnswer.localStream;
  const remoteStream = isOutgoing ? outgoingCall.remoteStream : incomingCallAnswer.remoteStream;
  const networkQualityFromHook = isOutgoing ? outgoingCall.networkQuality : incomingCallAnswer.networkQuality;
  
  // Use the appropriate hook for methods
  const callManager = isOutgoing ? outgoingCall : incomingCallAnswer;

  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [networkQuality, setNetworkQuality] = useState<NetworkQuality>('unknown');
  const [addOpen, setAddOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const callStartTimeRef = useRef<number>(0);
  const callIdRef = useRef<string>(callId || activeCallId || '');

  // Helper to get initials from display name
  const getInitials = useCallback((name: string) => {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  }, []);

  // Build participant list: [remote participant, local "You"]
  const [participants, setParticipants] = useState<Participant[]>(() => {
    const remote: Participant = {
      id: 'remote-0',
      userId: otherParty.userId,
      displayName: otherParty.displayName,
      photoUrl: otherParty.photoUrl,
      initials: getInitials(otherParty.displayName),
      isLocal: false,
    };
    const local: Participant = {
      id: 'local',
      userId: 'me',
      displayName: 'You',
      photoUrl: null,
      initials: 'ME',
      isLocal: true,
    };
    return [remote, local];
  });

  const mainP = participants[0];
  const pipList = participants.slice(1);

  // Reset call duration when screen mounts
  useEffect(() => {
    console.log('[VideoCallScreen] Component mounted - initializing');
    setCallDuration(0);
    
    // Set the callId in the appropriate hook ONCE
    const effectiveCallId = callId || activeCallId;
    if (effectiveCallId) {
      callIdRef.current = effectiveCallId;
      if (isOutgoing) {
        console.log('[VideoCallScreen] Setting callId in outgoingCall hook:', effectiveCallId);
        outgoingCall.setCallId(effectiveCallId);
      } else {
        console.log('[VideoCallScreen] Setting callId in incomingCallAnswer hook:', effectiveCallId);
        incomingCallAnswer.setCallId(effectiveCallId);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run ONLY on mount

  // Log stream changes
  useEffect(() => {
    console.log('[VideoCallScreen] Stream update - Local:', !!localStream, 'Remote:', !!remoteStream);
    console.log('[VideoCallScreen] Using hook:', isOutgoing ? 'outgoingCall' : 'incomingCallAnswer');
    
    if (localStream) {
      const videoTracks = localStream.getVideoTracks();
      console.log('[VideoCallScreen] Local video tracks:', videoTracks.length, videoTracks.map(t => ({ id: t.id, enabled: t.enabled, readyState: t.readyState })));
    }
    if (remoteStream) {
      const videoTracks = remoteStream.getVideoTracks();
      console.log('[VideoCallScreen] Remote video tracks:', videoTracks.length, videoTracks.map(t => ({ id: t.id, enabled: t.enabled, readyState: t.readyState })));
    }
  }, [localStream, remoteStream, isOutgoing]);

  // Update network quality from call manager
  useEffect(() => {
    if (networkQualityFromHook) {
      setNetworkQuality(networkQualityFromHook);
    }
  }, [networkQualityFromHook]);

  // Start call timer when connected
  useEffect(() => {
    if (callStatus === 'connected' && !timerRef.current) {
      callStartTimeRef.current = Date.now();
      timerRef.current = setInterval(() => {
        incrementCallDuration();
      }, 1000);
      console.log('[VideoCallScreen] Call timer started');
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [callStatus, incrementCallDuration]);

  // Handle call status changes
  useEffect(() => {
    if (callStatus === 'ended' || callStatus === 'rejected' || callStatus === 'missed' || callStatus === 'failed') {
      console.log('[VideoCallScreen] Call ended with status:', callStatus);
      
      // Stop timer immediately
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      
      // Navigate back immediately for ended status
      if (callStatus === 'ended') {
        console.log('[VideoCallScreen] Navigating back immediately');
        navigation.goBack();
        return;
      }
      
      // Show alert for non-normal endings
      if (callStatus === 'rejected') {
        Alert.alert('Call Rejected', 'The other person rejected your call.', [
          { text: 'OK', onPress: () => navigation.goBack() }
        ]);
      } else if (callStatus === 'missed') {
        Alert.alert('No Answer', 'The other person did not answer.', [
          { text: 'OK', onPress: () => navigation.goBack() }
        ]);
      } else if (callStatus === 'failed') {
        Alert.alert('Call Failed', 'Unable to establish connection.', [
          { text: 'OK', onPress: () => navigation.goBack() }
        ]);
      }
    }
  }, [callStatus, navigation]);

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  const getCallStatusText = () => {
    if (callStatus === 'ringing') return isOutgoing ? 'Calling...' : 'Incoming call...';
    if (callStatus === 'accepted') return 'Connecting...';
    if (callStatus === 'connected') return formatDuration(callDuration);
    return 'Call ended';
  };

  const swapToMain = useCallback((id: string) => {
    setParticipants((prev) => {
      const idx = prev.findIndex((p) => p.id === id);
      if (idx <= 0) return prev;
      const next = [...prev];
      [next[0], next[idx]] = [next[idx], next[0]];
      return next;
    });
  }, []);

  const handleMuteToggle = () => {
    const newMuted = !isMuted;
    setMuted(newMuted);
    callManager.toggleMute(newMuted);
  };

  const handleSpeakerToggle = () => {
    const newSpeakerOn = !isSpeakerOn;
    setSpeakerOn(newSpeakerOn);
    // TODO: Implement speaker toggle
  };

  const handleCameraToggle = () => {
    const newCameraState = !cameraEnabled;
    setCameraEnabled(newCameraState);
    callManager.toggleVideo(newCameraState);
    console.log('[VideoCallScreen] Camera toggle:', newCameraState);
  };

  const handleFlipCamera = () => {
    // TODO: Implement camera flip (front/back)
    console.log('[VideoCallScreen] Flip camera');
  };

  const switchToAudio = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    navigation.replace('AudioCall', { callId, isOutgoing, otherParty });
  };

  const openChat = () => {
    Alert.alert('Chat', 'Chat feature not available during video call');
  };

  const handleHangUp = async () => {
    console.log('[VideoCallScreen] Hanging up...');
    console.log('[VideoCallScreen] Current call status:', callStatus);
    console.log('[VideoCallScreen] Call ID from ref:', callIdRef.current);
    console.log('[VideoCallScreen] Is outgoing:', isOutgoing);
    
    // Ensure the hook has the callId before ending
    if (callIdRef.current) {
      if (isOutgoing) {
        outgoingCall.setCallId(callIdRef.current);
      } else {
        incomingCallAnswer.setCallId(callIdRef.current);
      }
    }
    
    // Calculate duration if call was connected
    const duration = callStatus === 'connected' 
      ? Math.floor((Date.now() - callStartTimeRef.current) / 1000)
      : 0;

    console.log('[VideoCallScreen] Calculated duration:', duration);
    console.log('[VideoCallScreen] Calling endCall on', isOutgoing ? 'outgoingCall' : 'incomingCallAnswer');

    // End the call using the appropriate manager
    await callManager.endCall(duration);

    console.log('[VideoCallScreen] endCall completed, navigating back...');
    navigation.goBack();
  };

  const getNetworkQualityIcon = () => {
    switch (networkQuality) {
      case 'excellent':
        return { name: 'wifi', color: '#4ade80' };
      case 'good':
        return { name: 'wifi', color: '#84cc16' };
      case 'fair':
        return { name: 'wifi', color: '#fbbf24' };
      case 'poor':
        return { name: 'wifi', color: '#f87171' };
      default:
        return null;
    }
  };

  const networkIcon = getNetworkQualityIcon();
  const localIsMain = mainP.isLocal; // camera flip only active when local is main
  const mainStream = mainP.isLocal ? localStream : remoteStream;

  return (
    <View style={styles.root}>
      <AppBg />
      <View style={styles.darkOverlay} />

      {/* ── Main view ── */}
      <View style={styles.mainView}>
        {mainP.isLocal && localStream && cameraEnabled ? (
          <RTCView
            streamURL={localStream.toURL()}
            style={StyleSheet.absoluteFill}
            objectFit="cover"
            mirror={true}
            zOrder={1}
          />
        ) : !mainP.isLocal && remoteStream ? (
          <RTCView
            streamURL={remoteStream.toURL()}
            style={StyleSheet.absoluteFill}
            objectFit="cover"
            mirror={false}
            zOrder={0}
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: '#0a1a30' }]} />
        )}
        
        {/* Show avatar overlay when no stream or camera disabled */}
        {(!mainStream || (mainP.isLocal && !cameraEnabled)) && (
          <View style={styles.mainAvatarOverlay}>
            <Avatar initials={mainP.initials} color={COLORS.blue} size={120} />
            <AppText fixedColor style={styles.mainName}>{mainP.displayName}</AppText>
            <AppText fixedColor style={styles.mainSub}>
              {callStatus === 'connected' ? `In call · ${formatDuration(callDuration)}` : getCallStatusText()}
            </AppText>
          </View>
        )}
      </View>

      {/* ── Top bar ── */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={handleHangUp} style={styles.backBtn}>
          <AppIcon name="chevron-back" size={26} color="rgba(255,255,255,0.80)" fixedColor />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <AppText fixedColor style={styles.topName}>{mainP.displayName}</AppText>
          <AppText fixedColor style={styles.topStatus}>
            {formatDuration(callDuration)} · {participants.length} participant{participants.length !== 1 ? 's' : ''}
            {callStatus === 'connected' && networkIcon && (
              <AppIcon 
                name={networkIcon.name as any} 
                size={11} 
                color={networkIcon.color} 
                fixedColor 
              />
            )}
          </AppText>
        </View>
      </View>

      {/* ── Right-side vertical panel: PiPs then action icons ── */}
      <View style={styles.rightPanel}>
        {/* PiP tiles */}
        {pipList.map((p) => (
          <PipTile
            key={p.id}
            participant={p}
            stream={p.isLocal ? localStream : remoteStream}
            cameraEnabled={cameraEnabled}
            onTap={() => swapToMain(p.id)}
          />
        ))}

        {/* Divider between PiPs and action icons */}
        <View style={styles.panelDivider} />

        {/* Camera flip — active (bright) when local is main; dim otherwise */}
        <TouchableOpacity
          style={[styles.sideBtn, localIsMain && styles.sideBtnActive]}
          onPress={handleFlipCamera}
          activeOpacity={0.75}
          disabled={!localIsMain || !cameraEnabled}
        >
          <AppIcon name="camera-reverse-outline" size={22} color="#fff" fixedColor />
          <AppText fixedColor style={styles.sideBtnLabel}>Flip</AppText>
        </TouchableOpacity>

        {/* Chat */}
        <TouchableOpacity style={styles.sideBtn} onPress={openChat} activeOpacity={0.75}>
          <AppIcon name="chatbubble-outline" size={20} color="#fff" fixedColor />
          <AppText fixedColor style={styles.sideBtnLabel}>Chat</AppText>
        </TouchableOpacity>

        {/* Add person - disabled for 1-on-1 calls */}
        <TouchableOpacity 
          style={[styles.sideBtn, { opacity: 0.4 }]} 
          onPress={() => setAddOpen(true)} 
          activeOpacity={0.75}
          disabled={true}
        >
          <AppIcon name="person-add-outline" size={20} color="#fff" fixedColor />
          <AppText fixedColor style={styles.sideBtnLabel}>Add</AppText>
        </TouchableOpacity>
      </View>

      {/* ── Bottom controls ── */}
      <View style={styles.controls}>
        <View style={styles.controlCol}>
          <TouchableOpacity
            style={[styles.controlBtn, isMuted && styles.controlBtnActive]}
            onPress={handleMuteToggle}
            disabled={callStatus !== 'connected'}
          >
            <AppIcon name={isMuted ? 'mic-off' : 'mic-outline'} size={24} color="#fff" fixedColor />
          </TouchableOpacity>
          <AppText fixedColor style={styles.controlLabel}>{isMuted ? 'Unmute' : 'Mute'}</AppText>
        </View>

        <View style={styles.controlCol}>
          <TouchableOpacity
            style={[styles.controlBtn, isSpeakerOn && styles.controlBtnActive]}
            onPress={handleSpeakerToggle}
            disabled={callStatus !== 'connected'}
          >
            <AppIcon name={isSpeakerOn ? 'volume-high-outline' : 'volume-mute-outline'} size={24} color="#fff" fixedColor />
          </TouchableOpacity>
          <AppText fixedColor style={styles.controlLabel}>Speaker</AppText>
        </View>

        <View style={styles.controlCol}>
          <TouchableOpacity 
            style={styles.controlBtn} 
            onPress={switchToAudio}
            disabled={callStatus !== 'connected'}
          >
            <AppIcon name="call-outline" size={24} color="#fff" fixedColor />
          </TouchableOpacity>
          <AppText fixedColor style={styles.controlLabel}>Audio only</AppText>
        </View>

        <View style={styles.controlCol}>
          <TouchableOpacity style={styles.hangUpBtn} onPress={handleHangUp}>
            <AppIcon name="call" size={28} color="#fff" fixedColor />
          </TouchableOpacity>
          <AppText fixedColor style={styles.controlLabel}>End</AppText>
        </View>
      </View>

      {/* ── Add person modal (placeholder - disabled for now) ── */}
      <Modal visible={addOpen} transparent animationType="slide"
        onRequestClose={() => setAddOpen(false)}>
        <Pressable style={styles.addOverlay} onPress={() => setAddOpen(false)} />
        <View style={styles.addSheet}>
          <View style={styles.addHandle} />
          <AppText fixedColor style={styles.addTitle}>Add to call</AppText>
          <AppText fixedColor style={styles.addEmpty}>
            Group calls are not available yet.
          </AppText>
        </View>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  darkOverlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.35)' },

  mainView: { ...StyleSheet.absoluteFill },
  mainAvatarOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center', 
    justifyContent: 'center', 
    gap: 14,
  },
  mainName: { fontSize: 24, fontWeight: '700', color: '#fff' },
  mainSub: { fontSize: 13, color: 'rgba(255,255,255,0.60)' },

  // Top bar — back button + name + timer
  topBar: {
    position: 'absolute', 
    top: 0, 
    left: 0, 
    right: 0,
    flexDirection: 'row', 
    alignItems: 'center',
    paddingTop: Platform.OS === 'web' ? 16 : Platform.OS === 'ios' ? 54 : 36,
    paddingBottom: 12, 
    paddingHorizontal: 12,
    backgroundColor: 'rgba(0,0,0,0.28)', 
    gap: 10,
  },
  backBtn: { padding: 6 },
  topName: { fontSize: 15, fontWeight: '700', color: '#fff' },
  topStatus: { fontSize: 11, color: 'rgba(255,255,255,0.60)', marginTop: 1 },

  // ── Right vertical panel: PiPs + action icons ─────────────────────────────
  rightPanel: {
    position: 'absolute',
    top: Platform.OS === 'web' ? 72 : Platform.OS === 'ios' ? 110 : 90,
    right: 10,
    alignItems: 'center',
    gap: 8,
  },

  // PiP tile
  pipTile: {
    width: PIP_W, 
    height: PIP_H,
    borderRadius: RADIUS.md, 
    overflow: 'hidden',
    borderWidth: 1.5, 
    borderColor: 'rgba(255,255,255,0.30)',
    ...SHADOW.glow,
  },
  pipTouch: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center', 
    justifyContent: 'center',
  },
  pipAvatarWrap: { alignItems: 'center', gap: 5 },
  pipNamePill: {
    fontSize: 10, 
    color: '#fff', 
    fontWeight: '600',
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 7, 
    paddingVertical: 2,
    borderRadius: RADIUS.full, 
    overflow: 'hidden',
  },
  pipNameBar: {
    position: 'absolute', 
    bottom: 0, 
    left: 0, 
    right: 0,
    textAlign: 'center', 
    fontSize: 10, 
    color: '#fff',
    backgroundColor: 'rgba(0,0,0,0.45)', 
    paddingVertical: 3,
  },

  // Thin divider between PiPs and action icons
  panelDivider: {
    width: 36, 
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.20)',
    marginVertical: 2,
  },

  // Action icon buttons in vertical list
  sideBtn: {
    width: 48, 
    height: 52,
    borderRadius: RADIUS.sm,
    backgroundColor: 'rgba(0,0,0,0.40)',
    borderWidth: 1, 
    borderColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', 
    justifyContent: 'center',
    gap: 3,
  },
  sideBtnActive: {
    backgroundColor: 'rgba(30,156,240,0.35)',
    borderColor: 'rgba(30,156,240,0.55)',
  },
  sideBtnLabel: {
    fontSize: 9, 
    color: 'rgba(255,255,255,0.75)', 
    fontWeight: '600',
  },

  // Bottom controls
  controls: {
    position: 'absolute', 
    bottom: 0, 
    left: 0, 
    right: 0,
    flexDirection: 'row', 
    justifyContent: 'space-around', 
    alignItems: 'flex-end',
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    paddingTop: 16, 
    paddingHorizontal: 8,
    backgroundColor: 'rgba(0,0,0,0.42)',
  },
  controlCol: { alignItems: 'center', gap: 6 },
  controlLabel: { fontSize: 10, color: 'rgba(255,255,255,0.70)' },
  controlBtn: {
    width: 54, 
    height: 54, 
    borderRadius: 27,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1, 
    borderColor: 'rgba(255,255,255,0.25)',
    borderTopColor: 'rgba(255,255,255,0.75)',
    alignItems: 'center', 
    justifyContent: 'center',
    ...SHADOW.card,
  },
  controlBtnActive: { backgroundColor: 'rgba(255,255,255,0.35)' },
  hangUpBtn: {
    width: 64, 
    height: 64, 
    borderRadius: 32,
    backgroundColor: '#e84343',
    alignItems: 'center', 
    justifyContent: 'center',
    transform: [{ rotate: '135deg' }],
    ...SHADOW.button,
  },

  // Add modal
  addOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.50)' },
  addSheet: {
    backgroundColor: '#0d2040',
    borderTopLeftRadius: 24, 
    borderTopRightRadius: 24,
    maxHeight: height * 0.65,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    paddingHorizontal: 16, 
    paddingTop: 12,
    ...SHADOW.glow,
  },
  addHandle: {
    width: 40, 
    height: 4, 
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignSelf: 'center', 
    marginBottom: 14,
  },
  addTitle: { fontSize: 17, fontWeight: '700', color: '#fff', marginBottom: 14 },
  addEmpty: { 
    fontSize: 14, 
    color: 'rgba(255,255,255,0.55)', 
    textAlign: 'center', 
    paddingVertical: 24 
  },
});
