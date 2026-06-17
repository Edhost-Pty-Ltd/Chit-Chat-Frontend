// ─── Screen: Video Call ──────────────────────────────────────────────────────
// Layout:
//   • Full-screen main view (remote or local camera)
//   • PiP tiles stacked top-right — tap avatar to swap to main
//   • Vertical icon list right side (below PiPs):
//       camera-reverse  → flip camera (only active when local is main)
//       chatbubble      → open chat
//       person-add      → add participant
//   • Bottom bar: mute | speaker | audio-only | end
//   • No flip icon anywhere else — single source of truth
//   • Works identically on mobile + web
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, TouchableOpacity, StyleSheet, Dimensions,
  Platform, Modal, ScrollView, Pressable, Animated,
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

type NavProp = NativeStackNavigationProp<RootStackParamList, 'VideoCall'>;
type RouteP  = RouteProp<RootStackParamList, 'VideoCall'>;

const { height } = Dimensions.get('window');
const PIP_W = 100;
const PIP_H = 140;

interface Participant { id: string; contact: Contact; isLocal: boolean; }

const LOCAL_CONTACT: Contact = {
  id: -1, name: 'You', avatar: 'ME', color: COLORS.blue,
  status: 'online', lastMsg: '', time: '', unread: 0,
};

function CameraTile({ facing }: { facing: 'front' | 'back' }) {
  if (!CameraView) return <View style={[StyleSheet.absoluteFill, { backgroundColor: '#1a1a2e' }]} />;
  return <CameraView style={StyleSheet.absoluteFill} facing={facing} />;
}

// ─── PiP tile — tap the avatar/profile to swap to main ───────────────────────
function PipTile({
  participant: p, facing, canShowCamera, onTap,
}: {
  participant: Participant; facing: 'front' | 'back';
  canShowCamera: boolean; onTap: () => void;
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
      {/* Camera feed (local) or dark bg (remote) */}
      {p.isLocal && canShowCamera
        ? <CameraTile facing={facing} />
        : <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.55)' }]} />
      }

      {/* Full-tile touchable — tap to become main */}
      <TouchableOpacity style={styles.pipTouch} onPress={handleTap} activeOpacity={0.8}>
        {/* Remote: show avatar centred */}
        {!p.isLocal && (
          <View style={styles.pipAvatarWrap}>
            <Avatar initials={p.contact.avatar} color={p.contact.color} size={42} />
            <AppText fixedColor style={styles.pipNamePill} numberOfLines={1}>
              {p.contact.name}
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
  const navigation  = useNavigation<NavProp>();
  const route       = useRoute<RouteP>();
  const { contact, duration: initialDuration = 0, participants: initialParticipants } = route.params;

  const [permission, requestPermission] = useCameraPerms();
  const [muted,      setMuted]          = useState(false);
  const [speakerOn,  setSpeakerOn]      = useState(true);
  const [facing,     setFacing]         = useState<'front' | 'back'>('front');
  const [duration,   setDuration]       = useState(initialDuration);
  const [addOpen,    setAddOpen]        = useState(false);

  // Build initial participant list:
  // • If group members were passed, each becomes a remote PiP tile
  // • Otherwise just the single contact + local "You"
  const [participants, setParticipants] = useState<Participant[]>(() => {
    const remotes: Participant[] = initialParticipants && initialParticipants.length > 0
      ? initialParticipants.map((c) => ({ id: `remote-${c.id}`, contact: c, isLocal: false }))
      : [{ id: 'remote-0', contact, isLocal: false }];
    return [...remotes, { id: 'local', contact: LOCAL_CONTACT, isLocal: true }];
  });

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'web' && !permission?.granted) requestPermission();
    timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fmt = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  const swapToMain = useCallback((id: string) => {
    setParticipants((prev) => {
      const idx = prev.findIndex((p) => p.id === id);
      if (idx <= 0) return prev;
      const next = [...prev];
      [next[0], next[idx]] = [next[idx], next[0]];
      return next;
    });
  }, []);

  const flipCamera = useCallback(() =>
    setFacing((f) => (f === 'front' ? 'back' : 'front')), []);

  const addParticipant = (c: Contact) => {
    if (participants.some((p) => p.contact.id === c.id)) return;
    setParticipants((prev) => [...prev, { id: `remote-${c.id}`, contact: c, isLocal: false }]);
    setAddOpen(false);
  };

  const mainP   = participants[0];
  const pipList = participants.slice(1);
  const hangUp  = () => navigation.goBack();

  const switchToAudio = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    navigation.replace('AudioCall', { contact, duration, participants: participants.filter((p) => !p.isLocal).map((p) => p.contact) });
  };

  const openChat = () => navigation.navigate('Chat', { contact });

  const availableContacts = CONTACTS.filter(
    (c) => !participants.some((p) => p.contact.id === c.id),
  );
  const canShowCamera  = Platform.OS === 'web' || !!permission?.granted;
  const localIsMain    = mainP.isLocal; // camera icon only flips when your cam is main

  return (
    <View style={styles.root}>
      <AppBg />
      <View style={styles.darkOverlay} />

      {/* ── Main view ── */}
      <View style={styles.mainView}>
        {mainP.isLocal && canShowCamera
          ? <CameraTile facing={facing} />
          : <View style={[StyleSheet.absoluteFill, { backgroundColor: '#0a1a30' }]} />
        }
        {!mainP.isLocal && (
          <View style={styles.mainAvatarOverlay}>
            <Avatar initials={mainP.contact.avatar} color={mainP.contact.color} size={120} />
            <AppText fixedColor style={styles.mainName}>{mainP.contact.name}</AppText>
            <AppText fixedColor style={styles.mainSub}>In call · {fmt(duration)}</AppText>
          </View>
        )}
      </View>

      {/* ── Top bar (back only + timer) ── */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={hangUp} style={styles.backBtn}>
          <AppIcon name="chevron-back" size={26} color="rgba(255,255,255,0.80)" fixedColor />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <AppText fixedColor style={styles.topName}>{mainP.contact.name}</AppText>
          <AppText fixedColor style={styles.topStatus}>
            {fmt(duration)} · {participants.length} participant{participants.length !== 1 ? 's' : ''}
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
            facing={facing}
            canShowCamera={canShowCamera}
            onTap={() => swapToMain(p.id)}
          />
        ))}

        {/* Divider between PiPs and action icons */}
        <View style={styles.panelDivider} />

        {/* Camera flip — active (bright) when local is main; dim otherwise */}
        <TouchableOpacity
          style={[styles.sideBtn, localIsMain && styles.sideBtnActive]}
          onPress={flipCamera}
          activeOpacity={0.75}
        >
          <AppIcon name="camera-reverse-outline" size={22} color="#fff" fixedColor />
          <AppText fixedColor style={styles.sideBtnLabel}>
            {localIsMain ? (facing === 'front' ? 'Back' : 'Front') : 'Flip'}
          </AppText>
        </TouchableOpacity>

        {/* Chat */}
        <TouchableOpacity style={styles.sideBtn} onPress={openChat} activeOpacity={0.75}>
          <AppIcon name="chatbubble-outline" size={20} color="#fff" fixedColor />
          <AppText fixedColor style={styles.sideBtnLabel}>Chat</AppText>
        </TouchableOpacity>

        {/* Add person */}
        <TouchableOpacity style={styles.sideBtn} onPress={() => setAddOpen(true)} activeOpacity={0.75}>
          <AppIcon name="person-add-outline" size={20} color="#fff" fixedColor />
          <AppText fixedColor style={styles.sideBtnLabel}>Add</AppText>
        </TouchableOpacity>
      </View>

      {/* ── Bottom controls ── */}
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

        <View style={styles.controlCol}>
          <TouchableOpacity style={styles.controlBtn} onPress={switchToAudio}>
            <AppIcon name="call-outline" size={24} color="#fff" fixedColor />
          </TouchableOpacity>
          <AppText fixedColor style={styles.controlLabel}>Audio only</AppText>
        </View>

        <View style={styles.controlCol}>
          <TouchableOpacity style={styles.hangUpBtn} onPress={hangUp}>
            <AppIcon name="call" size={28} color="#fff" fixedColor />
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
                  onPress={() => addParticipant(c)} activeOpacity={0.8}>
                  <Avatar initials={c.avatar} color={c.color} size={46} status={c.status} />
                  <View style={styles.addContactMeta}>
                    <AppText fixedColor style={styles.addContactName}>{c.name}</AppText>
                    <AppText fixedColor style={styles.addContactSub}>
                      {c.status === 'online' ? 'Online' : 'Tap to add'}
                    </AppText>
                  </View>
                  <LinearGradient colors={GRADIENTS.primary} style={styles.addIconWrap}>
                    <AppIcon name="videocam-outline" size={18} color="#fff" fixedColor />
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

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root:        { flex: 1, backgroundColor: '#000' },
  darkOverlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.35)' },

  mainView:          { ...StyleSheet.absoluteFill },
  mainAvatarOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center', justifyContent: 'center', gap: 14,
  },
  mainName: { fontSize: 24, fontWeight: '700', color: '#fff' },
  mainSub:  { fontSize: 13, color: 'rgba(255,255,255,0.60)' },

  // Top bar — back button + name only, no action icons
  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center',
    paddingTop: Platform.OS === 'web' ? 16 : Platform.OS === 'ios' ? 54 : 36,
    paddingBottom: 12, paddingHorizontal: 12,
    backgroundColor: 'rgba(0,0,0,0.28)', gap: 10,
  },
  backBtn:   { padding: 6 },
  topName:   { fontSize: 15, fontWeight: '700', color: '#fff' },
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
    width: PIP_W, height: PIP_H,
    borderRadius: RADIUS.md, overflow: 'hidden',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.30)',
    ...SHADOW.glow,
  },
  pipTouch: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center', justifyContent: 'center',
  },
  pipAvatarWrap: { alignItems: 'center', gap: 5 },
  pipNamePill: {
    fontSize: 10, color: '#fff', fontWeight: '600',
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 7, paddingVertical: 2,
    borderRadius: RADIUS.full, overflow: 'hidden',
  },
  pipNameBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    textAlign: 'center', fontSize: 10, color: '#fff',
    backgroundColor: 'rgba(0,0,0,0.45)', paddingVertical: 3,
  },

  // Thin divider between PiPs and action icons
  panelDivider: {
    width: 36, height: 1,
    backgroundColor: 'rgba(255,255,255,0.20)',
    marginVertical: 2,
  },

  // Action icon buttons in vertical list
  sideBtn: {
    width: 48, height: 52,
    borderRadius: RADIUS.sm,
    backgroundColor: 'rgba(0,0,0,0.40)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
    gap: 3,
  },
  sideBtnActive: {
    backgroundColor: 'rgba(30,156,240,0.35)',
    borderColor: 'rgba(30,156,240,0.55)',
  },
  sideBtnLabel: {
    fontSize: 9, color: 'rgba(255,255,255,0.75)', fontWeight: '600',
  },

  controls: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end',
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    paddingTop: 16, paddingHorizontal: 8,
    backgroundColor: 'rgba(0,0,0,0.42)',
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
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
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
