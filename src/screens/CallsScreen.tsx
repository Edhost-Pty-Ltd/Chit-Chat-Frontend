// ─── Screen: Calls ───────────────────────────────────────────────────────────
import React, { useState } from 'react';
import {
  View, FlatList, TouchableOpacity, StyleSheet,
  Modal, Pressable, ScrollView, Linking, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Avatar, BottomNav } from '../components';
import { CALLS, CONTACTS } from '../data/mockData';
import { COLORS, RADIUS, SHADOW, GRADIENTS, GLASS } from '../types/theme';
import { Call, Contact } from '../types';
import { AppBg, AppText, AppIcon, useForeground } from '../context/ThemeContext';

type CallTab = 'All' | 'Missed' | 'Voicemail';

// Mock phone numbers mapped by contact name
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
  if (missed)              return <AppIcon name="call"              size={14} color={COLORS.missed} fixedColor />;
  if (type === 'Outgoing') return <AppIcon name="arrow-up-outline"  size={14} color={COLORS.green}  fixedColor />;
  return                          <AppIcon name="arrow-down-outline" size={14} color={COLORS.blue}   fixedColor />;
}

// ─── Contact Picker Sheet ────────────────────────────────────────────────────
function ContactPickerSheet({
  visible,
  onClose,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  onSelect: (c: Contact) => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide"
      onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.overlay} onPress={onClose} />
      <View style={styles.sheet}>
        <AppBg />
        <View style={styles.handle} />

        {/* Sheet header */}
        <View style={styles.sheetHeader}>
          <TouchableOpacity onPress={onClose} style={styles.iconPad}>
            <AppIcon name="close" size={22} color={COLORS.sub} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <AppText style={styles.sheetTitle}>Call a contact</AppText>
            <AppText style={styles.sheetSub}>{CONTACTS.length} contacts</AppText>
          </View>
          <AppIcon name="search-outline" size={22} color={COLORS.sub} style={styles.iconPad} />
        </View>

        <AppText style={styles.sectionHint}>SELECT CONTACT TO CALL</AppText>

        <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
          {CONTACTS.map((c) => (
            <TouchableOpacity key={c.id} style={styles.contactCard}
              activeOpacity={0.75} onPress={() => onSelect(c)}>
              <Avatar initials={c.avatar} color={c.color} size={46} status={c.status} />
              <View style={styles.contactMeta}>
                <AppText style={styles.contactName}>{c.name}</AppText>
                <AppText style={styles.contactNum}>
                  {PHONE_NUMBERS[c.name] ?? 'No number'}
                </AppText>
              </View>
              {/* Light blue call button */}
              <TouchableOpacity onPress={() => onSelect(c)} activeOpacity={0.8}>
                <AppIcon glass tileSize={38} name="call" size={17} color={COLORS.blue} />
              </TouchableOpacity>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────
export default function CallsScreen() {
  const [tab,         setTab]         = useState<CallTab>('All');
  const [pickerOpen,  setPickerOpen]  = useState(false);
  const { FG } = useForeground();

  const filtered = tab === 'Missed' ? CALLS.filter((c) => c.missed) : CALLS;

  const handleSelectContact = (contact: Contact) => {
    setPickerOpen(false);
    const number = PHONE_NUMBERS[contact.name];
    if (number) {
      const tel = `tel:${number.replace(/\s/g, '')}`;
      Linking.canOpenURL(tel).then((can) => {
        if (can) {
          Linking.openURL(tel);
        } else {
          Alert.alert('Cannot place call', `Dialling ${number}`);
        }
      });
    } else {
      Alert.alert('No number', `${contact.name} has no phone number saved.`);
    }
  };

  const renderCall = ({ item }: { item: Call }) => (
    <View style={[styles.callCard, { backgroundColor: FG.glassBg, borderColor: FG.glassBorder }]}>
      <Avatar initials={item.avatar} color={item.color} size={48} />
      <View style={styles.callMeta}>
        <AppText style={[styles.callName, { color: FG.primary }]}>{item.name}</AppText>
        <View style={styles.callSubRow}>
          <CallDirectionIcon type={item.type} missed={item.missed} />
          <AppText fixedColor={item.missed} style={[styles.callType, item.missed && styles.callTypeMissed, { color: FG.secondary }]}>{item.type}</AppText>
        </View>
      </View>
      <View style={styles.callRight}>
        <AppText style={[styles.callTime, { color: FG.secondary }]}>{item.time}</AppText>
        <TouchableOpacity style={styles.infoBtn}>
          <AppIcon name="information-circle-outline" size={20} color={COLORS.blue} />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.root}>
      <AppBg />

      <ContactPickerSheet
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={handleSelectContact}
      />

      <View style={styles.header}>
        <AppText style={[styles.title, { color: FG.primary }]}>Calls</AppText>
        {/* New call button — phone icon + "+" as a clean pill */}
        <TouchableOpacity activeOpacity={0.85} onPress={() => setPickerOpen(true)}>
          <LinearGradient colors={GRADIENTS.primary} style={styles.newCallBtn}>
            <AppIcon name="call" size={16} color="#fff" fixedColor />
            <AppText style={styles.newCallPlus}>+</AppText>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Tab pills */}
      <View style={styles.tabRow}>
        {(['All', 'Missed', 'Voicemail'] as CallTab[]).map((t) => {
          const isActive = tab === t;
          return isActive ? (
            <TouchableOpacity key={t} onPress={() => setTab(t)} activeOpacity={0.85}>
              <LinearGradient colors={GRADIENTS.primary} style={styles.tabPill}>
                <AppText style={styles.tabTextActive}>{t}</AppText>
              </LinearGradient>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity key={t} onPress={() => setTab(t)}
              style={styles.tabPillInactive} activeOpacity={0.7}>
              <AppText style={styles.tabTextInactive}>{t}</AppText>
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
            <AppIcon name="call-outline" size={48} color={COLORS.sub} />
            <AppText style={styles.emptyText}>No missed calls</AppText>
          </View>
        }
      />

      <BottomNav active="calls" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.sky1 },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 56, paddingBottom: 14,
  },
  title:      { fontSize: 26, fontWeight: '800', color: COLORS.text },
  // New call button — horizontal pill with phone + "+" 
  newCallBtnWrap: {},
  newCallBtnInner: {},
  newCallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: RADIUS.full,
    ...SHADOW.button,
  },
  newCallPlus: {
    fontSize: 18,
    fontWeight: '300',
    color: '#fff',
    lineHeight: 20,
    marginTop: -1,
  },
  callPlusIcon: {},
  callPlusText: {},
  plusBadge: {},
  plusBadgeText: {},

  tabRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 14, paddingBottom: 14 },
  tabPill:         { paddingHorizontal: 18, paddingVertical: 8, borderRadius: RADIUS.full, ...SHADOW.button },
  tabPillInactive: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: RADIUS.full, ...GLASS.card },
  tabTextActive:   { fontSize: 13, fontWeight: '700', color: '#fff' },
  tabTextInactive: { fontSize: 13, fontWeight: '500', color: COLORS.sub },

  listContent: { paddingHorizontal: 14, paddingBottom: 20 },

  callCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    ...GLASS.card, borderRadius: RADIUS.lg,
    paddingHorizontal: 14, paddingVertical: 13, ...SHADOW.card,
  },
  callMeta:       { flex: 1 },
  callName:       { fontSize: 14, fontWeight: '700', color: COLORS.text, marginBottom: 3 },
  callSubRow:     { flexDirection: 'row', alignItems: 'center', gap: 4 },
  callType:       { fontSize: 12, color: COLORS.sub },
  callTypeMissed: { color: COLORS.missed, fontWeight: '600' },
  callRight:      { alignItems: 'flex-end', gap: 6 },
  callTime:       { fontSize: 12, color: COLORS.sub },
  infoBtn:        { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },

  emptyWrap: { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyText: { fontSize: 15, color: COLORS.sub },

  // ── Contact picker sheet ──────────────────────────────────────────────────
  overlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.22)' },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    height: '82%',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    overflow: 'hidden',
    ...SHADOW.glow,
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
  sheetTitle: { fontSize: 17, fontWeight: '700', color: COLORS.text },
  sheetSub:   { fontSize: 12, color: COLORS.sub, marginTop: 1 },
  sectionHint:{
    fontSize: 10, fontWeight: '700', color: COLORS.sub,
    letterSpacing: 1, paddingHorizontal: 20, paddingVertical: 6,
  },

  // Contact cards in sheet
  contactCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    marginHorizontal: 14, marginBottom: 8,
    ...GLASS.card, borderRadius: RADIUS.lg,
    paddingHorizontal: 14, paddingVertical: 12, ...SHADOW.card,
  },
  contactMeta: { flex: 1 },
  contactName: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  contactNum:  { fontSize: 12, color: COLORS.sub, marginTop: 2 },
  callBtnWrap: {},
  callBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(30,156,240,0.15)',
    borderWidth: 1, borderColor: 'rgba(30,156,240,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },
});
