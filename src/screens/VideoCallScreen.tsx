// ─── Screen: Video Call ──────────────────────────────────────────────────────
// Features:
//   • Tap any participant tile to swap them to the main (large) view
//   • Add person button opens contact picker and adds them to the call
//   • Switch camera, mute, speaker, switch to audio call, hang up
import React, { useState, useEffect, useRef } from 'react';
import {
  View, TouchableOpacity, StyleSheet, Dimensions,
  Platform, Modal, ScrollView, Pressable,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { AppText, AppIcon } from '../context/ThemeContext';
import { Avatar } from '../components';
import { COLORS, RADIUS, SHADOW, GRADIENTS, GLASS } from '../types/theme';
import { RootStackParamList, Contact } from '../types';
import { CONTACTS } from '../data/mockData';

type NavProp = NativeStackNavigationProp<RootStackParamList, 'VideoCall'>;
type RouteP  = RouteProp<RootStackParamList, 'VideoCall'>;

const { width, height } = Dimensions.get('window');
const PIP_W = 110;
const PIP_H = 150;

// ─── Participant type ─────────────────────────────────────────────────────────
interface Participant {
  id: string;
  contact: Contact;
  isLocal?: boolean;
}

export default function VideoCallScreen() {
  const navigation = useNavigation<NavProp>();
  const route      = useRoute<RouteP>();
  const { contact } = route.params;

  const [permission, requestPermission] = useCameraPermissions();
  const [muted,      setMuted]      = useState(false);
  const [speakerOn,  setSpeakerOn]  = useState(true);
  const [facing,     setFacing]     = useState<'front' | 'back'>('front');
  const [duration,   setDuration]   = useState(0);
  const [addOpen,    setAddOpen]    = useState(false);

  // All participants — first entry is always the "main" (large) view
  // 'local' id represents the device's own camera
  const [participants, setParticipants] = useState<Participant[]>([
    { id: 'remote-0', contact },
    { id: 'local',    contact: { id: -1, name: 'You', avatar: 'ME', color: COLORS.blue, status: 'online', lastMsg: '', time: '', unread: 0 }, isLocal: true },
  ]);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!permission?.granted) requestPermission();
    timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  // Swap tapped participant to index 0 (main view)
  const swapToMain = (id: string) => {
    setParticipants((prev) => {
      const idx = prev.findIndex((p) => p.id === id);
      if (idx <= 0) return prev;
      const next = [...prev];
      [next[0], next[idx]] = [next[idx], next[0]];
      return next;
    });
  };

  // Add contact to call
  const addContact = (c: Contact) => {
    const alreadyIn = participants.some((p) => p.contact.id === c.id);
    if (alreadyIn) return;
    setParticipants((prev) => [
      ...prev,
      { id: `remote-${c.id}`, contact: c },
    ]);
    setAddOpen(false);
  };

  const mainParticipant = participants[0];
  const pipParticipants = participants.slice(1);

  const hangUp = () => navigation.goBack();
  const switchToAudio = () => navigation.replace('AudioCall', { contact });

  // Contacts not already in call
  const availableContacts = CONTACTS.filter((c) => !participants.some((p) => p.contact.id === c.id));

  return (
    <View style={styles.root}>
      {/* ── Main view — large tile ── */}
      <View style={styles.mainView}>
        {mainParticipant.isLocal && permission?.granted && Platform.OS !== 'web' ? (
          <CameraView style={StyleSheet.absoluteFill} facing={facing} />
        ) : (
          <LinearGradient colors={['#0a1628', '#0d2040', '#1a3a6e']} style={StyleSheet.absoluteFill} />
        )}
        {/* Remote avatar overlay when camera unavailable */}
        {!mainParticipant.isLocal && (
          <View style={styles.mainAvatarOverlay}>
            <Avatar initials={mainParticipant.contact.avatar} color={mainParticipant.contact.color} size={100} />
            <AppText fixedColor style={styles.mainName}>{mainParticipant.contact.name}</AppText>
          </View>
        )}
      </View>

      {/* ── Top bar ── */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={hangUp} style={styles.backBtn}>
          <AppIcon name="chevron-back" size={26} color="rgba(255,255,255,0.80)" fixedColor />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <AppText fixedColor style={styles.topName}>{mainParticipant.contact.name}</AppText>
          <AppText fixedColor style={styles.topStatus}>
            Video · {fmt(duration)} · {participants.length} participants
          </AppText>
        </View>
        {/* Add person — top right */}
        <TouchableOpacity onPress={() => setAddOpen(true)} style={styles.addBtn}>
          <AppIcon name="person-add-outline" size={22} color="#fff" fixedColor />
        </TouchableOpacity>
      </View>

      {/* ── PiP tiles — tap any to swap to main ── */}
      <View style={styles.pipStack}>
        {pipParticipants.map((p) => (
          <TouchableOpacity
            key={p.id}
            style={styles.pipTile}
            onPress={() => swapToMain(p.id)}
            activeOpacity={0.85}
          >
            {p.isLocal && permission?.granted && Platform.OS !== 'web' ? (
              <CameraView style={StyleSheet.absoluteFill} facing={facing} />
            ) : (
              <LinearGradient colors={['#0d2040', '#1a3a6e']} style={StyleSheet.absoluteFill} />
            )}
            {!p.isLocal && (
              <View style={styles.pipAvatarOverlay}>
                <Avatar initials={p.contact.avatar} color={p.contact.color} size={34} />
              </View>
            )}
            {/* Tap-to-swap hint */}
            <View style={styles.swapHint}>
              <AppIcon name="swap-horizontal-outline" size={14} color="rgba(255,255,255,0.70)" fixedColor />
            </View>
            <AppText fixedColor style={styles.pipName} numberOfLines={1}>{p.contact.name}</AppText>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Bottom controls ── */}
      <View style={styles.controls}>
        {/* Mute */}
        <View style={styles.controlCol}>
          <TouchableOpacity style={[styles.controlBtn, muted && styles.controlBtnOn]} onPress={() => setMuted((m) => !m)}>
            <AppIcon name={muted ? 'mic-off' : 'mic-outline'} size={24} color="#fff" fixedColor />
          </TouchableOpacity>
          <AppText fixedColor style={styles.controlLabel}>{muted ? 'Unmute' : 'Mute'}</AppText>
        </View>

        {/* Flip camera */}
        <View style={styles.controlCol}>
          <TouchableOpacity style={styles.controlBtn} onPress={() => setFacing((f) => f === 'front' ? 'back' : 'front')}>
            <AppIcon name="camera-reverse-outline" size={24} color="#fff" fixedColor />
          </TouchableOpacity>
          <AppText fixedColor style={styles.controlLabel}>Flip</AppText>
        </View>

        {/* Speaker */}
        <View style={styles.controlCol}>
          <TouchableOpacity style={[styles.controlBtn, speakerOn && styles.controlBtnOn]} onPress={() => setSpeakerOn((s) => !s)}>
            <AppIcon name={speakerOn ? 'volume-high-outline' : 'volume-mute-outline'} size={24} color="#fff" fixedColor />
          </TouchableOpacity>
          <AppText fixedColor style={styles.controlLabel}>Speaker</AppText>
        </View>

        {/* Switch to audio */}
        <View style={styles.controlCol}>
          <TouchableOpacity style={styles.controlBtn} onPress={switchToAudio}>
            <AppIcon name="call-outline" size={24} color="#fff" fixedColor />
          </TouchableOpacity>
          <AppText fixedColor style={styles.controlLabel}>Audio</AppText>
        </View>

        {/* Hang up */}
        <View style={styles.controlCol}>
          <TouchableOpacity style={styles.hangUpBtn} onPress={hangUp}>
            <AppIcon name="call" size={28} color="#fff" fixedColor />
          </TouchableOpacity>
          <AppText fixedColor style={styles.controlLabel}>End</AppText>
        </View>
      </View>

      {/* ── Add person modal ── */}
      <Modal visible={addOpen} transparent animationType="slide" onRequestClose={() => setAddOpen(false)}>
        <Pressable style={styles.addOverlay} onPress={() => setAddOpen(false)} />
        <View style={styles.addSheet}>
          <View style={styles.addHandle} />
          <AppText fixedColor style={styles.addTitle}>Add to call</AppText>
          {availableContacts.length === 0 ? (
            <AppText fixedColor style={styles.addEmpty}>All contacts are already in the call.</AppText>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false}>
              {availableContacts.map((c) => (
                <TouchableOpacity key={c.id} style={styles.addContactRow} onPress={() => addContact(c)} activeOpacity={0.8}>
                  <Avatar initials={c.avatar} color={c.color} size={46} status={c.status} />
                  <View style={styles.addContactMeta}>
                    <AppText fixedColor style={styles.addContactName}>{c.name}</AppText>
                    <AppText fixedColor style={styles.addContactSub}>{c.status === 'online' ? 'Online' : 'Tap to add'}</AppText>
                  </View>
                  <View style={styles.addIconWrap}>
                    <AppIcon name="videocam-outline" size={20} color={COLORS.blue} fixedColor />
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },

  // Main tile fills the whole screen
  mainView: { ...StyleSheet.absoluteFillObject },
  mainAvatarOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'center', gap: 14,
  },
  mainName: { fontSize: 22, fontWeight: '700', color: '#fff' },

  // Top bar
  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center',
    paddingTop: 52, paddingBottom: 14, paddingHorizontal: 16,
    backgroundColor: 'rgba(0,0,0,0.35)', gap: 12,
  },
  backBtn:  { padding: 4 },
  topName:  { fontSize: 16, fontWeight: '700', color: '#fff' },
  topStatus:{ fontSize: 12, color: 'rgba(255,255,255,0.65)', marginTop: 2 },
  addBtn:   { padding: 8, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.18)' },

  // PiP column on the right
  pipStack: {
    position: 'absolute',
    top: 120, right: 12,
    gap: 10,
  },
  pipTile: {
    width: PIP_W, height: PIP_H,
    borderRadius: 14, overflow: 'hidden',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.35)',
    ...SHADOW.glow,
  },
  pipAvatarOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'center',
  },
  swapHint: {
    position: 'absolute', top: 6, right: 6,
    backgroundColor: 'rgba(0,0,0,0.40)', borderRadius: 8,
    padding: 3,
  },
  pipName: {
    position: 'absolute', bottom: 5, left: 0, right: 0,
    textAlign: 'center', fontSize: 10, color: '#fff',
    backgroundColor: 'rgba(0,0,0,0.40)',
    paddingVertical: 2,
  },

  // Bottom controls
  controls: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end',
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    paddingTop: 16, paddingHorizontal: 8,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  controlCol:   { alignItems: 'center', gap: 6 },
  controlLabel: { fontSize: 10, color: 'rgba(255,255,255,0.70)' },
  controlBtn: {
    width: 54, height: 54, borderRadius: 27,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center', justifyContent: 'center',
    ...SHADOW.card,
  },
  controlBtnOn: { backgroundColor: 'rgba(255,255,255,0.35)' },
  hangUpBtn: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: '#e84343',
    alignItems: 'center', justifyContent: 'center',
    transform: [{ rotate: '135deg' }],
    ...SHADOW.button,
  },

  // Add person modal
  addOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.50)' },
  addSheet: {
    backgroundColor: '#0d2040',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: height * 0.65,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
    paddingHorizontal: 16, paddingTop: 12,
    ...SHADOW.glow,
  },
  addHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignSelf: 'center', marginBottom: 14,
  },
  addTitle: { fontSize: 17, fontWeight: '700', color: '#fff', marginBottom: 14 },
  addEmpty: { fontSize: 14, color: 'rgba(255,255,255,0.55)', textAlign: 'center', paddingVertical: 24 },
  addContactRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 12, paddingHorizontal: 4,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  addContactMeta: { flex: 1 },
  addContactName: { fontSize: 15, fontWeight: '600', color: '#fff' },
  addContactSub:  { fontSize: 12, color: 'rgba(255,255,255,0.55)', marginTop: 2 },
  addIconWrap: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(30,156,240,0.20)',
    borderWidth: 1, borderColor: 'rgba(30,156,240,0.35)',
    alignItems: 'center', justifyContent: 'center',
  },
});
