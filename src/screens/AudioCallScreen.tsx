// ─── Screen: Audio Call ──────────────────────────────────────────────────────
// Full-screen audio call UI with mute, speaker, add person,
// switch to video, and hang up.
import React, { useState, useRef, useEffect } from 'react';
import {
  View, TouchableOpacity, StyleSheet, Alert, Platform,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { AppText, AppIcon } from '../context/ThemeContext';
import { Avatar } from '../components';
import { COLORS, RADIUS, SHADOW, GRADIENTS } from '../types/theme';
import { RootStackParamList } from '../types';

type NavProp = NativeStackNavigationProp<RootStackParamList, 'AudioCall'>;
type RouteP  = RouteProp<RootStackParamList, 'AudioCall'>;

export default function AudioCallScreen() {
  const navigation = useNavigation<NavProp>();
  const route      = useRoute<RouteP>();
  const { contact } = route.params;

  const [muted,        setMuted]        = useState(false);
  const [speakerOn,    setSpeakerOn]    = useState(false);
  const [onHold,       setOnHold]       = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    timerRef.current = setInterval(() => setCallDuration((d) => d + 1), 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  const hangUp = () => navigation.goBack();

  const switchToVideo = () => navigation.replace('VideoCall', { contact });

  const addPerson = () => {
    Alert.alert('Add person', 'This would open a contact picker to add someone to the call.');
  };

  return (
    <LinearGradient
      colors={['#0a1628', '#0d2244', '#1a4a8a']}
      style={styles.root}
      start={{ x: 0.3, y: 0 }} end={{ x: 0.7, y: 1 }}
    >
      {/* Caller info */}
      <View style={styles.callerSection}>
        <View style={styles.avatarRing}>
          <Avatar initials={contact.avatar} color={contact.color} size={110} />
        </View>
        <AppText fixedColor style={styles.callerName}>{contact.name}</AppText>
        <AppText fixedColor style={styles.callStatus}>
          {onHold ? '⏸ On hold' : formatDuration(callDuration)}
        </AppText>
      </View>

      {/* Controls grid */}
      <View style={styles.controlsGrid}>

        {/* Row 1 */}
        <View style={styles.controlRow}>
          <View style={styles.controlCol}>
            <TouchableOpacity
              style={[styles.controlBtn, muted && styles.controlBtnOn]}
              onPress={() => setMuted((m) => !m)}
            >
              <AppIcon name={muted ? 'mic-off' : 'mic-outline'} size={26} color="#fff" fixedColor />
            </TouchableOpacity>
            <AppText fixedColor style={styles.controlLabel}>{muted ? 'Unmute' : 'Mute'}</AppText>
          </View>

          <View style={styles.controlCol}>
            <TouchableOpacity
              style={[styles.controlBtn, speakerOn && styles.controlBtnOn]}
              onPress={() => setSpeakerOn((s) => !s)}
            >
              <AppIcon name={speakerOn ? 'volume-high-outline' : 'volume-mute-outline'} size={26} color="#fff" fixedColor />
            </TouchableOpacity>
            <AppText fixedColor style={styles.controlLabel}>Speaker</AppText>
          </View>

          <View style={styles.controlCol}>
            <TouchableOpacity
              style={[styles.controlBtn, onHold && styles.controlBtnOn]}
              onPress={() => setOnHold((h) => !h)}
            >
              <AppIcon name={onHold ? 'play-outline' : 'pause-outline'} size={26} color="#fff" fixedColor />
            </TouchableOpacity>
            <AppText fixedColor style={styles.controlLabel}>{onHold ? 'Resume' : 'Hold'}</AppText>
          </View>
        </View>

        {/* Row 2 */}
        <View style={styles.controlRow}>
          <View style={styles.controlCol}>
            <TouchableOpacity style={styles.controlBtn} onPress={addPerson}>
              <AppIcon name="person-add-outline" size={26} color="#fff" fixedColor />
            </TouchableOpacity>
            <AppText fixedColor style={styles.controlLabel}>Add</AppText>
          </View>

          <View style={styles.controlCol}>
            <TouchableOpacity style={styles.controlBtn} onPress={switchToVideo}>
              <AppIcon name="videocam-outline" size={26} color="#fff" fixedColor />
            </TouchableOpacity>
            <AppText fixedColor style={styles.controlLabel}>Video</AppText>
          </View>

          <View style={styles.controlCol}>
            <TouchableOpacity style={styles.controlBtn}>
              <AppIcon name="keypad-outline" size={26} color="#fff" fixedColor />
            </TouchableOpacity>
            <AppText fixedColor style={styles.controlLabel}>Keypad</AppText>
          </View>
        </View>
      </View>

      {/* Hang up */}
      <View style={styles.hangUpRow}>
        <TouchableOpacity style={styles.hangUpBtn} onPress={hangUp}>
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
  callStatus:  { fontSize: 16, color: 'rgba(255,255,255,0.65)' },

  controlsGrid: { width: '100%', paddingHorizontal: 24, gap: 24 },
  controlRow:   { flexDirection: 'row', justifyContent: 'space-around' },
  controlCol:   { alignItems: 'center', gap: 8, width: 80 },
  controlLabel: { fontSize: 12, color: 'rgba(255,255,255,0.70)' },
  controlBtn: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center', justifyContent: 'center',
    ...SHADOW.card,
  },
  controlBtnOn: { backgroundColor: 'rgba(255,255,255,0.35)' },

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
