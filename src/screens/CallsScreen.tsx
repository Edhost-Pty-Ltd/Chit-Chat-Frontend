// ─── Screen: Calls ───────────────────────────────────────────────────────────
import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  View, FlatList, TouchableOpacity, StyleSheet,
  Modal, Pressable, ScrollView, Alert, ActivityIndicator, TextInput,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { doc, getDoc } from 'firebase/firestore';
import NetInfo from '@react-native-community/netinfo';
import { db } from '../config/firebase';
import { Avatar, BottomNav } from '../components';
import { COLORS, RADIUS, SHADOW, GRADIENTS } from '../types/theme';
import type { CallHistoryItem } from '../types/call';
import type { RootStackParamList } from '../types';
import { AppBg, AppText, AppIcon, useForeground, useTypography, useGlass } from '../context/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../hooks/useAuth';
import { useCallHistory } from '../hooks/useCallHistory';
import { useGroupCall } from '../hooks/useGroupCall';
import { useContacts } from '../hooks/useContacts';
import { usePhoneBook } from '../hooks/usePhoneBook';
import { getOrCreateDirectChat } from '../hooks/useChatActions';
import { fetchUserPrivacySettings } from '../hooks/usePrivacySettings';
import { useFocusEffect } from '@react-navigation/native';
import { markMissedCallsAsViewed } from '../hooks/useMissedCalls';
import { loadLocalUserProfiles, saveLocalUserProfiles } from '../hooks/useLocalUserProfiles';

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

// Get initials from a display name. Usernames are always alphabetical.
function getInitials(name: string): string {
  if (!name || !name.trim()) return '?';
  
  // Split on whitespace and take first letter of first + last word
  const parts = name.trim().split(/\s+/).filter(Boolean);
  
  if (parts.length >= 2) {
    const first = parts[0][0];
    const last = parts[parts.length - 1][0];
    // Only use if they're actual letters
    if (/[a-zA-Z]/.test(first) && /[a-zA-Z]/.test(last)) {
      return (first + last).toUpperCase();
    }
  }
  if (parts.length === 1) {
    const first = parts[0][0];
    if (/[a-zA-Z]/.test(first)) {
      return first.toUpperCase();
    }
  }
  
  // Try to find any letter in the string
  const match = name.match(/[a-zA-Z]/);
  if (match) return match[0].toUpperCase();
  
  // No letters at all — try last 2 digits (phone number)
  const digits = name.replace(/\D/g, '');
  if (digits.length >= 2) return digits.slice(-2);
  if (digits.length === 1) return digits;
  
  return '?';
}

// Format E.164 phone number for display (e.g. +27 82 123 4567)
function formatSAPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  // South African +27 numbers: +27 XX XXX XXXX
  if (digits.startsWith('27') && digits.length === 11) {
    return `+${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  }
  // Generic international: +CC XXX XXX XXXX
  if (digits.length > 6) {
    if (digits.length <= 3) return `+${digits}`;
    if (digits.length <= 6) return `+${digits.slice(0, 2)} ${digits.slice(2)}`;
    return `+${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}`;
  }
  // Short numbers — return as-is with + prefix
  return phone.startsWith('+') ? phone : `+${phone}`;
}

function CallDirectionIcon({ direction, status }: { direction: 'incoming' | 'outgoing'; status: string }) {
  if (status === 'missed')     return <AppIcon name="call"              size={14} color={COLORS.missed} fixedColor />;
  if (direction === 'outgoing') return <AppIcon name="arrow-up-outline"  size={14} color={COLORS.green}  fixedColor />;
  return                               <AppIcon name="arrow-down-outline" size={14} color={COLORS.blue}   fixedColor />;
}

// ─── Call Info Sheet ──────────────────────────────────────────────────────────
function CallInfoSheet({
  call,
  resolvedName,
  resolvedInitials,
  resolvedPhone,
  resolvedPhoto,
  visible,
  onClose,
  onAudioCall,
  onVideoCall,
  onMessage,
}: {
  call: CallHistoryItem | null;
  resolvedName: string;
  resolvedInitials: string;
  resolvedPhone: string;
  resolvedPhoto: string | null;
  visible: boolean;
  onClose: () => void;
  onAudioCall: () => void;
  onVideoCall: () => void;
  onMessage?: () => void;
}) {
  const { FG } = useForeground();
  const { bevel } = useGlass();
  const { fontFamily, textColor } = useTypography();

  if (!call) return null;

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
            initials={resolvedInitials} 
            color={COLORS.blue} 
            size={64} 
            imageUrl={resolvedPhoto}
          />
          <View style={styles.infoMeta}>
            <AppText style={[styles.infoName, { color: textColor, fontFamily }]}>{resolvedName}</AppText>
            <AppText style={styles.infoNum}>
              {resolvedPhone ? formatSAPhone(resolvedPhone) : 'No number saved'}
            </AppText>
          </View>
        </View>

        {/* Call detail card — bevel glass */}
        <View style={[styles.detailCard, bevel]}>
          <View style={styles.detailRow}>
            <CallDirectionIcon direction={call.direction} status={call.status} />
            <AppText style={[styles.detailType, { color: statusColor, fontFamily }]} fixedColor={isMissed}>
              {statusText}
            </AppText>
          </View>
          <AppText style={[styles.detailTime, { fontFamily, color: FG.secondary }]}>
            {formatTimestamp(call.timestamp)}
          </AppText>
        </View>

        {/* Action buttons */}
        <View style={styles.actionRow}>
          {[
            { icon: 'call'       as const, label: 'Call',    onPress: onAudioCall },
            { icon: 'videocam'   as const, label: 'Video',   onPress: onVideoCall },
            { icon: 'chatbubble' as const, label: 'Message', onPress: () => onMessage?.() },
          ].map((btn) => (
            <View key={btn.label} style={styles.actionItem}>
              <TouchableOpacity onPress={btn.onPress} activeOpacity={0.85}>
                <LinearGradient colors={GRADIENTS.primary} style={styles.actionBtn}>
                  <AppIcon name={btn.icon} size={24} color="#fff" fixedColor />
                </LinearGradient>
              </TouchableOpacity>
              <AppText style={[styles.actionLabel, { color: textColor, fontFamily }]}>{btn.label}</AppText>
            </View>
          ))}
        </View>

        {/* Close — bevel glass */}
        <TouchableOpacity
          onPress={onClose}
          activeOpacity={0.85}
          style={[styles.closeBtn, bevel]}
        >
          <AppText style={[styles.closeBtnText, { color: textColor, fontFamily }]}>Close</AppText>
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
  const { bevel } = useGlass();
  const { FG } = useForeground();
  const { fontFamily, textColor } = useTypography();
  const [query, setQuery] = useState('');
  const searchRef = useRef<TextInput>(null);

  // Filter contacts by name or phone as the user types
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter(
      (c) =>
        c.displayName?.toLowerCase().includes(q) ||
        c.phone?.toLowerCase().includes(q)
    );
  }, [contacts, query]);

  const handleClose = () => {
    setQuery('');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide"
      onRequestClose={handleClose} statusBarTranslucent>
      <Pressable style={styles.overlay} onPress={handleClose} />
      <View style={styles.sheet}>
        <AppBg />
        <View style={styles.handle} />

        {/* Sheet header */}
        <View style={styles.sheetHeader}>
          <TouchableOpacity onPress={handleClose} style={styles.iconPad}>
            <AppIcon name="close" size={22} color={COLORS.sub} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <AppText style={[styles.sheetTitle, { color: textColor, fontFamily }]}>Call a contact</AppText>
            <AppText style={styles.sheetSub}>{filtered.length} contacts</AppText>
          </View>
        </View>

        {/* Search input */}
        <View style={[styles.searchRow, { backgroundColor: FG.glassBg, borderColor: FG.glassBorder }]}>
          <AppIcon name="search-outline" size={18} color={COLORS.sub} />
          <TextInput
            ref={searchRef}
            style={[styles.searchInput, { color: textColor }]}
            placeholder="Search contacts…"
            placeholderTextColor={COLORS.sub}
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
            autoCapitalize="none"
            clearButtonMode="while-editing"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <AppIcon name="close-circle" size={18} color={COLORS.sub} />
            </TouchableOpacity>
          )}
        </View>

        <AppText style={styles.sectionHint}>SELECT CONTACT TO CALL</AppText>

        {loading ? (
          <View style={styles.centerWrap}>
            <ActivityIndicator size="large" color={COLORS.blue} />
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.centerWrap}>
            <AppIcon name="people-outline" size={48} color={COLORS.sub} />
            <AppText style={styles.emptyText}>
              {query.trim() ? `No contacts matching "${query}"` : 'No contacts yet'}
            </AppText>
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
            {filtered.map((c) => (
              <TouchableOpacity key={c.userId} style={[styles.contactCard, bevel]}
                activeOpacity={0.75} onPress={() => onSelectAudio(c.userId, c.displayName, c.photoUri || c.firebasePhotoURL || null)}>
                <Avatar
                  initials={getInitials(c.displayName)}
                  color={COLORS.blue}
                  size={46}
                  imageUrl={c.photoUri || c.firebasePhotoURL || null}
                />
                <View style={styles.contactMeta}>
                  <AppText style={[styles.contactName, { color: textColor, fontFamily }]}>{c.displayName}</AppText>
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
  const { resolveName } = usePhoneBook();
  const groupCall = useGroupCall();
  const { bevel } = useGlass();
  const { fontFamily, textColor } = useTypography();
  const insets = useSafeAreaInsets();

  // Build a userId → phone map from device contacts so we can resolve names
  // for call-history entries using the phone-book rule (saved name > phone number).
  const userIdToPhone = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of contacts) {
      if (c.userId) map.set(c.userId, c.phone);
    }
    return map;
  }, [contacts]);

  // Mark missed calls as viewed when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      if (user?.uid) {
        markMissedCallsAsViewed(user.uid).catch((err) => {
          console.warn('[CallsScreen] Failed to mark missed calls as viewed:', err);
        });
      }
    }, [user?.uid])
  );

  // Build a userId → profile photo map from saved device contacts. Prefer the
  // device contact photo, falling back to the (privacy-filtered) Firebase photo.
  const userIdToPhoto = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const c of contacts) {
      if (c.userId) map.set(c.userId, c.photoUri || c.firebasePhotoURL || null);
    }
    return map;
  }, [contacts]);

  // For unsaved contacts, we fetch their Firebase profile displayName (the name
  // they used when signing up) and phone number so we can:
  //  - Show proper initials on the avatar (from signup username)
  //  - Display the phone number as the name label
  const [userIdToFirebaseProfile, setUserIdToFirebaseProfile] = useState<Map<string, { displayName: string; phone: string }>>(new Map());

  // Seed from the shared local profile cache (also populated by ChatsScreen) so
  // unsaved contacts' names/phones show immediately offline / on a cold start,
  // instead of blank until the Firestore lookup below completes.
  useEffect(() => {
    loadLocalUserProfiles().then((cached) => {
      if (cached.size > 0) {
        setUserIdToFirebaseProfile((prev) => new Map([...cached, ...prev]));
      }
    });
  }, []);

  // Persist saved contacts' userId → phone to the shared cache so their names
  // still resolve offline via the device phone book (there is no Firestore
  // cache on React Native, so an offline lookup by userId would otherwise fail).
  useEffect(() => {
    if (!contacts.length) return;
    const profiles = new Map<string, { displayName: string; phone: string }>();
    for (const c of contacts) {
      if (c.userId && c.phone) profiles.set(c.userId, { displayName: c.displayName, phone: c.phone });
    }
    if (profiles.size > 0) saveLocalUserProfiles(profiles).catch(() => {});
  }, [contacts]);

  // Fetch Firebase profiles for call participants who are NOT in saved contacts
  useEffect(() => {
    const fetchUnsavedUserProfiles = async () => {
      // Find userIds in call history that are NOT in saved contacts
      const unsavedUserIds = callHistory
        .map((c) => c.otherParty.userId)
        .filter((uid) => !userIdToPhone.has(uid));

      // Deduplicate
      const uniqueUnsaved = [...new Set(unsavedUserIds)];
      if (uniqueUnsaved.length === 0) return;

      // Only fetch for users we haven't cached yet
      const toFetch = uniqueUnsaved.filter((uid) => !userIdToFirebaseProfile.has(uid));
      if (toFetch.length === 0) return;

      // Fetch profiles from Firebase for each unsaved user
      const newProfiles = new Map<string, { displayName: string; phone: string }>();
      await Promise.all(
        toFetch.map(async (uid) => {
          try {
            const userDoc = await getDoc(doc(db, 'users', uid));
            if (userDoc.exists()) {
              const data = userDoc.data();
              newProfiles.set(uid, {
                displayName: data.displayName || '',
                phone: data.phone || '',
              });
            }
          } catch (err) {
            console.warn('[CallsScreen] Failed to fetch user profile:', uid, err);
          }
        })
      );

      // Merge with existing cached profiles
      if (newProfiles.size > 0) {
        setUserIdToFirebaseProfile((prev) => {
          const merged = new Map(prev);
          newProfiles.forEach((profile, uid) => merged.set(uid, profile));
          return merged;
        });
        // Persist to the shared local cache for instant offline resolution.
        saveLocalUserProfiles(newProfiles).catch(() => {});
      }
    };

    fetchUnsavedUserProfiles();
    // Only re-run when call history or saved contacts change (not the cache itself)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callHistory, userIdToPhone]);

  /** Resolve a profile photo for a call participant: saved contact photo → the
   *  photo stored on the call record → null (fall back to initials). */
  const resolveCallerPhoto = useCallback(
    (userId: string, fallbackPhoto: string | null): string | null => {
      const savedPhoto = userIdToPhoto.get(userId);
      return savedPhoto ?? fallbackPhoto ?? null;
    },
    [userIdToPhoto]
  );

  /** Resolve the DISPLAY NAME shown in the call row/info sheet:
   *  1. Saved contact → contact displayName (from useContacts)
   *  2. Unsaved contact → formatted phone number
   *  3. Fallback → whatever was stored in the call record
   */
  const resolveCallerName = useCallback(
    (userId: string, fallbackName: string): string => {
      // Check if this is a saved contact — use their displayName directly
      const savedContact = contacts.find((c) => c.userId === userId);
      if (savedContact) {
        return savedContact.displayName;
      }
      // Otherwise resolve via the cached phone number.
      const firebaseProfile = userIdToFirebaseProfile.get(userId);
      if (firebaseProfile?.phone) {
        // Prefer the device phone book name (works offline); resolveName
        // returns the phone number itself when the contact isn't saved.
        const deviceName = resolveName(firebaseProfile.phone);
        if (deviceName && deviceName !== firebaseProfile.phone) return deviceName;
        return formatSAPhone(firebaseProfile.phone);
      }
      // Fallback to whatever was stored in the call record
      return fallbackName;
    },
    [contacts, userIdToFirebaseProfile, resolveName]
  );

  /** Resolve INITIALS for the avatar:
   *  1. Saved contact → initials from contact's displayName (from useContacts)
   *  2. Unsaved contact → initials from their signup username (Firebase)
   *  3. Fallback → initials from whatever was stored in the call record
   */
  const resolveCallerInitials = useCallback(
    (userId: string, fallbackName: string): string => {
      // Check if this is a saved contact — use their displayName from useContacts directly
      const savedContact = contacts.find((c) => c.userId === userId);
      if (savedContact) {
        return getInitials(savedContact.displayName);
      }
      // Prefer the device phone book name (offline-capable) for initials.
      const firebaseProfile = userIdToFirebaseProfile.get(userId);
      if (firebaseProfile?.phone) {
        const deviceName = resolveName(firebaseProfile.phone);
        if (deviceName && deviceName !== firebaseProfile.phone) return getInitials(deviceName);
      }
      // Otherwise fall back to their Firebase signup username.
      if (firebaseProfile?.displayName) {
        return getInitials(firebaseProfile.displayName);
      }
      // Fallback to initials from whatever was stored in the call record
      if (fallbackName && fallbackName.trim()) {
        const initials = getInitials(fallbackName);
        if (initials !== '?') return initials;
      }
      // Absolute last resort
      return getInitials(userId || 'U');
    },
    [contacts, userIdToFirebaseProfile, resolveName]
  );
  
  const [tab, setTab] = useState<CallTab>('All');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [calling, setCalling] = useState(false);
  const [selectedCall, setSelectedCall] = useState<CallHistoryItem | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);

  // Resolved display name for the currently-selected call in the info sheet.
  const selectedCallName = selectedCall
    ? resolveCallerName(selectedCall.otherParty.userId, selectedCall.otherParty.displayName)
    : '';
  // Resolved initials for the info sheet avatar.
  const selectedCallInitials = selectedCall
    ? resolveCallerInitials(selectedCall.otherParty.userId, selectedCall.otherParty.displayName)
    : '';
  // Resolved phone number for the selected call (shown under the name in the sheet).
  // For saved contacts: from the device contacts map.
  // For unsaved contacts: from Firebase profile.
  const selectedCallPhone = selectedCall
    ? (userIdToPhone.get(selectedCall.otherParty.userId)
        ?? userIdToFirebaseProfile.get(selectedCall.otherParty.userId)?.phone
        ?? '')
    : '';
  // Resolved profile photo for the selected call (saved contact photo → record photo).
  const selectedCallPhoto = selectedCall
    ? resolveCallerPhoto(selectedCall.otherParty.userId, selectedCall.otherParty.photoUrl)
    : null;

  // Filter based on tab
  const filtered = tab === 'Missed' 
    ? callHistory.filter((c) => c.status === 'missed') 
    : callHistory;

  // ── Shared LiveKit call initiator ─────────────────────────────────────────
  // Creates the call document then navigates to OutgoingCall (the ringing
  // screen), which owns the rest of the outgoing lifecycle: waiting for the
  // callee to answer, starting the active call, timeout, and cancellation.
  const startLiveKitCall = async (
    calleeUserId: string,
    displayName: string,
    callType: 'audio' | 'video',
  ) => {
    if (!user) { Alert.alert('Error', 'You must be logged in to make calls'); return; }

    // Calls need a live connection (signaling + LiveKit media). Fail fast with
    // a clear message instead of hanging on the block/privacy/token chain
    // below, which would otherwise leave the "Starting call..." spinner stuck
    // for a long time before eventually erroring out.
    const net = await NetInfo.fetch();
    if (net.isConnected === false) {
      Alert.alert('No connection', "You're offline. Calls require an internet connection.");
      return;
    }

    // Block check (either direction blocks the call)
    try {
      const [iBlockedThem, theyBlockedMe] = await Promise.all([
        getDoc(doc(db, 'users', user.uid, 'blockedUsers', calleeUserId)),
        getDoc(doc(db, 'users', calleeUserId, 'blockedUsers', user.uid)),
      ]);
      if (iBlockedThem.exists()) {
        Alert.alert("Can't call", `You've blocked ${displayName}. Unblock them to make calls.`);
        return;
      }
      if (theyBlockedMe.exists()) {
        Alert.alert("Can't call", `You can no longer call ${displayName}.`);
        return;
      }
    } catch (err) {
      console.warn('[CallsScreen] Block check failed:', err);
    }

    // Privacy check
    const calleePrivacy = await fetchUserPrivacySettings(calleeUserId);
    if (calleePrivacy.calls === 'Nobody') {
      Alert.alert("Can't call", `${displayName} has turned off calls.`);
      return;
    }

    // Get or create a direct chat to use as the call room anchor
    const chatId = await getOrCreateDirectChat(user.uid, calleeUserId);
    const callerName = user.phoneNumber || user.displayName || 'Unknown';

    const result = await groupCall.initiateGroupCall(
      chatId,
      user.uid,
      callerName,
      [user.uid, calleeUserId],
      callType,
    );

    if (result) {
      // Compute avatar initials for the callee (signup username for unsaved contacts)
      const calleeInitials = resolveCallerInitials(calleeUserId, displayName);

      // OutgoingCallScreen owns everything from here.
      navigation.navigate('OutgoingCall', {
        callId: result.callId,
        displayName,
        callType,
        photoUrl: null,
        roomName: result.roomName,
        callerName,
        chatId,
        memberCount: 2,
        initials: calleeInitials,
      });
    } else {
      Alert.alert('Call Failed', 'Unable to start call. Please try again.');
    }
  };

  // Handle initiating an audio call from contact picker
  const handleSelectAudioContact = async (userId: string, displayName: string, photoUrl: string | null) => {
    if (!user) { Alert.alert('Error', 'You must be logged in to make calls'); return; }
    setPickerOpen(false);
    setCalling(true);
    try {
      await startLiveKitCall(userId, displayName, 'audio');
    } catch (err) {
      console.error('[CallsScreen] Audio call failed:', err);
      Alert.alert('Call Failed', 'Unable to start call. Please try again.');
    } finally {
      setCalling(false);
    }
  };

  // Handle initiating a video call from contact picker
  const handleSelectVideoContact = async (userId: string, displayName: string, photoUrl: string | null) => {
    if (!user) { Alert.alert('Error', 'You must be logged in to make calls'); return; }
    setPickerOpen(false);
    setCalling(true);
    try {
      await startLiveKitCall(userId, displayName, 'video');
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

      // Check the callee's privacyCalls setting before starting
      const calleePrivacy = await fetchUserPrivacySettings(item.otherParty.userId);
      if (calleePrivacy.calls === 'Nobody') {
        Alert.alert("Can't call", `${resolveCallerName(item.otherParty.userId, item.otherParty.displayName)} has turned off calls.`);
        return;
      }

      const callerDisplayName = resolveCallerName(item.otherParty.userId, item.otherParty.displayName);
      await startLiveKitCall(item.otherParty.userId, callerDisplayName, typeToUse);
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
    const resolvedName = resolveCallerName(item.otherParty.userId, item.otherParty.displayName);
    const resolvedInitials = resolveCallerInitials(item.otherParty.userId, item.otherParty.displayName);
    const resolvedPhoto = resolveCallerPhoto(item.otherParty.userId, item.otherParty.photoUrl);
    const statusLabel = item.status === 'completed' && item.duration
      ? formatDuration(item.duration)
      : item.status === 'missed' ? 'Missed'
      : item.status === 'rejected' ? 'Rejected'
      : item.status === 'busy' ? 'Busy'
      : 'Failed';

    return (
      <TouchableOpacity
        style={[styles.callCard, bevel]}
        onPress={() => handleCallRowPress(item)}
        activeOpacity={0.7}
      >
        <Avatar 
          initials={resolvedInitials} 
          color={COLORS.blue} 
          size={48} 
          imageUrl={resolvedPhoto}
        />
        <View style={styles.callMeta}>
          <AppText style={[styles.callName, { color: textColor, fontFamily }]}>{resolvedName}</AppText>
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
        displayName: selectedCallName || selectedCall.otherParty.displayName,
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
        resolvedName={selectedCallName}
        resolvedInitials={selectedCallInitials}
        resolvedPhone={selectedCallPhone}
        resolvedPhoto={selectedCallPhoto}
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

      <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
        <AppText style={[styles.title, { color: textColor, fontFamily }]}>Calls</AppText>
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
              style={[styles.tabPillInactive, bevel]} activeOpacity={0.7}>
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
    paddingHorizontal: 20, paddingTop: 0, paddingBottom: 14,
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
  },
  tabTextActive:   { fontSize: 13, fontWeight: '700', color: '#fff' },
  tabTextInactive: { fontSize: 13, fontWeight: '500', color: COLORS.sub },

  listContent: { paddingHorizontal: 14, paddingBottom: 20 },

  callCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: RADIUS.lg,
    paddingHorizontal: 14, paddingVertical: 13,
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
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 14,
    marginBottom: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: RADIUS.md,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 0,
  },

  // Contact cards in sheet
  contactCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    marginHorizontal: 14, marginBottom: 8,
    borderRadius: RADIUS.lg,
    paddingHorizontal: 14, paddingVertical: 12,
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(30,156,240,0.25)',
    backgroundColor: 'rgba(135,206,235,0.12)',
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
    alignItems: 'center',
  },
  closeBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },
});
