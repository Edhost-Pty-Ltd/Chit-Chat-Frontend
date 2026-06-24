// ─── Screen: Audio Call ──────────────────────────────────────────────────────
// Layout:
//   • Top bar: back button, contact name, timer, chat, switch-to-video, add person
//   • Main area: avatar, caller name, call status/duration
//   • Optional PiP tile (top-right) when camera is enabled for preview
//   • Bottom controls: mute, speaker, camera toggle, hang up
//   • Integrates with WebRTC hooks for real call functionality
import React, { useState, useRef, useEffect } from 'react';
import {
  View, TouchableOpacity, StyleSheet, Alert, Platform, Modal, Pressable, Dimensions,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import RTCView from '../components/RTCView';
import { LinearGradient } from 'expo-linear-gradient';
import { AppText, AppIcon, AppBg } from '../context/ThemeContext';
import { Avatar } from '../components';
import { useCallContext } from '../context/CallContext';
import { useOutgoingCall } from '../hooks/useOutgoingCall';
import { useIncomingCallAnswer } from '../hooks/useIncomingCallAnswer';
import { useAudioRouting } from '../hooks/useAudioRouting';
import { getOrCreateDirectChat } from '../hooks/useChatActions';
import { getAuth } from '@react-native-firebase/auth';
import { COLORS, RADIUS, SHADOW } from '../types/theme';
import { RootStackParamList } from '../types';
import type { NetworkQuality } from '../hooks/useWebRTC';

type NavProp = NativeStackNavigationProp<RootStackParamList, 'AudioCall'>;
type RouteP  = RouteProp<RootStackParamList, 'AudioCall'>;

const { height } = Dimensions.get('window');
const PIP_W = 110;
const PIP_H = 150;

export default function AudioCallScreen() {
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RouteP>();
  const { callId, isOutgoing, otherParty } = route.params;

  const { callStatus, isMuted, isSpeakerOn, callDuration, activeCallId, setMuted, setSpeakerOn, incrementCallDuration, setCallDuration } = useCallContext();
  const outgoingCall = useOutgoingCall();
  const incomingCallAnswer = useIncomingCallAnswer();
  const audioRouting = useAudioRouting();

  // Access streams directly from hooks
  const localStream = isOutgoing ? outgoingCall.localStream : incomingCallAnswer.localStream;
  const remoteStream = isOutgoing ? outgoingCall.remoteStream : incomingCallAnswer.remoteStream;
  const networkQualityFromHook = isOutgoing ? outgoingCall.networkQuality : incomingCallAnswer.networkQuality;

  // Use the appropriate hook based on call direction
  const callManager = isOutgoing ? outgoingCall : incomingCallAnswer;

  const [cameraEnabled, setCameraEnabled] = useState(false); // Default off for audio calls
  const [networkQuality, setNetworkQuality] = useState<NetworkQuality>('unknown');
  const [addOpen, setAddOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const callStartTimeRef = useRef<number>(0);
  const callIdRef = useRef<string>(callId || activeCallId || '');
  
  // Reset call duration when screen mounts
  useEffect(() => {
    console.log('[AudioCallScreen] Component mounted - initializing');
    setCallDuration(0);
    
    // Set the callId in the appropriate hook ONCE
    const effectiveCallId = callId || activeCallId;
    if (effectiveCallId) {
      callIdRef.current = effectiveCallId;
      if (isOutgoing) {
        console.log('[AudioCallScreen] Setting callId in outgoingCall hook:', effectiveCallId);
        outgoingCall.setCallId(effectiveCallId);
      } else {
        console.log('[AudioCallScreen] Setting callId in incomingCallAnswer hook:', effectiveCallId);
        incomingCallAnswer.setCallId(effectiveCallId);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run ONLY on mount

  // Log stream changes
  useEffect(() => {
    console.log('[AudioCallScreen] Stream update - Local:', !!localStream, 'Remote:', !!remoteStream);
    console.log('[AudioCallScreen] Using hook:', isOutgoing ? 'outgoingCall' : 'incomingCallAnswer');
    
    if (localStream) {
      const videoTracks = localStream.getVideoTracks();
      console.log('[AudioCallScreen] Local video tracks:', videoTracks.length, videoTracks.map(t => ({ id: t.id, enabled: t.enabled, readyState: t.readyState })));
    }
    if (remoteStream) {
      const videoTracks = remoteStream.getVideoTracks();
      console.log('[AudioCallScreen] Remote video tracks:', videoTracks.length, videoTracks.map(t => ({ id: t.id, enabled: t.enabled, readyState: t.readyState })));
    }
  }, [localStream, remoteStream, isOutgoing]);

  // Initialize audio routing when screen mounts
  useEffect(() => {
    audioRouting.initializeAudioSession();
    
    return () => {
      audioRouting.cleanup();
    };
  }, []);

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
      console.log('[AudioCallScreen] Call timer started');
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
      console.log('[AudioCallScreen] Call ended with status:', callStatus);
      
      // Stop timer immediately
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      
      // Navigate back immediately for ended status
      if (callStatus === 'ended') {
        console.log('[AudioCallScreen] Navigating back immediately');
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

  const getInitials = (name: string) => {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
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

  const handleMuteToggle = () => {
    const newMuted = !isMuted;
    setMuted(newMuted);
    callManager.toggleMute(newMuted);
  };

  const handleSpeakerToggle = async () => {
    const newSpeakerState = !isSpeakerOn;
    setSpeakerOn(newSpeakerState);
    await audioRouting.toggleSpeaker();
    console.log('[AudioCallScreen] Speaker toggle:', newSpeakerState);
  };

  const handleCameraToggle = () => {
    const newCameraState = !cameraEnabled;
    setCameraEnabled(newCameraState);
    callManager.toggleVideo(newCameraState);
    console.log('[AudioCallScreen] Camera toggle:', newCameraState);
  };

  const handleFlipCamera = () => {
    // TODO: Implement camera flip (front/back)
    console.log('[AudioCallScreen] Flip camera');
  };

  const switchToVideo = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    navigation.replace('VideoCall', { callId, isOutgoing, otherParty });
  };

  const openChat = async () => {
    try {
      const currentUid = getAuth().currentUser?.uid;
      if (!currentUid) {
        Alert.alert('Chat unavailable', 'Could not open the chat.');
        return;
      }
      const chatId = await getOrCreateDirectChat(currentUid, otherParty.userId);
      // Push so the call keeps running underneath; back returns to the call.
      navigation.push('Chat', {
        chatId,
        displayName: otherParty.displayName,
        isGroup: false,
        otherUserId: otherParty.userId,
        otherUserPhoto: otherParty.photoUrl,
      });
    } catch (error) {
      console.error('[AudioCallScreen] Error opening chat:', error);
      Alert.alert('Error', 'Could not open chat. Please try again.');
    }
  };

  const handleHangUp = async () => {
    console.log('[AudioCallScreen] Hanging up...');
    console.log('[AudioCallScreen] Current call status:', callStatus);
    console.log('[AudioCallScreen] Call ID from ref:', callIdRef.current);
    console.log('[AudioCallScreen] Is outgoing:', isOutgoing);
    
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

    console.log('[AudioCallScreen] Calculated duration:', duration);
    console.log('[AudioCallScreen] Calling endCall on', isOutgoing ? 'outgoingCall' : 'incomingCallAnswer');

    // End the call using the appropriate manager
    await callManager.endCall(duration);

    console.log('[AudioCallScreen] endCall completed, navigating back...');
    navigation.goBack();
  };

  const networkIcon = getNetworkQualityIcon();

  return (
    <View style={styles.root}>
      <AppBg />
      <LinearGradient
        colors={['rgba(10,22,40,0.75)', 'rgba(13,34,68,0.85)', 'rgba(26,74,138,0.95)']}
        style={styles.gradientOverlay}
        start={{ x: 0.3, y: 0 }} 
        end={{ x: 0.7, y: 1 }}
      />

      {/* ── Top bar ── */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={handleHangUp} style={styles.backBtn}>
          <AppIcon name="chevron-back" size={26} color="rgba(255,255,255,0.80)" fixedColor />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <AppText fixedColor style={styles.topName}>{otherParty.displayName}</AppText>
          <AppText fixedColor style={styles.topStatus}>
            {getCallStatusText()}
            {callStatus === 'connected' && networkIcon && (
              <>
                {' · '}
                <AppIcon 
                  name={networkIcon.name as any} 
                  size={11} 
                  color={networkIcon.color} 
                  fixedColor 
                />
              </>
            )}
          </AppText>
        </View>
        
        {/* Top bar action buttons */}
        <TouchableOpacity onPress={openChat} style={styles.topBtn} activeOpacity={0.75}>
          <AppIcon name="chatbubble-outline" size={22} color="rgba(255,255,255,0.80)" fixedColor />
        </TouchableOpacity>
        
        <TouchableOpacity 
          onPress={switchToVideo} 
          style={styles.topBtn} 
          activeOpacity={0.75}
          disabled={callStatus !== 'connected'}
        >
          <AppIcon name="videocam-outline" size={24} color="rgba(255,255,255,0.80)" fixedColor />
        </TouchableOpacity>
        
        <TouchableOpacity 
          onPress={() => setAddOpen(true)} 
          style={[styles.topBtn, { opacity: 0.4 }]} 
          activeOpacity={0.75}
          disabled={true}
        >
          <AppIcon name="person-add-outline" size={22} color="rgba(255,255,255,0.80)" fixedColor />
        </TouchableOpacity>
      </View>

      {/* ── Main caller info ── */}
      <View style={styles.callerSection}>
        <View style={styles.avatarRing}>
          <Avatar 
            initials={getInitials(otherParty.displayName)} 
            color={COLORS.blue} 
            size={120} 
          />
        </View>
        <AppText fixedColor style={styles.callerName}>{otherParty.displayName}</AppText>
        <AppText fixedColor style={styles.callStatus}>
          {getCallStatusText()}
        </AppText>
      </View>

      {/* ── Local Camera PiP (only when camera enabled) ── */}
      {cameraEnabled && localStream && (
        <View style={styles.pipContainer}>
          <View style={styles.pipTile}>
            <RTCView
              streamURL={Platform.OS !== 'web' ? (localStream as any).toURL?.() : undefined}
              stream={Platform.OS === 'web' ? localStream : undefined}
              style={StyleSheet.absoluteFill}
              objectFit="cover"
              mirror={true}
              zOrder={1}
            />
            {/* Camera flip button overlay */}
            <TouchableOpacity 
              style={styles.pipFlipBtn} 
              onPress={handleFlipCamera}
              activeOpacity={0.75}
            >
              <AppIcon name="camera-reverse-outline" size={18} color="#fff" fixedColor />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── Bottom controls (4 buttons) ── */}
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
            style={[styles.controlBtn, cameraEnabled && styles.controlBtnActive]}
            onPress={handleCameraToggle}
            disabled={callStatus !== 'connected'}
          >
            <AppIcon name={cameraEnabled ? 'videocam-outline' : 'videocam-off-outline'} size={24} color="#fff" fixedColor />
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

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  gradientOverlay: { ...StyleSheet.absoluteFill },

  // Top bar — back button + name + timer + action buttons
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
  topBtn: { 
    padding: 6,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Main caller section
  callerSection: { 
    position: 'absolute',
    top: Platform.OS === 'web' ? 140 : Platform.OS === 'ios' ? 180 : 160,
    left: 0,
    right: 0,
    alignItems: 'center', 
    gap: 14,
  },
  avatarRing: {
    padding: 6,
    borderRadius: 70,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.45)',
    borderTopColor: 'rgba(255,255,255,0.70)',
    ...SHADOW.glow,
  },
  callerName: { fontSize: 28, fontWeight: '700', color: '#fff' },
  callStatus: { fontSize: 16, color: 'rgba(255,255,255,0.65)' },

  // Local camera PiP (top-right corner)
  pipContainer: {
    position: 'absolute',
    top: Platform.OS === 'web' ? 72 : Platform.OS === 'ios' ? 110 : 90,
    right: 10,
  },
  pipTile: {
    width: PIP_W, 
    height: PIP_H,
    borderRadius: RADIUS.md, 
    overflow: 'hidden',
    borderWidth: 1.5, 
    borderColor: 'rgba(255,255,255,0.30)',
    ...SHADOW.glow,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  pipFlipBtn: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.30)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Bottom controls (4 buttons in a row)
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
  controlBtnActive: { 
    backgroundColor: 'rgba(30,156,240,0.35)',
    borderColor: 'rgba(30,156,240,0.55)',
  },
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
