// ─── Screen: Audio Call ──────────────────────────────────────────────────────
// Full-screen audio call UI with WebRTC integration
import React, { useState, useRef, useEffect } from 'react';
import {
  View, TouchableOpacity, StyleSheet, Alert, Platform,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { AppText, AppIcon } from '../context/ThemeContext';
import { Avatar } from '../components';
import { useCallContext } from '../context/CallContext';
import { useOutgoingCall } from '../hooks/useOutgoingCall';
import { useIncomingCallAnswer } from '../hooks/useIncomingCallAnswer';
import { useAudioRouting } from '../hooks/useAudioRouting';
import { COLORS, RADIUS, SHADOW } from '../types/theme';
import { RootStackParamList } from '../types';
import type { NetworkQuality } from '../hooks/useWebRTC';

type NavProp = NativeStackNavigationProp<RootStackParamList, 'AudioCall'>;
type RouteP  = RouteProp<RootStackParamList, 'AudioCall'>;

export default function AudioCallScreen() {
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RouteP>();
  const { callId, isOutgoing, otherParty } = route.params;

  const { callStatus, isMuted, isSpeakerOn, callDuration, setMuted, setSpeakerOn, incrementCallDuration } = useCallContext();
  const outgoingCall = useOutgoingCall();
  const incomingCallAnswer = useIncomingCallAnswer();
  const audioRouting = useAudioRouting();

  // Use the appropriate hook based on call direction
  const callManager = isOutgoing ? outgoingCall : incomingCallAnswer;

  const [onHold, setOnHold] = useState(false);
  const [networkQuality, setNetworkQuality] = useState<NetworkQuality>('unknown');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const callStartTimeRef = useRef<number>(0);

  // Initialize audio routing when screen mounts
  useEffect(() => {
    audioRouting.initializeAudioSession();
    
    return () => {
      audioRouting.cleanup();
    };
  }, []);

  // Update network quality from call manager
  useEffect(() => {
    if (callManager.networkQuality) {
      setNetworkQuality(callManager.networkQuality);
    }
  }, [callManager.networkQuality]);

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
      } else {
        // Normal end
        navigation.goBack();
      }
    }
  }, [callStatus, navigation]);

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  const getCallStatusText = () => {
    if (onHold) return '⏸ On hold';
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

  const handleSpeakerToggle = async () => {
    const newSpeakerState = !isSpeakerOn;
    setSpeakerOn(newSpeakerState);
    await audioRouting.toggleSpeaker();
    console.log('[AudioCallScreen] Speaker toggle:', newSpeakerState);
  };

  const handleHangUp = async () => {
    console.log('[AudioCallScreen] Hanging up...');
    
    // Calculate duration if call was connected
    const duration = callStatus === 'connected' 
      ? Math.floor((Date.now() - callStartTimeRef.current) / 1000)
      : 0;

    // End the call using the appropriate manager
    await callManager.endCall(duration);

    navigation.goBack();
  };

  const handleHold = () => {
    setOnHold((h) => !h);
    // TODO: Implement hold functionality
    console.log('[AudioCallScreen] Hold toggle:', !onHold);
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
    <LinearGradient
      colors={['#0a1628', '#0d2244', '#1a4a8a']}
      style={styles.root}
      start={{ x: 0.3, y: 0 }} end={{ x: 0.7, y: 1 }}
    >
      {/* Caller info */}
      <View style={styles.callerSection}>
        <View style={styles.avatarRing}>
          <Avatar 
            initials={getInitials(otherParty.displayName)} 
            color={COLORS.blue} 
            size={110} 
          />
        </View>
        <AppText fixedColor style={styles.callerName}>{otherParty.displayName}</AppText>
        <View style={styles.statusRow}>
          <AppText fixedColor style={styles.callStatus}>
            {getCallStatusText()}
          </AppText>
          {/* Network quality indicator */}
          {callStatus === 'connected' && networkIcon && (
            <View style={styles.networkIndicator}>
              <AppIcon 
                name={networkIcon.name as any} 
                size={16} 
                color={networkIcon.color} 
                fixedColor 
              />
            </View>
          )}
        </View>
      </View>

      {/* Controls grid */}
      <View style={styles.controlsGrid}>

        {/* Row 1 */}
        <View style={styles.controlRow}>
          <View style={styles.controlCol}>
            <TouchableOpacity
              style={[styles.controlBtn, isMuted && styles.controlBtnOn]}
              onPress={handleMuteToggle}
              disabled={callStatus !== 'connected'}
            >
              <AppIcon name={isMuted ? 'mic-off' : 'mic-outline'} size={26} color="#fff" fixedColor />
            </TouchableOpacity>
            <AppText fixedColor style={styles.controlLabel}>{isMuted ? 'Unmute' : 'Mute'}</AppText>
          </View>

          <View style={styles.controlCol}>
            <TouchableOpacity
              style={[styles.controlBtn, isSpeakerOn && styles.controlBtnOn]}
              onPress={handleSpeakerToggle}
              disabled={callStatus !== 'connected'}
            >
              <AppIcon name={isSpeakerOn ? 'volume-high-outline' : 'volume-mute-outline'} size={26} color="#fff" fixedColor />
            </TouchableOpacity>
            <AppText fixedColor style={styles.controlLabel}>Speaker</AppText>
          </View>

          <View style={styles.controlCol}>
            <TouchableOpacity
              style={[styles.controlBtn, onHold && styles.controlBtnOn]}
              onPress={handleHold}
              disabled={callStatus !== 'connected'}
            >
              <AppIcon name={onHold ? 'play-outline' : 'pause-outline'} size={26} color="#fff" fixedColor />
            </TouchableOpacity>
            <AppText fixedColor style={styles.controlLabel}>{onHold ? 'Resume' : 'Hold'}</AppText>
          </View>
        </View>

        {/* Row 2 */}
        <View style={styles.controlRow}>
          <View style={styles.controlCol}>
            <TouchableOpacity 
              style={[styles.controlBtn, styles.controlBtnDisabled]} 
              disabled
            >
              <AppIcon name="person-add-outline" size={26} color="rgba(255,255,255,0.4)" fixedColor />
            </TouchableOpacity>
            <AppText fixedColor style={styles.controlLabelDisabled}>Add</AppText>
          </View>

          <View style={styles.controlCol}>
            <TouchableOpacity 
              style={[styles.controlBtn, styles.controlBtnDisabled]} 
              disabled
            >
              <AppIcon name="videocam-outline" size={26} color="rgba(255,255,255,0.4)" fixedColor />
            </TouchableOpacity>
            <AppText fixedColor style={styles.controlLabelDisabled}>Video</AppText>
          </View>

          <View style={styles.controlCol}>
            <TouchableOpacity 
              style={[styles.controlBtn, styles.controlBtnDisabled]} 
              disabled
            >
              <AppIcon name="keypad-outline" size={26} color="rgba(255,255,255,0.4)" fixedColor />
            </TouchableOpacity>
            <AppText fixedColor style={styles.controlLabelDisabled}>Keypad</AppText>
          </View>
        </View>
      </View>

      {/* Hang up */}
      <View style={styles.hangUpRow}>
        <TouchableOpacity style={styles.hangUpBtn} onPress={handleHangUp}>
          <AppIcon name="call" size={34} color="#fff" fixedColor />
        </TouchableOpacity>
        <AppText fixedColor style={styles.hangUpLabel}>End call</AppText>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', paddingTop: 80 },

  callerSection: { alignItems: 'center', gap: 14, marginBottom: 60 },
  avatarRing: {
    padding: 6,
    borderRadius: 70,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.30)',
    ...SHADOW.glow,
  },
  callerName:  { fontSize: 28, fontWeight: '700', color: '#fff' },
  statusRow:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  callStatus:  { fontSize: 16, color: 'rgba(255,255,255,0.65)' },
  networkIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  controlsGrid: { width: '100%', paddingHorizontal: 24, gap: 24 },
  controlRow:   { flexDirection: 'row', justifyContent: 'space-around' },
  controlCol:   { alignItems: 'center', gap: 8, width: 80 },
  controlLabel: { fontSize: 12, color: 'rgba(255,255,255,0.70)' },
  controlLabelDisabled: { fontSize: 12, color: 'rgba(255,255,255,0.40)' },
  controlBtn: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center', justifyContent: 'center',
    ...SHADOW.card,
  },
  controlBtnOn: { backgroundColor: 'rgba(255,255,255,0.35)' },
  controlBtnDisabled: { opacity: 0.5 },

  hangUpRow: { position: 'absolute', bottom: Platform.OS === 'ios' ? 60 : 44, alignItems: 'center', gap: 10 },
  hangUpBtn: {
    width: 76, height: 76, borderRadius: 38,
    backgroundColor: '#e84343',
    alignItems: 'center', justifyContent: 'center',
    transform: [{ rotate: '135deg' }],
    ...SHADOW.button,
  },
  hangUpLabel: { fontSize: 13, color: 'rgba(255,255,255,0.70)' },
});
