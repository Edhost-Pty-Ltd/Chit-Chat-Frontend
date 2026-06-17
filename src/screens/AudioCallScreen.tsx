// ─── Screen: Audio Call ──────────────────────────────────────────────────────
// • Duration preserved when switching to/from VideoCall
// • Chat button → opens conversation without ending call
// • Switch to video → VideoCallScreen with same duration (call continues)
// • Camera toggle shows local PiP (works on mobile + web)
import React, { useState, useRef, useEffect } from 'react';
import {
  View, TouchableOpacity, StyleSheet, Dimensions,
  Platform, Modal, ScrollView, Pressable,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';

let CameraView: any = null;
let useCameraPermissions: (() => [any, () => Promise<any>]) | null = null;
try {
  const cam = require('expo-camera');
  CameraView = cam.CameraView;
  useCameraPermissions = cam.useCameraPermissions;
} catch { /* Expo Go */ }

function useCameraPerms(): [any, () => Promise<any>] {
  if (useCameraPermissions) return useCameraPermissions(); // eslint-disable-line react-hooks/rules-of-hooks
  return [null, async () => ({ granted: false })];
}

import { AppText, AppIcon, AppBg } from '../context/ThemeContext';
import { Avatar } from '../components';
import { COLORS, RADIUS, SHADOW, GRADIENTS } from '../types/theme';
import { RootStackParamList, Contact } from '../types';
import { CONTACTS } from '../data/mockData';

type NavProp = NativeStackNavigationProp<RootStackParamList, 'AudioCall'>;
type RouteP  = RouteProp<RootStackParamList, 'AudioCall'>;

const { height } = Dimensions.get('window');
const PIP_W = 110;
const PIP_H = 150;

function CameraTile({ facing }: { facing: 'front' | 'back' }) {
  if (!CameraView) return <View style={[StyleSheet.absoluteFill, { backgroundColor: '#1a1a2e' }]} />;
  return <CameraView style={StyleSheet.absoluteFill} facing={facing} />;
}

export default function AudioCallScreen() {
  const navigation = useNavigation<NavProp>();
  const route      = useRoute<RouteP>();
  const { contact, duration: initialDuration = 0, participants: initialParticipants } = route.params;

  const [permission, requestPermission] = useCameraPerms();
  const [muted,        setMuted]        = useState(false);
  const [speakerOn,    setSpeakerOn]    = useState(false);
  const [duration,     setDuration]     = useState(initialDuration);
  const [addOpen,      setAddOpen]      = useState(false);
  const [showCamera,   setShowCamera]   = useState(false);
  const [facing,       setFacing]       = useState<'front' | 'back'>('front');
  // Start with group members if provided, otherwise just the single contact
  const [participants, setParticipants] = useState<Contact[]>(
    initialParticipants && initialParticipants.length > 0 ? initialParticipants : [contact]
  );

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'web' && !permission?.granted) requestPermission();
    timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fmt = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  const hangUp      = () => navigation.goBack();
  const openChat    = () => navigation.navigate('Chat', { contact });
  const canShowCam  = Platform.OS === 'web' || !!permission?.granted;

  // Switch to video — stop local timer, pass current duration
  const switchToVideo = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    navigation.replace('VideoCall', { contact, duration, participants });
  };

  const addContact = (c: Contact) => {
    if (participants.some((p) => p.id === c.id)) return;
    setParticipants((prev) => [...prev, c]);
    setAddOpen(false);
  };

  const availableContacts = CONTACTS.filter((c) => !participants.some((p) => p.id === c.id));

  return (
    <View style={styles.root}>
      <AppBg />
      <View style={styles.overlay} />

      {/* ── Main area ── */}
      <View style={styles.mainArea}>
        <View style={styles.avatarRing}>
          <Avatar initials={contact.avatar} color={contact.color} size={110} />
        </View>
        <AppText fixedColor style={styles.callerName}>{contact.name}</AppText>
        <AppText fixedColor style={styles.callStatus}>Audio call · {fmt(duration)}</AppText>
        {participants.length > 1 && (
          <View style={styles.extraRow}>
            {participants.slice(1).map((p) => (
              <Avatar key={p.id} initials={p.avatar} color={p.color} size={36} />
            ))}
            <AppText fixedColor style={styles.extraLabel}>
              +{participants.length - 1} on call
            </AppText>
          </View>
        )}
      </View>

      {/* ── Top bar ── */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={hangUp} style={styles.iconBtn}>
          <AppIcon name="chevron-back" size={26} color="rgba(255,255,255,0.80)" fixedColor />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <AppText fixedColor style={styles.topName}>{contact.name}</AppText>
          <AppText fixedColor style={styles.topStatus}>
            {fmt(duration)} · {participants.length} participant{participants.length > 1 ? 's' : ''}
          </AppText>
        </View>

        {/* Chat button */}
        <TouchableOpacity style={styles.iconBtn} onPress={openChat}>
          <AppIcon name="chatbubble-outline" size={20} color="#fff" fixedColor />
        </TouchableOpacity>

        {/* Switch to video */}
        <TouchableOpacity style={[styles.iconBtn, styles.iconBtnGlass]} onPress={switchToVideo}>
          <AppIcon name="videocam-outline" size={22} color="#fff" fixedColor />
        </TouchableOpacity>

        {/* Add person */}
        <TouchableOpacity style={[styles.iconBtn, styles.iconBtnGlass]}
          onPress={() => setAddOpen(true)}>
          <AppIcon name="person-add-outline" size={20} color="#fff" fixedColor />
        </TouchableOpacity>
      </View>

      {/* ── Local camera PiP ── */}
      {showCamera && canShowCam && (
        <View style={styles.pipTile}>
          <CameraTile facing={facing} />
          {/* Flip icon top-right */}
          <TouchableOpacity style={styles.pipFlipBtn}
            onPress={() => setFacing((f) => f === 'front' ? 'back' : 'front')}
            activeOpacity={0.8}>
            <AppIcon name="camera-reverse-outline" size={18} color="#fff" fixedColor />
          </TouchableOpacity>
          <AppText fixedColor style={styles.pipName}>You</AppText>
        </View>
      )}

      {/* ── Controls ── */}
      <View style={styles.controls}>
        <View style={styles.controlCol}>
          <TouchableOpacity style={[styles.controlBtn, muted && styles.controlBtnActive]}
            onPress={() => setMuted((m) => !m)}>
            <AppIcon name={muted ? 'mic-off' : 'mic-outline'} size={24} color="#fff" fixedColor />
          </TouchableOpacity>
          <AppText fixedColor style={styles.controlLabel}>{muted ? 'Unmute' : 'Mute'}</AppText>
        </View>

        <View style={styles.controlCol}>
          <TouchableOpacity style={[styles.controlBtn, speakerOn && styles.controlBtnActive]}
            onPress={() => setSpeakerOn((s) => !s)}>
            <AppIcon name={speakerOn ? 'volume-high-outline' : 'volume-mute-outline'} size={24} color="#fff" fixedColor />
          </TouchableOpacity>
          <AppText fixedColor style={styles.controlLabel}>Speaker</AppText>
        </View>

        {/* Camera toggle */}
        <View style={styles.controlCol}>
          <TouchableOpacity
            style={[styles.controlBtn, showCamera && styles.controlBtnActive]}
            onPress={() => {
              if (!canShowCam && Platform.OS !== 'web') { requestPermission(); return; }
              setShowCamera((c) => !c);
            }}>
            <AppIcon name="camera-outline" size={24} color="#fff" fixedColor />
          </TouchableOpacity>
          <AppText fixedColor style={styles.controlLabel}>Camera</AppText>
        </View>

        <View style={styles.controlCol}>
          <TouchableOpacity style={styles.hangUpBtn} onPress={hangUp}>
            <AppIcon name="call" size={26} color="#fff" fixedColor />
          </TouchableOpacity>
          <AppText fixedColor style={styles.controlLabel}>End</AppText>
        </View>
      </View>

      {/* ── Add person modal ── */}
      <Modal visible={addOpen} transparent animationType="slide"
        onRequestClose={() => setAddOpen(false)}>
        <Pressable style={styles.addOverlay} onPress={() => setAddOpen(false)} />
        <View style={styles.addSheet}>
          <View style={styles.addHandle} />
          <AppText fixedColor style={styles.addTitle}>Add to call</AppText>
          {availableContacts.length === 0 ? (
            <AppText fixedColor style={styles.addEmpty}>All contacts are already in the call.</AppText>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false}>
              {availableContacts.map((c) => (
                <TouchableOpacity key={c.id} style={styles.addContactRow}
                  onPress={() => addContact(c)} activeOpacity={0.8}>
                  <Avatar initials={c.avatar} color={c.color} size={46} status={c.status} />
                  <View style={styles.addContactMeta}>
                    <AppText fixedColor style={styles.addContactName}>{c.name}</AppText>
                    <AppText fixedColor style={styles.addContactSub}>
                      {c.status === 'online' ? 'Online' : 'Tap to add'}
                    </AppText>
                  </View>
                  <LinearGradient colors={GRADIENTS.primary} style={styles.addIconWrap}>
                    <AppIcon name="call-outline" size={18} color="#fff" fixedColor />
                  </LinearGradient>
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
  root:    { flex: 1 },
  overlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.55)' },

  mainArea: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center', justifyContent: 'center', gap: 14,
  },
  avatarRing: {
    padding: 6, borderRadius: 68,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.30)',
    ...SHADOW.glow,
  },
  callerName: { fontSize: 26, fontWeight: '700', color: '#fff' },
  callStatus: { fontSize: 15, color: 'rgba(255,255,255,0.65)' },
  extraRow:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  extraLabel: { fontSize: 13, color: 'rgba(255,255,255,0.65)' },

  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 54 : 36,
    paddingBottom: 12, paddingHorizontal: 12,
    backgroundColor: 'rgba(0,0,0,0.30)', gap: 6,
  },
  iconBtn:      { padding: 8 },
  iconBtnGlass: {
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
  },
  topName:   { fontSize: 15, fontWeight: '700', color: '#fff' },
  topStatus: { fontSize: 11, color: 'rgba(255,255,255,0.65)', marginTop: 2 },

  pipTile: {
    position: 'absolute', top: 120, right: 12,
    width: PIP_W, height: PIP_H,
    borderRadius: RADIUS.md, overflow: 'hidden',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.35)',
    ...SHADOW.glow,
  },
  pipFlipBtn: {
    position: 'absolute', top: 6, right: 6,
    backgroundColor: 'rgba(0,0,0,0.50)',
    borderRadius: RADIUS.sm, padding: 5,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
  },
  pipName: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    textAlign: 'center', fontSize: 10, color: '#fff',
    backgroundColor: 'rgba(0,0,0,0.45)', paddingVertical: 3,
  },

  controls: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end',
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    paddingTop: 16, paddingHorizontal: 4,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  controlCol:       { alignItems: 'center', gap: 6 },
  controlLabel:     { fontSize: 10, color: 'rgba(255,255,255,0.70)' },
  controlBtn: {
    width: 54, height: 54, borderRadius: 27,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center', justifyContent: 'center',
    ...SHADOW.card,
  },
  controlBtnActive: { backgroundColor: 'rgba(255,255,255,0.35)' },
  hangUpBtn: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: '#e84343',
    alignItems: 'center', justifyContent: 'center',
    transform: [{ rotate: '135deg' }],
    ...SHADOW.button,
  },

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
    paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  addContactMeta: { flex: 1 },
  addContactName: { fontSize: 15, fontWeight: '600', color: '#fff' },
  addContactSub:  { fontSize: 12, color: 'rgba(255,255,255,0.55)', marginTop: 2 },
  addIconWrap: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    ...SHADOW.button,
  },
});
