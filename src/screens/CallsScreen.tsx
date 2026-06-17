// ─── Screen: Calls ───────────────────────────────────────────────────────────
import React, { useState } from 'react';
import {
  View, FlatList, TouchableOpacity, StyleSheet,
  Modal, Pressable, ScrollView, Linking, Alert, Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { Avatar, BottomNav } from '../components';
import { CALLS, CONTACTS } from '../data/mockData';
import { COLORS, RADIUS, SHADOW, GRADIENTS, GLASS } from '../types/theme';
import { Call, Contact, RootStackParamList } from '../types';
import { AppBg, AppText, AppIcon, useForeground, useTypography } from '../context/ThemeContext';

type NavProp = NativeStackNavigationProp<RootStackParamList>;
type CallTab = 'All' | 'Missed' | 'Voicemail';

const PHONE_NUMBERS: Record<string, string> = {
  'Anna Martin':  '+27 71 234 5678',
  'Kevin Patel':  '+27 82 345 6789',
  'Sophie Lee':   '+27 61 456 7890',
  'Team Office':  '+27 11 567 8901',
  'Liam Johnson': '+27 73 678 9012',
  'Family Group': '+27 83 789 0123',
  'Design Team':  '+27 64 890 1234',
};

function CallDirectionIcon({ type, missed }: { type: string; missed?: boolean }) {
  if (missed)              return <AppIcon name="call"              size={13} color={COLORS.missed} fixedColor />;
  if (type === 'Outgoing') return <AppIcon name="arrow-up-outline"  size={13} color={COLORS.green}  fixedColor />;
  return                          <AppIcon name="arrow-down-outline" size={13} color={COLORS.blue}   fixedColor />;
}

// ─── Contact Picker Sheet ────────────────────────────────────────────────────
function ContactPickerSheet({ visible, onClose, onAudioCall, onVideoCall }: {
  visible: boolean; onClose: () => void;
  onAudioCall: (c: Contact) => void; onVideoCall: (c: Contact) => void;
}) {
  const { FG } = useForeground();
  const { fontFamily, textColor } = useTypography();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.overlay} onPress={onClose} />
      <View style={styles.sheet}>
        <AppBg />
        <View style={styles.handle} />
        <View style={styles.sheetHeader}>
          <TouchableOpacity onPress={onClose} style={styles.iconPad}>
            <AppIcon name="close" size={22} color={FG.secondary} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <AppText style={[styles.sheetTitle, { color: textColor, fontFamily }]}>Call a contact</AppText>
            <AppText style={[styles.sheetSub, { color: FG.secondary }]}>{CONTACTS.length} contacts</AppText>
          </View>
        </View>
        <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
          {CONTACTS.map((c) => (
            <View key={c.id} style={[styles.contactCard, { backgroundColor: FG.glassBg, borderColor: FG.glassBorder }]}>
              <Avatar initials={c.avatar} color={c.color} size={46} status={c.status} />
              <View style={styles.contactMeta}>
                <AppText style={[styles.contactName, { color: textColor, fontFamily }]}>{c.name}</AppText>
                <AppText style={[styles.contactNum, { color: FG.secondary }]}>{PHONE_NUMBERS[c.name] ?? 'No number'}</AppText>
              </View>
              {/* Audio call button */}
              <TouchableOpacity onPress={() => onAudioCall(c)} activeOpacity={0.85}>
                <LinearGradient colors={GRADIENTS.primary} style={styles.callActionBtn}>
                  <AppIcon name="call" size={16} color="#fff" fixedColor />
                </LinearGradient>
              </TouchableOpacity>
              {/* Video call button */}
              <TouchableOpacity onPress={() => onVideoCall(c)} activeOpacity={0.85}>
                <LinearGradient colors={GRADIENTS.primary} style={styles.callActionBtn}>
                  <AppIcon name="videocam" size={16} color="#fff" fixedColor />
                </LinearGradient>
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── Call Info Sheet ─────────────────────────────────────────────────────────
function CallInfoSheet({ call, visible, onClose, onAudioCall, onVideoCall, onMessage }: {
  call: Call | null; visible: boolean; onClose: () => void;
  onAudioCall: () => void; onVideoCall: () => void; onMessage: () => void;
}) {
  const { FG } = useForeground();
  const { fontFamily, textColor } = useTypography();
  if (!call) return null;

  const number = PHONE_NUMBERS[call.name];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.overlay} onPress={onClose} />
      <View style={styles.sheet}>
        <AppBg />
        <View style={styles.handle} />

        {/* Contact info */}
        <View style={styles.infoHeader}>
          <Avatar initials={call.avatar} color={call.color} size={64} />
          <View style={styles.infoMeta}>
            <AppText style={[styles.infoName, { color: textColor, fontFamily }]}>{call.name}</AppText>
            <AppText style={[styles.infoNum, { color: FG.secondary }]}>{number ?? 'No number saved'}</AppText>
          </View>
        </View>

        {/* Call details card */}
        <View style={[styles.detailCard, { backgroundColor: FG.glassBg, borderColor: FG.glassBorder }]}>
          <View style={styles.detailRow}>
            <CallDirectionIcon type={call.type} missed={call.missed} />
            <AppText style={[styles.detailType, call.missed && styles.detailTypeMissed, { color: call.missed ? COLORS.missed : FG.primary }]}>
              {call.missed ? 'Missed call' : call.type}
            </AppText>
          </View>
          <AppText style={[styles.detailTime, { color: FG.secondary }]}>{call.time}</AppText>
        </View>

        {/* Action buttons — same style as ChatScreen top bar */}
        <View style={styles.actionRow}>
          {/* Audio call */}
          <TouchableOpacity style={styles.actionItem} onPress={onAudioCall} activeOpacity={0.85}>
            <LinearGradient colors={GRADIENTS.primary} style={styles.actionBtn}>
              <AppIcon name="call" size={24} color="#fff" fixedColor />
            </LinearGradient>
            <AppText style={[styles.actionLabel, { color: FG.secondary }]}>Call</AppText>
          </TouchableOpacity>

          {/* Video call */}
          <TouchableOpacity style={styles.actionItem} onPress={onVideoCall} activeOpacity={0.85}>
            <LinearGradient colors={GRADIENTS.primary} style={styles.actionBtn}>
              <AppIcon name="videocam" size={24} color="#fff" fixedColor />
            </LinearGradient>
            <AppText style={[styles.actionLabel, { color: FG.secondary }]}>Video</AppText>
          </TouchableOpacity>

          {/* Message */}
          <TouchableOpacity style={styles.actionItem} onPress={onMessage} activeOpacity={0.85}>
            <LinearGradient colors={GRADIENTS.primary} style={styles.actionBtn}>
              <AppIcon name="chatbubble" size={22} color="#fff" fixedColor />
            </LinearGradient>
            <AppText style={[styles.actionLabel, { color: FG.secondary }]}>Message</AppText>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={[styles.closeBtn, { backgroundColor: FG.glassBg, borderColor: FG.glassBorder }]} onPress={onClose}>
          <AppText style={[styles.closeBtnText, { color: FG.secondary }]}>Close</AppText>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────
export default function CallsScreen() {
  const navigation  = useNavigation<NavProp>();
  const { FG }      = useForeground();
  const { fontFamily, textColor } = useTypography();

  const [tab,        setTab]        = useState<CallTab>('All');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedCall, setSelectedCall] = useState<Call | null>(null);
  const [infoOpen,   setInfoOpen]   = useState(false);

  const filtered = tab === 'Missed' ? CALLS.filter((c) => c.missed) : CALLS;

  const placeAudioCall = (contact: Contact) => {
    setPickerOpen(false);
    navigation.navigate('AudioCall', { contact });
  };

  const placeVideoCall = (contact: Contact) => {
    setPickerOpen(false);
    navigation.navigate('VideoCall', { contact });
  };

  const handleCallRowPress = (item: Call) => {
    setSelectedCall(item);
    setInfoOpen(true);
  };

  const getContactForCall = (call: Call): Contact => {
    return CONTACTS.find((c) => c.name === call.name) ?? {
      id: call.id, name: call.name, avatar: call.avatar, color: call.color,
      status: 'offline', lastMsg: '', time: call.time, unread: 0,
    };
  };

  const renderCall = ({ item }: { item: Call }) => (
    <TouchableOpacity
      style={[styles.callCard, { backgroundColor: FG.glassBg, borderColor: FG.glassBorder }]}
      activeOpacity={0.75}
      onPress={() => handleCallRowPress(item)}
    >
      <Avatar initials={item.avatar} color={item.color} size={48} />
      <View style={styles.callMeta}>
        <AppText style={[styles.callName, { color: textColor, fontFamily }]}>{item.name}</AppText>
        <View style={styles.callSubRow}>
          <CallDirectionIcon type={item.type} missed={item.missed} />
          <AppText fixedColor={item.missed}
            style={[styles.callType, item.missed && styles.callTypeMissed, { color: item.missed ? COLORS.missed : FG.secondary }]}>
            {item.type}
          </AppText>
        </View>
      </View>
      <View style={styles.callRight}>
        <AppText style={[styles.callTime, { color: FG.secondary }]}>{item.time}</AppText>
        {/* Call action buttons — same gradient pill as ChatScreen */}
        <View style={styles.callBtns}>
          <TouchableOpacity onPress={() => placeAudioCall(getContactForCall(item))} activeOpacity={0.85}>
            <LinearGradient colors={GRADIENTS.primary} style={styles.callBtnPill}>
              <AppIcon name="call" size={14} color="#fff" fixedColor />
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => placeVideoCall(getContactForCall(item))} activeOpacity={0.85}>
            <LinearGradient colors={GRADIENTS.primary} style={styles.callBtnPill}>
              <AppIcon name="videocam" size={14} color="#fff" fixedColor />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.root}>
      <AppBg />

      <ContactPickerSheet
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onAudioCall={placeAudioCall}
        onVideoCall={placeVideoCall}
      />

      <CallInfoSheet
        call={selectedCall}
        visible={infoOpen}
        onClose={() => setInfoOpen(false)}
        onAudioCall={() => {
          setInfoOpen(false);
          if (selectedCall) placeAudioCall(getContactForCall(selectedCall));
        }}
        onVideoCall={() => {
          setInfoOpen(false);
          if (selectedCall) placeVideoCall(getContactForCall(selectedCall));
        }}
        onMessage={() => {
          setInfoOpen(false);
          if (selectedCall) {
            const contact = getContactForCall(selectedCall);
            navigation.navigate('Chat', { contact });
          }
        }}
      />

      <View style={[styles.header, { backgroundColor: FG.glassBg, borderBottomColor: FG.glassBorder, borderBottomWidth: 1 }]}>
        <AppText style={[styles.title, { color: textColor, fontFamily }]}>Calls</AppText>
        <TouchableOpacity activeOpacity={0.85} onPress={() => setPickerOpen(true)}>
          <LinearGradient colors={GRADIENTS.primary} style={styles.newCallBtn}>
            <AppIcon name="call" size={16} color="#fff" fixedColor />
            <AppText fixedColor style={styles.newCallPlus}>+</AppText>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      <View style={styles.tabRow}>
        {(['All', 'Missed', 'Voicemail'] as CallTab[]).map((t) => {
          const isActive = tab === t;
          return isActive ? (
            <TouchableOpacity key={t} onPress={() => setTab(t)} activeOpacity={0.85}>
              <LinearGradient colors={GRADIENTS.primary} style={styles.tabPill}>
                <AppText fixedColor style={styles.tabTextActive}>{t}</AppText>
              </LinearGradient>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity key={t} onPress={() => setTab(t)}
              style={[styles.tabPillInactive, { backgroundColor: FG.glassBg, borderColor: FG.glassBorder }]} activeOpacity={0.7}>
              <AppText style={[styles.tabTextInactive, { color: FG.secondary }]}>{t}</AppText>
            </TouchableOpacity>
          );
        })}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderCall}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <AppIcon name="call-outline" size={48} color={FG.secondary} />
            <AppText style={[styles.emptyText, { color: FG.secondary }]}>No calls yet</AppText>
          </View>
        }
      />

      <BottomNav active="calls" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: Platform.OS === 'web' ? 16 : 56, paddingBottom: 14,
  },
  title: { fontSize: 26, fontWeight: '800' },
  newCallBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: RADIUS.full, ...SHADOW.button,
  },
  newCallPlus: { fontSize: 18, fontWeight: '300', color: '#fff', lineHeight: 20, marginTop: -1 },

  tabRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 14, paddingBottom: 14 },
  tabPill:        { paddingHorizontal: 18, paddingVertical: 8, borderRadius: RADIUS.full, ...SHADOW.button },
  tabPillInactive:{ paddingHorizontal: 18, paddingVertical: 8, borderRadius: RADIUS.full, borderWidth: 1 },
  tabTextActive:  { fontSize: 13, fontWeight: '700', color: '#fff' },
  tabTextInactive:{ fontSize: 13, fontWeight: '500' },

  listContent: { paddingHorizontal: 14, paddingBottom: 90 },

  // Call log card — full glass
  callCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: RADIUS.lg, borderWidth: 1,
    paddingHorizontal: 14, paddingVertical: 13, ...SHADOW.card,
  },
  callMeta:       { flex: 1 },
  callName:       { fontSize: 14, fontWeight: '700', marginBottom: 3 },
  callSubRow:     { flexDirection: 'row', alignItems: 'center', gap: 4 },
  callType:       { fontSize: 12 },
  callTypeMissed: { fontWeight: '600' },
  callRight:      { alignItems: 'flex-end', gap: 6 },
  callTime:       { fontSize: 11 },

  // Gradient pill call buttons (same family as ChatScreen)
  callBtns:    { flexDirection: 'row', gap: 6 },
  callBtnPill: {
    width: 30, height: 30, borderRadius: 15,
    alignItems: 'center', justifyContent: 'center',
    ...SHADOW.button,
  },

  emptyWrap: { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyText: { fontSize: 15 },

  // Sheets
  overlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.22)' },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    maxHeight: '82%',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    overflow: 'hidden', ...SHADOW.glow,
  },
  handle: {
    alignSelf: 'center', width: 40, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(30,156,240,0.30)', marginTop: 10, marginBottom: 4,
  },
  sheetHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12, gap: 10,
  },
  iconPad:    { padding: 4 },
  sheetTitle: { fontSize: 17, fontWeight: '700' },
  sheetSub:   { fontSize: 12, marginTop: 1 },

  // Contact picker cards
  contactCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginHorizontal: 14, marginBottom: 8,
    borderRadius: RADIUS.lg, borderWidth: 1,
    paddingHorizontal: 14, paddingVertical: 12, ...SHADOW.card,
  },
  contactMeta: { flex: 1 },
  contactName: { fontSize: 14, fontWeight: '600' },
  contactNum:  { fontSize: 12, marginTop: 2 },
  callActionBtn: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center',
    ...SHADOW.button,
  },

  // Call info sheet
  infoHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    paddingHorizontal: 20, paddingVertical: 16,
  },
  infoMeta:   { flex: 1 },
  infoName:   { fontSize: 20, fontWeight: '700' },
  infoNum:    { fontSize: 13, marginTop: 3 },

  detailCard: {
    marginHorizontal: 20, marginBottom: 24,
    borderRadius: RADIUS.lg, borderWidth: 1,
    paddingHorizontal: 16, paddingVertical: 12,
    ...SHADOW.card,
  },
  detailRow:       { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  detailType:      { fontSize: 15, fontWeight: '600' },
  detailTypeMissed:{ },
  detailTime:      { fontSize: 13 },

  // Action buttons row
  actionRow: {
    flexDirection: 'row', justifyContent: 'space-around',
    paddingHorizontal: 20, paddingBottom: 20,
  },
  actionItem: { alignItems: 'center', gap: 8 },
  actionBtn: {
    width: 64, height: 64, borderRadius: 32,
    alignItems: 'center', justifyContent: 'center',
    ...SHADOW.button,
  },
  actionLabel: { fontSize: 12, fontWeight: '600' },

  closeBtn: {
    marginHorizontal: 20, marginBottom: 28,
    borderRadius: RADIUS.lg, borderWidth: 1,
    paddingVertical: 14, alignItems: 'center',
  },
  closeBtnText: { fontSize: 15, fontWeight: '600' },
});
