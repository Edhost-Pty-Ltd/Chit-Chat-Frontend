// ─── Screen: Calls ───────────────────────────────────────────────────────────
import React, { useState } from 'react';
import {
  View, FlatList, TouchableOpacity, StyleSheet,
  Modal, Pressable, ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { Avatar, BottomNav } from '../components';
import { CONTACTS } from '../data/mockData';
import { COLORS, RADIUS, SHADOW, GRADIENTS, GLASS } from '../types/theme';
import { Contact } from '../types';
import type { CallHistoryItem } from '../types/call';
import type { RootStackParamList } from '../types';
import { AppBg, AppText, AppIcon, useForeground } from '../context/ThemeContext';
import { useAuth } from '../hooks/useAuth';
import { useCallHistory } from '../hooks/useCallHistory';
import { useOutgoingCall } from '../hooks/useOutgoingCall';
import { useCallContext } from '../context/CallContext';

type CallTab = 'All' | 'Missed';
type NavProp = NativeStackNavigationProp<RootStackParamList>;

// Helper to format call duration
function formatDuration(seconds: number | null): string {
  if (!seconds) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

// Helper to format timestamp
function formatTimestamp(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  
  if (days === 0) {
    // Today - show time
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  } else if (days === 1) {
    return 'Yesterday';
  } else if (days < 7) {
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  } else {
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    });
  }
}

// Get initials from display name
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function CallDirectionIcon({ direction, status }: { direction: 'incoming' | 'outgoing'; status: string }) {
  if (status === 'missed')     return <AppIcon name="call"              size={14} color={COLORS.missed} fixedColor />;
  if (direction === 'outgoing') return <AppIcon name="arrow-up-outline"  size={14} color={COLORS.green}  fixedColor />;
  return                               <AppIcon name="arrow-down-outline" size={14} color={COLORS.blue}   fixedColor />;
}

// ─── Contact Picker Sheet ────────────────────────────────────────────────────
function ContactPickerSheet({
  visible,
  onClose,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  onSelect: (userId: string, displayName: string) => void;
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
              activeOpacity={0.75} onPress={() => onSelect(c.id, c.name)}>
              <Avatar initials={c.avatar} color={c.color} size={46} status={c.status} />
              <View style={styles.contactMeta}>
                <AppText style={styles.contactName}>{c.name}</AppText>
                <AppText style={styles.contactNum}>Tap to call</AppText>
              </View>
              {/* Light blue call button */}
              <TouchableOpacity onPress={() => onSelect(c.id, c.name)} activeOpacity={0.8}>
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
  const navigation = useNavigation<NavProp>();
  const { user } = useAuth();
  const { callHistory, loading, error } = useCallHistory(user?.uid ?? null);
  const { setCallStatus, setActiveCallId } = useCallContext();
  const outgoingCall = useOutgoingCall();
  
  const [tab, setTab] = useState<CallTab>('All');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [calling, setCalling] = useState(false);
  
  const { FG } = useForeground();

  // Filter based on tab
  const filtered = tab === 'Missed' 
    ? callHistory.filter((c) => c.status === 'missed') 
    : callHistory;

  // Handle initiating a call from contact picker
  const handleSelectContact = async (userId: string, displayName: string) => {
    if (!user) {
      Alert.alert('Error', 'You must be logged in to make calls');
      return;
    }
    
    setPickerOpen(false);
    setCalling(true);

    try {
      console.log('[CallsScreen] Initiating call to:', displayName);
      
      const callId = await outgoingCall.initiateCall(
        user.uid,
        userId,
        { 
          userId: user.uid, 
          displayName: user.displayName || 'You', 
          photoUrl: user.photoURL 
        },
        { 
          userId, 
          displayName, 
          photoUrl: null 
        }
      );

      if (callId) {
        // Navigate to call screen
        navigation.navigate('AudioCall', {
          callId,
          isOutgoing: true,
          otherParty: {
            userId,
            displayName,
            photoUrl: null,
          },
        });
      } else {
        Alert.alert('Call Failed', 'Unable to initiate call');
      }
    } catch (err) {
      console.error('[CallsScreen] Call failed:', err);
      Alert.alert('Call Failed', 'Unable to start call. Please try again.');
    } finally {
      setCalling(false);
    }
  };

  // Handle calling back from history
  const handleCallBack = async (item: CallHistoryItem) => {
    if (!user) {
      Alert.alert('Error', 'You must be logged in to make calls');
      return;
    }

    setCalling(true);

    try {
      console.log('[CallsScreen] Calling back:', item.otherParty.displayName);
      
      const callId = await outgoingCall.initiateCall(
        user.uid,
        item.otherParty.userId,
        { 
          userId: user.uid, 
          displayName: user.displayName || 'You', 
          photoUrl: user.photoURL 
        },
        item.otherParty
      );

      if (callId) {
        // Navigate to call screen
        navigation.navigate('AudioCall', {
          callId,
          isOutgoing: true,
          otherParty: item.otherParty,
        });
      } else {
        Alert.alert('Call Failed', 'Unable to initiate call');
      }
    } catch (err) {
      console.error('[CallsScreen] Call back failed:', err);
      Alert.alert('Call Failed', 'Unable to start call. Please try again.');
    } finally {
      setCalling(false);
    }
  };

  // Show call details
  const handleShowInfo = (item: CallHistoryItem) => {
    const statusText = item.status === 'completed' ? 'Completed' 
      : item.status === 'missed' ? 'Missed'
      : item.status === 'rejected' ? 'Rejected'
      : item.status === 'busy' ? 'Busy'
      : 'Failed';
    
    const durationText = item.duration 
      ? `Duration: ${formatDuration(item.duration)}`
      : 'No duration recorded';

    Alert.alert(
      item.otherParty.displayName,
      `${statusText} ${item.direction} ${item.type} call\n${durationText}\n${item.timestamp.toLocaleString()}`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Call Back', onPress: () => handleCallBack(item) },
      ]
    );
  };

  const renderCall = ({ item }: { item: CallHistoryItem }) => {
    const isMissed = item.status === 'missed';
    const statusLabel = item.status === 'completed' && item.duration
      ? formatDuration(item.duration)
      : item.status === 'missed' ? 'Missed'
      : item.status === 'rejected' ? 'Rejected'
      : item.status === 'busy' ? 'Busy'
      : 'Failed';

    return (
      <TouchableOpacity
        style={[styles.callCard, { backgroundColor: FG.glassBg, borderColor: FG.glassBorder }]}
        onPress={() => handleCallBack(item)}
        activeOpacity={0.7}
      >
        <Avatar initials={getInitials(item.otherParty.displayName)} color={COLORS.blue} size={48} />
        <View style={styles.callMeta}>
          <AppText style={[styles.callName, { color: FG.primary }]}>{item.otherParty.displayName}</AppText>
          <View style={styles.callSubRow}>
            <CallDirectionIcon direction={item.direction} status={item.status} />
            <AppText 
              fixedColor={isMissed} 
              style={[styles.callType, isMissed && styles.callTypeMissed, { color: FG.secondary }]}
            >
              {item.direction === 'outgoing' ? 'Outgoing' : 'Incoming'} • {statusLabel}
            </AppText>
          </View>
        </View>
        <View style={styles.callRight}>
          <AppText style={[styles.callTime, { color: FG.secondary }]}>
            {formatTimestamp(item.timestamp)}
          </AppText>
          <TouchableOpacity style={styles.infoBtn} onPress={() => handleShowInfo(item)}>
            <AppIcon name="information-circle-outline" size={20} color={COLORS.blue} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

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
        {/* New call button */}
        <TouchableOpacity 
          activeOpacity={0.85} 
          onPress={() => setPickerOpen(true)}
          disabled={calling}
        >
          <LinearGradient colors={GRADIENTS.primary} style={styles.newCallBtn}>
            <AppIcon name="call" size={16} color="#fff" fixedColor />
            <AppText style={styles.newCallPlus}>+</AppText>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Tab pills */}
      <View style={styles.tabRow}>
        {(['All', 'Missed'] as CallTab[]).map((t) => {
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

      {/* Loading state */}
      {loading ? (
        <View style={styles.centerWrap}>
          <ActivityIndicator size="large" color={COLORS.blue} />
          <AppText style={styles.centerText}>Loading call history...</AppText>
        </View>
      ) : error ? (
        <View style={styles.centerWrap}>
          <AppIcon name="alert-circle-outline" size={48} color={COLORS.missed} />
          <AppText style={styles.centerText}>Failed to load calls</AppText>
          <AppText style={styles.errorText}>{error}</AppText>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.callId}
          renderItem={renderCall}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <AppIcon name="call-outline" size={48} color={COLORS.sub} />
              <AppText style={styles.emptyText}>
                {tab === 'Missed' ? 'No missed calls' : 'No call history'}
              </AppText>
              <AppText style={styles.emptyHint}>
                Tap + to start a new call
              </AppText>
            </View>
          }
        />
      )}

      {/* Calling overlay */}
      {calling && (
        <View style={styles.callingOverlay}>
          <ActivityIndicator size="large" color="#fff" />
          <AppText fixedColor style={styles.callingText}>Starting call...</AppText>
        </View>
      )}

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
  title: { fontSize: 26, fontWeight: '800', color: COLORS.text },
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

  centerWrap: { alignItems: 'center', paddingTop: 80, gap: 12 },
  centerText: { fontSize: 15, color: COLORS.sub },
  errorText:  { fontSize: 13, color: COLORS.missed, textAlign: 'center', paddingHorizontal: 40 },
  
  emptyWrap: { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyText: { fontSize: 15, color: COLORS.sub, fontWeight: '600' },
  emptyHint: { fontSize: 13, color: COLORS.sub },

  callingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  callingText: { fontSize: 16, color: '#fff', fontWeight: '600' },

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
});
