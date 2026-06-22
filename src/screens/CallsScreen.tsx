// ─── Screen: Calls ───────────────────────────────────────────────────────────
import React, { useState } from 'react';
import {
  View, FlatList, TouchableOpacity, StyleSheet,
  Modal, Pressable, ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Avatar, BottomNav } from '../components';
import { COLORS, RADIUS, SHADOW, GRADIENTS } from '../types/theme';
import type { CallHistoryItem } from '../types/call';
import type { RootStackParamList } from '../types';
import { AppBg, AppText, AppIcon, useForeground } from '../context/ThemeContext';
import { useAuth } from '../hooks/useAuth';
import { useCallHistory } from '../hooks/useCallHistory';
import { useOutgoingCall } from '../hooks/useOutgoingCall';
import { useContacts } from '../hooks/useContacts';
import { getOrCreateDirectChat } from '../hooks/useChatActions';

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

// ─── Call Info Sheet ──────────────────────────────────────────────────────────
function CallInfoSheet({
  call,
  visible,
  onClose,
  onAudioCall,
  onVideoCall,
  onMessage,
}: {
  call: CallHistoryItem | null;
  visible: boolean;
  onClose: () => void;
  onAudioCall: () => void;
  onVideoCall: () => void;
  onMessage?: () => void;
}) {
  const { FG } = useForeground();

  if (!call) return null;

  // Determine call status text and color
  const isMissed = call.status === 'missed';
  const statusText = isMissed ? 'Missed call' : `${call.direction === 'outgoing' ? 'Outgoing' : 'Incoming'} ${call.type}`;
  const statusColor = isMissed ? COLORS.missed : FG.primary;

  return (
    <Modal visible={visible} transparent animationType="slide"
      onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.overlay} onPress={onClose} />
      <View style={styles.infoSheet}>
        <AppBg />
        <View style={styles.handle} />

        {/* Contact info header */}
        <View style={styles.infoHeader}>
          <Avatar 
            initials={getInitials(call.otherParty.displayName)} 
            color={COLORS.blue} 
            size={64} 
            imageUrl={call.otherParty.photoUrl}
          />
          <View style={styles.infoMeta}>
            <AppText style={styles.infoName}>{call.otherParty.displayName}</AppText>
            <AppText style={styles.infoNum}>
              {call.otherParty.userId || 'No number saved'}
            </AppText>
          </View>
        </View>

        {/* Call details card */}
        <View style={[styles.detailCard, { 
          backgroundColor: FG.glassBg, 
          borderColor: FG.glassBorder 
        }]}>
          <View style={styles.detailRow}>
            <CallDirectionIcon direction={call.direction} status={call.status} />
            <AppText style={[styles.detailType, { color: statusColor }]} fixedColor={isMissed}>
              {statusText}
            </AppText>
          </View>
          <AppText style={styles.detailTime}>
            {formatTimestamp(call.timestamp)}
          </AppText>
        </View>

        {/* Action buttons row */}
        <View style={styles.actionRow}>
          <View style={styles.actionItem}>
            <TouchableOpacity onPress={onAudioCall} activeOpacity={0.85}>
              <LinearGradient colors={GRADIENTS.primary} style={styles.actionBtn}>
                <AppIcon name="call" size={24} color="#fff" fixedColor />
              </LinearGradient>
            </TouchableOpacity>
            <AppText style={styles.actionLabel}>Call</AppText>
          </View>

          <View style={styles.actionItem}>
            <TouchableOpacity onPress={onVideoCall} activeOpacity={0.85}>
              <LinearGradient colors={GRADIENTS.primary} style={styles.actionBtn}>
                <AppIcon name="videocam" size={24} color="#fff" fixedColor />
              </LinearGradient>
            </TouchableOpacity>
            <AppText style={styles.actionLabel}>Video</AppText>
          </View>

          <View style={styles.actionItem}>
            <TouchableOpacity 
              onPress={() => {
                onMessage?.();
              }} 
              activeOpacity={0.85}
            >
              <LinearGradient colors={GRADIENTS.primary} style={styles.actionBtn}>
                <AppIcon name="chatbubble" size={24} color="#fff" fixedColor />
              </LinearGradient>
            </TouchableOpacity>
            <AppText style={styles.actionLabel}>Message</AppText>
          </View>
        </View>

        {/* Close button */}
        <TouchableOpacity 
          onPress={onClose} 
          activeOpacity={0.85}
          style={[styles.closeBtn, { backgroundColor: FG.glassBg, borderColor: FG.glassBorder }]}
        >
          <AppText style={styles.closeBtnText}>Close</AppText>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

// ─── Contact Picker Sheet ────────────────────────────────────────────────────
function ContactPickerSheet({
  visible,
  onClose,
  onSelectAudio,
  onSelectVideo,
  contacts,
  loading,
}: {
  visible: boolean;
  onClose: () => void;
  onSelectAudio: (userId: string, displayName: string, photoUrl: string | null) => void;
  onSelectVideo: (userId: string, displayName: string, photoUrl: string | null) => void;
  contacts: any[];
  loading: boolean;
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
            <AppText style={styles.sheetSub}>{contacts.length} contacts</AppText>
          </View>
          <AppIcon name="search-outline" size={22} color={COLORS.sub} style={styles.iconPad} />
        </View>

        <AppText style={styles.sectionHint}>SELECT CONTACT TO CALL</AppText>

        {loading ? (
          <View style={styles.centerWrap}>
            <ActivityIndicator size="large" color={COLORS.blue} />
          </View>
        ) : contacts.length === 0 ? (
          <View style={styles.centerWrap}>
            <AppIcon name="people-outline" size={48} color={COLORS.sub} />
            <AppText style={styles.emptyText}>No contacts yet</AppText>
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
            {contacts.map((c) => (
              <TouchableOpacity key={c.userId} style={styles.contactCard}
                activeOpacity={0.75} onPress={() => onSelectAudio(c.userId, c.displayName, c.photoUri || c.firebasePhotoURL || null)}>
                <Avatar 
                  initials={getInitials(c.displayName)} 
                  color={COLORS.blue} 
                  size={46} 
                  imageUrl={c.photoUri || c.firebasePhotoURL || null}
                />
                <View style={styles.contactMeta}>
                  <AppText style={styles.contactName}>{c.displayName}</AppText>
                  <AppText style={styles.contactNum}>Tap to call</AppText>
                </View>
                {/* Audio call button */}
                <TouchableOpacity onPress={() => onSelectAudio(c.userId, c.displayName, c.photoUri || c.firebasePhotoURL || null)} activeOpacity={0.8} style={{ marginRight: 8 }}>
                  <AppIcon glass tileSize={38} name="call" size={17} color={COLORS.blue} />
                </TouchableOpacity>
                {/* Video call button */}
                <TouchableOpacity onPress={() => onSelectVideo(c.userId, c.displayName, c.photoUri || c.firebasePhotoURL || null)} activeOpacity={0.8}>
                  <AppIcon glass tileSize={38} name="videocam" size={17} color={COLORS.blue} />
                </TouchableOpacity>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────
export default function CallsScreen() {
  const navigation = useNavigation<NavProp>();
  const { user } = useAuth();
  const { callHistory, loading, error } = useCallHistory(user?.uid ?? null);
  const { contacts, loading: contactsLoading } = useContacts();
  const outgoingCall = useOutgoingCall();
  
  const [tab, setTab] = useState<CallTab>('All');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [calling, setCalling] = useState(false);
  const [selectedCall, setSelectedCall] = useState<CallHistoryItem | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);

  // Filter based on tab
  const filtered = tab === 'Missed' 
    ? callHistory.filter((c) => c.status === 'missed') 
    : callHistory;

  // Handle initiating an audio call from contact picker
  const handleSelectAudioContact = async (userId: string, displayName: string, photoUrl: string | null) => {
    if (!user) {
      Alert.alert('Error', 'You must be logged in to make calls');
      return;
    }
    
    setPickerOpen(false);
    setCalling(true);

    try {
      console.log('[CallsScreen] Initiating audio call to:', displayName);
      
      // Fetch current user's profile from Firestore
      const userProfileRef = doc(db, 'users', user.uid);
      const userProfileSnap = await getDoc(userProfileRef);
      const userProfile = userProfileSnap.exists() ? userProfileSnap.data() : null;
      
      const callId = await outgoingCall.initiateCall(
        user.uid,
        userId,
        { 
          userId: user.uid, 
          displayName: userProfile?.displayName || user.phoneNumber || 'Unknown', 
          photoUrl: userProfile?.photoURL || null 
        },
        { 
          userId, 
          displayName, 
          photoUrl 
        },
        'audio'
      );

      if (callId) {
        // Navigate to audio call screen
        navigation.navigate('AudioCall', {
          callId,
          isOutgoing: true,
          otherParty: {
            userId,
            displayName,
            photoUrl,
          },
        });
      } else {
        Alert.alert('Call Failed', 'Unable to initiate call');
      }
    } catch (err) {
      console.error('[CallsScreen] Audio call failed:', err);
      Alert.alert('Call Failed', 'Unable to start call. Please try again.');
    } finally {
      setCalling(false);
    }
  };

  // Handle initiating a video call from contact picker
  const handleSelectVideoContact = async (userId: string, displayName: string, photoUrl: string | null) => {
    if (!user) {
      Alert.alert('Error', 'You must be logged in to make calls');
      return;
    }
    
    setPickerOpen(false);
    setCalling(true);

    try {
      console.log('[CallsScreen] Initiating video call to:', displayName);
      
      // Fetch current user's profile from Firestore
      const userProfileRef = doc(db, 'users', user.uid);
      const userProfileSnap = await getDoc(userProfileRef);
      const userProfile = userProfileSnap.exists() ? userProfileSnap.data() : null;
      
      const callId = await outgoingCall.initiateCall(
        user.uid,
        userId,
        { 
          userId: user.uid, 
          displayName: userProfile?.displayName || user.phoneNumber || 'Unknown', 
          photoUrl: userProfile?.photoURL || null 
        },
        { 
          userId, 
          displayName, 
          photoUrl 
        },
        'video'
      );

      if (callId) {
        // Navigate to video call screen
        navigation.navigate('VideoCall', {
          callId,
          isOutgoing: true,
          otherParty: {
            userId,
            displayName,
            photoUrl,
          },
        });
      } else {
        Alert.alert('Call Failed', 'Unable to initiate call');
      }
    } catch (err) {
      console.error('[CallsScreen] Video call failed:', err);
      Alert.alert('Call Failed', 'Unable to start call. Please try again.');
    } finally {
      setCalling(false);
    }
  };

  // Handle calling back from history
  const handleCallBack = async (item: CallHistoryItem, callType?: 'audio' | 'video') => {
    if (!user) {
      Alert.alert('Error', 'You must be logged in to make calls');
      return;
    }

    setCalling(true);

    try {
      const typeToUse = callType || item.type; // Use passed type or fallback to item type
      console.log('[CallsScreen] Calling back:', item.otherParty.displayName, 'Type:', typeToUse);
      
      // Fetch current user's profile from Firestore
      const userProfileRef = doc(db, 'users', user.uid);
      const userProfileSnap = await getDoc(userProfileRef);
      const userProfile = userProfileSnap.exists() ? userProfileSnap.data() : null;
      
      const callId = await outgoingCall.initiateCall(
        user.uid,
        item.otherParty.userId,
        { 
          userId: user.uid, 
          displayName: userProfile?.displayName || user.phoneNumber || 'Unknown', 
          photoUrl: userProfile?.photoURL || null 
        },
        item.otherParty,
        typeToUse
      );

      if (callId) {
        // Navigate to appropriate call screen based on type
        if (typeToUse === 'video') {
          navigation.navigate('VideoCall', {
            callId,
            isOutgoing: true,
            otherParty: item.otherParty,
          });
        } else {
          navigation.navigate('AudioCall', {
            callId,
            isOutgoing: true,
            otherParty: item.otherParty,
          });
        }
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

  // Handle tapping a call row to open info sheet
  const handleCallRowPress = (item: CallHistoryItem) => {
    setSelectedCall(item);
    setInfoOpen(true);
  };

  // Handle audio call from info sheet
  const handleInfoAudioCall = () => {
    if (selectedCall) {
      setInfoOpen(false);
      handleCallBack(selectedCall, 'audio');
    }
  };

  // Handle video call from info sheet
  const handleInfoVideoCall = () => {
    if (selectedCall) {
      setInfoOpen(false);
      handleCallBack(selectedCall, 'video');
    }
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
        style={styles.callCard}
        onPress={() => handleCallRowPress(item)}
        activeOpacity={0.7}
      >
        <Avatar 
          initials={getInitials(item.otherParty.displayName)} 
          color={COLORS.blue} 
          size={48} 
          imageUrl={item.otherParty.photoUrl}
        />
        <View style={styles.callMeta}>
          <AppText style={styles.callName}>{item.otherParty.displayName}</AppText>
          <View style={styles.callSubRow}>
            <CallDirectionIcon direction={item.direction} status={item.status} />
            <AppText 
              fixedColor={isMissed} 
              style={[styles.callType, isMissed && styles.callTypeMissed]}
            >
              {item.direction === 'outgoing' ? 'Outgoing' : 'Incoming'} • {statusLabel}
            </AppText>
          </View>
        </View>
        <View style={styles.callRight}>
          <AppText style={styles.callTime}>
            {formatTimestamp(item.timestamp)}
          </AppText>
        </View>
      </TouchableOpacity>
    );
  };

  // Handle message button from info sheet
  const handleInfoMessage = async () => {
    if (!selectedCall || !user) return;
    
    setInfoOpen(false);
    
    try {
      // Get or create a direct chat with this contact
      const chatId = await getOrCreateDirectChat(user.uid, selectedCall.otherParty.userId);
      
      // Navigate to chat screen
      navigation.navigate('Chat', {
        chatId,
        displayName: selectedCall.otherParty.displayName,
        isGroup: false,
        otherUserId: selectedCall.otherParty.userId,
        otherUserPhoto: selectedCall.otherParty.photoUrl,
      });
    } catch (error) {
      console.error('[CallsScreen] Error navigating to chat:', error);
      Alert.alert('Error', 'Could not open chat. Please try again.');
    }
  };

  return (
    <View style={styles.root}>
      <AppBg />

      <CallInfoSheet
        call={selectedCall}
        visible={infoOpen}
        onClose={() => setInfoOpen(false)}
        onAudioCall={handleInfoAudioCall}
        onVideoCall={handleInfoVideoCall}
        onMessage={handleInfoMessage}
      />

      <ContactPickerSheet
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelectAudio={handleSelectAudioContact}
        onSelectVideo={handleSelectVideoContact}
        contacts={contacts}
        loading={contactsLoading}
      />

      <View style={styles.header}>
        <AppText style={styles.title}>Calls</AppText>
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
    shadowColor: '#1E9CF0',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.40,
    shadowRadius: 12,
    elevation: 10,
  },
  newCallPlus: {
    fontSize: 18,
    fontWeight: '300',
    color: '#fff',
    lineHeight: 20,
    marginTop: -1,
  },

  tabRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 14, paddingBottom: 14 },
  tabPill: {
    paddingHorizontal: 18, paddingVertical: 8, borderRadius: RADIUS.full,
    shadowColor: '#1E9CF0',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.40,
    shadowRadius: 12,
    elevation: 10,
  },
  tabPillInactive: {
    paddingHorizontal: 18, paddingVertical: 8, borderRadius: RADIUS.full,
    backgroundColor: 'rgba(180,225,245,0.22)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.45)',
  },
  tabTextActive:   { fontSize: 13, fontWeight: '700', color: '#fff' },
  tabTextInactive: { fontSize: 13, fontWeight: '500', color: COLORS.sub },

  listContent: { paddingHorizontal: 14, paddingBottom: 20 },

  callCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: 'rgba(180,225,245,0.22)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.45)',
    borderRadius: RADIUS.lg,
    paddingHorizontal: 14, paddingVertical: 13,
    shadowColor: '#0e6ea8',
    shadowOffset: { width: 2, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 4,
  },
  callMeta:       { flex: 1 },
  callName:       { fontSize: 14, fontWeight: '700', color: COLORS.text, marginBottom: 3 },
  callSubRow:     { flexDirection: 'row', alignItems: 'center', gap: 4 },
  callType:       { fontSize: 12, color: COLORS.sub },
  callTypeMissed: { color: COLORS.missed, fontWeight: '600' },
  callRight:      { alignItems: 'flex-end', gap: 6 },
  callTime:       { fontSize: 12, color: COLORS.sub },

  centerWrap: { alignItems: 'center', paddingTop: 80, gap: 12 },
  centerText: { fontSize: 15, color: COLORS.sub },
  errorText:  { fontSize: 13, color: COLORS.missed, textAlign: 'center', paddingHorizontal: 40 },
  
  emptyWrap: { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyText: { fontSize: 15, color: COLORS.sub, fontWeight: '600' },
  emptyHint: { fontSize: 13, color: COLORS.sub },

  callingOverlay: {
    ...StyleSheet.absoluteFill,
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
    backgroundColor: 'rgba(180,225,245,0.22)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.45)',
    borderRadius: RADIUS.lg,
    paddingHorizontal: 14, paddingVertical: 12,
    shadowColor: '#0e6ea8',
    shadowOffset: { width: 2, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 4,
  },
  contactMeta: { flex: 1 },
  contactName: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  contactNum:  { fontSize: 12, color: COLORS.sub, marginTop: 2 },

  // ── Call info sheet ───────────────────────────────────────────────────────
  infoSheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    height: '82%',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    overflow: 'hidden',
    ...SHADOW.glow,
  },
  infoHeader: {
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 16, 
    paddingHorizontal: 20, 
    paddingVertical: 20,
  },
  infoMeta: { flex: 1 },
  infoName: { fontSize: 20, fontWeight: '700', color: COLORS.text },
  infoNum: { fontSize: 13, marginTop: 3 },
  detailCard: {
    marginHorizontal: 20,
    marginBottom: 24,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    ...SHADOW.card,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  detailType: {
    fontSize: 15,
    fontWeight: '600',
  },
  detailTypeMissed: {},
  detailTime: {
    fontSize: 13,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  actionItem: {
    alignItems: 'center',
    gap: 8,
  },
  actionBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOW.button,
  },
  actionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text,
  },
  closeBtn: {
    marginHorizontal: 20,
    marginTop: 10,
    paddingVertical: 15,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  closeBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },
});
