// ─── Screen: Video Call ──────────────────────────────────────────────────────
// Full-screen video call UI with WebRTC integration
import React, { useState, useRef, useEffect } from 'react';
import {
  View, TouchableOpacity, StyleSheet, Alert, Platform,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RTCView } from 'react-native-webrtc';
import { LinearGradient } from 'expo-linear-gradient';
import { AppText, AppIcon } from '../context/ThemeContext';
import { Avatar } from '../components';
import { useCallContext } from '../context/CallContext';
import { useOutgoingCall } from '../hooks/useOutgoingCall';
import { useIncomingCallAnswer } from '../hooks/useIncomingCallAnswer';
import { COLORS, RADIUS, SHADOW } from '../types/theme';
import { RootStackParamList } from '../types';
import type { NetworkQuality } from '../hooks/useWebRTC';

type NavProp = NativeStackNavigationProp<RootStackParamList, 'VideoCall'>;
type RouteP  = RouteProp<RootStackParamList, 'VideoCall'>;

export default function VideoCallScreen() {
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RouteP>();
  const { callId, isOutgoing, otherParty } = route.params;

  const { callStatus, isMuted, isSpeakerOn, callDuration, activeCallId, setMuted, setSpeakerOn, incrementCallDuration, setCallDuration } = useCallContext();
  const outgoingCall = useOutgoingCall();
  const incomingCallAnswer = useIncomingCallAnswer();

  // Access streams directly from hooks (don't cache in a constant)
  // This ensures we get updates when streams are created
  const localStream = isOutgoing ? outgoingCall.localStream : incomingCallAnswer.localStream;
  const remoteStream = isOutgoing ? outgoingCall.remoteStream : incomingCallAnswer.remoteStream;
  const networkQualityFromHook = isOutgoing ? outgoingCall.networkQuality : incomingCallAnswer.networkQuality;
  
  // Use the appropriate hook for methods
  const callManager = isOutgoing ? outgoingCall : incomingCallAnswer;

  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [networkQuality, setNetworkQuality] = useState<NetworkQuality>('unknown');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const callStartTimeRef = useRef<number>(0);
  const callIdRef = useRef<string>(callId || activeCallId || '');

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
    console.log('[VideoCallScreen] outgoingCall.localStream:', !!outgoingCall.localStream, 'remoteStream:', !!outgoingCall.remoteStream);
    console.log('[VideoCallScreen] incomingCallAnswer.localStream:', !!incomingCallAnswer.localStream, 'remoteStream:', !!incomingCallAnswer.remoteStream);
    
    if (localStream) {
      const videoTracks = localStream.getVideoTracks();
      console.log('[VideoCallScreen] Local video tracks:', videoTracks.length, videoTracks.map(t => ({ id: t.id, enabled: t.enabled, readyState: t.readyState })));
      
      // Log the stream URL
      try {
        const url = localStream.toURL();
        console.log('[VideoCallScreen] Local stream URL:', url);
      } catch (e) {
        console.error('[VideoCallScreen] Error getting local stream URL:', e);
      }
    }
    if (remoteStream) {
      const videoTracks = remoteStream.getVideoTracks();
      console.log('[VideoCallScreen] Remote video tracks:', videoTracks.length, videoTracks.map(t => ({ id: t.id, enabled: t.enabled, readyState: t.readyState })));
      
      // Log the stream URL
      try {
        const url = remoteStream.toURL();
        console.log('[VideoCallScreen] Remote stream URL:', url);
      } catch (e) {
        console.error('[VideoCallScreen] Error getting remote stream URL:', e);
      }
    }
  }, [localStream, remoteStream, outgoingCall.localStream, outgoingCall.remoteStream, incomingCallAnswer.localStream, incomingCallAnswer.remoteStream, isOutgoing]);

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
  }, [callStatus]);

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
    if (callStatus === 'connecting' || callStatus === 'accepted') return 'Connecting...';
    if (callStatus === 'connected') return formatDuration(callDuration);
    return 'Call ended';
  };

  const handleMuteToggle = () => {
    const newMuted = !isMuted;
    setMuted(newMuted);
    callManager.toggleMute(newMuted);
  };

  const handleCameraToggle = () => {
    const newCameraState = !cameraEnabled;
    setCameraEnabled(newCameraState);
    callManager.toggleVideo(newCameraState);
    console.log('[VideoCallScreen] Camera toggle:', newCameraState);
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

  const handleSwitchCamera = () => {
    // TODO: Implement camera switching
    console.log('[VideoCallScreen] Switch camera');
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

  const networkIcon = getNetworkQualityIcon();

  return (
    <View style={styles.root}>
      {/* Remote video (full screen) */}
      {remoteStream ? (
        <RTCView
          streamURL={remoteStream.toURL()}
          style={styles.remoteVideo}
          objectFit="cover"
          mirror={false}
          zOrder={0}
        />
      ) : (
        <LinearGradient
          colors={['#0a1628', '#0d2244', '#1a4a8a']}
          style={styles.remoteVideoPlaceholder}
          start={{ x: 0.3, y: 0 }}
          end={{ x: 0.7, y: 1 }}
        >
          <Avatar 
            initials={getInitials(otherParty.displayName)} 
            color={COLORS.blue} 
            size={110} 
          />
          <AppText fixedColor style={styles.placeholderName}>{otherParty.displayName}</AppText>
        </LinearGradient>
      )}

      {/* Local video (picture-in-picture) */}
      {localStream && cameraEnabled ? (
        <View style={styles.localVideoContainer}>
          <RTCView
            streamURL={localStream.toURL()}
            style={styles.localVideo}
            objectFit="cover"
            mirror={true}
            zOrder={1}
          />
        </View>
      ) : null}

      {/* Top bar */}
      <LinearGradient
        colors={['rgba(0,0,0,0.6)', 'transparent']}
        style={styles.topBar}
      >
        <View style={styles.statusRow}>
          <AppText fixedColor style={styles.statusText}>
            {getCallStatusText()}
          </AppText>
          {callStatus === 'connected' && networkIcon && (
            <View style={styles.networkIndicator}>
              <AppIcon 
                name={networkIcon.name as any} 
                size={14} 
                color={networkIcon.color} 
                fixedColor 
              />
            </View>
          )}
        </View>
        <AppText fixedColor style={styles.callerName}>{otherParty.displayName}</AppText>
      </LinearGradient>

      {/* Bottom controls */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.7)']}
        style={styles.bottomBar}
      >
        <View style={styles.controlsRow}>
          {/* Mute */}
          <TouchableOpacity
            style={[styles.controlBtn, isMuted && styles.controlBtnActive]}
            onPress={handleMuteToggle}
            disabled={callStatus !== 'connected'}
          >
            <AppIcon 
              name={isMuted ? 'mic-off' : 'mic-outline'} 
              size={26} 
              color="#fff" 
              fixedColor 
            />
          </TouchableOpacity>

          {/* Camera */}
          <TouchableOpacity
            style={[styles.controlBtn, !cameraEnabled && styles.controlBtnActive]}
            onPress={handleCameraToggle}
            disabled={callStatus !== 'connected'}
          >
            <AppIcon 
              name={cameraEnabled ? 'videocam-outline' : 'videocam-off-outline'} 
              size={26} 
              color="#fff" 
              fixedColor 
            />
          </TouchableOpacity>

          {/* Switch camera */}
          <TouchableOpacity
            style={styles.controlBtn}
            onPress={handleSwitchCamera}
            disabled={callStatus !== 'connected' || !cameraEnabled}
          >
            <AppIcon 
              name="camera-reverse-outline" 
              size={26} 
              color="#fff" 
              fixedColor 
            />
          </TouchableOpacity>

          {/* Hang up */}
          <TouchableOpacity 
            style={styles.hangUpBtn} 
            onPress={handleHangUp}
          >
            <AppIcon name="call" size={34} color="#fff" fixedColor />
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { 
    flex: 1, 
    backgroundColor: '#000',
  },

  remoteVideo: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },

  remoteVideoPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 0,
  },

  placeholderName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginTop: 16,
  },

  localVideoContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 20,
    right: 20,
    width: 120,
    height: 160,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    ...SHADOW.glow,
    zIndex: 10,
  },

  localVideo: {
    flex: 1,
  },

  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: 20,
    paddingHorizontal: 20,
    zIndex: 5,
  },

  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },

  statusText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
  },

  networkIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  callerName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },

  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
    paddingTop: 40,
    paddingHorizontal: 20,
    zIndex: 5,
  },

  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },

  controlBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOW.card,
  },

  controlBtnActive: {
    backgroundColor: 'rgba(255,255,255,0.1)',
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
});
