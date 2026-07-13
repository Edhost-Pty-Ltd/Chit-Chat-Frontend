// ─── Screen: Chat ────────────────────────────────────────────────────────────
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View, FlatList, TouchableOpacity, ScrollView,
  StyleSheet, TextInput, KeyboardAvoidingView, Platform,
  ActivityIndicator, PanResponder, Linking, Modal, Alert,
  GestureResponderEvent, PanResponderGestureState, Image, Dimensions,
  Animated,
} from 'react-native';
import { useNavigation, useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NotificationTestPanel } from '../components/NotificationTestPanel';

// Platform-specific imports for native-only modules
let CameraView: any = null;
let useCameraPermissions: any = null;
let useMediaLibraryPermissions: any = null;

if (Platform.OS !== 'web') {
  try {
    const camera = require('expo-camera');
    CameraView = camera.CameraView;
    useCameraPermissions = camera.useCameraPermissions;
    
    const mediaLibrary = require('expo-media-library');
    useMediaLibraryPermissions = mediaLibrary.usePermissions;
  } catch (err) {
    console.warn('[ChatScreen] Native modules not available:', err);
  }
} else {
  // Web fallbacks
  useCameraPermissions = () => [null, () => Promise.resolve({ status: 'denied' })];
  useMediaLibraryPermissions = () => [null, () => Promise.resolve({ status: 'denied' })];
}

import { collection, doc, getDoc, getDocs, writeBatch, query, where, serverTimestamp, addDoc, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Avatar } from '../components';
import { VoiceMessageBubble } from '../components/VoiceMessageBubble';
import { FileMessageBubble } from '../components/FileMessageBubble';
import { LocationMessageBubble } from '../components/LocationMessageBubble';
import { VoiceRecordingOverlay } from '../components/VoiceRecordingOverlay';
import { ForwardModal } from '../components/ForwardModal';
import { MessageInfoModal } from '../components/MessageInfoModal';
import { useAuth } from '../hooks/useAuth';
import { useMessages, FireMessage } from '../hooks/useMessages';
import { useVoicePlayer } from '../hooks/useVoicePlayer';
import { useVoiceRecorder, RecordingResult } from '../hooks/useVoiceRecorder';
import { useOutgoingCall } from '../hooks/useOutgoingCall';
import { useLocationSharing } from '../hooks/useLocationSharing';
import { useGroupCall } from '../hooks/useGroupCall';
import { usePhoneBook } from '../hooks/usePhoneBook';
import { useOtherUserPresence } from '../hooks/usePresence';
import { fetchUserPrivacySettings } from '../hooks/usePrivacySettings';
import { clearLocalMessages } from '../hooks/useLocalMessages';
import { useContacts, AppContact } from '../hooks/useContacts';
import { useActiveCall } from '../context/ActiveCallContext';
import { uploadVoiceNote, UploadProgress } from '../utils/voiceNoteStorage';
import { sendVoiceMessage, sendImageMessage, sendFileMessage, sendCurrentLocationMessage, sendLiveLocationMessage, stopLiveLocationSharing, markChatAsRead, getOrCreateDirectChat, sendGroupAddMessage, sendGroupRemoveMessage } from '../hooks/useChatActions';
import { normalizePhone } from '../utils/phoneUtils';
import { parseSystemMessage } from '../utils/systemMessageParser';
import { getDateLabel, groupMessagesByDate } from '../utils/dateUtils';
import { useTypingIndicator } from '../hooks/useTypingIndicator';
import { TypingIndicator } from '../components/TypingIndicator';
import { COLORS, RADIUS, SHADOW, GRADIENTS, GLASS } from '../types/theme';
import { RootStackParamList } from '../types';
import { AppBg, AppText, AppIcon, useForeground, useTypography, useGlass } from '../context/ThemeContext';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

type NavProp = NativeStackNavigationProp<RootStackParamList, 'Chat'>;
type RoutePropType = RouteProp<RootStackParamList, 'Chat'>;

// ── Constants ────────────────────────────────────────────────────────────────
const CANCEL_THRESHOLD_DP = 50;
const MAX_UPLOAD_RETRIES = 3;
const PERMISSION_MESSAGE_DURATION_MS = 3000;
const MUTE_STORAGE_KEY_PREFIX = 'chat_mute_';

// Common emoji picks
const EMOJI_LIST = [
  '😀', '😂', '😍', '🥰', '😎', '😢', '😡', '👍', '👎', '❤️',
  '🔥', '🎉', '🙏', '💯', '✅', '🤣', '😅', '🤔', '👀', '💪',
  '🥳', '😭', '🫡', '💀', '🤯', '🫶', '😴', '🤩', '😏', '🙈',
];

// ── Group Member Interface ────────────────────────────────────────────────────
interface GroupMember {
  userId: string;
  displayName: string;
  photoURL: string | null;
  status: 'online' | 'away' | 'offline';
  firebaseDisplayName?: string;  // The username they signed up with
  phone?: string;                // Their phone number
}

// ── Past Member Interface ──────────────────────────────────────────────────────
interface PastMember {
  userId: string;
  displayName: string;
  photoURL: string | null;
  leftAt: Date;
  reason?: string; // "left" | "Removed by [name]"
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Extract up to 2-char initials from a display name */
function getInitials(name: string): string {
  if (!name || !name.trim()) return '?';
  
  const parts = name.trim().split(/\s+/).filter(Boolean);
  
  if (parts.length >= 2) {
    const first = parts[0][0];
    const last = parts[parts.length - 1][0];
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
  
  const match = name.match(/[a-zA-Z]/);
  if (match) return match[0].toUpperCase();
  
  const digits = name.replace(/\D/g, '');
  if (digits.length >= 2) return digits.slice(-2);
  if (digits.length === 1) return digits;
  
  return '?';
}

/** Format a Date to a short time string like "14:32" */
function formatTime(date: Date | null): string {
  if (!date) return '';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/** Format a past member's left date to "Left [date]" */
function formatLeftDate(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) {
    return `Left today`;
  } else if (diffDays === 1) {
    return `Left yesterday`;
  } else if (diffDays < 7) {
    return `Left ${diffDays} days ago`;
  } else if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return `Left ${weeks} ${weeks === 1 ? 'week' : 'weeks'} ago`;
  } else if (diffDays < 365) {
    const months = Math.floor(diffDays / 30);
    return `Left ${months} ${months === 1 ? 'month' : 'months'} ago`;
  } else {
    return `Left ${date.toLocaleDateString([], { year: 'numeric', month: 'short' })}`;
  }
}
/** Format call duration in seconds to display format */
function formatCallDuration(durationInSeconds: number | null): string {
  if (!durationInSeconds) return '';

  if (durationInSeconds < 60) {
    return `${durationInSeconds} sec${durationInSeconds !== 1 ? 's' : ''}`;
  }

  const mins = Math.floor(durationInSeconds / 60);
  const secs = durationInSeconds % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

/** Determine message tick status */
type TickStatus = 'sent' | 'delivered' | 'read';
function getTickStatus(
  message: FireMessage,
  currentUserId: string | null,
  isGroup: boolean,
  groupMemberCount?: number
): TickStatus {
  // Only show ticks for outgoing messages
  if (message.senderId !== currentUserId) return 'read';

  const deliveredTo = message.deliveredTo || [];
  const readBy = message.readBy || [];

  // Remove sender from counts
  const deliveredCount = deliveredTo.filter(id => id !== currentUserId).length;
  const readCount = readBy.filter(id => id !== currentUserId).length;

  // For direct chats
  if (!isGroup) {
    if (readCount > 0) return 'read';
    if (deliveredCount > 0) return 'delivered';
    return 'sent';
  }

  // For group chats - blue ticks only when ALL other members have read
  const otherMemberCount = (groupMemberCount || 1) - 1; // exclude self
  if (otherMemberCount > 0 && readCount >= otherMemberCount) return 'read';
  // Double grey tick when at least one member delivered
  if (deliveredCount > 0) return 'delivered';
  // Otherwise single tick
  return 'sent';
}

/** Get tick icon and color based on status */
function getTickIcon(status: TickStatus): {
  icon: 'checkmark' | 'checkmark-done';
  color: string;
} {
  switch (status) {
    case 'sent':
      return { icon: 'checkmark', color: COLORS.sub };
    case 'delivered':
      return { icon: 'checkmark-done', color: COLORS.sub };
    case 'read':
      return { icon: 'checkmark-done', color: COLORS.blue };
  }
}

/** Get a consistent color for a group chat sender name (WhatsApp-style) */
const GROUP_NAME_COLORS = [
  '#e91e63', '#9c27b0', '#673ab7', '#3f51b5', '#0097a7',
  '#00796b', '#689f38', '#e65100', '#f57c00', '#5d4037',
  '#455a64', '#1565c0', '#ad1457', '#6a1b9a', '#283593',
];
function getSenderNameColor(senderId: string): string {
  let hash = 0;
  for (let i = 0; i < senderId.length; i++) {
    hash = senderId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return GROUP_NAME_COLORS[Math.abs(hash) % GROUP_NAME_COLORS.length];
}

/** Load muted state from AsyncStorage */
async function loadMutedState(chatId: string): Promise<boolean> {
  try {
    const key = `${MUTE_STORAGE_KEY_PREFIX}${chatId}`;
    const value = await AsyncStorage.getItem(key);
    return value === 'true';
  } catch (error) {
    console.error('[ChatScreen] Failed to load muted state:', error);
    return false;
  }
}

/** Save muted state to AsyncStorage */
async function saveMutedState(chatId: string, muted: boolean): Promise<void> {
  try {
    const key = `${MUTE_STORAGE_KEY_PREFIX}${chatId}`;
    await AsyncStorage.setItem(key, muted.toString());
  } catch (error) {
    console.error('[ChatScreen] Failed to save muted state:', error);
  }
}

export default function ChatScreen() {
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RoutePropType>();
  const insets = useSafeAreaInsets();
  const { chatId, displayName, isGroup, otherUserId, otherUserPhoto } = route.params;
  const { FG } = useForeground();
  const { fontFamily, textColor } = useTypography();
  const { bevel } = useGlass();

  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [mediaLibraryPermission, requestMediaLibraryPermission] = useMediaLibraryPermissions();

  // ── Auth — get current user ID ──────────────────────────────────
  const { user } = useAuth();
  const userId = user?.uid ?? null;

  // Mark chat as read when screen comes into focus
 useFocusEffect(
  useCallback(() => {
    console.log('🟢 [ChatScreen] useFocusEffect triggered - chatId:', chatId, 'userId:', user?.uid);
    if (chatId && user?.uid) {
      markChatAsRead(chatId, user.uid).catch((err) => {
        console.warn('[ChatScreen] Failed to mark chat as read:', err);
      });
      // Also mark individual messages as read (updates ticks for the sender)
      // Respects the current user's read receipts privacy setting
      fetchUserPrivacySettings(user.uid).then((privacy) => {
        markAsRead(chatId, user.uid, privacy.readReceipts);
      }).catch((err) => {
        console.warn('[ChatScreen] Failed to mark messages as read:', err);
      });
    } else {
      console.warn('⚠️ [ChatScreen] Missing chatId or userId:', { chatId, userId: user?.uid });
    }
  }, [chatId, user?.uid])
);

  // ── Messages — real-time Firestore stream ───────────────────────
  const { messages, loading, sendMessage, markAsRead, loadOlder, hasMore, loadingOlder } = useMessages(chatId, userId);

  // ── Group rejoin timestamp (hide messages before this) ──────────
  const [memberJoinedAt, setMemberJoinedAt] = useState<Date | null>(null);

  // ── Filter out blocked messages for recipient ───────────────────
  // If I receive a message that was sent while I was blocked, don't show it
  // Exception: In group chats, show all messages regardless of block status
  const filteredMessages = useMemo(() => {
    let filtered = messages;
    
    // In group chats, filter out messages from before the user's join time
    if (isGroup && memberJoinedAt) {
      filtered = filtered.filter(msg => {
        if (!msg.timestamp) return true; // keep messages without timestamp (pending)
        return msg.timestamp >= memberJoinedAt;
      });
    }
    
    // In 1-on-1 chats, filter out blocked messages for recipient
    if (!isGroup) {
      filtered = filtered.filter(msg => {
        if (msg.blockedMessage && msg.senderId !== userId) return false;
        return true;
      });
    }
    
    return filtered;
  }, [messages, userId, isGroup, memberJoinedAt]);

  // ── Group messages by date with separators ──────────────────────
  // This creates a flat list of messages with date separator items inserted
  // whenever messages cross a calendar day boundary
  type MessageListItem = 
    | { type: 'message'; data: FireMessage }
    | { type: 'dateSeparator'; dateLabel: string; date: Date };

  const messagesWithDates = useMemo((): MessageListItem[] => {
    if (filteredMessages.length === 0) return [];

    const items: MessageListItem[] = [];
    let currentDateLabel: string | null = null;

    filteredMessages.forEach((message, index) => {
      if (!message.timestamp) {
        // Skip messages without timestamps
        items.push({ type: 'message', data: message });
        return;
      }

      const messageDate = message.timestamp instanceof Date 
        ? message.timestamp 
        : new Date(message.timestamp);

      if (isNaN(messageDate.getTime())) {
        // Skip invalid dates
        items.push({ type: 'message', data: message });
        return;
      }

      const dateLabel = getDateLabel(messageDate, 'long');

      // Insert date separator if we're entering a new day
      if (dateLabel !== currentDateLabel) {
        items.push({
          type: 'dateSeparator',
          dateLabel,
          date: messageDate,
        });
        currentDateLabel = dateLabel;
      }

      items.push({ type: 'message', data: message });
    });

    return items;
  }, [filteredMessages]);

  // ── Voice player — single-active-player management ─────────────
  const player = useVoicePlayer();

  // ── Typing presence ────────────────────────────────────────────
  const { typingUsers, setTyping } = useTypingIndicator(chatId, userId);

  // ── Voice recorder ─────────────────────────────────────────────
  const recorder = useVoiceRecorder();

  // ── Outgoing call ──────────────────────────────────────────────
  const outgoingCall = useOutgoingCall();

  // ── Group call ──────────────────────────────────────────────────
  const groupCall = useGroupCall();

  // ── Active call (app-level LiveKit host; supports minimize) ──────
  const { startCall: startActiveCall } = useActiveCall();

  // ── Phone book name resolver (saved contact name, else phone number) ──
  const { resolveName } = usePhoneBook();

  /** Resolve a senderId to name and phone for group sender labels. */
  const resolveSenderInfo = (senderId: string): { name: string; phone: string } => {
    if (senderId === userId) return { name: 'You', phone: '' };
    if (!isGroup) return { name: displayName, phone: '' };
    // Check group members (has Firebase displayName + phone)
    const member = groupMembers.find((m) => m.userId === senderId);
    // Check contacts
    const contact = phoneContacts.find((c) => c.userId === senderId);
    
    // Name priority: contact name (phone book) > Firebase signup name > phone number
    const contactName = contact?.displayName || '';
    const firebaseName = member?.firebaseDisplayName || '';
    const phone = member?.phone || contact?.phone || '';
    
    // Use contact name if saved, otherwise Firebase displayName
    const name = contactName || firebaseName || '';
    
    if (name) return { name, phone };
    if (phone) return { name: phone, phone: '' };
    return { name: senderId.slice(0, 8) + '…', phone: '' };
  };

  /** Resolve a senderId to a single display name (for replies, typing, etc.) */
  const resolveSenderName = (senderId: string): string => {
    if (senderId === userId) return 'You';
    if (!isGroup) return displayName;
    const info = resolveSenderInfo(senderId);
    return info.name;
  };

  // ── Presence: watch other user's status (write presence moved to App level) ─
  // viewerIsContact: true by default — chats only exist between contacts.
  const { statusText: presenceText, isOnline, photoURL: livePhotoURL } = useOtherUserPresence(
    isGroup ? null : otherUserId ?? null,
    isGroup,
    true, // they're in your contacts if you have a chat with them
  );
  // The photo to display for the other user: the live, privacy-filtered value
  // once loaded, otherwise the value passed via navigation params.
  const headerPhoto = isGroup
    ? otherUserPhoto
    : (livePhotoURL === undefined ? otherUserPhoto : livePhotoURL);

  // ── Contacts (for share contact feature) ──────────────────────────────────
  const { contacts: phoneContacts, loading: contactsLoading, hasPermission: contactsPermission } = useContacts();
  
  // Debug: log contacts whenever they change
  useEffect(() => {
    console.log('[ChatScreen] phoneContacts updated:', {
      count: phoneContacts?.length ?? 0,
      loading: contactsLoading,
      hasPermission: contactsPermission,
      sample: phoneContacts?.slice(0, 2).map(c => ({ name: c.displayName, userId: c.userId })) ?? []
    });
  }, [phoneContacts, contactsLoading, contactsPermission]);

  // ── Firebase signup name for unsaved contacts (used for avatar initials on calls) ──
  const [otherUserSignupName, setOtherUserSignupName] = useState<string | null>(null);
  useEffect(() => {
    if (isGroup || !otherUserId) return;
    // Check if the contact is saved in the phone book
    const isSaved = phoneContacts.some((c) => c.userId === otherUserId);
    if (isSaved) {
      // Saved contact — initials come from the phone-book name, no fetch needed
      setOtherUserSignupName(null);
      return;
    }
    // Unsaved contact — fetch their Firebase profile for the signup username
    getDoc(doc(db, 'users', otherUserId)).then((snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.displayName) {
          setOtherUserSignupName(data.displayName);
        }
      }
    }).catch((err) => {
      console.warn('[ChatScreen] Failed to fetch other user profile:', err);
    });
  }, [isGroup, otherUserId, phoneContacts]);

  // ── Location sharing ────────────────────────────────────────────
  const locationSharing = useLocationSharing();

  const [input, setInput] = useState('');
  const listRef = useRef<FlatList>(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showAttach, setShowAttach] = useState(false);
  const [showLocationMenu, setShowLocationMenu] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [muted, setMuted] = useState(false);
  const [selectedDuration, setSelectedDuration] = useState(15);

  // ── Search state ────────────────────────────────────────────────────
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  // Ordered list of messageIds that match the current query (oldest → newest).
  const [searchMatchIds, setSearchMatchIds] = useState<string[]>([]);
  // Index within searchMatchIds of the currently "active" (navigated-to) match.
  const [searchCurrentIndex, setSearchCurrentIndex] = useState(0);
  // The message ID currently being highlighted after a search-result tap.
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const highlightAnim = useRef(new Animated.Value(0)).current;
  const searchInputRef = useRef<TextInput>(null);

  // ── Group members state ─────────────────────────────────────────
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [groupCreatedBy, setGroupCreatedBy] = useState<string | null>(null);
  const [groupPhotoURL, setGroupPhotoURL] = useState<string | null>(null);
  const [groupBio, setGroupBio] = useState<string>('');
  const [editingBio, setEditingBio] = useState(false);
  const [bioInput, setBioInput] = useState<string>('');
  // Resolve typing user display names (depends on groupMembers)
  const typingNames = useMemo(() => {
    return typingUsers.map(({ userId: uid }) => {
      if (!isGroup) return displayName;
      const member = groupMembers.find((m) => m.userId === uid);
      if (member?.displayName) return member.displayName;
      // Fallback to contacts list
      const contact = phoneContacts.find((c) => c.userId === uid);
      if (contact?.displayName) return contact.displayName;
      return contact?.phone ?? uid;
    });
  }, [typingUsers, isGroup, displayName, groupMembers, phoneContacts]);

  // ── Past members state ──────────────────────────────────────────
  const [pastMembers, setPastMembers] = useState<PastMember[]>([]);
  const [loadingPastMembers, setLoadingPastMembers] = useState(false);

  // ── Block contact state ─────────────────────────────────────────
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockedByMe, setBlockedByMe] = useState(false); // I blocked them
  const [blockedByThem, setBlockedByThem] = useState(false); // They blocked me
  const [checkingBlockedStatus, setCheckingBlockedStatus] = useState(true);
  const [showBlockConfirmation, setShowBlockConfirmation] = useState(false);

  // ── Leave group state ───────────────────────────────────────────
  const [showLeaveGroupConfirmation, setShowLeaveGroupConfirmation] = useState(false);
  const [leavingGroup, setLeavingGroup] = useState(false);

  // ── Upload & retry state ────────────────────────────────────────
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const pendingRecordingRef = useRef<RecordingResult | null>(null);

  // ── Image upload state ──────────────────────────────────────────
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageUploadProgress, setImageUploadProgress] = useState<number>(0);

  // ── Image viewer state ──────────────────────────────────────────
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerImageUrl, setViewerImageUrl] = useState<string | null>(null);
  const [viewerMenuOpen, setViewerMenuOpen] = useState(false);

  // ── Selected message state (for long-press actions) ────────────
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [showMessageActions, setShowMessageActions] = useState(false);

  // ── Reply state ─────────────────────────────────────────────────
  const [replyingTo, setReplyingTo] = useState<FireMessage | null>(null);

  // ── Forward state ───────────────────────────────────────────────
  const [forwardModalVisible, setForwardModalVisible] = useState(false);
  const [messageToForward, setMessageToForward] = useState<FireMessage | null>(null);

  // ── Message info state ──────────────────────────────────────────
  const [messageInfoVisible, setMessageInfoVisible] = useState(false);
  const [messageForInfo, setMessageForInfo] = useState<FireMessage | null>(null);

  // ── Contact picker state (share contact via 3-dot menu) ─────────
  const [contactPickerOpen, setContactPickerOpen] = useState(false);
  const [contactQuery, setContactQuery] = useState('');

  // ── Received-contact action sheet state ─────────────────────────
  const [contactActionCard, setContactActionCard] = useState<{
    name: string;
    phone: string;
    userId: string | null;
  } | null>(null);

  // ── Add member picker state (group info) ────────────────────────
  const [addMemberPickerOpen, setAddMemberPickerOpen] = useState(false);
  const [addMemberQuery, setAddMemberQuery] = useState('');

  // ── Invite link picker state (send link within app) ─────────────
  const [invitePickerOpen, setInvitePickerOpen] = useState(false);
  const [invitePickerQuery, setInvitePickerQuery] = useState('');

  // ── Shared media gallery state ──────────────────────────────────
  const [mediaGalleryOpen, setMediaGalleryOpen] = useState(false);

  // ── Group invite preview modal state ────────────────────────────
  const [invitePreview, setInvitePreview] = useState<{
    inviteCode: string;
    groupName: string;
    groupId?: string;
  } | null>(null);
  const [invitePreviewData, setInvitePreviewData] = useState<{
    groupPhotoURL: string | null;
    groupName: string;
    createdBy: string;
    createdAt: string;
    memberCount: number;
    isAlreadyMember: boolean;
  } | null>(null);
  const [loadingInvitePreview, setLoadingInvitePreview] = useState(false);

  // Debug log for contacts
  useEffect(() => {
    if (contactPickerOpen) {
      console.log('[ChatScreen] Contact picker opened. Contacts:', phoneContacts?.length ?? 0, 'Loading:', contactsLoading, 'Permission:', contactsPermission);
      if (phoneContacts && phoneContacts.length > 0) {
        const filtered = phoneContacts
          .filter(c => c.userId && c.userId !== userId)
          .filter(c => c.userId !== otherUserId);
        console.log('[ChatScreen] After filtering (excluding self & chat partner):', filtered.length);
        console.log('[ChatScreen] userId:', userId, 'otherUserId:', otherUserId);
        console.log('[ChatScreen] First 3 contacts:', filtered.slice(0, 3).map(c => ({ name: c.displayName, userId: c.userId })));
      }
    }
  }, [contactPickerOpen, phoneContacts, contactsLoading, contactsPermission, userId, otherUserId]);

  // ── Camera ref ──────────────────────────────────────────────────
  const cameraRef = useRef<any>(null);

  // ── Permission message state ────────────────────────────────────
  const [permissionMessage, setPermissionMessage] = useState<string | null>(null);
  const [showSettingsButton, setShowSettingsButton] = useState(false);
  const permissionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Track if recording was cancelled via gesture ─────────────────
  const isCancelledRef = useRef(false);

  // ── Load muted state from AsyncStorage on mount ─────────────────
  useEffect(() => {
    let isMounted = true;
    
    const loadMuted = async () => {
      const savedMuted = await loadMutedState(chatId);
      if (isMounted) {
        setMuted(savedMuted);
      }
    };
    
    loadMuted();
    
    return () => {
      isMounted = false;
    };
  }, [chatId]);

  // ── Eagerly load group members for sender name resolution ────────
  useEffect(() => {
    if (!isGroup || !chatId || groupMembers.length > 0) return;
    
    const fetchMembersEagerly = async () => {
      try {
        const chatRef = doc(db, 'chats', chatId);
        const chatSnap = await getDoc(chatRef);
        if (!chatSnap.exists()) return;
        const chatData = chatSnap.data();
        const memberIds = chatData.members as string[] || [];
        setGroupCreatedBy(chatData.createdBy ?? null);
        setGroupPhotoURL(chatData.groupPhotoURL ?? null);
        setGroupBio(chatData.groupBio ?? '');
        
        // Load user's join timestamp for message filtering
        const joinedAtMap = chatData.memberJoinedAt || {};
        if (userId && joinedAtMap[userId]) {
          const ts = joinedAtMap[userId];
          setMemberJoinedAt(ts.toDate ? ts.toDate() : new Date(ts));
        }
        if (memberIds.length === 0) return;

        const memberPromises = memberIds.map(async (memberId) => {
          try {
            const userRef = doc(db, 'users', memberId);
            const userSnap = await getDoc(userRef);
            if (userSnap.exists()) {
              const userData = userSnap.data();
              // Priority: phone book name > Firebase displayName > phone number
              const phoneBookName = resolveName(userData.phone, '');
              const firebaseName = userData.displayName || '';
              const resolvedName = phoneBookName || firebaseName || userData.phone || 'Unknown';
              return {
                userId: memberId,
                displayName: resolvedName,
                photoURL: userData.photoURL || null,
                status: userData.status || 'offline',
                firebaseDisplayName: firebaseName,
                phone: userData.phone || '',
              } as GroupMember;
            }
            return { userId: memberId, displayName: 'Unknown', photoURL: null, status: 'offline' } as GroupMember;
          } catch { return { userId: memberId, displayName: 'Unknown', photoURL: null, status: 'offline' } as GroupMember; }
        });
        const members = await Promise.all(memberPromises);
        setGroupMembers(members);
      } catch (err) {
        console.error('[ChatScreen] Eager group members fetch failed:', err);
      }
    };
    fetchMembersEagerly();
  }, [isGroup, chatId]);

  // ── Fetch group members when profile modal opens ────────────────
  useEffect(() => {
    if (!profileModalOpen || !isGroup || !chatId) return;

    const fetchGroupMembers = async () => {
      setLoadingMembers(true);
      try {
        console.log('[ChatScreen] Fetching group members for chat:', chatId);
        
        // First, get the chat document to retrieve member IDs
        const chatRef = doc(db, 'chats', chatId);
        const chatSnap = await getDoc(chatRef);
        
        if (!chatSnap.exists()) {
          console.warn('[ChatScreen] Chat document not found');
          setGroupMembers([]);
          setLoadingMembers(false);
          return;
        }

        const chatData = chatSnap.data();
        const memberIds = chatData.members as string[] || [];
        setGroupCreatedBy(chatData.createdBy ?? null);
        setGroupPhotoURL(chatData.groupPhotoURL ?? null);
        setGroupBio(chatData.groupBio ?? '');
        
        console.log('[ChatScreen] Found member IDs:', memberIds);

        if (memberIds.length === 0) {
          setGroupMembers([]);
          setLoadingMembers(false);
          return;
        }

        // Fetch each member's profile from the users collection
        const memberPromises = memberIds.map(async (memberId) => {
          try {
            const userRef = doc(db, 'users', memberId);
            const userSnap = await getDoc(userRef);
            
            if (userSnap.exists()) {
              const userData = userSnap.data();
              const photoPrivacy = userData.privacyProfilePhoto ?? 'Contacts';
              return {
                userId: memberId,
                displayName: resolveName(userData.phone, 'Unknown'),
                photoURL: photoPrivacy === 'Nobody' ? null : (userData.photoURL || null),
                status: userData.status || 'offline',
              } as GroupMember;
            }
            
            // Fallback for users without profile data
            return {
              userId: memberId,
              displayName: 'Unknown User',
              photoURL: null,
              status: 'offline',
            } as GroupMember;
          } catch (error) {
            console.error('[ChatScreen] Error fetching user:', memberId, error);
            return {
              userId: memberId,
              displayName: 'Unknown User',
              photoURL: null,
              status: 'offline',
            } as GroupMember;
          }
        });

        const members = await Promise.all(memberPromises);
        console.log('[ChatScreen] Fetched group members:', members.length);
        setGroupMembers(members);
      } catch (error) {
        console.error('[ChatScreen] Error fetching group members:', error);
        setGroupMembers([]);
      } finally {
        setLoadingMembers(false);
      }
    };

    fetchGroupMembers();
  }, [profileModalOpen, isGroup, chatId]);

  // ── Fetch past members when profile modal opens ─────────────────
  useEffect(() => {
    if (!profileModalOpen || !isGroup || !chatId) return;

    const fetchPastMembers = async () => {
      setLoadingPastMembers(true);
      try {
        console.log('[ChatScreen] Fetching past members for chat:', chatId);
        
        // First, get the chat document to check for pastMembers field
        const chatRef = doc(db, 'chats', chatId);
        const chatSnap = await getDoc(chatRef);
        
        if (!chatSnap.exists()) {
          console.warn('[ChatScreen] Chat document not found');
          setPastMembers([]);
          setLoadingPastMembers(false);
          return;
        }

        const chatData = chatSnap.data();
        const pastMemberData = chatData.pastMembers as Array<{
          userId: string;
          leftAt: any; // Firestore Timestamp
          reason?: string;
        }> | undefined;
        
        console.log('[ChatScreen] Found past member data:', pastMemberData);

        if (!pastMemberData || pastMemberData.length === 0) {
          setPastMembers([]);
          setLoadingPastMembers(false);
          return;
        }

        // Fetch each past member's profile from the users collection
        const pastMemberPromises = pastMemberData.map(async (pastMemberEntry) => {
          try {
            const userRef = doc(db, 'users', pastMemberEntry.userId);
            const userSnap = await getDoc(userRef);
            
            // Convert Firestore Timestamp to Date
            const leftAtDate = pastMemberEntry.leftAt?.toDate ? 
              pastMemberEntry.leftAt.toDate() : 
              new Date(pastMemberEntry.leftAt);
            
            if (userSnap.exists()) {
              const userData = userSnap.data();
              return {
                userId: pastMemberEntry.userId,
                displayName: resolveName(userData.phone, 'Unknown'),
                photoURL: userData.photoURL || null,
                leftAt: leftAtDate,
                reason: pastMemberEntry.reason ?? 'Left',
              } as PastMember;
            }
            
            // Fallback for users without profile data
            return {
              userId: pastMemberEntry.userId,
              displayName: 'Unknown User',
              photoURL: null,
              leftAt: leftAtDate,
              reason: pastMemberEntry.reason ?? 'Left',
            } as PastMember;
          } catch (error) {
            console.error('[ChatScreen] Error fetching past member:', pastMemberEntry.userId, error);
            return {
              userId: pastMemberEntry.userId,
              displayName: 'Unknown User',
              photoURL: null,
              leftAt: new Date(),
            } as PastMember;
          }
        });

        const members = await Promise.all(pastMemberPromises);
        console.log('[ChatScreen] Fetched past members:', members.length);
        setPastMembers(members);
      } catch (error) {
        console.error('[ChatScreen] Error fetching past members:', error);
        setPastMembers([]);
      } finally {
        setLoadingPastMembers(false);
      }
    };

    fetchPastMembers();
  }, [profileModalOpen, isGroup, chatId]);

  // ── Check blocked status ─────────────────────────────────────────
  useEffect(() => {
    if (!userId || !otherUserId || isGroup) {
      setCheckingBlockedStatus(false);
      setIsBlocked(false);
      return;
    }

    const checkBlockedStatus = async () => {
      try {
        console.log('[ChatScreen] Checking if contact is blocked:', otherUserId);
        
        // Check if the current user has blocked the other user
        const blockedByMeRef = doc(db, 'users', userId, 'blockedUsers', otherUserId);
        const blockedByMeSnap = await getDoc(blockedByMeRef);
        
        // Check if the other user has blocked the current user
        const blockedMeRef = doc(db, 'users', otherUserId, 'blockedUsers', userId);
        const blockedMeSnap = await getDoc(blockedMeRef);
        
        const iBlockedThem = blockedByMeSnap.exists();
        const theyBlockedMe = blockedMeSnap.exists();
        
        setBlockedByMe(iBlockedThem);
        setBlockedByThem(theyBlockedMe);
        setIsBlocked(iBlockedThem || theyBlockedMe);
        
        console.log('[ChatScreen] Blocked status - by me:', iBlockedThem, ', by them:', theyBlockedMe);
      } catch (error) {
        // Expected while offline (Firestore throws when a doc isn't cached
        // and there's no connection) — warn instead of error so it doesn't
        // trigger the intrusive red error overlay in dev, and keep whatever
        // blocked state was last known rather than resetting it.
        console.warn('[ChatScreen] Error checking blocked status (likely offline):', error);
      } finally {
        setCheckingBlockedStatus(false);
      }
    };

    checkBlockedStatus();
  }, [userId, otherUserId, isGroup]);

  // ── Re-check blocked status when screen comes into focus ────────
  useFocusEffect(
    React.useCallback(() => {
      if (!isGroup && userId && otherUserId) {
        (async () => {
          try {
            const blockedByMeRef = doc(db, 'users', userId, 'blockedUsers', otherUserId);
            const blockedByMeSnap = await getDoc(blockedByMeRef);
            
            const blockedMeRef = doc(db, 'users', otherUserId, 'blockedUsers', userId);
            const blockedMeSnap = await getDoc(blockedMeRef);
            
            const iBlockedThem = blockedByMeSnap.exists();
            const theyBlockedMe = blockedMeSnap.exists();
            
            setBlockedByMe(iBlockedThem);
            setBlockedByThem(theyBlockedMe);
            setIsBlocked(iBlockedThem || theyBlockedMe);
          } catch (error) {
            // Expected while offline — see note in the mount-time check above.
            console.warn('[ChatScreen] Error re-checking blocked status (likely offline):', error);
          }
        })();
      }
    }, [userId, otherUserId, isGroup])
  );

  // ── Stop playback on unmount / navigation away ──────────────────
  useEffect(() => {
    return () => {
      player.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Auto-scroll when new messages arrive ────────────────────────
  // Skip while paging in older messages so the viewport stays anchored to
  // what the user is reading instead of jumping to the bottom.
  useEffect(() => {
    if (loadingOlder) return;
    if (filteredMessages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [filteredMessages.length, loadingOlder]);

  // ── Handle permission denied states ─────────────────────────────
  useEffect(() => {
    if (recorder.state.permissionDenied) {
      if (recorder.state.permissionDeniedPermanently) {
        setShowSettingsButton(true);
        setPermissionMessage('Microphone access is required for voice notes. Please enable it in Settings.');
      } else {
        setShowSettingsButton(false);
        setPermissionMessage('Microphone access is required for voice notes.');
        if (permissionTimerRef.current) clearTimeout(permissionTimerRef.current);
        permissionTimerRef.current = setTimeout(() => {
          setPermissionMessage(null);
        }, PERMISSION_MESSAGE_DURATION_MS);
      }
    }

    return () => {
      if (permissionTimerRef.current) clearTimeout(permissionTimerRef.current);
    };
  }, [recorder.state.permissionDenied, recorder.state.permissionDeniedPermanently]);

  // ── Search handler ──────────────────────────────────────────────
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setSearchMatchIds([]);
      setSearchCurrentIndex(0);
      setHighlightedMessageId(null);
      return;
    }
    const q = query.toLowerCase();
    // Collect matching IDs oldest→newest (messages are already sorted asc).
    const ids = messages
      .filter((m) => m.type === 'text' && m.text?.toLowerCase().includes(q))
      .map((m) => m.messageId);
    setSearchMatchIds(ids);
    // Jump to the most recent match (last index) like WhatsApp.
    const startIdx = ids.length > 0 ? ids.length - 1 : 0;
    setSearchCurrentIndex(startIdx);
    if (ids.length > 0) scrollToAndHighlight(ids[startIdx]);
  }, [messages]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Navigate up/down through matches. direction: -1 = up (older), +1 = down (newer). */
  const navigateMatch = useCallback((direction: -1 | 1) => {
    setSearchCurrentIndex((prev) => {
      const next = Math.max(0, Math.min(searchMatchIds.length - 1, prev + direction));
      if (searchMatchIds[next]) scrollToAndHighlight(searchMatchIds[next]);
      return next;
    });
  }, [searchMatchIds]); // eslint-disable-line react-hooks/exhaustive-deps

  const scrollToAndHighlight = (messageId: string) => {
    const index = messages.findIndex(m => m.messageId === messageId);
    if (index !== -1 && listRef.current) {
      listRef.current.scrollToIndex({ index, animated: true, viewPosition: 0.4 });
    }
    setHighlightedMessageId(messageId);
    highlightAnim.setValue(1);
    Animated.timing(highlightAnim, {
      toValue: 0,
      duration: 1500,
      useNativeDriver: true,
    }).start(() => setHighlightedMessageId(null));
  };

  // ── Scroll to message handler ───────────────────────────────────
  const scrollToMessage = useCallback((messageId: string) => {
    scrollToAndHighlight(messageId);
  }, [messages, highlightAnim]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Upload and send voice note ──────────────────────────────────
  const handleVoiceUploadAndSend = useCallback(async (result: RecordingResult) => {
    if (!userId) return;

    const messageId = doc(collection(db, 'chats', chatId, 'messages')).id;

    setIsUploading(true);
    setUploadProgress(0);
    setUploadError(null);
    pendingRecordingRef.current = result;

    try {
      const uploadResult = await uploadVoiceNote(
        result.uri,
        chatId,
        messageId,
        (progress: UploadProgress) => {
          setUploadProgress(progress.percentage);
        },
      );

      await sendVoiceMessage(chatId, userId, uploadResult.downloadUrl, result.durationMs);

      setIsUploading(false);
      setUploadProgress(0);
      setRetryCount(0);
      pendingRecordingRef.current = null;
    } catch (error: any) {
      console.error('[ChatScreen] Voice upload failed:', error);
      setIsUploading(false);

      const isNetworkError = error.message === 'UPLOAD_TIMEOUT' ||
        error.code === 'storage/retry-limit-exceeded' ||
        error.code === 'storage/canceled';

      if (isNetworkError && retryCount < MAX_UPLOAD_RETRIES - 1) {
        setUploadError('Upload failed. Tap to retry.');
      } else {
        setUploadError('Upload could not be completed.');
        pendingRecordingRef.current = null;
      }
    }
  }, [userId, chatId, retryCount]);

  // ── Retry upload handler ────────────────────────────────────────
  const handleRetryUpload = useCallback(() => {
    const pendingResult = pendingRecordingRef.current;
    if (!pendingResult || retryCount >= MAX_UPLOAD_RETRIES) return;

    setRetryCount((prev) => prev + 1);
    setUploadError(null);
    handleVoiceUploadAndSend(pendingResult);
  }, [retryCount, handleVoiceUploadAndSend]);

  // ── Send handler ────────────────────────────────────────────────
  const handleSend = async (text?: string) => {
    const trimmed = (text ?? input).trim();
    if (!trimmed) return;

    // Stop typing indicator immediately on send
    setTyping(false);

    try {
      // If replying to a message, include reply metadata
      if (replyingTo) {
        await addDoc(collection(db, 'chats', chatId, 'messages'), {
          senderId: userId,
          text: trimmed,
          type: 'text',
          timestamp: serverTimestamp(),
          readBy: [userId],
          deliveredTo: [],
          blockedMessage: isBlocked, // Mark if sent while either party is blocked
          replyTo: {
            messageId: replyingTo.messageId,
            senderId: replyingTo.senderId,
            text: replyingTo.text,
            type: replyingTo.type,
          },
        });

        // Update chat's lastMessage
        const chatRef = doc(db, 'chats', chatId);
        await updateDoc(chatRef, {
          'lastMessage.text': trimmed,
          'lastMessage.senderId': userId,
          'lastMessage.timestamp': serverTimestamp(),
        });

        setReplyingTo(null);
        setInput('');
        setShowEmoji(false);
      } else {
        // Regular message without reply
        // If either party has blocked the other, send message but mark it as blocked
        if (isBlocked) {
          await addDoc(collection(db, 'chats', chatId, 'messages'), {
            senderId: userId,
            text: trimmed,
            type: 'text',
            timestamp: serverTimestamp(),
            readBy: [userId],
            deliveredTo: [],
            blockedMessage: true, // Mark message as sent while blocked
          });

          // Update chat's lastMessage
          const chatRef = doc(db, 'chats', chatId);
          await updateDoc(chatRef, {
            'lastMessage.text': trimmed,
            'lastMessage.senderId': userId,
            'lastMessage.timestamp': serverTimestamp(),
          });

          setInput('');
          setShowEmoji(false);
        } else {
          // Normal send
          const success = await sendMessage(trimmed);
          if (success) {
            setInput('');
            setShowEmoji(false);
          }
        }
      }
    } catch (error) {
      console.error('[ChatScreen] Error sending message:', error);
      Alert.alert('Error', 'Failed to send message');
    }
  };

  // ── Message selection and actions ───────────────────────────────
  const handleLongPressMessage = (messageId: string) => {
    setSelectedMessageId(messageId);
    setShowMessageActions(true);
    setShowEmoji(false); // Close emoji panel if open
  };

  const handleClearSelection = () => {
    setSelectedMessageId(null);
    setShowMessageActions(false);
  };

  const handleDeleteMessage = async () => {
    if (!selectedMessageId) return;
    
    Alert.alert(
      'Delete Message',
      'Are you sure you want to delete this message?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // Delete from Firestore
              const messageRef = doc(db, 'chats', chatId, 'messages', selectedMessageId);
              await writeBatch(db).delete(messageRef).commit();
              console.log('[ChatScreen] Message deleted successfully');
              handleClearSelection();
            } catch (error) {
              console.error('[ChatScreen] Error deleting message:', error);
              Alert.alert('Error', 'Failed to delete message.');
            }
          },
        },
      ]
    );
  };

  const handleReplyMessage = () => {
    if (!selectedMessageId) return;
    const message = messages.find(m => m.messageId === selectedMessageId);
    if (message) {
      setReplyingTo(message);
      handleClearSelection();
    }
  };

  const handleForwardMessage = () => {
    if (!selectedMessageId) return;
    const message = messages.find(m => m.messageId === selectedMessageId);
    if (message) {
      setMessageToForward(message);
      setForwardModalVisible(true);
      handleClearSelection();
    }
  };

  const handleCopyMessage = async () => {
    if (!selectedMessageId) return;
    const message = messages.find(m => m.messageId === selectedMessageId);
    if (message?.text) {
      try {
        // Use React Native's built-in Clipboard (available in react-native)
        const { Clipboard } = await import('react-native');
        Clipboard.setString(message.text);
        console.log('[ChatScreen] Message copied to clipboard');
        Alert.alert('Copied', 'Message copied to clipboard');
        handleClearSelection();
      } catch (error) {
        console.error('[ChatScreen] Error copying message:', error);
        Alert.alert('Error', 'Failed to copy message.');
      }
    }
  };

  const handleShowMessageInfo = () => {
    if (!selectedMessageId) return;
    const message = messages.find(m => m.messageId === selectedMessageId);
    if (message) {
      setMessageForInfo(message);
      setMessageInfoVisible(true);
      handleClearSelection();
    }
  };

  // ── Forward to selected chats handler ───────────────────────────
  const handleForwardToChats = async (selectedChatIds: string[]) => {
    if (!messageToForward || !userId) return;

    try {
      console.log('[ChatScreen] Forwarding message to', selectedChatIds.length, 'chats');

      // Forward to each selected chat
      for (const targetChatId of selectedChatIds) {
        const messageData: any = {
          senderId: userId,
          type: messageToForward.type,
          timestamp: serverTimestamp(),
          readBy: [userId],
          forwarded: true,
        };

        // Copy relevant fields based on message type
        if (messageToForward.type === 'text' && messageToForward.text) {
          messageData.text = messageToForward.text;
        } else if (messageToForward.type === 'image' && messageToForward.imageUrl) {
          messageData.imageUrl = messageToForward.imageUrl;
          messageData.text = messageToForward.text || null;
        } else if (messageToForward.type === 'voice' && messageToForward.voiceUrl) {
          messageData.voiceUrl = messageToForward.voiceUrl;
          messageData.duration = messageToForward.duration;
        } else if (messageToForward.type === 'file' && messageToForward.fileUrl) {
          messageData.fileUrl = messageToForward.fileUrl;
          messageData.fileName = messageToForward.fileName;
          messageData.fileSize = messageToForward.fileSize;
          messageData.mimeType = messageToForward.mimeType;
        } else if (messageToForward.type === 'location' && messageToForward.location) {
          messageData.location = messageToForward.location;
          messageData.isLiveLocation = false; // Don't forward live location status
        }

        // Add message to target chat
        await addDoc(collection(db, 'chats', targetChatId, 'messages'), messageData);

        // Update target chat's lastMessage
        const chatRef = doc(db, 'chats', targetChatId);
        const lastMessageText = 
          messageToForward.type === 'text' 
            ? messageToForward.text 
            : messageToForward.type === 'voice'
              ? '🎤 Voice message'
              : messageToForward.type === 'image'
                ? '📷 Image'
                : messageToForward.type === 'file'
                  ? `📎 ${messageToForward.fileName || 'File'}`
                  : messageToForward.type === 'location'
                    ? '📍 Location'
                    : 'Message';

        await updateDoc(chatRef, {
          'lastMessage.text': lastMessageText,
          'lastMessage.senderId': userId,
          'lastMessage.timestamp': serverTimestamp(),
        });
      }

      console.log('[ChatScreen] Message forwarded successfully');
      Alert.alert(
        'Message Forwarded',
        `Message forwarded to ${selectedChatIds.length} ${selectedChatIds.length === 1 ? 'chat' : 'chats'}`
      );
      
      setMessageToForward(null);
      setForwardModalVisible(false);
    } catch (error) {
      console.error('[ChatScreen] Error forwarding message:', error);
      Alert.alert('Error', 'Failed to forward message. Please try again.');
    }
  };

  // ── Voice call handler ──────────────────────────────────────────
  // ── Unified call initiation — LiveKit for both 1-on-1 and group ─────────────
  // A 1-on-1 call is just a 2-person LiveKit room, so the same GroupCallScreen
  // + group-call-notification flow handles every call. This makes "Add to call"
  // work everywhere.
  const startCall = useCallback(async (callType: 'audio' | 'video') => {
    if (!userId) {
      Alert.alert('Cannot make call', 'User information not available.');
      return;
    }

    try {
      const userDisplayName = user?.phoneNumber || user?.displayName || 'Unknown';
      let memberIds: string[];

      if (isGroup) {
        // Group: pull the member list from the chat document
        const chatRef = doc(db, 'chats', chatId);
        const chatSnap = await getDoc(chatRef);
        if (!chatSnap.exists()) {
          Alert.alert('Error', 'Could not load group information');
          return;
        }
        memberIds = (chatSnap.data().members as string[]) || [];
      } else {
        // 1-on-1: a 2-person LiveKit room
        if (!otherUserId) {
          Alert.alert('Cannot make call', 'User information not available.');
          return;
        }

        // Check the other user's privacyCalls setting before starting
        const calleePrivacy = await fetchUserPrivacySettings(otherUserId);
        if (calleePrivacy.calls === 'Nobody') {
          Alert.alert("Can't call", `${displayName} has turned off calls.`);
          return;
        }
        // 'Contacts' — all users you have a direct chat with are contacts, so allowed.

        memberIds = [userId, otherUserId];
      }

      const result = await groupCall.initiateGroupCall(
        chatId,
        userId,
        userDisplayName,
        memberIds,
        callType
      );

      if (result) {
        if (isGroup) {
          // Group call: the initiator enters the room immediately and the other
          // members receive notifications to join. There is no single ringing
          // target, so we start the active call directly.
          startActiveCall({
            roomName: result.roomName,
            displayName: userDisplayName,
            audioOnly: callType === 'audio',
            groupName: displayName,
            memberCount: memberIds.length,
            chatId,
            callId: result.callId,
          });
        } else {
          // 1-on-1 call: show the ringing screen and wait for the callee to
          // answer. OutgoingCallScreen owns the rest of the outgoing lifecycle
          // (waiting for 'active', starting the call, timeout, cancellation).
          navigation.navigate('OutgoingCall', {
            callId: result.callId,
            displayName,
            callType,
            photoUrl: otherUserPhoto ?? null,
            roomName: result.roomName,
            callerName: userDisplayName,
            chatId,
            memberCount: memberIds.length,
            // For unsaved contacts, derive initials from their signup username
            initials: otherUserSignupName ? getInitials(otherUserSignupName) : undefined,
          });
        }
      } else {
        Alert.alert('Error', groupCall.error || 'Failed to start call');
      }
    } catch (error) {
      console.error('[ChatScreen] Error initiating call:', error);
      Alert.alert('Error', 'Failed to start call');
    }
  }, [userId, isGroup, chatId, otherUserId, displayName, otherUserPhoto, user, groupCall, startActiveCall, navigation]);

  const handleVoiceCall = useCallback(() => startCall('audio'), [startCall]);

  // ── Video call handler ──────────────────────────────────────────────────────
  const handleVideoCall = useCallback(() => startCall('video'), [startCall]);

  // ── PanResponder for mic button ─────────────────────────────────
  const micPanResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,

    onPanResponderGrant: (_evt: GestureResponderEvent, _gestureState: PanResponderGestureState) => {
      isCancelledRef.current = false;
      recorder.startRecording();
    },

    onPanResponderMove: (_evt: GestureResponderEvent, gestureState: PanResponderGestureState) => {
      const distance = Math.sqrt(gestureState.dx * gestureState.dx + gestureState.dy * gestureState.dy);
      if (distance >= CANCEL_THRESHOLD_DP && !isCancelledRef.current) {
        isCancelledRef.current = true;
        recorder.cancelRecording();
      }
    },

    onPanResponderRelease: async (_evt: GestureResponderEvent, _gestureState: PanResponderGestureState) => {
      if (isCancelledRef.current) return;

      const result = await recorder.stopRecording();
      if (result) {
        handleVoiceUploadAndSend(result);
      }
    },

    onPanResponderTerminate: () => {
      if (!isCancelledRef.current) {
        isCancelledRef.current = true;
        recorder.cancelRecording();
      }
    },
  }), [recorder, handleVoiceUploadAndSend]);

  // ── Dismiss permission message ──────────────────────────────────
  const dismissPermissionMessage = useCallback(() => {
    setPermissionMessage(null);
    setShowSettingsButton(false);
  }, []);

  // ── Open device settings ────────────────────────────────────────
  const handleOpenSettings = useCallback(() => {
    Linking.openSettings();
    dismissPermissionMessage();
  }, [dismissPermissionMessage]);

  // ── Image compression helper ────────────────────────────────────
  const compressImage = async (uri: string): Promise<string> => {
    try {
      console.log('[ChatScreen] Attempting to compress image:', uri);
      
      // Dynamic import to avoid crash if module not available
      const { manipulateAsync, SaveFormat } = await import('expo-image-manipulator');
      
      const compressed = await manipulateAsync(
        uri,
        [{ resize: { width: 1200 } }], // Resize to max 1200px width, maintain aspect ratio
        { compress: 0.8, format: SaveFormat.JPEG }
      );
      
      console.log('[ChatScreen] Compressed successfully');
      return compressed.uri;
    } catch (error) {
      console.warn('[ChatScreen] Compression not available or failed, using original:', error);
      return uri; // Fallback to original if compression fails or module unavailable
    }
  };

  // ── Upload single image helper ─────────────────────────────────
  const uploadSingleImage = async (uri: string) => {
    if (!userId) return;

    try {
      console.log('[ChatScreen] Uploading image:', uri);
      
      // Compress before upload
      const compressedUri = await compressImage(uri);
      
      const uploadResult = await sendImageMessage(
        chatId,
        userId,
        compressedUri,
        (progress) => {
          setImageUploadProgress(progress);
          console.log('[ChatScreen] Image upload progress:', progress);
        }
      );
      
      if (!uploadResult.success) {
        Alert.alert('Upload Failed', 'Could not send the image. Please try again.');
      }
    } catch (error) {
      console.error('[ChatScreen] Upload error:', error);
      Alert.alert('Error', 'Failed to upload image.');
    }
  };

  // ── Camera / gallery / documents ────────────────────────────────
  const openCamera = async () => {
    if (Platform.OS === 'web') {
      Alert.alert('Camera', 'Camera is not available on web.');
      return;
    }
    
    // Check if permission is already granted
    if (cameraPermission?.granted) {
      setCameraOpen(true);
      return;
    }
    
    // Request permission
    const { granted } = await requestCameraPermission();
    if (granted) {
      setCameraOpen(true);
    } else {
      Alert.alert('Permission needed', 'Allow camera access to take photos.');
    }
  };

  const takePicture = async () => {
    if (!cameraRef.current || !userId) return;

    try {
      console.log('[ChatScreen] Taking picture...');
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.85,
      });
      
      console.log('[ChatScreen] Picture taken:', photo.uri);
      setCameraOpen(false);
      
      setUploadingImage(true);
      setImageUploadProgress(0);
      
      await uploadSingleImage(photo.uri);
      
      setUploadingImage(false);
      setImageUploadProgress(0);
      console.log('[ChatScreen] Picture uploaded successfully');
    } catch (error) {
      console.error('[ChatScreen] Camera error:', error);
      Alert.alert('Error', 'Failed to take or upload picture.');
      setUploadingImage(false);
      setImageUploadProgress(0);
    }
  };

  const openGallery = async () => {
    try {
      // Request media library permission first
      const { granted } = mediaLibraryPermission ?? await requestMediaLibraryPermission();
      if (!granted) {
        Alert.alert('Permission needed', 'Allow photo access to select images from your gallery.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true, // Enable multiple selection
        quality: 0.85,
      });
      
      if (!result.canceled && result.assets.length > 0 && userId) {
        setShowAttach(false);
        setUploadingImage(true);
        setImageUploadProgress(0);
        
        // Upload images sequentially
        for (let i = 0; i < result.assets.length; i++) {
          const imageUri = result.assets[i].uri;
          console.log(`[ChatScreen] Uploading image ${i + 1}/${result.assets.length}`);
          
          try {
            // Reset progress for each image
            setImageUploadProgress(0);
            
            const compressedUri = await compressImage(imageUri);
            
            const uploadResult = await sendImageMessage(
              chatId,
              userId,
              compressedUri,
              (progress) => {
                setImageUploadProgress(progress);
                console.log(`[ChatScreen] Image ${i + 1} upload progress:`, progress);
              }
            );
            
            if (!uploadResult.success) {
              console.error(`[ChatScreen] Image ${i + 1} upload failed`);
              Alert.alert('Upload Failed', `Image ${i + 1} could not be sent. Continuing with others...`);
            } else {
              console.log(`[ChatScreen] Image ${i + 1} uploaded successfully`);
            }
          } catch (error) {
            console.error(`[ChatScreen] Image ${i + 1} upload error:`, error);
            Alert.alert('Error', `Failed to upload image ${i + 1}. Continuing with others...`);
          }
        }
        
        console.log('[ChatScreen] All images processed');
        setUploadingImage(false);
        setImageUploadProgress(0);
      }
    } catch (error) {
      console.error('[ChatScreen] Gallery error:', error);
      setUploadingImage(false);
      setImageUploadProgress(0);
      Alert.alert('Error', 'Failed to select or upload images.');
    }
  };

  const openDocuments = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ 
        multiple: true,
        type: '*/*', // Allow all file types
      });
      
      if (!result.canceled && result.assets.length > 0 && userId) {
        setShowAttach(false);
        setUploadingImage(true);
        setImageUploadProgress(0);
        
        for (let i = 0; i < result.assets.length; i++) {
          const file = result.assets[i];
          console.log(`[ChatScreen] Uploading file ${i + 1}/${result.assets.length}:`, file.name, file.mimeType);
          
          try {
            // Reset progress for each file
            setImageUploadProgress(0);
            
            const uploadResult = await sendFileMessage(
              chatId,
              userId,
              file.uri,
              file.name,
              file.size || 0,
              file.mimeType || 'application/octet-stream',
              (progress) => {
                setImageUploadProgress(progress);
                console.log(`[ChatScreen] File ${i + 1} upload progress:`, progress);
              }
            );
            
            if (!uploadResult.success) {
              console.error(`[ChatScreen] File ${i + 1} upload failed`);
              Alert.alert('Upload Failed', `${file.name} could not be sent. Continuing with others...`);
            } else {
              console.log(`[ChatScreen] File ${i + 1} uploaded successfully`);
            }
          } catch (error) {
            console.error(`[ChatScreen] File ${i + 1} upload error:`, error);
            Alert.alert('Error', `Failed to upload ${file.name}. Continuing with others...`);
          }
        }
        
        console.log('[ChatScreen] All files processed');
        setUploadingImage(false);
        setImageUploadProgress(0);
      }
    } catch (error) {
      console.error('[ChatScreen] Document picker error:', error);
      setUploadingImage(false);
      setImageUploadProgress(0);
      Alert.alert('Error', 'Failed to select files.');
    }
  };

  const openAudioPicker = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ 
        type: 'audio/*', // Only audio files
        multiple: false,
      });
      
      if (!result.canceled && result.assets.length > 0 && userId) {
        setShowAttach(false);
        const audioFile = result.assets[0];
        console.log('[ChatScreen] Selected audio file:', audioFile.name, audioFile.mimeType);
        
        setUploadingImage(true);
        setImageUploadProgress(0);
        
        try {
          const uploadResult = await sendFileMessage(
            chatId,
            userId,
            audioFile.uri,
            audioFile.name,
            audioFile.size || 0,
            audioFile.mimeType || 'audio/mpeg',
            (progress) => {
              setImageUploadProgress(progress);
              console.log('[ChatScreen] Audio file upload progress:', progress);
            }
          );
          
          if (uploadResult.success) {
            console.log('[ChatScreen] Audio file sent successfully');
          } else {
            Alert.alert('Upload Failed', 'Could not send the audio file. Please try again.');
          }
        } catch (error) {
          console.error('[ChatScreen] Audio upload error:', error);
          Alert.alert('Error', 'Failed to upload audio file.');
        } finally {
          setUploadingImage(false);
          setImageUploadProgress(0);
        }
      }
    } catch (error) {
      console.error('[ChatScreen] Audio picker error:', error);
      Alert.alert('Error', 'Failed to select audio file.');
    }
  };

  // ── Location handlers ───────────────────────────────────────────
  const handleOpenLocationMenu = () => {
    setShowAttach(false);
    setShowLocationMenu(true);
  };

  const handleSendCurrentLocation = async () => {
    if (!userId) return;
    
    setShowLocationMenu(false);
    
    const location = await locationSharing.getCurrentLocation();
    if (!location) {
      Alert.alert('Error', locationSharing.error || 'Failed to get location');
      return;
    }
    
    const result = await sendCurrentLocationMessage(chatId, userId, location);
    
    if (!result.success) {
      Alert.alert('Error', 'Failed to send location');
    }
  };

  const handleStartLiveLocation = async () => {
    if (!userId) return;
    
    setShowLocationMenu(false);
    
    const location = await locationSharing.getCurrentLocation();
    if (!location) {
      Alert.alert('Error', locationSharing.error || 'Failed to get location');
      return;
    }
    
    const result = await sendLiveLocationMessage(
      chatId,
      userId,
      location,
      selectedDuration
    );
    
    if (!result.success) {
      Alert.alert('Error', 'Failed to send live location');
      return;
    }
    
    const started = await locationSharing.startLiveSharing(
      chatId,
      result.messageId,
      selectedDuration
    );
    
    if (!started) {
      Alert.alert('Error', locationSharing.error || 'Failed to start live sharing');
    }
  };

  const handleStopLiveLocation = async (messageId: string) => {
    await locationSharing.stopLiveSharing();
    await stopLiveLocationSharing(chatId, messageId);
  };

  // ── Received-contact actions ───────────────────────────────────
  /** True if the given phone is already in the user's device phone book. */
  const isContactSaved = useCallback((phone: string): boolean => {
    if (!phone || !phoneContacts) return false;
    const normalized = normalizePhone(phone);
    return phoneContacts.some(pc => normalizePhone(pc.phone) === normalized);
  }, [phoneContacts]);

  /** Open a chat with the shared contact and navigate to it. */
  const handleMessageSharedContact = useCallback(async (contactUserId: string | null, name: string) => {
    setContactActionCard(null);
    if (!userId || !contactUserId) {
      Alert.alert('Unavailable', 'This contact is not on ChitChat yet.');
      return;
    }
    if (contactUserId === userId) {
      Alert.alert('This is you', 'You cannot message yourself.');
      return;
    }
    try {
      const newChatId = await getOrCreateDirectChat(userId, contactUserId);
      navigation.replace('Chat', {
        chatId: newChatId,
        displayName: name,
        isGroup: false,
        otherUserId: contactUserId,
        otherUserPhoto: null,
      });
    } catch (err) {
      console.error('[ChatScreen] Failed to open chat with shared contact:', err);
      Alert.alert('Error', 'Could not open chat with this contact.');
    }
  }, [userId, navigation]);

  /** Open the native "New Contact" form pre-filled with the shared info. */
  const handleSaveSharedContact = useCallback(async (name: string, phone: string) => {
    setContactActionCard(null);
    if (Platform.OS === 'web') {
      Alert.alert('Not available', 'Saving contacts is not available on web.');
      return;
    }
    try {
      const Contacts = require('expo-contacts/legacy');
      const parts = name.trim().split(/\s+/);
      const firstName = parts[0] ?? name;
      const lastName = parts.slice(1).join(' ') || undefined;
      await Contacts.presentFormAsync(null, {
        [Contacts.Fields.FirstName]: firstName,
        [Contacts.Fields.LastName]: lastName,
        [Contacts.Fields.PhoneNumbers]: [{ label: 'mobile', number: phone }],
      });
    } catch (err) {
      console.error('[ChatScreen] Failed to open native contact form:', err);
      Alert.alert('Error', 'Could not open the contact form.');
    }
  }, []);

  // ── Clear chat handler ──────────────────────────────────────────
  const handleClearChat = useCallback(async () => {
    if (!chatId) {
      console.error('[ChatScreen] No chatId available');
      return;
    }

    try {
      console.log('[ChatScreen] Clearing chat:', chatId);
      const messagesRef = collection(db, 'chats', chatId, 'messages');
      const snapshot = await getDocs(messagesRef);

      if (snapshot.empty) {
        // Firestore is already empty, but there may still be locally-retained messages.
        await clearLocalMessages(chatId);
        Alert.alert('Chat Cleared', 'Chat has been cleared.');
        return;
      }

      const totalMessages = snapshot.docs.length;
      console.log(`[ChatScreen] Found ${totalMessages} messages to delete`);

      // Firestore batch can handle up to 500 operations
      // Split into multiple batches if needed
      const BATCH_SIZE = 500;
      const batches = [];
      
      for (let i = 0; i < snapshot.docs.length; i += BATCH_SIZE) {
        const batch = writeBatch(db);
        const batchDocs = snapshot.docs.slice(i, i + BATCH_SIZE);
        
        batchDocs.forEach((docSnapshot) => {
          batch.delete(docSnapshot.ref);
        });
        
        batches.push(batch);
      }

      // Execute all batches
      await Promise.all(batches.map(batch => batch.commit()));

      // Wipe the local cache so the user sees an empty chat immediately.
      await clearLocalMessages(chatId);

      console.log(`[ChatScreen] Successfully cleared ${totalMessages} messages`);
      Alert.alert('Success', 'Chat cleared successfully');
    } catch (error) {
      console.error('[ChatScreen] Error clearing chat:', error);
      Alert.alert('Error', 'Failed to clear chat. Please try again.');
    }
  }, [chatId]);

  // ── Block contact handler ───────────────────────────────────────
  const handleBlockContact = useCallback(async () => {
    if (!userId || !otherUserId || isGroup) {
      console.error('[ChatScreen] Cannot block: missing user info or is group chat');
      return;
    }

    try {
      console.log('[ChatScreen] Blocking contact:', otherUserId);
      
      // Add the blocked user to the current user's blockedUsers subcollection
      const blockedRef = doc(db, 'users', userId, 'blockedUsers', otherUserId);
      await writeBatch(db).set(blockedRef, {
        blockedAt: new Date(),
        displayName: displayName,
        photoURL: otherUserPhoto || null,
      }).commit();
      
      console.log('[ChatScreen] Contact blocked successfully');
      setIsBlocked(true);
      setShowBlockConfirmation(false);
      setProfileModalOpen(false);
      
      // Show confirmation
      Alert.alert('Contact Blocked', `${displayName} has been blocked. You won't receive messages from this contact.`);
    } catch (error) {
      console.error('[ChatScreen] Error blocking contact:', error);
      Alert.alert('Error', 'Failed to block contact. Please try again.');
    }
  }, [userId, otherUserId, isGroup, displayName, otherUserPhoto]);

  // ── Unblock contact handler ─────────────────────────────────────
  const handleUnblockContact = useCallback(async () => {
    if (!userId || !otherUserId || isGroup) {
      console.error('[ChatScreen] Cannot unblock: missing user info or is group chat');
      return;
    }

    try {
      console.log('[ChatScreen] Unblocking contact:', otherUserId);
      
      // Remove the blocked user from the current user's blockedUsers subcollection
      const blockedRef = doc(db, 'users', userId, 'blockedUsers', otherUserId);
      await writeBatch(db).delete(blockedRef).commit();
      
      console.log('[ChatScreen] Contact unblocked successfully');
      setIsBlocked(false);
      setBlockedByMe(false);
      
      // Show confirmation
      Alert.alert('Contact Unblocked', `You can now send and receive messages from ${displayName}.`);
    } catch (error) {
      console.error('[ChatScreen] Error unblocking contact:', error);
      Alert.alert('Error', 'Failed to unblock contact. Please try again.');
    }
  }, [userId, otherUserId, isGroup, displayName]);

  // ── Leave group handler ─────────────────────────────────────────
  const handleLeaveGroup = useCallback(async () => {
    if (!userId || !chatId || !isGroup) {
      console.error('[ChatScreen] Cannot leave: missing user info or not a group chat');
      return;
    }

    setLeavingGroup(true);

    try {
      console.log('[ChatScreen] Leaving group:', chatId);
      
      const chatRef = doc(db, 'chats', chatId);
      const chatSnap = await getDoc(chatRef);
      
      if (!chatSnap.exists()) {
        Alert.alert('Error', 'Group not found.');
        setLeavingGroup(false);
        return;
      }

      const chatData = chatSnap.data();
      const currentMembers = chatData.members as string[] || [];
      const updatedMembers = currentMembers.filter((id) => id !== userId);
      
      // Get user's display name for the system message
      const userRef = doc(db, 'users', userId);
      const userSnap = await getDoc(userRef);
      const userDisplayName = userSnap.exists() ? (userSnap.data().displayName || user?.phoneNumber || 'User') : 'User';
      
      const batch = writeBatch(db);
      
      // 1. Update chat: remove from members, add to pastMembers
      const pastMembersEntry = {
        userId,
        leftAt: new Date(),
        reason: 'Left',
      };
      
      const currentPastMembers = chatData.pastMembers || [];
      const updatedPastMembers = [...currentPastMembers, pastMembersEntry];
      
      batch.update(chatRef, {
        members: updatedMembers,
        pastMembers: updatedPastMembers,
      });
      
      // 2. Add system message to the chat
      const msgRef = doc(collection(db, 'chats', chatId, 'messages'));
      const leaveText = `GROUP_LEAVE:${userId}:${userDisplayName}`;
      batch.set(msgRef, {
        messageId: msgRef.id,
        senderId: 'system',
        text: leaveText,
        type: 'system',
        subtype: 'member-left',
        timestamp: serverTimestamp(),
        readBy: [],
        deliveredTo: [],
      });
      
      // 3. Update lastMessage
      batch.update(chatRef, {
        'lastMessage.text': `${userDisplayName} left the group`,
        'lastMessage.senderId': 'system',
        'lastMessage.timestamp': serverTimestamp(),
      });
      
      await batch.commit();
      
      console.log('[ChatScreen] Left group successfully');
      setLeavingGroup(false);
      setShowLeaveGroupConfirmation(false);
      setProfileModalOpen(false);
      
      // Navigate back to ChatsScreen
      navigation.goBack();
      
      // Show confirmation
      setTimeout(() => {
        Alert.alert('Left Group', `You have left ${displayName}.`);
      }, 500);
    } catch (error) {
      console.error('[ChatScreen] Error leaving group:', error);
      setLeavingGroup(false);
      Alert.alert('Error', 'Failed to leave group. Please try again.');
    }
  }, [userId, chatId, isGroup, displayName, user, navigation]);

  // ── Check if recording is active ────────────────────────────────
  const isRecording = recorder.state.status === 'recording';

  // ── Add member to group ─────────────────────────────────────────
  const handleAddMember = useCallback(async (contact: { userId: string; displayName: string }) => {
    setAddMemberPickerOpen(false);
    if (!userId || !chatId || !isGroup) return;
    try {
      const chatRef = doc(db, 'chats', chatId);
      const chatSnap = await getDoc(chatRef);
      if (!chatSnap.exists()) return;
      const currentMembers = chatSnap.data().members as string[] || [];
      if (currentMembers.includes(contact.userId)) {
        Alert.alert('Already a member', `${contact.displayName} is already in this group.`);
        return;
      }
      // Update members array and record join timestamp
      await updateDoc(chatRef, { 
        members: [...currentMembers, contact.userId],
        [`memberJoinedAt.${contact.userId}`]: serverTimestamp(),
      });
      // Send system message
      const adderName = user?.displayName || 'Someone';
      await sendGroupAddMessage(chatId, userId, contact.userId, adderName, contact.displayName);
      
      // Update lastMessage so the group appears immediately in the added user's chat list
      const systemMessageText = `${contact.displayName} was added`;
      await updateDoc(chatRef, {
        'lastMessage.text': systemMessageText,
        'lastMessage.senderId': 'system',
        'lastMessage.timestamp': serverTimestamp(),
        'lastMessage.readBy': [],
        'lastMessage.deliveredTo': [],
      });
      
      // Refresh group members list
      setGroupMembers(prev => [...prev, {
        userId: contact.userId,
        displayName: contact.displayName,
        photoURL: null,
        status: 'offline',
      }]);
      Alert.alert('Added', `${contact.displayName} has been added to the group.`);
    } catch (err) {
      console.error('[ChatScreen] Failed to add member:', err);
      Alert.alert('Error', 'Failed to add member.');
    }
  }, [userId, chatId, isGroup, user]);

  // ── Remove member from group (creator only) ─────────────────────
  const handleRemoveMember = useCallback(async (member: GroupMember) => {
    if (!userId || !chatId || !isGroup) return;
    Alert.alert(
      'Remove Member',
      `Remove ${member.displayName} from this group?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              const chatRef = doc(db, 'chats', chatId);
              const chatSnap = await getDoc(chatRef);
              if (!chatSnap.exists()) return;
              const chatData = chatSnap.data();
              const currentMembers = chatData.members as string[] || [];
              const updatedMembers = currentMembers.filter(id => id !== member.userId);
              
              // Add to pastMembers
              const currentPastMembers = chatData.pastMembers || [];
              const removerName = user?.displayName || 'Admin';
              const updatedPastMembers = [...currentPastMembers, { userId: member.userId, leftAt: new Date(), reason: `Removed by ${removerName}` }];
              
              await updateDoc(chatRef, { members: updatedMembers, pastMembers: updatedPastMembers });

              await sendGroupRemoveMessage(chatId, userId, member.userId, removerName, member.displayName);

              setGroupMembers(prev => prev.filter(m => m.userId !== member.userId));
              setPastMembers(prev => [...prev, { userId: member.userId, displayName: member.displayName, photoURL: member.photoURL, leftAt: new Date(), reason: `Removed by ${removerName}` }]);
            } catch (err) {
              console.error('[ChatScreen] Failed to remove member:', err);
              Alert.alert('Error', 'Failed to remove member.');
            }
          },
        },
      ]
    );
  }, [userId, chatId, isGroup, user]);

  // ── Change group profile photo ──────────────────────────────────
  const handleChangeGroupPhoto = useCallback(async () => {
    if (!chatId || !isGroup) return;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (result.canceled || !result.assets?.[0]?.uri) return;
      
      const uri = result.assets[0].uri;
      // Upload to Firebase Storage
      const { getStorage, ref, uploadBytes, getDownloadURL } = await import('firebase/storage');
      const storage = getStorage();
      const photoRef = ref(storage, `group-photos/${chatId}.jpg`);
      const response = await fetch(uri);
      const blob = await response.blob();
      await uploadBytes(photoRef, blob);
      const downloadURL = await getDownloadURL(photoRef);
      
      // Update Firestore
      await updateDoc(doc(db, 'chats', chatId), { groupPhotoURL: downloadURL });
      setGroupPhotoURL(downloadURL);
    } catch (err) {
      console.error('[ChatScreen] Failed to update group photo:', err);
      Alert.alert('Error', 'Failed to update group photo.');
    }
  }, [chatId, isGroup]);

  // ── Save group bio ──────────────────────────────────────────────
  const handleSaveGroupBio = useCallback(async () => {
    if (!chatId || !isGroup) return;
    try {
      await updateDoc(doc(db, 'chats', chatId), { groupBio: bioInput.trim() });
      setGroupBio(bioInput.trim());
      setEditingBio(false);
    } catch (err) {
      console.error('[ChatScreen] Failed to save group bio:', err);
      Alert.alert('Error', 'Failed to save group description.');
    }
  }, [chatId, isGroup, bioInput]);

  // ── Share group invite link (within ChitChat) ────────────────────
  const handleOpenInvitePreview = useCallback(async (inviteCode: string, groupName: string) => {
    setInvitePreview({ inviteCode, groupName });
    setLoadingInvitePreview(true);
    setInvitePreviewData(null);
    try {
      const q2 = query(collection(db, 'chats'), where('inviteCode', '==', inviteCode));
      const snap = await getDocs(q2);
      if (snap.empty) {
        setInvitePreviewData(null);
        setLoadingInvitePreview(false);
        Alert.alert('Error', 'This invite link is invalid or expired.');
        setInvitePreview(null);
        return;
      }
      const chatDoc = snap.docs[0];
      const chatData = chatDoc.data();
      const members = chatData.members as string[] || [];
      const createdAt = chatData.createdAt?.toDate?.() || new Date();
      const creatorId = chatData.createdBy || '';
      
      // Resolve creator name
      let creatorName = creatorId;
      if (creatorId) {
        const creatorSnap = await getDoc(doc(db, 'users', creatorId));
        if (creatorSnap.exists()) {
          const creatorData = creatorSnap.data();
          creatorName = creatorData.phone || creatorId;
        }
      }

      setInvitePreviewData({
        groupPhotoURL: chatData.groupPhotoURL || null,
        groupName: chatData.groupName || groupName,
        createdBy: creatorName,
        createdAt: createdAt.toLocaleDateString([], { year: 'numeric', month: '2-digit', day: '2-digit' }),
        memberCount: members.length,
        isAlreadyMember: members.includes(userId!),
      });
    } catch (err) {
      console.error('[ChatScreen] Failed to load invite preview:', err);
      Alert.alert('Error', 'Failed to load group info.');
      setInvitePreview(null);
    } finally {
      setLoadingInvitePreview(false);
    }
  }, [userId]);

  const handleJoinFromPreview = useCallback(async () => {
    if (!invitePreview || !userId) return;
    try {
      const q2 = query(collection(db, 'chats'), where('inviteCode', '==', invitePreview.inviteCode));
      const snap = await getDocs(q2);
      if (snap.empty) {
        Alert.alert('Error', 'This invite link is invalid or expired.');
        setInvitePreview(null);
        return;
      }
      const chatDoc = snap.docs[0];
      const chatData = chatDoc.data();
      const members = chatData.members as string[];
      if (members.includes(userId)) {
        // Already a member — navigate to the group
        setInvitePreview(null);
        navigation.navigate('Chat', {
          chatId: chatDoc.id,
          displayName: chatData.groupName || invitePreview.groupName,
          isGroup: true,
          otherUserId: undefined,
          otherUserPhoto: chatData.groupPhotoURL || null,
        });
        return;
      }
      // Add user to members
      await updateDoc(doc(db, 'chats', chatDoc.id), {
        members: [...members, userId],
        [`memberJoinedAt.${userId}`]: serverTimestamp(),
      });
      const { sendGroupJoinLinkMessage } = await import('../hooks/useChatActions');
      const userName = user?.displayName || 'Someone';
      await sendGroupJoinLinkMessage(chatDoc.id, userId, userName);
      await updateDoc(doc(db, 'chats', chatDoc.id), {
        'lastMessage.text': `${userName} joined via invite link`,
        'lastMessage.senderId': 'system',
        'lastMessage.timestamp': serverTimestamp(),
      });
      setInvitePreview(null);
      Alert.alert('Joined!', `You joined "${chatData.groupName || invitePreview.groupName}".`);
    } catch (err) {
      console.error('[ChatScreen] Failed to join group:', err);
      Alert.alert('Error', 'Failed to join group.');
    }
  }, [invitePreview, userId, user, navigation]);
  const handleShareInviteLink = useCallback(async () => {
    if (!chatId) return;
    setInvitePickerQuery('');
    setInvitePickerOpen(true);
  }, [chatId]);

  /** Actually send the invite link to a chosen contact */
  const handleSendInviteTo = useCallback(async (contact: { userId: string; displayName: string }) => {
    setInvitePickerOpen(false);
    if (!userId || !chatId) return;
    try {
      const chatRef = doc(db, 'chats', chatId);
      const chatSnap = await getDoc(chatRef);
      let inviteCode = chatSnap.data()?.inviteCode;
      if (!inviteCode) {
        inviteCode = chatId.slice(0, 8) + Math.random().toString(36).slice(2, 8);
        await updateDoc(chatRef, { inviteCode });
      }
      const link = `chitchat.app/join/${inviteCode}`;

      // Find or create the 1-on-1 chat with the picked contact
      const recipientChatId = await getOrCreateDirectChat(userId, contact.userId);

      // Send the invite link as a special 'group-invite' message type
      await addDoc(collection(db, 'chats', recipientChatId, 'messages'), {
        senderId: userId,
        text: link,
        type: 'group-invite',
        groupName: displayName,
        groupId: chatId,
        inviteCode,
        timestamp: serverTimestamp(),
        readBy: [userId],
        deliveredTo: [],
      });
      await updateDoc(doc(db, 'chats', recipientChatId), {
        'lastMessage.text': `📎 Group invite: ${displayName}`,
        'lastMessage.senderId': userId,
        'lastMessage.timestamp': serverTimestamp(),
      });

      Alert.alert('Sent', `Invite link sent to ${contact.displayName}.`);
    } catch (err) {
      console.error('[ChatScreen] Failed to send invite link:', err);
      Alert.alert('Error', 'Failed to send invite link.');
    }
  }, [userId, chatId, displayName]);

  // ── Render a single message bubble or date separator ────────────
  const renderItem = ({ item }: { item: MessageListItem }) => {
    // Handle date separators
    if (item.type === 'dateSeparator') {
      return (
        <View style={styles.datePillWrap}>
          <View style={styles.datePill}>
            <AppText style={styles.datePillText}>{item.dateLabel}</AppText>
          </View>
        </View>
      );
    }

    // Handle messages
    return renderMessage({ item: item.data });
  };

  // ── Render a single message bubble ──────────────────────────────
  const renderMessage = ({ item }: { item: FireMessage }) => {
    // ── System messages (block/unblock notifications) ───────────────
    // Also detect system messages by text pattern (in case type field is missing from cache)
    const isSystemMsg = item.type === 'system' || 
      item.senderId === 'system' ||
      (item.text && /^(GROUP_ADD|GROUP_REMOVE|GROUP_LEAVE|GROUP_JOIN_LINK|BLOCK|UNBLOCK|NUMBER_CHANGE):/.test(item.text));
    
    if (isSystemMsg) {
      // Parse system message with local name resolution
      const displayText = (() => {
        const text = item.text || '';
        if (!text || !userId) return text;
        
        // GROUP_ADD:adderId:addedId:adderName:addedName
        if (text.startsWith('GROUP_ADD:')) {
          const parts = text.split(':');
          if (parts.length !== 5) return parseSystemMessage(text, userId);
          const [, adderId, addedId] = parts;
          if (userId === adderId && userId === addedId) return 'You joined the group';
          if (userId === adderId) return `You added ${resolveSenderName(addedId)}`;
          if (userId === addedId) return `${resolveSenderName(adderId)} added you`;
          return `${resolveSenderName(adderId)} added ${resolveSenderName(addedId)}`;
        }
        
        // GROUP_REMOVE:removerId:removedId:removerName:removedName
        if (text.startsWith('GROUP_REMOVE:')) {
          const parts = text.split(':');
          if (parts.length !== 5) return parseSystemMessage(text, userId);
          const [, removerId, removedId] = parts;
          if (userId === removerId) return `You removed ${resolveSenderName(removedId)}`;
          if (userId === removedId) return `${resolveSenderName(removerId)} removed you`;
          return `${resolveSenderName(removerId)} removed ${resolveSenderName(removedId)}`;
        }
        
        // GROUP_LEAVE:leaverId:leaverName
        if (text.startsWith('GROUP_LEAVE:')) {
          const parts = text.split(':');
          if (parts.length !== 3) return parseSystemMessage(text, userId);
          const [, leaverId] = parts;
          if (userId === leaverId) return 'You left the group';
          return `${resolveSenderName(leaverId)} left`;
        }
        
        // GROUP_JOIN_LINK:joinerId:joinerName
        if (text.startsWith('GROUP_JOIN_LINK:')) {
          const parts = text.split(':');
          if (parts.length !== 3) return parseSystemMessage(text, userId);
          const [, joinerId] = parts;
          if (userId === joinerId) return 'You joined using invite link';
          return `${resolveSenderName(joinerId)} joined using invite link`;
        }
        
        return parseSystemMessage(text, userId);
      })();
      return (
        <View style={styles.systemMessageContainer}>
          <View style={[styles.systemMessageBubble, { backgroundColor: FG.glassBg }]}>
            <AppText style={[styles.systemMessageText, { color: FG.secondary }]}>
              {displayText}
            </AppText>
          </View>
        </View>
      );
    }

    const isOut = item.senderId === userId;
    const isSelected = selectedMessageId === item.messageId;
    const isSearchMatch = searchQuery.trim().length > 0 &&
      item.type === 'text' &&
      item.text?.toLowerCase().includes(searchQuery.toLowerCase());
    const isActiveMatch = searchMatchIds[searchCurrentIndex] === item.messageId;
    
    
    // Get tick status for outgoing messages
    const tickStatus = getTickStatus(item, userId, isGroup, isGroup ? groupMembers.length : undefined);
    const tickIcon = getTickIcon(tickStatus);

    // Debug logging for outgoing text messages
    if (item.senderId === userId && item.type === 'text' && Math.random() < 0.1) {
      console.log('[ChatScreen] Tick status:', {
        messageId: item.messageId,
        text: item.text?.substring(0, 20),
        tickStatus,
        readBy: item.readBy,
        deliveredTo: item.deliveredTo,
        senderId: item.senderId,
        currentUserId: userId
      });
    }

    
    const messageContent = (
      <View style={[styles.msgRow, isOut ? styles.msgRowOut : styles.msgRowIn]}>
        {!isOut && (
          
          item.type === 'voice' && item.voiceUrl && item.duration ? (
            <VoiceMessageBubble
              messageId={item.messageId}
              voiceUrl={item.voiceUrl}
              durationMs={item.duration}
              isOutgoing={false}
              playerState={player.state}
              onPlay={() => {
                if (player.state.activeMessageId === item.messageId && player.state.status === 'paused') {
                  player.resume();
                } else {
                  player.play(item.voiceUrl!, item.messageId, item.duration!);
                }
              }}
              onPause={() => player.pause()}
              onSeek={(positionMs) => player.seek(positionMs)}
              timestamp={item.timestamp}
            />
           ) : item.type === 'call' ? (
  <View style={[styles.callBubble, styles.callBubbleIn]}>
    <View style={styles.callIconCircle}>
      <AppIcon
        name={item.callType === 'video' ? 'videocam' : 'call'}
        size={20}
        color={COLORS.sub}
      />
    </View>
    <View style={styles.callContent}>
            <AppText style={styles.callTitle}>
        {item.callType === 'video' ? 'Video call' : 'Voice call'}
      </AppText>
      {/* Debug: Show duration or status */}
      <AppText style={styles.callDuration}>
        {item.callDuration !== null && item.callDuration !== undefined
          ? `Duration: ${formatCallDuration(item.callDuration)} (${item.callDuration}s)`
          : item.callStatus === 'missed'
          ? 'Missed'
          : item.callStatus === 'rejected'
          ? 'Declined'
          : item.callStatus === 'busy'
          ? 'Busy'
          : item.callStatus === 'failed'
          ? 'Failed'
          : `No duration (status: ${item.callStatus})`}
      </AppText>

    </View>
    <AppText style={styles.callTime}>{formatTime(item.timestamp)}</AppText>
  </View>


            
          ) : item.type === 'file' && item.fileUrl && item.fileName ? (
            <FileMessageBubble
              fileName={item.fileName!}
              fileSize={item.fileSize ?? undefined}
              fileUrl={item.fileUrl!}
              mimeType={item.mimeType ?? undefined}
              isOutgoing={false}
            />
          ) : item.type === 'location' && item.location ? (
            <LocationMessageBubble
              location={item.location}
              isLiveLocation={item.isLiveLocation}
              liveLocationExpiry={item.liveLocationExpiry}
              isSender={false}
              onStopSharing={() => handleStopLiveLocation(item.messageId)}
              timestamp={item.timestamp}
            />
          ) : item.type === 'group-invite' && item.groupName ? (
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => {
                const inviteCode = item.inviteCode || item.text?.split('/').pop();
                if (inviteCode) handleOpenInvitePreview(inviteCode, item.groupName!);
              }}
              style={styles.groupInviteBubbleIn}
            >
              <View style={styles.groupInviteIconWrap}>
                <AppIcon name="people" size={32} color={COLORS.blue} fixedColor />
              </View>
              <View style={{ flex: 1 }}>
                <AppText fixedColor style={styles.groupInviteTitle}>Group Invite</AppText>
                <AppText fixedColor style={styles.groupInviteName}>{item.groupName}</AppText>
                <View style={styles.groupInviteButtonWrap}>
                  <AppText fixedColor style={styles.groupInviteButtonText}>TAP TO VIEW</AppText>
                </View>
              </View>
              <AppText fixedColor style={styles.groupInviteTime}>{formatTime(item.timestamp)}</AppText>
            </TouchableOpacity>
          ) : item.type === 'contact' && item.contactName ? (
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => setContactActionCard({
                name: item.contactName!,
                phone: item.contactPhone ?? '',
                userId: item.contactUserId ?? null,
              })}
              style={styles.contactBubbleIn}
            >
              <View style={styles.contactBubbleTop}>
                <View style={styles.contactBubbleAvatar}>
                  <AppText style={styles.contactBubbleInitials}>
                    {item.contactName.slice(0, 2).toUpperCase()}
                  </AppText>
                </View>
                <View style={{ flex: 1 }}>
                  <AppText fixedColor style={styles.contactBubbleName}>{item.contactName}</AppText>
                  <AppText fixedColor style={styles.contactBubblePhone}>{item.contactPhone ?? ''}</AppText>
                </View>
              </View>
              <View style={styles.contactBubbleDivider} />
              <AppText fixedColor style={styles.contactBubbleTime}>{formatTime(item.timestamp)}</AppText>
            </TouchableOpacity>
          ) : item.type === 'image' && item.imageUrl ? (
            <LinearGradient colors={GRADIENTS.chatSent} style={[styles.bubble, styles.bubbleIn, styles.imageBubble]}>
              {isGroup && (() => {
                const info = resolveSenderInfo(item.senderId);
                const nameColor = getSenderNameColor(item.senderId);
                return (
                  <View style={styles.groupSenderRow}>
                    <AppText fixedColor style={[styles.groupSenderName, { color: nameColor }]}>{info.name}</AppText>
                    {info.phone ? <AppText fixedColor style={styles.groupSenderPhone}>{info.phone}</AppText> : null}
                  </View>
                );
              })()}
              {item.forwarded && (
                <View style={styles.forwardedLabel}>
                  <AppIcon name="arrow-redo" size={11} color="rgba(255,255,255,0.6)" fixedColor />
                  <AppText fixedColor style={styles.forwardedText}>Forwarded</AppText>
                </View>
              )}
              <TouchableOpacity 
                activeOpacity={0.9}
                onPress={() => {
                  setViewerImageUrl(item.imageUrl!);
                  setViewerVisible(true);
                }}
              >
                <Image 
                  source={{ uri: item.imageUrl }} 
                  style={styles.messageImage}
                  resizeMode="cover"
                />
              </TouchableOpacity>
              <View style={styles.imageTimeOverlay}>
                <AppText fixedColor style={styles.timeIn}>{formatTime(item.timestamp)}</AppText>
              </View>
            </LinearGradient>
          ) : (
            <LinearGradient colors={GRADIENTS.chatSent} style={[styles.bubble, styles.bubbleIn]}>
              {isGroup && (() => {
                const info = resolveSenderInfo(item.senderId);
                const nameColor = getSenderNameColor(item.senderId);
                return (
                  <View style={styles.groupSenderRow}>
                    <AppText fixedColor style={[styles.groupSenderName, { color: nameColor }]}>{info.name}</AppText>
                    {info.phone ? <AppText fixedColor style={styles.groupSenderPhone}>{info.phone}</AppText> : null}
                  </View>
                );
              })()}
              {item.forwarded && (
                <View style={styles.forwardedLabel}>
                  <AppIcon name="arrow-redo" size={11} color="rgba(255,255,255,0.6)" fixedColor />
                  <AppText fixedColor style={styles.forwardedText}>Forwarded</AppText>
                </View>
              )}
              {item.replyTo && (
                <TouchableOpacity 
                  style={styles.replyBubble}
                  onPress={() => {
                    const originalMsg = messages.find(m => m.messageId === item.replyTo!.messageId);
                    if (originalMsg) {
                      const index = messages.findIndex(m => m.messageId === item.replyTo!.messageId);
                      if (index !== -1 && listRef.current) {
                        listRef.current.scrollToIndex({ index, animated: true, viewPosition: 0.5 });
                      }
                    }
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.replyBubbleBar} />
                  <View style={{ flex: 1 }}>
                    <AppText fixedColor style={styles.replyBubbleSender}>
                      {item.replyTo.senderId === userId ? 'You' : resolveSenderName(item.replyTo.senderId)}
                    </AppText>
                    <AppText fixedColor style={styles.replyBubbleText} numberOfLines={1}>
                      {item.replyTo.type === 'text' && item.replyTo.text
                        ? item.replyTo.text
                        : item.replyTo.type === 'voice'
                          ? '🎤 Voice message'
                          : item.replyTo.type === 'image'
                            ? '📷 Image'
                            : item.replyTo.type === 'file'
                              ? '📎 File'
                              : item.replyTo.type === 'location'
                                                               ? '📍 Location'
                                : item.replyTo.type === 'call'
                                  ? (item.replyTo.text || '📞 Call')
                                  : item.replyTo.type === 'contact'
                                    ? '👤 Contact'
                                    : 'Message'}

                    </AppText>
                  </View>
                </TouchableOpacity>
              )}
              {item.text && <AppText fixedColor style={styles.bubbleTextIn}>{item.text}</AppText>}
              <AppText fixedColor style={styles.timeIn}>{formatTime(item.timestamp)}</AppText>
            </LinearGradient>
          )
        )}
        {isOut && (
          item.type === 'voice' && item.voiceUrl && item.duration ? (
            <VoiceMessageBubble
              messageId={item.messageId}
              voiceUrl={item.voiceUrl}
              durationMs={item.duration}
              isOutgoing={true}
              playerState={player.state}
              onPlay={() => {
                if (player.state.activeMessageId === item.messageId && player.state.status === 'paused') {
                  player.resume();
                } else {
                  player.play(item.voiceUrl!, item.messageId, item.duration!);
                }
              }}
              onPause={() => player.pause()}
              onSeek={(positionMs) => player.seek(positionMs)}
              timestamp={item.timestamp}
              tickIcon={tickIcon}
            />
              ) : item.type === 'call' ? (
  <View style={[styles.callBubble, styles.callBubbleOut]}>
    <View style={styles.callIconCircle}>
      <AppIcon
        name={item.callType === 'video' ? 'videocam' : 'call'}
        size={20}
        color={COLORS.blue}
      />
    </View>
    <View style={styles.callContent}>
      <AppText style={[styles.callTitle, { color: textColor }]}>
        {item.callType === 'video' ? 'Video call' : 'Voice call'}
      </AppText>
      {item.callDuration && item.callDuration > 0 ? (
        <AppText style={[styles.callDuration, { color: textColor, opacity: 0.6 }]}>
          {formatCallDuration(item.callDuration)}
        </AppText>
      ) : item.callStatus === 'missed' ? (
        <AppText style={[styles.callDuration, { color: COLORS.missed }]}>Missed</AppText>

      ) : item.callStatus === 'rejected' ? (
        <AppText style={[styles.callDuration, { color: textColor, opacity: 0.6 }]}>Declined</AppText>
      ) : item.callStatus === 'busy' ? (
        <AppText style={[styles.callDuration, { color: textColor, opacity: 0.6 }]}>Busy</AppText>
      ) : item.callStatus === 'failed' ? (
        <AppText style={[styles.callDuration, { color: textColor, opacity: 0.6 }]}>Failed</AppText>
      ) : null}
    </View>
    <View style={styles.callTimeWithTick}>
      <AppText style={styles.callTime}>{formatTime(item.timestamp)}</AppText>
      <AppIcon
        name={tickIcon.icon}
        size={13}
        color={tickIcon.color}
        fixedColor
      />
    </View>
  </View>


          ) : item.type === 'file' && item.fileUrl && item.fileName ? (
            <FileMessageBubble
              fileName={item.fileName!}
              fileSize={item.fileSize ?? undefined}
              fileUrl={item.fileUrl!}
              mimeType={item.mimeType ?? undefined}
              isOutgoing={true}
            />
          ) : item.type === 'location' && item.location ? (
            <LocationMessageBubble
              location={item.location}
              isLiveLocation={item.isLiveLocation}
              liveLocationExpiry={item.liveLocationExpiry}
              isSender={true}
              onStopSharing={() => handleStopLiveLocation(item.messageId)}
              timestamp={item.timestamp}
              tickIcon={tickIcon}
            />
          ) : item.type === 'group-invite' && item.groupName ? (
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => {
                const inviteCode = item.inviteCode || item.text?.split('/').pop();
                if (inviteCode) handleOpenInvitePreview(inviteCode, item.groupName!);
              }}
              style={styles.groupInviteBubbleOut}
            >
              <View style={styles.groupInviteIconWrap}>
                <AppIcon name="people" size={32} color="#fff" fixedColor />
              </View>
              <View style={{ flex: 1 }}>
                <AppText fixedColor style={[styles.groupInviteTitle, { color: 'rgba(255,255,255,0.8)' }]}>Group Invite</AppText>
                <AppText fixedColor style={[styles.groupInviteName, { color: '#fff' }]}>{item.groupName}</AppText>
              </View>
              <View style={styles.groupInviteTimeWithTick}>
                <AppText fixedColor style={[styles.groupInviteTime, { color: 'rgba(255,255,255,0.7)' }]}>{formatTime(item.timestamp)}</AppText>
                <AppIcon name={tickIcon.icon} size={13} color={tickIcon.color} fixedColor />
              </View>
            </TouchableOpacity>
          ) : item.type === 'contact' && item.contactName ? (
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => setContactActionCard({
                name: item.contactName!,
                phone: item.contactPhone ?? '',
                userId: item.contactUserId ?? null,
              })}
              style={styles.contactBubbleOut}
            >
              <View style={styles.contactBubbleTop}>
                <View style={styles.contactBubbleAvatar}>
                  <AppText style={styles.contactBubbleInitials}>
                    {item.contactName.slice(0, 2).toUpperCase()}
                  </AppText>
                </View>
                <View style={{ flex: 1 }}>
                  <AppText style={[styles.contactBubbleName, { color: textColor }]}>{item.contactName}</AppText>
                  <AppText style={[styles.contactBubblePhone, { color: COLORS.sub }]}>{item.contactPhone ?? ''}</AppText>
                </View>
              </View>
              <View style={styles.contactBubbleDivider} />
              <View style={styles.timeOutRow}>
                <AppText style={styles.timeOut}>{formatTime(item.timestamp)}</AppText>
                <AppIcon name={tickIcon.icon} size={13} color={tickIcon.color} fixedColor />
              </View>
            </TouchableOpacity>
          ) : item.type === 'image' && item.imageUrl ? (
            <View style={[styles.bubble, styles.bubbleOut, styles.imageBubble]}>
              {item.forwarded && (
                <View style={[styles.forwardedLabel, { paddingHorizontal: 8, paddingTop: 4 }]}>
                  <AppIcon name="arrow-redo" size={11} color={COLORS.sub} fixedColor />
                  <AppText style={[styles.forwardedText, { color: COLORS.sub }]}>Forwarded</AppText>
                </View>
              )}
              <TouchableOpacity 
                activeOpacity={0.9}
                onPress={() => {
                  setViewerImageUrl(item.imageUrl!);
                  setViewerVisible(true);
                }}
              >
                <Image 
                  source={{ uri: item.imageUrl }} 
                  style={styles.messageImage}
                  resizeMode="cover"
                />
              </TouchableOpacity>
              <View style={styles.imageTimeOverlay}>
                <AppText style={styles.timeOut}>{formatTime(item.timestamp)}</AppText>
                <AppIcon
                  name={tickIcon.icon}
                  size={13}
                  color={tickIcon.color}
                  fixedColor
                />
              </View>
            </View>
          ) : (
            <View style={[styles.bubble, styles.bubbleOut]}>
              {item.forwarded && (
                <View style={styles.forwardedLabel}>
                  <AppIcon name="arrow-redo" size={11} color={COLORS.sub} fixedColor />
                  <AppText style={[styles.forwardedText, { color: COLORS.sub }]}>Forwarded</AppText>
                </View>
              )}
              {item.replyTo && (
                <TouchableOpacity 
                  style={[styles.replyBubble, { backgroundColor: 'rgba(30,156,240,0.08)' }]}
                  onPress={() => {
                    const originalMsg = messages.find(m => m.messageId === item.replyTo!.messageId);
                    if (originalMsg) {
                      const index = messages.findIndex(m => m.messageId === item.replyTo!.messageId);
                      if (index !== -1 && listRef.current) {
                        listRef.current.scrollToIndex({ index, animated: true, viewPosition: 0.5 });
                      }
                    }
                  }}
                  activeOpacity={0.7}
                >
                  <View style={[styles.replyBubbleBar, { backgroundColor: COLORS.blue }]} />
                  <View style={{ flex: 1 }}>
                    <AppText style={[styles.replyBubbleSender, { color: COLORS.blue }]}>
                      {item.replyTo.senderId === userId ? 'You' : resolveSenderName(item.replyTo.senderId)}
                    </AppText>
                    <AppText style={[styles.replyBubbleText, { color: textColor, opacity: 0.7 }]} numberOfLines={1}>
                      {item.replyTo.type === 'text' && item.replyTo.text 
                        ? item.replyTo.text 
                        : item.replyTo.type === 'voice' 
                          ? '🎤 Voice message'
                          : item.replyTo.type === 'image'
                            ? '📷 Image'
                            : item.replyTo.type === 'file'
                              ? '📎 File'
                              : item.replyTo.type === 'location'
                                  ? '📍 Location'
                              : item.replyTo.type === 'call'
                              ? (item.replyTo.text || '📞 Call')
                              : item.replyTo.type === 'contact'
                              ? '👤 Contact'
                              : 'Message'}

                    </AppText>
                  </View>
                </TouchableOpacity>
              )}
              {item.text && <AppText style={[styles.bubbleTextOut, { color: textColor, fontFamily }]}>{item.text}</AppText>}
              <View style={styles.timeOutRow}>
                <AppText style={styles.timeOut}>{formatTime(item.timestamp)}</AppText>
                <AppIcon
                  name={tickIcon.icon}
                  size={13}
                  color={tickIcon.color}
                  fixedColor
                />
              </View>
            </View>
          )
        )}
      </View>
    );

    return (
      <TouchableOpacity
        activeOpacity={1}
        onLongPress={() => handleLongPressMessage(item.messageId)}
        delayLongPress={300}
      >
        <View style={[isSelected && styles.selectedMessage]}>
          {messageContent}
          {/* Search match highlight — active match is orange-tinted, others blue-tinted */}
          {isSearchMatch && (
            <View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFill,
                styles.searchHighlightOverlay,
                isActiveMatch && styles.searchHighlightOverlayActive,
              ]}
            />
          )}
          {/* Flash highlight after navigating from search */}
          {item.messageId === highlightedMessageId && (
            <Animated.View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFill,
                styles.searchHighlightOverlay,
                styles.searchHighlightOverlayActive,
                { opacity: highlightAnim },
              ]}
            />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  // ── Loading state ───────────────────────────────────────────────
  const renderLoading = () => (
    <View style={styles.centerState}>
      <ActivityIndicator size="large" color={COLORS.blue} />
    </View>
  );

  // ── Empty state ─────────────────────────────────────────────────
  const renderEmpty = () => (
    <View style={styles.centerState}>
      <AppText style={styles.emptyEmoji}>👋</AppText>
      <AppText style={styles.emptyText}>Say hello!</AppText>
    </View>
  );

  return (
    <>
      <SafeAreaView style={[styles.root, { backgroundColor: COLORS.sky1 }]} edges={['left', 'right', 'bottom']}>
        <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <AppBg />

          {/* ── Top bar ── */}
          {searchOpen ? (
            /* ── Inline search bar (replaces top bar while search is active) ── */
            <View style={[styles.topBar, styles.searchBar]}>
              <TouchableOpacity
                onPress={() => {
                  setSearchOpen(false);
                  setSearchQuery('');
                  setSearchMatchIds([]);
                  setSearchCurrentIndex(0);
                  setHighlightedMessageId(null);
                }}
                style={styles.backBtn}
              >
                <AppIcon name="arrow-back" size={24} color={COLORS.blue} fixedColor />
              </TouchableOpacity>

              <TextInput
                ref={searchInputRef}
                style={[styles.searchBarInput, { color: textColor }]}
                placeholder="Search messages…"
                placeholderTextColor={COLORS.sub}
                value={searchQuery}
                onChangeText={handleSearch}
                autoFocus
                returnKeyType="search"
              />

              {/* Match counter */}
              {searchQuery.trim().length > 0 && (
                <AppText style={styles.searchMatchCount}>
                  {searchMatchIds.length === 0
                    ? '0 / 0'
                    : `${searchMatchIds.length - searchCurrentIndex} / ${searchMatchIds.length}`}
                </AppText>
              )}

              {/* Up arrow — older message */}
              <TouchableOpacity
                onPress={() => navigateMatch(-1)}
                disabled={searchMatchIds.length === 0 || searchCurrentIndex === 0}
                style={styles.searchNavBtn}
                hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
              >
                <AppIcon
                  name="chevron-up"
                  size={22}
                  color={searchMatchIds.length === 0 || searchCurrentIndex === 0 ? COLORS.sub : COLORS.blue}
                />
              </TouchableOpacity>

              {/* Down arrow — newer message */}
              <TouchableOpacity
                onPress={() => navigateMatch(1)}
                disabled={searchMatchIds.length === 0 || searchCurrentIndex === searchMatchIds.length - 1}
                style={styles.searchNavBtn}
                hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
              >
                <AppIcon
                  name="chevron-down"
                  size={22}
                  color={
                    searchMatchIds.length === 0 || searchCurrentIndex === searchMatchIds.length - 1
                      ? COLORS.sub
                      : COLORS.blue
                  }
                />
              </TouchableOpacity>
            </View>
          ) : (
          <View style={styles.topBar}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <AppIcon name="chevron-back" size={24} color={COLORS.blue} fixedColor />
            </TouchableOpacity>

            {/* Tapping the avatar/name opens Profile Modal */}
            <TouchableOpacity
              style={styles.topBarContact}
              onPress={() => setProfileModalOpen(true)}
              activeOpacity={0.75}
            >
              <Avatar 
                initials={getInitials(displayName)} 
                color={COLORS.blue} 
                size={40}
                imageUrl={headerPhoto}
              />
              <View style={styles.contactInfo}>
                <AppText style={[styles.contactName, { color: textColor, fontFamily }]}>{displayName}</AppText>
                <AppText style={[styles.onlineText, { color: isOnline ? COLORS.blue : FG.secondary }]}>
                  {isGroup
                    ? 'Group chat'
                    : presenceText || 'Tap here for info'}
                </AppText>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.iconBtn} onPress={handleVoiceCall} disabled={outgoingCall.isInitiating}>
              <AppIcon name="call" size={20} color={COLORS.blue} fixedColor />
            </TouchableOpacity>

            <TouchableOpacity style={styles.iconBtn} onPress={handleVideoCall} disabled={outgoingCall.isInitiating}>
              <AppIcon name="videocam" size={20} color={COLORS.blue} fixedColor />
            </TouchableOpacity>

            <TouchableOpacity style={styles.iconBtn} onPress={() => setMenuOpen((v) => !v)}>
              <AppIcon name="ellipsis-vertical" size={20} color={COLORS.blue} fixedColor />
            </TouchableOpacity>
          </View>
          )}{/* end searchOpen ternary */}

          {/* ── 3-dot menu dropdown ── */}
          <Modal visible={menuOpen} transparent animationType="none" onRequestClose={() => setMenuOpen(false)}>
            <TouchableOpacity 
              style={styles.menuBackdrop} 
              activeOpacity={1} 
              onPress={() => setMenuOpen(false)} 
            />
            <View style={[styles.menuCard, bevel]}>
              <TouchableOpacity
                style={styles.menuItem}
                onPress={async () => {
                  const newMutedState = !muted;
                  setMuted(newMutedState);
                  await saveMutedState(chatId, newMutedState);
                  setMenuOpen(false);
                }}
                activeOpacity={0.75}
              >
                <AppIcon 
                  name={muted ? 'notifications' : 'notifications-off'} 
                  size={20} 
                  color={COLORS.blue} 
                  fixedColor 
                />
                <AppText style={[styles.menuItemText, { color: textColor }]}>
                  {muted ? 'Unmute Notifications' : 'Mute Notifications'}
                </AppText>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setMenuOpen(false);
                  setSearchOpen(true);
                }}
                activeOpacity={0.75}
              >
                <AppIcon name="search" size={20} color={COLORS.blue} fixedColor />
                <AppText style={[styles.menuItemText, { color: textColor }]}>Search in chat</AppText>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setMenuOpen(false);
                  setContactQuery('');
                  setContactPickerOpen(true);
                }}
                activeOpacity={0.75}
              >
                <AppIcon name="person-outline" size={20} color={COLORS.blue} fixedColor />
                <AppText style={[styles.menuItemText, { color: textColor }]}>Share Contact</AppText>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.menuItem, styles.menuItemDanger]}
                onPress={() => {
                  setMenuOpen(false);
                  Alert.alert(
                    'Clear Chat',
                    'Are you sure you want to clear all messages in this chat?',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Clear', style: 'destructive', onPress: handleClearChat }
                    ]
                  );
                }}
                activeOpacity={0.75}
              >
                <AppIcon name="trash-outline" size={20} color={COLORS.missed} fixedColor />
                <AppText style={[styles.menuItemText, styles.menuItemTextDanger]}>Clear Chat</AppText>
              </TouchableOpacity>
            </View>
          </Modal>

          {/* ── Messages list ── */}
          {loading ? renderLoading() : messagesWithDates.length === 0 ? renderEmpty() : (
            <FlatList
              ref={listRef}
              data={messagesWithDates}
              keyExtractor={(item) => item.type === 'message' ? item.data.messageId : `date-${item.date.getTime()}`}
              renderItem={renderItem}
              contentContainerStyle={styles.messageList}
              showsVerticalScrollIndicator={false}
              // Keep the viewport stable when older messages are prepended.
              maintainVisibleContentPosition={{ minIndexForVisible: 1 }}
              ListHeaderComponent={
                hasMore ? (
                  <TouchableOpacity
                    style={styles.loadEarlierBtn}
                    activeOpacity={0.7}
                    disabled={loadingOlder}
                    onPress={loadOlder}
                  >
                    {loadingOlder ? (
                      <ActivityIndicator size="small" color={COLORS.blue} />
                    ) : (
                      <AppText style={styles.loadEarlierText}>Load earlier messages</AppText>
                    )}
                  </TouchableOpacity>
                ) : null
              }
              ListFooterComponent={
                typingNames.length > 0
                  ? <TypingIndicator names={typingNames} />
                  : null
              }
              onContentSizeChange={() => {
                // Only auto-pin to the bottom for new/live content, not when
                // older messages are being paged in above the viewport.
                if (!loadingOlder) listRef.current?.scrollToEnd({ animated: false });
              }}
            />
          )}

          {/* ── Permission denied message ── */}
          {permissionMessage && (
            <View style={styles.permissionBanner}>
              <AppText style={styles.permissionText}>{permissionMessage}</AppText>
              {showSettingsButton ? (
                <View style={styles.permissionActions}>
                  <TouchableOpacity onPress={handleOpenSettings} style={styles.permissionBtn}>
                    <AppText fixedColor style={styles.permissionBtnText}>Open Settings</AppText>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={dismissPermissionMessage} style={styles.permissionDismissBtn}>
                    <AppIcon name="close" size={18} color={COLORS.sub} />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity onPress={dismissPermissionMessage} style={styles.permissionDismissBtn}>
                  <AppIcon name="close" size={18} color={COLORS.sub} />
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* ── Upload error / retry banner ── */}
          {uploadError && (
            <View style={styles.uploadErrorBanner}>
              <AppIcon name="alert-circle-outline" size={16} color={COLORS.missed} fixedColor />
              <AppText style={styles.uploadErrorText}>{uploadError}</AppText>
              {pendingRecordingRef.current && retryCount < MAX_UPLOAD_RETRIES && (
                <TouchableOpacity onPress={handleRetryUpload} style={styles.retryBtn}>
                  <AppText fixedColor style={styles.retryBtnText}>Retry</AppText>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={() => { setUploadError(null); pendingRecordingRef.current = null; }} style={styles.permissionDismissBtn}>
                <AppIcon name="close" size={18} color={COLORS.sub} />
              </TouchableOpacity>
            </View>
          )}

          {/* ── Message Action Toolbar ── */}
          {showMessageActions && selectedMessageId && (
            <View style={[styles.actionToolbar, { backgroundColor: FG.glassBg, borderTopColor: FG.glassBorder }]}>
              <View style={styles.actionToolbarContent}>
                <TouchableOpacity style={styles.actionToolbarBtn} onPress={handleReplyMessage}>
                  <AppIcon name="arrow-undo-outline" size={22} color={COLORS.blue} />
                  <AppText style={[styles.actionToolbarLabel, { color: textColor }]}>Reply</AppText>
                </TouchableOpacity>

                <TouchableOpacity style={styles.actionToolbarBtn} onPress={handleForwardMessage}>
                  <AppIcon name="arrow-redo-outline" size={22} color={COLORS.blue} />
                  <AppText style={[styles.actionToolbarLabel, { color: textColor }]}>Forward</AppText>
                </TouchableOpacity>

                <TouchableOpacity style={styles.actionToolbarBtn} onPress={handleCopyMessage}>
                  <AppIcon name="copy-outline" size={22} color={COLORS.blue} />
                  <AppText style={[styles.actionToolbarLabel, { color: textColor }]}>Copy</AppText>
                </TouchableOpacity>

                <TouchableOpacity style={styles.actionToolbarBtn} onPress={handleShowMessageInfo}>
                  <AppIcon name="information-circle-outline" size={22} color={COLORS.blue} />
                  <AppText style={[styles.actionToolbarLabel, { color: textColor }]}>Info</AppText>
                </TouchableOpacity>

                <TouchableOpacity style={styles.actionToolbarBtn} onPress={handleDeleteMessage}>
                  <AppIcon name="trash-outline" size={22} color={COLORS.missed} fixedColor />
                  <AppText style={[styles.actionToolbarLabel, { color: COLORS.missed }]}>Delete</AppText>
                </TouchableOpacity>

                <TouchableOpacity style={styles.actionToolbarClose} onPress={handleClearSelection}>
                  <AppIcon name="close-circle" size={24} color={FG.secondary} />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ── Emoji panel ── */}
          {showEmoji && (
            <View style={[styles.emojiPanel, { backgroundColor: FG.glassBg, borderTopColor: FG.glassBorder }]}>
              <ScrollView horizontal={false} showsVerticalScrollIndicator={false}>
                <View style={styles.emojiGrid}>
                  {EMOJI_LIST.map((e) => (
                    <TouchableOpacity key={e} style={styles.emojiItem} onPress={() => setInput(prev => prev + e)}>
                      <AppText fixedColor style={styles.emojiChar}>{e}</AppText>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>
          )}

          {/* ── Reply Preview ── */}
          {replyingTo && (
            <View style={[styles.replyPreview, { backgroundColor: FG.glassBg, borderTopColor: FG.glassBorder }]}>
              <View style={styles.replyPreviewBar} />
              <View style={styles.replyPreviewContent}>
                <View style={{ flex: 1 }}>
                  <AppText style={[styles.replyPreviewLabel, { color: COLORS.blue }]}>
                    Replying to {replyingTo.senderId === userId ? 'yourself' : resolveSenderName(replyingTo.senderId)}
                  </AppText>
                  <AppText style={[styles.replyPreviewText, { color: FG.secondary }]} numberOfLines={1}>
                    {replyingTo.type === 'text' && replyingTo.text 
                      ? replyingTo.text 
                      : replyingTo.type === 'voice' 
                        ? '🎤 Voice message'
                        : replyingTo.type === 'image'
                          ? '📷 Image'
                          : replyingTo.type === 'file'
                            ? `📎 ${replyingTo.fileName || 'File'}`
                            : replyingTo.type === 'location'
                              ? '📍 Location'
                              : 'Message'}
                  </AppText>
                </View>
                <TouchableOpacity onPress={() => setReplyingTo(null)} style={styles.replyPreviewClose}>
                  <AppIcon name="close-circle" size={22} color={FG.secondary} />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ── Input bar / Blocked banner ── */}
          {isBlocked ? (
            /* Show blocked banner + input bar */
            <View style={styles.inputBarWithBanner}>
              {/* Banner */}
              <TouchableOpacity 
                style={[styles.blockedBanner, { backgroundColor: FG.glassBg, borderTopColor: FG.glassBorder }]}
                onPress={blockedByMe ? handleUnblockContact : undefined}
                activeOpacity={blockedByMe ? 0.7 : 1}
                disabled={!blockedByMe}
              >
                <View style={styles.blockedBannerContent}>
                  <AppIcon name="ban-outline" size={20} color={COLORS.missed} fixedColor />
                  <View style={{ flex: 1 }}>
                    {blockedByMe ? (
                      <AppText style={[styles.blockedBannerTitle, { color: textColor, fontFamily }]}>
                        You blocked {displayName}. Tap here to unblock
                      </AppText>
                    ) : (
                      <AppText style={[styles.blockedBannerTitle, { color: textColor, fontFamily }]}>
                        {displayName} blocked you
                      </AppText>
                    )}
                  </View>
                  {blockedByMe && (
                    <AppIcon name="chevron-forward" size={20} color={COLORS.blue} fixedColor />
                  )}
                </View>
              </TouchableOpacity>

              {/* Input bar - always show */}
              <View style={styles.inputBar}>
                {isRecording ? (
                  <View style={styles.recordingOverlayContainer}>
                    <VoiceRecordingOverlay
                      durationMs={recorder.state.durationMs}
                      isWarning={recorder.state.isWarning}
                      onCancel={() => recorder.cancelRecording()}
                    />
                  </View>
                ) : (
                  <>
                    {/* Attachments */}
                    <TouchableOpacity style={styles.inputSideBtn} onPress={() => { setShowEmoji(false); setShowAttach(true); }}>
                      <AppIcon name="add" size={26} color={COLORS.sub} />
                    </TouchableOpacity>

                    {/* Text field + emoji */}
                    <View style={styles.inputFieldWrap}>
                      <TextInput
                        style={[styles.inputField, { color: FG.primary }]}
                        placeholder="Message"
                        placeholderTextColor={FG.faint}
                        value={input}
                        onChangeText={(text) => {
                          setInput(text);
                          setTyping(text.length > 0);
                        }}
                        multiline
                        maxLength={500}
                        onFocus={() => { setShowEmoji(false); setShowAttach(false); }}
                      />
                      <TouchableOpacity style={styles.emojiBtn} onPress={() => { setShowAttach(false); setShowEmoji((e) => !e); }}>
                        <AppIcon name={showEmoji ? 'keypad-outline' : 'happy-outline'} size={22} color={COLORS.sub} />
                      </TouchableOpacity>
                    </View>

                    {/* Camera */}
                    <TouchableOpacity style={styles.inputSideBtn} onPress={openCamera}>
                      <AppIcon name="camera-outline" size={22} color={COLORS.sub} />
                    </TouchableOpacity>
                  </>
                )}

                {/* Mic / Send button */}
                {input.trim() ? (
                  <TouchableOpacity onPress={() => handleSend()} activeOpacity={0.85} style={styles.sendBtn}>
                    <LinearGradient colors={GRADIENTS.primary} style={styles.sendBtnInner}>
                      <AppIcon name="send" size={19} color="#fff" fixedColor />
                    </LinearGradient>
                  </TouchableOpacity>
                ) : (
                  <View {...micPanResponder.panHandlers} style={styles.sendBtn}>
                    <LinearGradient
                      colors={isRecording ? ['#ef4444', '#dc2626'] : ['#7dd3fc', '#38bdf8']}
                      style={styles.sendBtnInner}
                    >
                      <AppIcon name="mic" size={19} color="#fff" fixedColor />
                    </LinearGradient>
                  </View>
                )}
              </View>
            </View>
          ) : (
            /* Normal Input Bar */
            <View style={styles.inputBar}>
            {isRecording ? (
              <View style={styles.recordingOverlayContainer}>
                <VoiceRecordingOverlay
                  durationMs={recorder.state.durationMs}
                  isWarning={recorder.state.isWarning}
                  onCancel={() => recorder.cancelRecording()}
                />
              </View>
            ) : (
              <>
                {/* Attachments */}
                <TouchableOpacity style={styles.inputSideBtn} onPress={() => { setShowEmoji(false); setShowAttach(true); }}>
                  <AppIcon name="add" size={26} color={COLORS.sub} />
                </TouchableOpacity>

                {/* Text field + emoji */}
                <View style={styles.inputFieldWrap}>
                  <TextInput
                    style={[styles.inputField, { color: FG.primary }]}
                    placeholder="Message"
                    placeholderTextColor={FG.faint}
                    value={input}
                    onChangeText={(text) => {
                      setInput(text);
                      setTyping(text.length > 0);
                    }}
                    multiline
                    maxLength={500}
                    onFocus={() => { setShowEmoji(false); setShowAttach(false); }}
                  />
                  <TouchableOpacity style={styles.emojiBtn} onPress={() => { setShowAttach(false); setShowEmoji((e) => !e); }}>
                    <AppIcon name={showEmoji ? 'keypad-outline' : 'happy-outline'} size={22} color={COLORS.sub} />
                  </TouchableOpacity>
                </View>

                {/* Camera */}
                <TouchableOpacity style={styles.inputSideBtn} onPress={openCamera}>
                  <AppIcon name="camera-outline" size={22} color={COLORS.sub} />
                </TouchableOpacity>
              </>
            )}

            {/* Mic / Send button */}
            {input.trim() || isUploading ? (
              <TouchableOpacity onPress={() => handleSend()} activeOpacity={0.85} style={styles.sendBtn}>
                <LinearGradient colors={GRADIENTS.primary} style={styles.sendBtnInner}>
                  <AppIcon name="send" size={19} color="#fff" fixedColor />
                </LinearGradient>
              </TouchableOpacity>
            ) : (
              <View {...micPanResponder.panHandlers} style={styles.sendBtn}>
                <LinearGradient
                  colors={isRecording ? ['#ef4444', '#dc2626'] : ['#7dd3fc', '#38bdf8']}
                  style={styles.sendBtnInner}
                >
                  <AppIcon name={isRecording ? 'stop' : 'mic'} size={19} color="#fff" fixedColor />
                </LinearGradient>
              </View>
            )}
          </View>
          )}

          {/* ── Upload progress indicator ── */}
          {(isUploading || uploadingImage) && (
            <View style={styles.uploadProgressBar}>
              <View style={[styles.uploadProgressFill, { width: `${isUploading ? uploadProgress : imageUploadProgress}%` }]} />
            </View>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* ── Attachments sheet ── */}
      <Modal visible={showAttach} transparent animationType="slide" onRequestClose={() => setShowAttach(false)}>
        <TouchableOpacity style={styles.attachOverlay} activeOpacity={1} onPress={() => setShowAttach(false)} />
        <View style={[styles.attachSheet, { backgroundColor: FG.glassBg }]}>
          <View style={styles.attachHandle} />
          <AppText style={[styles.attachTitle, { color: textColor, fontFamily }]}>Share</AppText>
          <View style={styles.attachGrid}>
            {[
              { icon: 'document-outline' as const, label: 'Files',    action: openDocuments },
              { icon: 'camera-outline'   as const, label: 'Camera',   action: () => { setShowAttach(false); openCamera(); } },
              { icon: 'location-outline' as const, label: 'Location', action: handleOpenLocationMenu },
            ].map((item) => (
              <TouchableOpacity key={item.label} style={[styles.attachItem, bevel]}
                onPress={item.action} activeOpacity={0.8}>
                <View style={styles.attachIconWrap}>
                  <AppIcon name={item.icon} size={26} color={COLORS.blue} fixedColor />
                </View>
                <AppText style={[styles.attachLabel, { color: textColor, fontFamily }]}>{item.label}</AppText>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

      {/* ── Add Member Picker Modal (group info) ── */}
      <Modal visible={addMemberPickerOpen} transparent animationType="slide" onRequestClose={() => setAddMemberPickerOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <TouchableOpacity style={styles.attachOverlay} activeOpacity={1} onPress={() => setAddMemberPickerOpen(false)} />
          <View style={[styles.contactPickerSheet, { backgroundColor: FG.glassBg, minHeight: 320 }]}>
            <AppBg />
            <View style={styles.attachHandle} />
            <AppText style={[styles.attachTitle, { color: textColor, fontFamily }]}>Add Member</AppText>

            <View style={[styles.contactSearchWrap, bevel]}>
              <AppIcon name="search-outline" size={16} color={COLORS.sub} />
              <TextInput
                style={[styles.contactSearchInput, { color: textColor }]}
                placeholder="Search contacts…"
                placeholderTextColor={COLORS.sub}
                value={addMemberQuery}
                onChangeText={setAddMemberQuery}
              />
              {addMemberQuery.length > 0 && (
                <TouchableOpacity onPress={() => setAddMemberQuery('')}>
                  <AppIcon name="close-circle" size={16} color={COLORS.sub} />
                </TouchableOpacity>
              )}
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              style={{ flexGrow: 1, minHeight: 200 }}
              contentContainerStyle={styles.contactPickerContent}
              keyboardShouldPersistTaps="handled"
            >
              {contactsLoading ? (
                <View style={{ alignItems: 'center', paddingTop: 60, gap: 12 }}>
                  <ActivityIndicator size="large" color={COLORS.blue} />
                  <AppText style={{ color: COLORS.sub, fontSize: 14 }}>Loading contacts...</AppText>
                </View>
              ) : (() => {
                const memberIds = groupMembers.map(m => m.userId);
                const available = (phoneContacts ?? [])
                  .filter(c => c.userId && c.userId !== userId)
                  .filter(c => !memberIds.includes(c.userId))
                  .filter(c => !addMemberQuery.trim() || c.displayName.toLowerCase().includes(addMemberQuery.toLowerCase()) || c.phone.includes(addMemberQuery));
                if (available.length === 0) {
                  return (
                    <View style={{ alignItems: 'center', paddingTop: 60, gap: 12 }}>
                      <AppIcon name="people-outline" size={48} color={COLORS.sub} />
                      <AppText style={{ color: textColor, fontSize: 16, fontWeight: '600', textAlign: 'center' }}>
                        {addMemberQuery.trim() ? 'No matching contacts' : 'No contacts to add'}
                      </AppText>
                      <AppText style={{ color: COLORS.sub, fontSize: 13, textAlign: 'center', paddingHorizontal: 40 }}>
                        {addMemberQuery.trim() ? `No contacts match "${addMemberQuery}"` : 'All your ChitChat contacts are already in this group'}
                      </AppText>
                    </View>
                  );
                }
                return available.map(c => (
                  <TouchableOpacity
                    key={c.phone}
                    style={[styles.contactPickerRow, bevel]}
                    activeOpacity={0.75}
                    onPress={() => handleAddMember({ userId: c.userId, displayName: c.displayName })}
                  >
                    <Avatar
                      initials={c.displayName.slice(0, 2).toUpperCase()}
                      color={COLORS.blue}
                      size={44}
                      imageUrl={c.photoUri || c.firebasePhotoURL || null}
                    />
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <AppText style={[{ fontSize: 14, fontWeight: '600' }, { color: textColor }]}>{c.displayName}</AppText>
                      <AppText style={{ fontSize: 12, color: COLORS.sub, marginTop: 2 }}>{c.phone}</AppText>
                    </View>
                    <AppIcon name="person-add" size={18} color={COLORS.blue} fixedColor />
                  </TouchableOpacity>
                ));
              })()}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Invite Link Picker Modal (send within app) ── */}
      <Modal visible={invitePickerOpen} transparent animationType="slide" onRequestClose={() => setInvitePickerOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <TouchableOpacity style={styles.attachOverlay} activeOpacity={1} onPress={() => setInvitePickerOpen(false)} />
          <View style={[styles.contactPickerSheet, { backgroundColor: FG.glassBg, minHeight: 320 }]}>
            <AppBg />
            <View style={styles.attachHandle} />
            <AppText style={[styles.attachTitle, { color: textColor, fontFamily }]}>Send Invite To…</AppText>

            <View style={[styles.contactSearchWrap, bevel]}>
              <AppIcon name="search-outline" size={16} color={COLORS.sub} />
              <TextInput
                style={[styles.contactSearchInput, { color: textColor }]}
                placeholder="Search contacts…"
                placeholderTextColor={COLORS.sub}
                value={invitePickerQuery}
                onChangeText={setInvitePickerQuery}
              />
              {invitePickerQuery.length > 0 && (
                <TouchableOpacity onPress={() => setInvitePickerQuery('')}>
                  <AppIcon name="close-circle" size={16} color={COLORS.sub} />
                </TouchableOpacity>
              )}
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              style={{ flexGrow: 1, minHeight: 200 }}
              contentContainerStyle={styles.contactPickerContent}
              keyboardShouldPersistTaps="handled"
            >
              {contactsLoading ? (
                <View style={{ alignItems: 'center', paddingTop: 60, gap: 12 }}>
                  <ActivityIndicator size="large" color={COLORS.blue} />
                  <AppText style={{ color: COLORS.sub, fontSize: 14 }}>Loading contacts...</AppText>
                </View>
              ) : (() => {
                const memberIds = groupMembers.map(m => m.userId);
                const available = (phoneContacts ?? [])
                  .filter(c => c.userId && c.userId !== userId)
                  .filter(c => !memberIds.includes(c.userId))
                  .filter(c => !invitePickerQuery.trim() || c.displayName.toLowerCase().includes(invitePickerQuery.toLowerCase()) || c.phone.includes(invitePickerQuery));
                if (available.length === 0) {
                  return (
                    <View style={{ alignItems: 'center', paddingTop: 60, gap: 12 }}>
                      <AppIcon name="people-outline" size={48} color={COLORS.sub} />
                      <AppText style={{ color: textColor, fontSize: 16, fontWeight: '600', textAlign: 'center' }}>
                        {invitePickerQuery.trim() ? 'No matching contacts' : 'No contacts to invite'}
                      </AppText>
                    </View>
                  );
                }
                return available.map(c => (
                  <TouchableOpacity
                    key={c.phone}
                    style={[styles.contactPickerRow, bevel]}
                    activeOpacity={0.75}
                    onPress={() => handleSendInviteTo({ userId: c.userId, displayName: c.displayName })}
                  >
                    <Avatar
                      initials={c.displayName.slice(0, 2).toUpperCase()}
                      color={COLORS.blue}
                      size={44}
                      imageUrl={c.photoUri || c.firebasePhotoURL || null}
                    />
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <AppText style={[{ fontSize: 14, fontWeight: '600' }, { color: textColor }]}>{c.displayName}</AppText>
                      <AppText style={{ fontSize: 12, color: COLORS.sub, marginTop: 2 }}>{c.phone}</AppText>
                    </View>
                    <AppIcon name="send-outline" size={18} color={COLORS.blue} fixedColor />
                  </TouchableOpacity>
                ));
              })()}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Received Contact Action Modal ── */}
      <Modal
        visible={contactActionCard !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setContactActionCard(null)}
      >
        <TouchableOpacity
          style={styles.contactActionOverlay}
          activeOpacity={1}
          onPress={() => setContactActionCard(null)}
        >
          <TouchableOpacity activeOpacity={1} style={[styles.contactActionSheet, { backgroundColor: FG.glassBg }]}>
            <AppBg />
            {contactActionCard && (
              <>
                <View style={styles.contactActionHeader}>
                  <View style={styles.contactBubbleAvatar}>
                    <AppText style={styles.contactBubbleInitials}>
                      {contactActionCard.name.slice(0, 2).toUpperCase()}
                    </AppText>
                  </View>
                  <View style={{ flex: 1 }}>
                    <AppText style={[styles.contactActionName, { color: textColor }]} numberOfLines={1}>
                      {contactActionCard.name}
                    </AppText>
                    <AppText style={{ fontSize: 13, color: COLORS.sub, marginTop: 2 }}>
                      {contactActionCard.phone}
                    </AppText>
                  </View>
                </View>

                <View style={styles.contactActionDivider} />

                {/* Message action — always available for ChitChat users */}
                <TouchableOpacity
                  style={styles.contactActionButton}
                  activeOpacity={0.7}
                  onPress={() => handleMessageSharedContact(contactActionCard.userId, contactActionCard.name)}
                >
                  <AppIcon name="chatbubble-outline" size={22} color={COLORS.blue} fixedColor />
                  <View style={{ flex: 1, marginLeft: 14 }}>
                    <AppText style={[styles.contactActionButtonTitle, { color: textColor }]}>
                      {isContactSaved(contactActionCard.phone) ? 'Message' : 'Message (number not saved)'}
                    </AppText>
                    <AppText style={{ fontSize: 12, color: COLORS.sub, marginTop: 2 }}>
                      Open a chat with this contact
                    </AppText>
                  </View>
                </TouchableOpacity>

                {/* Save-contact action — only if not already saved */}
                {!isContactSaved(contactActionCard.phone) && (
                  <>
                    <View style={styles.contactActionDivider} />
                    <TouchableOpacity
                      style={styles.contactActionButton}
                      activeOpacity={0.7}
                      onPress={() => handleSaveSharedContact(contactActionCard.name, contactActionCard.phone)}
                    >
                      <AppIcon name="person-add-outline" size={22} color={COLORS.blue} fixedColor />
                      <View style={{ flex: 1, marginLeft: 14 }}>
                        <AppText style={[styles.contactActionButtonTitle, { color: textColor }]}>
                          Save contact
                        </AppText>
                        <AppText style={{ fontSize: 12, color: COLORS.sub, marginTop: 2 }}>
                          Add {contactActionCard.name} to your phone contacts
                        </AppText>
                      </View>
                    </TouchableOpacity>
                  </>
                )}

                <View style={styles.contactActionDivider} />
                <TouchableOpacity
                  style={[styles.contactActionButton, { justifyContent: 'center' }]}
                  activeOpacity={0.7}
                  onPress={() => setContactActionCard(null)}
                >
                  <AppText style={{ color: COLORS.sub, fontSize: 15, fontWeight: '600' }}>Cancel</AppText>
                </TouchableOpacity>
              </>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ── Contact Picker Modal ── */}
      <Modal visible={contactPickerOpen} transparent animationType="slide" onRequestClose={() => setContactPickerOpen(false)}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <TouchableOpacity style={styles.attachOverlay} activeOpacity={1} onPress={() => setContactPickerOpen(false)} />
          <View style={[styles.contactPickerSheet, { backgroundColor: FG.glassBg }]}>
            <AppBg />
            <View style={styles.attachHandle} />
            <AppText style={[styles.attachTitle, { color: textColor, fontFamily }]}>
              {isGroup ? 'Share Contact' : `Send ${displayName}'s contact to…`}
            </AppText>

            {/* Search */}
            <View style={[styles.contactSearchWrap, bevel]}>
              <AppIcon name="search-outline" size={16} color={COLORS.sub} />
              <TextInput
                style={[styles.contactSearchInput, { color: textColor }]}
                placeholder="Search contacts…"
                placeholderTextColor={COLORS.sub}
                value={contactQuery}
                onChangeText={setContactQuery}
              />
              {contactQuery.length > 0 && (
                <TouchableOpacity onPress={() => setContactQuery('')}>
                  <AppIcon name="close-circle" size={16} color={COLORS.sub} />
                </TouchableOpacity>
              )}
            </View>

            {/* Contact list */}
            <ScrollView 
              showsVerticalScrollIndicator={false} 
              style={styles.contactPickerList} 
              contentContainerStyle={styles.contactPickerContent}
              keyboardShouldPersistTaps="handled"
            >
              {contactsLoading ? (
                <View style={{ alignItems: 'center', paddingTop: 60, gap: 12 }}>
                  <ActivityIndicator size="large" color={COLORS.blue} />
                  <AppText style={{ color: COLORS.sub, fontSize: 14 }}>Loading contacts...</AppText>
                </View>
              ) : !contactsPermission ? (
                <View style={{ alignItems: 'center', paddingTop: 60, gap: 12 }}>
                  <AppIcon name="lock-closed-outline" size={48} color={COLORS.sub} />
                  <AppText style={{ color: textColor, fontSize: 16, fontWeight: '600', textAlign: 'center' }}>
                    Contacts Permission Required
                  </AppText>
                  <AppText style={{ color: COLORS.sub, fontSize: 13, textAlign: 'center', paddingHorizontal: 40 }}>
                    Please grant contacts permission in your device settings to share contacts
                  </AppText>
                </View>
              ) : !phoneContacts || phoneContacts.filter(c => c.userId && c.userId !== userId && c.userId !== otherUserId).length === 0 ? (
                <View style={{ alignItems: 'center', paddingTop: 60, gap: 12 }}>
                  <AppIcon name="people-outline" size={48} color={COLORS.sub} />
                  <AppText style={{ color: textColor, fontSize: 16, fontWeight: '600', textAlign: 'center' }}>
                    No Contacts Found
                  </AppText>
                  <AppText style={{ color: COLORS.sub, fontSize: 13, textAlign: 'center', paddingHorizontal: 40 }}>
                    None of your contacts are using ChitChat yet
                  </AppText>
                </View>
              ) : (
                <>
                  {phoneContacts
                    .filter(c => c.userId && c.userId !== userId)       // must be a ChitChat user and not self
                    .filter(c => c.userId !== otherUserId)               // don't share the recipient back to themselves
                    .filter(c => !contactQuery.trim() || c.displayName.toLowerCase().includes(contactQuery.toLowerCase()) || c.phone.includes(contactQuery))
                    .map((c) => (
                      <TouchableOpacity
                        key={c.phone}
                        style={[styles.contactPickerRow, bevel]}
                        activeOpacity={0.75}
                        onPress={async () => {
                          setContactPickerOpen(false);
                          if (!userId || !otherUserId) return;
                          try {
                            // Fetch the CURRENT chat partner's phone (the contact we want to share)
                            const partnerSnap = await getDoc(doc(db, 'users', otherUserId));
                            const partnerPhone = partnerSnap.exists() ? (partnerSnap.data().phone as string | undefined) : undefined;
                            if (!partnerPhone) {
                              console.error('[ShareContact] Could not resolve chat partner phone number');
                              return;
                            }

                            // Find or create the chat between me (sender) and the picked recipient
                            const recipientChatId = await getOrCreateDirectChat(userId, c.userId);

                            // Write the CURRENT chat partner's contact card into the recipient chat
                            await addDoc(collection(db, 'chats', recipientChatId, 'messages'), {
                              senderId: userId,
                              type: 'contact',
                              contactName: displayName,     // current chat partner's name
                              contactPhone: partnerPhone,   // current chat partner's phone
                              contactUserId: otherUserId,   // current chat partner's Firestore userId
                              text: null,
                              timestamp: serverTimestamp(),
                              readBy: [userId],
                              deliveredTo: [],
                            });
                            await updateDoc(doc(db, 'chats', recipientChatId), {
                              'lastMessage.text': `👤 ${displayName}`,
                              'lastMessage.senderId': userId,
                              'lastMessage.timestamp': serverTimestamp(),
                            });
                          } catch (err) {
                            console.error('[ChatScreen] Failed to send contact:', err);
                          }
                        }}
                      >
                        <Avatar
                          initials={c.displayName.slice(0, 2).toUpperCase()}
                          color={COLORS.blue}
                          size={44}
                          imageUrl={c.photoUri || c.firebasePhotoURL || null}
                        />
                        <View style={{ flex: 1, marginLeft: 12 }}>
                          <AppText style={[{ fontSize: 14, fontWeight: '600' }, { color: textColor }]}>{c.displayName}</AppText>
                          <AppText style={{ fontSize: 12, color: COLORS.sub, marginTop: 2 }}>{c.phone}</AppText>
                        </View>
                        <AppIcon name="share-outline" size={18} color={COLORS.blue} fixedColor />
                      </TouchableOpacity>
                    ))}
                  {phoneContacts.filter(c => c.userId && c.userId !== userId).filter(c => c.userId !== otherUserId).filter(c => !contactQuery.trim() || c.displayName.toLowerCase().includes(contactQuery.toLowerCase()) || c.phone.includes(contactQuery)).length === 0 && contactQuery.trim() && (
                    <View style={{ alignItems: 'center', paddingTop: 40, gap: 10 }}>
                      <AppIcon name="search-outline" size={44} color={COLORS.sub} />
                      <AppText style={{ color: COLORS.sub, fontSize: 14 }}>No contacts match "{contactQuery}"</AppText>
                    </View>
                  )}
                </>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Full Media Gallery Modal ── */}
      <Modal
        visible={mediaGalleryOpen}
        transparent={false}
        animationType="slide"
        onRequestClose={() => setMediaGalleryOpen(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: '#000' }}>
          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 }}>
            <TouchableOpacity onPress={() => setMediaGalleryOpen(false)} style={{ padding: 4 }}>
              <AppIcon name="arrow-back" size={24} color="#fff" fixedColor />
            </TouchableOpacity>
            <AppText style={{ color: '#fff', fontSize: 18, fontWeight: '700', marginLeft: 16 }}>
              Media ({messages.filter(m => m.type === 'image' && m.imageUrl).length})
            </AppText>
          </View>
          {/* Grid */}
          <ScrollView contentContainerStyle={{ flexDirection: 'row', flexWrap: 'wrap', gap: 2, padding: 2 }}>
            {messages
              .filter(m => m.type === 'image' && m.imageUrl)
              .reverse()
              .map((m) => {
                const size = (Dimensions.get('window').width - 8) / 3;
                return (
                  <TouchableOpacity
                    key={m.messageId}
                    activeOpacity={0.85}
                    onPress={() => {
                      setMediaGalleryOpen(false);
                      setViewerImageUrl(m.imageUrl!);
                      setViewerVisible(true);
                    }}
                  >
                    <Image
                      source={{ uri: m.imageUrl! }}
                      style={{ width: size, height: size }}
                      resizeMode="cover"
                    />
                  </TouchableOpacity>
                );
              })}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* ── Group Invite Preview Modal (WhatsApp-style) ── */}
      <Modal
        visible={invitePreview !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setInvitePreview(null)}
      >
        <TouchableOpacity style={styles.attachOverlay} activeOpacity={1} onPress={() => setInvitePreview(null)} />
        <View style={[styles.invitePreviewSheet, { backgroundColor: FG.glassBg }]}>
          <AppBg />
          {/* Close button */}
          <TouchableOpacity
            style={{ position: 'absolute', top: 16, left: 16, zIndex: 10 }}
            onPress={() => setInvitePreview(null)}
          >
            <AppIcon name="close" size={22} color={FG.secondary} />
          </TouchableOpacity>

          {loadingInvitePreview ? (
            <View style={{ alignItems: 'center', paddingVertical: 60 }}>
              <ActivityIndicator size="large" color={COLORS.blue} />
              <AppText style={{ color: COLORS.sub, marginTop: 12, fontSize: 14 }}>Loading group info...</AppText>
            </View>
          ) : invitePreviewData ? (
            <View style={{ alignItems: 'center', paddingTop: 24, paddingHorizontal: 24 }}>
              {/* Group Avatar */}
              <Avatar
                initials={getInitials(invitePreviewData.groupName)}
                color={COLORS.blue}
                size={80}
                imageUrl={invitePreviewData.groupPhotoURL}
              />
              {/* Group Name */}
              <AppText style={{ color: textColor, fontSize: 20, fontWeight: '700', marginTop: 16, textAlign: 'center' }}>
                {invitePreviewData.groupName}
              </AppText>
              {/* Created by + date */}
              <AppText style={{ color: COLORS.sub, fontSize: 13, marginTop: 8, textAlign: 'center' }}>
                Created by {invitePreviewData.createdBy}, {invitePreviewData.createdAt}
              </AppText>
              {/* Member count */}
              <AppText style={{ color: COLORS.sub, fontSize: 13, marginTop: 4 }}>
                {invitePreviewData.memberCount} {invitePreviewData.memberCount === 1 ? 'member' : 'members'}
              </AppText>

              {/* Join / Open button */}
              <TouchableOpacity
                style={[styles.invitePreviewJoinBtn, invitePreviewData.isAlreadyMember && { backgroundColor: COLORS.sub }]}
                activeOpacity={0.8}
                onPress={handleJoinFromPreview}
              >
                <AppText style={styles.invitePreviewJoinText}>
                  {invitePreviewData.isAlreadyMember ? 'Open group' : 'Join group'}
                </AppText>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      </Modal>

      {/* ── Location Sharing Menu ── */}
      <Modal
        visible={showLocationMenu}
        transparent
        animationType="slide"
        onRequestClose={() => setShowLocationMenu(false)}
      >
        <TouchableOpacity 
          style={styles.attachOverlay}
          activeOpacity={1}
          onPress={() => setShowLocationMenu(false)}
        />
        <View style={[styles.attachSheet, { backgroundColor: FG.glassBg }]}>
          <View style={styles.attachHandle} />
          <AppText style={[styles.attachTitle, { color: textColor, fontFamily }]}>
            Share Location
          </AppText>

          {/* Current Location */}
          <TouchableOpacity 
            style={[styles.locationOption, bevel]}
            onPress={handleSendCurrentLocation}
            activeOpacity={0.8}
          >
            <View style={styles.locationIconWrap}>
              <AppIcon name="location" size={28} color={COLORS.blue} fixedColor />
            </View>
            <View style={styles.locationOptionText}>
              <AppText style={[styles.locationOptionTitle, { color: textColor, fontFamily }]}>
                Current Location
              </AppText>
              <AppText style={[styles.locationOptionDesc, { color: COLORS.sub }]}>
                Send your current location
              </AppText>
            </View>
          </TouchableOpacity>

          {/* Live Location */}
          <View style={[styles.locationOption, bevel]}>
            <View style={styles.locationIconWrap}>
              <AppIcon name="navigate" size={28} color={COLORS.blue} fixedColor />
            </View>
            <View style={styles.locationOptionText}>
              <AppText style={[styles.locationOptionTitle, { color: textColor, fontFamily }]}>
                Live Location
              </AppText>
              <AppText style={[styles.locationOptionDesc, { color: COLORS.sub }]}>
                Share for:
              </AppText>
              
              {/* Duration Selector */}
              <View style={styles.durationButtons}>
                {[5, 15, 30, 60].map((duration) => {
                  const isSelected = selectedDuration === duration;
                  return (
                    <TouchableOpacity
                      key={duration}
                      style={[
                        styles.durationButton,
                        isSelected ? { backgroundColor: COLORS.blue } : bevel,
                      ]}
                      onPress={() => setSelectedDuration(duration)}
                    >
                      <AppText 
                        style={[
                          styles.durationText,
                          { color: isSelected ? '#fff' : textColor }
                        ]}
                        fixedColor={isSelected}
                      >
                        {duration}m
                      </AppText>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TouchableOpacity 
                style={[styles.startLiveButton, { marginTop: 12 }]}
                onPress={handleStartLiveLocation}
                activeOpacity={0.85}
              >
                <LinearGradient colors={GRADIENTS.primary} style={styles.startLiveButtonInner}>
                  <AppText fixedColor style={styles.startLiveButtonText}>
                    Start Sharing
                  </AppText>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── In-app camera ── */}
      {cameraOpen && Platform.OS !== 'web' && (
        <Modal visible animationType="slide" onRequestClose={() => setCameraOpen(false)}>
          <View style={{ flex: 1, backgroundColor: '#000' }}>
            <CameraView ref={cameraRef} style={{ flex: 1 }} facing="back">
              <View style={styles.cameraControls}>
                <TouchableOpacity onPress={() => setCameraOpen(false)} style={styles.cameraCloseBtn}>
                  <AppIcon name="close" size={28} color="#fff" fixedColor />
                </TouchableOpacity>
                <TouchableOpacity style={styles.cameraShutterBtn} onPress={takePicture}>
                  <View style={styles.cameraShutter} />
                </TouchableOpacity>
                <View style={{ width: 52 }} />
              </View>
            </CameraView>
          </View>
        </Modal>
      )}

      {/* ── Full-screen image viewer ── */}
      {viewerVisible && viewerImageUrl && (
        <Modal 
          visible 
          transparent 
          animationType="fade" 
          onRequestClose={() => { setViewerVisible(false); setViewerMenuOpen(false); }}
        >
          <View style={styles.imageViewerContainer}>
            <TouchableOpacity 
              style={styles.imageViewerBackdrop}
              activeOpacity={1}
              onPress={() => { setViewerMenuOpen(false); }}
            >
              <Image
                source={{ uri: viewerImageUrl }}
                style={styles.imageViewerImage}
                resizeMode="contain"
              />
            </TouchableOpacity>

            {/* Top bar */}
            <View style={styles.imageViewerTopBar}>
              <TouchableOpacity onPress={() => { setViewerVisible(false); setViewerMenuOpen(false); }} style={{ padding: 8 }}>
                <AppIcon name="arrow-back" size={24} color="#fff" fixedColor />
              </TouchableOpacity>
              <View style={{ flex: 1 }} />
              {/* Forward button */}
              <TouchableOpacity
                style={{ padding: 8 }}
                onPress={() => {
                  setViewerVisible(false);
                  setViewerMenuOpen(false);
                  // Find the message with this image and forward it
                  const imgMsg = messages.find(m => m.imageUrl === viewerImageUrl);
                  if (imgMsg) {
                    setMessageToForward(imgMsg);
                    setForwardModalVisible(true);
                  }
                }}
              >
                <AppIcon name="arrow-redo-outline" size={22} color="#fff" fixedColor />
              </TouchableOpacity>
              {/* 3-dot menu */}
              <TouchableOpacity style={{ padding: 8 }} onPress={() => setViewerMenuOpen(!viewerMenuOpen)}>
                <AppIcon name="ellipsis-vertical" size={22} color="#fff" fixedColor />
              </TouchableOpacity>
            </View>

            {/* Dropdown menu */}
            {viewerMenuOpen && (
              <View style={styles.imageViewerMenu}>
                <TouchableOpacity
                  style={styles.imageViewerMenuItem}
                  onPress={async () => {
                    setViewerMenuOpen(false);
                    try {
                      await import('react-native').then(({ Share, Platform }) => {
                        if (Platform.OS === 'ios') {
                          Share.share({ url: viewerImageUrl! });
                        } else {
                          Share.share({ message: viewerImageUrl! });
                        }
                      });
                    } catch (err) {
                      console.error('[ImageViewer] Share failed:', err);
                    }
                  }}
                >
                  <AppIcon name="share-social-outline" size={20} color="#fff" fixedColor />
                  <AppText style={styles.imageViewerMenuText}>Share</AppText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.imageViewerMenuItem}
                  onPress={() => {
                    setViewerMenuOpen(false);
                    setViewerVisible(false);
                    setProfileModalOpen(false); // Close profile modal too
                    // Scroll to the message in chat
                    setTimeout(() => {
                      const imgMsg = messages.find(m => m.imageUrl === viewerImageUrl);
                      if (imgMsg) {
                        const index = filteredMessages.findIndex(m => m.messageId === imgMsg.messageId);
                        if (index !== -1 && listRef.current) {
                          listRef.current.scrollToIndex({ index, animated: true, viewPosition: 0.5 });
                          setHighlightedMessageId(imgMsg.messageId);
                        }
                      }
                    }, 300);
                  }}
                >
                  <AppIcon name="chatbubble-outline" size={20} color="#fff" fixedColor />
                  <AppText style={styles.imageViewerMenuText}>Show in chat</AppText>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </Modal>
      )}

      {/* ── Profile Modal ── */}
      <Modal
        visible={profileModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setProfileModalOpen(false)}
      >
        <View style={styles.profileOverlay}>
          <TouchableOpacity 
            style={styles.profileBackdrop} 
            activeOpacity={1} 
            onPress={() => setProfileModalOpen(false)} 
          />
          <View style={[styles.profileSheet, { backgroundColor: FG.glassBg, borderColor: FG.glassBorder }]}>
            <AppBg />
            {/* Handle */}
            <View style={styles.profileHandle} />

            {/* Close button */}
            <TouchableOpacity 
              style={styles.profileCloseBtn} 
              onPress={() => setProfileModalOpen(false)}
            >
              <AppIcon name="close" size={20} color={FG.secondary} />
            </TouchableOpacity>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.profileScroll}>
              {/* Avatar + name */}
              <View style={styles.profileAvatarWrap}>
                {isGroup ? (
                  <TouchableOpacity activeOpacity={0.8} onPress={handleChangeGroupPhoto}>
                    <Avatar 
                      initials={getInitials(displayName)} 
                      color={COLORS.blue} 
                      size={80}
                      imageUrl={groupPhotoURL || headerPhoto}
                    />
                    <View style={{ position: 'absolute', bottom: 0, right: 0, width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.blue, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' }}>
                      <AppIcon name="camera" size={14} color="#fff" fixedColor />
                    </View>
                  </TouchableOpacity>
                ) : (
                  <Avatar 
                    initials={getInitials(displayName)} 
                    color={COLORS.blue} 
                    size={80}
                    imageUrl={headerPhoto}
                  />
                )}
                </View>
                <AppText style={[styles.profileName, { color: textColor, fontFamily }]}>
                  {displayName}
                </AppText>
                <AppText style={[styles.profileStatus, { color: isOnline ? COLORS.blue : FG.secondary }]}>
                  {isGroup ? `Group · ${groupMembers.length} members` : (presenceText || 'Tap here for info')}
                </AppText>

                {/* Group Bio / Description */}
                {isGroup && (
                  <View style={{ width: '100%', marginTop: 12, marginBottom: 4 }}>
                    {editingBio ? (
                      <View style={[{ borderRadius: RADIUS.lg, padding: 12 }, bevel]}>
                        <TextInput
                          style={{ fontSize: 14, color: textColor, minHeight: 60, textAlignVertical: 'top' }}
                          placeholder="Add group description..."
                          placeholderTextColor={COLORS.sub}
                          value={bioInput}
                          onChangeText={setBioInput}
                          multiline
                          autoFocus
                        />
                        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 8 }}>
                          <TouchableOpacity onPress={() => { setEditingBio(false); setBioInput(groupBio); }}>
                            <AppText style={{ color: COLORS.sub, fontSize: 13, fontWeight: '600' }}>Cancel</AppText>
                          </TouchableOpacity>
                          <TouchableOpacity onPress={handleSaveGroupBio}>
                            <AppText style={{ color: COLORS.blue, fontSize: 13, fontWeight: '700' }}>Save</AppText>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ) : (
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => { setBioInput(groupBio); setEditingBio(true); }}
                        style={[{ borderRadius: RADIUS.lg, padding: 12 }, bevel]}
                      >
                        <AppText style={{ fontSize: 14, color: groupBio ? textColor : COLORS.sub }}>
                          {groupBio || 'Add group description...'}
                        </AppText>
                      </TouchableOpacity>
                    )}
                  </View>
                )}

                {/* Action buttons */}
                <View style={styles.profileActions}>
                  {[
                    { icon: 'call-outline' as const, label: 'Audio Call', onPress: () => { setProfileModalOpen(false); handleVoiceCall(); } },
                    { icon: 'videocam-outline' as const, label: 'Video Call', onPress: () => { setProfileModalOpen(false); handleVideoCall(); } },
                  ].map((a) => (
                    <TouchableOpacity 
                      key={a.label} 
                      style={[styles.profileActionBtn, bevel]} 
                      onPress={a.onPress} 
                      activeOpacity={0.8}
                      disabled={isGroup}
                    >
                      <LinearGradient colors={GRADIENTS.primary} style={styles.profileActionIcon}>
                        <AppIcon name={a.icon} size={20} color="#fff" fixedColor />
                      </LinearGradient>
                      <AppText style={[styles.profileActionLabel, { color: textColor }]}>
                        {a.label}
                      </AppText>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Group Participants - Only show for group chats */}
                {isGroup && (
                  <>
                    <AppText style={[styles.profileSectionLabel, { color: FG.secondary }]}>
                      PARTICIPANTS ({groupMembers.length})
                    </AppText>
                    <View style={{ flexDirection: 'row', gap: 16, marginBottom: 12 }}>
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => setAddMemberPickerOpen(true)}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
                      >
                        <AppIcon name="person-add-outline" size={18} color={COLORS.blue} fixedColor />
                        <AppText style={{ color: COLORS.blue, fontSize: 13, fontWeight: '600' }}>Add</AppText>
                      </TouchableOpacity>
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={handleShareInviteLink}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
                      >
                        <AppIcon name="link-outline" size={18} color={COLORS.blue} fixedColor />
                        <AppText style={{ color: COLORS.blue, fontSize: 13, fontWeight: '600' }}>Invite</AppText>
                      </TouchableOpacity>
                    </View>
                    {loadingMembers ? (
                      <View style={[styles.profileMemberLoadingBox, bevel]}>
                        <ActivityIndicator size="small" color={COLORS.blue} />
                        <AppText style={[styles.profileMemberLoadingText, { color: FG.secondary }]}>
                          Loading participants...
                        </AppText>
                      </View>
                    ) : groupMembers.length > 0 ? (
                      groupMembers.map((member) => {
                        const statusColor = 
                          member.status === 'online' ? '#4CAF50' : 
                          member.status === 'away' ? '#FFC107' : COLORS.sub;
                        const statusLabel = 
                          member.status === 'online' ? 'Online' : 
                          member.status === 'away' ? 'Away' : 'Offline';
                        
                        return (
                          <View 
                            key={member.userId} 
                            style={[styles.profileMemberRow, bevel]}
                          >
                            <Avatar 
                              initials={getInitials(member.displayName)} 
                              color={COLORS.blue} 
                              size={42}
                              imageUrl={member.photoURL}
                            />
                            <View style={{ flex: 1 }}>
                              <AppText style={[styles.profileMemberName, { color: textColor, fontFamily }]}>
                                {member.displayName}
                                {member.userId === userId && <AppText style={[styles.profileMemberYou, { color: FG.secondary }]}> (You)</AppText>}
                                {member.userId === groupCreatedBy && <AppText style={{ color: COLORS.blue, fontSize: 12, fontWeight: '700' }}> • Admin</AppText>}
                              </AppText>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: statusColor }} />
                                <AppText style={[styles.profileMemberStatus, { color: FG.secondary }]}>
                                  {statusLabel}
                                </AppText>
                              </View>
                            </View>
                            {/* Remove button — only visible to group creator, not on self */}
                            {groupCreatedBy === userId && member.userId !== userId && (
                              <TouchableOpacity
                                activeOpacity={0.7}
                                onPress={() => handleRemoveMember(member)}
                                style={{ padding: 6 }}
                              >
                                <AppIcon name="remove-circle-outline" size={22} color="#e53935" fixedColor />
                              </TouchableOpacity>
                            )}
                          </View>
                        );
                      })
                    ) : (
                      <View style={[styles.profileMemberEmptyBox, bevel]}>
                        <AppIcon name="people-outline" size={28} color={FG.secondary} />
                        <AppText style={[styles.profileMemberEmptyText, { color: FG.secondary }]}>
                          No participants found
                        </AppText>
                      </View>
                    )}
                  </>
                )}

                {/* Past Members - Only show for group chats if there are any */}
                {isGroup && (
                  <>
                    <AppText style={[styles.profileSectionLabel, { color: FG.secondary }]}>
                      PAST MEMBERS {pastMembers.length > 0 ? `(${pastMembers.length})` : ''}
                    </AppText>
                    {loadingPastMembers ? (
                      <View style={[styles.profileMemberLoadingBox, bevel]}>
                        <ActivityIndicator size="small" color={COLORS.blue} />
                        <AppText style={[styles.profileMemberLoadingText, { color: FG.secondary }]}>
                          Loading past members...
                        </AppText>
                      </View>
                    ) : pastMembers.length > 0 ? (
                      pastMembers.map((member) => {
                        const leftDateText = formatLeftDate(member.leftAt);
                        const reasonText = member.reason && member.reason !== 'Left'
                          ? member.reason
                          : `Left • ${leftDateText}`;
                        
                        return (
                          <View 
                            key={member.userId} 
                            style={[styles.profilePastMemberRow, bevel]}
                          >
                            <Avatar 
                              initials={getInitials(member.displayName)} 
                              color={COLORS.blue} 
                              size={42}
                              imageUrl={member.photoURL}
                              status="offline"
                            />
                            <View style={{ flex: 1 }}>
                              <AppText style={[styles.profileMemberName, styles.profilePastMemberName, { color: textColor, fontFamily }]}>
                                {member.displayName}
                              </AppText>
                              <AppText style={[styles.profileMemberStatus, { color: FG.secondary }]}>
                                {reasonText}
                              </AppText>
                            </View>
                            <AppIcon name="exit-outline" size={18} color={FG.secondary} />
                          </View>
                        );
                      })
                    ) : (
                      <View style={[styles.profileMemberEmptyBox, bevel]}>
                        <AppIcon name="people-outline" size={28} color={FG.secondary} />
                        <AppText style={[styles.profileMemberEmptyText, { color: FG.secondary }]}>
                          No past members
                        </AppText>
                      </View>
                    )}
                  </>
                )}

                {/* Shared media */}
                <AppText style={[styles.profileSectionLabel, { color: FG.secondary }]}>
                  SHARED MEDIA
                </AppText>
                {(() => {
                  const mediaMessages = messages.filter(m => m.type === 'image' && m.imageUrl);
                  if (mediaMessages.length === 0) {
                    return (
                      <View style={[styles.infoMediaBox, bevel]}>
                        <AppIcon name="images-outline" size={28} color={FG.secondary} />
                        <AppText style={[styles.infoMediaEmpty, { color: FG.secondary }]}>
                          No media shared yet
                        </AppText>
                      </View>
                    );
                  }
                  const allMedia = [...mediaMessages].reverse(); // newest first
                  const imageWidth = (Dimensions.get('window').width - 80) / 3; // 3 columns with gaps
                  return (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                      {allMedia.map((m) => (
                        <TouchableOpacity
                          key={m.messageId}
                          activeOpacity={0.85}
                          onPress={() => {
                            setViewerImageUrl(m.imageUrl!);
                            setViewerVisible(true);
                          }}
                        >
                          <Image
                            source={{ uri: m.imageUrl! }}
                            style={{ width: imageWidth, height: imageWidth, borderRadius: 6 }}
                            resizeMode="cover"
                          />
                        </TouchableOpacity>
                      ))}
                    </View>
                  );
                })()}

                {/* Privacy section for group chats - Leave Group */}
                {isGroup && (
                  <>
                    <AppText style={[styles.profileSectionLabel, { color: FG.secondary }]}>
                      PRIVACY
                    </AppText>

                    {/* Leave Group Button */}
                    {!showLeaveGroupConfirmation ? (
                      <TouchableOpacity 
                        style={[styles.profileBlockBtn, bevel]}
                        onPress={() => setShowLeaveGroupConfirmation(true)}
                        activeOpacity={0.8}
                        disabled={leavingGroup}
                      >
                        <AppIcon name="exit-outline" size={20} color={COLORS.missed} fixedColor />
                        <AppText style={[styles.profileBlockText, { color: COLORS.missed }]}>
                          Leave Group
                        </AppText>
                      </TouchableOpacity>
                    ) : (
                      /* Inline Confirmation Card */
                      <View style={[styles.confirmationCard, bevel]}>
                        {/* Gradient Icon */}
                        <LinearGradient 
                          colors={['rgba(255,59,48,0.20)', 'rgba(255,149,0,0.20)']}
                          style={styles.confirmationIconWrap}
                        >
                          <AppIcon name="exit-outline" size={28} color={COLORS.missed} fixedColor />
                        </LinearGradient>

                        {/* Title */}
                        <AppText style={[styles.confirmationTitle, { color: textColor, fontFamily }]}>
                          Leave Group?
                        </AppText>

                        {/* Body text */}
                        <AppText style={[styles.confirmationBody, { color: FG.secondary }]}>
                          You will no longer receive messages from this group. A notification will be sent to all members that you left.
                        </AppText>

                        {/* Action buttons */}
                        <View style={styles.confirmationButtons}>
                          <TouchableOpacity 
                            style={[styles.confirmationCancelBtn, { borderColor: FG.glassBorder }]}
                            onPress={() => setShowLeaveGroupConfirmation(false)}
                            activeOpacity={0.8}
                            disabled={leavingGroup}
                          >
                            <AppText style={[styles.confirmationCancelText, { color: textColor }]}>
                              Cancel
                            </AppText>
                          </TouchableOpacity>

                          <TouchableOpacity 
                            style={[styles.confirmationBlockBtn, { backgroundColor: COLORS.missed }]}
                            onPress={handleLeaveGroup}
                            activeOpacity={0.8}
                            disabled={leavingGroup}
                          >
                            {leavingGroup ? (
                              <ActivityIndicator size="small" color="#fff" />
                            ) : (
                              <AppText style={[styles.confirmationBlockText, { color: '#fff' }]}>
                                Leave Group
                              </AppText>
                            )}
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}
                  </>
                )}

                {/* Privacy section - Only show for individual chats */}
                {!isGroup && (
                  <>
                    <AppText style={[styles.profileSectionLabel, { color: FG.secondary }]}>
                      PRIVACY
                    </AppText>

                    {/* Block/Unblock Contact Button */}
                    {isBlocked && blockedByMe ? (
                      /* Unblock User Button */
                      <TouchableOpacity 
                        style={[styles.profileBlockBtn, bevel]}
                        onPress={handleUnblockContact}
                        activeOpacity={0.8}
                      >
                        <AppIcon name="checkmark-circle-outline" size={20} color={COLORS.blue} fixedColor />
                        <AppText style={[styles.profileBlockText, { color: COLORS.blue }]}>
                          Unblock User
                        </AppText>
                      </TouchableOpacity>
                    ) : !showBlockConfirmation ? (
                      /* Block Contact Button */
                      <TouchableOpacity 
                        style={[styles.profileBlockBtn, bevel]}
                        onPress={() => setShowBlockConfirmation(true)}
                        activeOpacity={0.8}
                      >
                        <AppIcon name="ban-outline" size={20} color={COLORS.missed} fixedColor />
                        <AppText style={[styles.profileBlockText, { color: COLORS.missed }]}>
                          Block {displayName}
                        </AppText>
                      </TouchableOpacity>
                    ) : (
                      /* Inline Confirmation Card */
                      <View style={[styles.confirmationCard, bevel]}>
                        {/* Gradient Icon */}
                        <LinearGradient 
                          colors={['rgba(255,59,48,0.20)', 'rgba(255,149,0,0.20)']}
                          style={styles.confirmationIconWrap}
                        >
                          <AppIcon name="ban-outline" size={28} color={COLORS.missed} fixedColor />
                        </LinearGradient>

                        {/* Title */}
                        <AppText style={[styles.confirmationTitle, { color: textColor, fontFamily }]}>
                          Block {displayName}?
                        </AppText>

                        {/* Body text */}
                        <AppText style={[styles.confirmationBody, { color: FG.secondary }]}>
                          Blocked contacts cannot call you or send you messages. They won't be notified that you blocked them.
                        </AppText>

                        {/* Action buttons */}
                        <View style={styles.confirmationButtons}>
                          <TouchableOpacity 
                            style={[styles.confirmationCancelBtn, { borderColor: FG.glassBorder }]}
                            onPress={() => setShowBlockConfirmation(false)}
                            activeOpacity={0.8}
                          >
                            <AppText style={[styles.confirmationCancelText, { color: textColor }]}>
                              Cancel
                            </AppText>
                          </TouchableOpacity>

                          <TouchableOpacity 
                            style={[styles.confirmationBlockBtn, { backgroundColor: COLORS.missed }]}
                            onPress={handleBlockContact}
                            activeOpacity={0.8}
                          >
                            <AppText style={[styles.confirmationBlockText, { color: '#fff' }]}>
                              Block
                            </AppText>
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}
                  </>
                )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Forward Modal ── */}
      {userId && (
        <ForwardModal
          visible={forwardModalVisible}
          onClose={() => {
            setForwardModalVisible(false);
            setMessageToForward(null);
          }}
          onForward={handleForwardToChats}
          currentUserId={userId}
        />
      )}

      {/* ── Message Info Modal ── */}
      {userId && messageForInfo && (
        <MessageInfoModal
          visible={messageInfoVisible}
          onClose={() => {
            setMessageInfoVisible(false);
            setMessageForInfo(null);
          }}
          messageTimestamp={messageForInfo.timestamp}
          readBy={messageForInfo.readBy}
          currentUserId={userId}
          isGroup={isGroup}
        />
      )}
    </>
  );
}


const styles = StyleSheet.create({
  root: { flex: 1 },

  topBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingTop: 52, paddingBottom: 12, paddingHorizontal: 14,
    gap: 8, ...GLASS.header,
  },
  backBtn: { padding: 2 },
  topBarContact: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  contactInfo: { flex: 1 },
  contactName: { fontSize: 15, fontWeight: '700' },
  onlineText: { fontSize: 12, marginTop: 2 },
  iconBtn: { padding: 4 },

  // ── Center states (loading / empty) ───────────────────────────────────────
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyEmoji: { fontSize: 48, marginBottom: 8 },
  emptyText: { fontSize: 16, color: COLORS.sub, fontWeight: '500' },

  // ── Messages ──────────────────────────────────────────────────────────────
  messageList: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 8, gap: 8 },
  loadEarlierBtn: { alignSelf: 'center', paddingVertical: 8, paddingHorizontal: 18, marginBottom: 8, borderRadius: RADIUS.full, ...GLASS.card },
  loadEarlierText: { fontSize: 13, fontWeight: '600', color: COLORS.blue },
  datePillWrap: { alignItems: 'center', marginBottom: 10 },
  datePill: { ...GLASS.card, borderRadius: RADIUS.full, paddingHorizontal: 16, paddingVertical: 5 },
  datePillText: { fontSize: 11, color: COLORS.sub },

  msgRow: { flexDirection: 'row', marginBottom: 4 },
  msgRowIn: { justifyContent: 'flex-start' },
  msgRowOut: { justifyContent: 'flex-end' },

  // ── System messages ───────────────────────────────────────────────────────
  systemMessageContainer: {
    alignItems: 'center',
    marginVertical: 8,
    paddingHorizontal: 20,
  },
  systemMessageBubble: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    maxWidth: '80%',
  },
  systemMessageText: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },

  bubble: { 
    maxWidth: '75%', 
    borderRadius: 18, 
    paddingHorizontal: 14, 
    paddingVertical: 10,
    paddingBottom: 6,
    position: 'relative',
  },
  bubbleIn: { borderBottomLeftRadius: 4, ...SHADOW.card },
  groupSenderName: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  groupSenderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
    gap: 12,
  },
  groupSenderPhone: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.6)',
  },
  forwardedLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  forwardedText: {
    fontSize: 11,
    fontStyle: 'italic',
    color: 'rgba(255,255,255,0.6)',
  },
  bubbleTextIn: { 
    fontSize: 14, 
    color: '#fff', 
    lineHeight: 20,
    paddingRight: 60, // Space for time and tick
    marginBottom: 2,
  },
  timeIn: { 
    position: 'absolute',
    bottom: 4,
    right: 10,
    fontSize: 10, 
    color: 'rgba(255,255,255,0.75)',
  },

  bubbleOut: { 
    backgroundColor: 'rgba(180,225,245,0.22)', 
    borderWidth: 1, 
    borderColor: 'rgba(30,156,240,0.18)', 
    borderBottomRightRadius: 4,
    position: 'relative',
    ...SHADOW.card 
  },
  bubbleTextOut: { 
    fontSize: 14, 
    color: COLORS.text, 
    lineHeight: 20,
    paddingRight: 70, // Space for time and double tick
    marginBottom: 2,
  },
  timeOutRow: { 
    position: 'absolute',
    bottom: 4,
    right: 10,
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 3,
  },
  timeOut: { fontSize: 10, color: COLORS.sub },

    // ── Call messages ──────────────────────────────────────────────────────────
  callBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: '75%',
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
  },
  callBubbleIn: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderBottomLeftRadius: 4,
    ...SHADOW.card,
  },
  callBubbleOut: {
    backgroundColor: 'rgba(180,225,245,0.22)',
    borderWidth: 1,
    borderColor: 'rgba(30,156,240,0.18)',
    borderBottomRightRadius: 4,
    ...SHADOW.card,
  },
  callIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  callContent: {
    flex: 1,
    gap: 2,
  },
  callTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: '#fff',
  },
  callDuration: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
  },
  callTime: {
    fontSize: 10,
    color: COLORS.sub,
    marginLeft: 4,
  },
  callTimeWithTick: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },


  // Voice / image
  imagePlaceholder: {
    width: 160, height: 100, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  imageBubble: {
    padding: 4,
    paddingBottom: 4,
  },
  messageImage: {
    width: 200,
    height: 200,
    borderRadius: 12,
  },
  imageTimeOverlay: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },

  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end',
    paddingHorizontal: 8, paddingVertical: 8,
    paddingBottom: Platform.OS === 'ios' ? 28 : 10,
    gap: 4, ...GLASS.header,
  },
  inputSideBtn: { width: 38, height: 42, alignItems: 'center', justifyContent: 'center' },
  inputFieldWrap: { 
    flex: 1, 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: 'rgba(30,156,240,0.06)', 
    borderRadius: RADIUS.xl, 
    borderWidth: 1,
    borderColor: 'rgba(30,156,240,0.18)',
    paddingHorizontal: 14, 
    height: 42 
  },
  inputField: { flex: 1, fontSize: 14, color: COLORS.text, padding: 0, margin: 0, height: 42 },
  emojiBtn: { paddingLeft: 8, alignSelf: 'center' },
  sendBtn: { width: 42, height: 42, borderRadius: 21, ...SHADOW.button },
  sendBtnInner: { flex: 1, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },

  // Emoji panel
  emojiPanel: {
    maxHeight: 160, 
    borderTopWidth: 1,
    paddingVertical: 8,
    backgroundColor: 'rgba(180,225,245,0.18)',
    borderTopColor: 'rgba(30,156,240,0.18)',
  },
  emojiGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, gap: 2 },
  emojiItem: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  emojiChar: { fontSize: 26 },

  // Attachment sheet
  attachOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.30)' },
  attachSheet: {
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingBottom: Platform.OS === 'ios' ? 50 : 40,
    paddingHorizontal: 20, paddingTop: 12,
    ...SHADOW.glow,
  },
  attachHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(30,156,240,0.40)', alignSelf: 'center', marginBottom: 14 },
  attachTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginBottom: 16 },
  attachGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  attachItem: {
    width: 90, paddingVertical: 14, alignItems: 'center', gap: 8,
    borderRadius: RADIUS.lg,
  },
  attachIconWrap: { width: 48, height: 48, borderRadius: 14, backgroundColor: 'rgba(30,156,240,0.10)', alignItems: 'center', justifyContent: 'center' },
  attachLabel: { fontSize: 11, fontWeight: '600', color: COLORS.sub, textAlign: 'center' },

  // Camera UI
  cameraControls: {
    position: 'absolute', bottom: 40, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center',
  },
  cameraCloseBtn: { width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  cameraShutterBtn: { alignItems: 'center', justifyContent: 'center' },
  cameraShutter: { width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(255,255,255,0.95)', borderWidth: 4, borderColor: 'rgba(255,255,255,0.60)' },

  // ── Recording overlay ─────────────────────────────────────────────────────
  recordingOverlayContainer: {
    flex: 1,
  },

  // ── Permission banner ─────────────────────────────────────────────────────
  permissionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30,156,240,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(30,156,240,0.18)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
  },
  permissionText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.text,
  },
  permissionActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  permissionBtn: {
    backgroundColor: COLORS.blue,
    borderRadius: RADIUS.md,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  permissionBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  permissionDismissBtn: {
    padding: 4,
  },

  // ── Upload error banner ───────────────────────────────────────────────────
  uploadErrorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30,156,240,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.25)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
  },
  uploadErrorText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.text,
  },
  retryBtn: {
    backgroundColor: COLORS.blue,
    borderRadius: RADIUS.md,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  retryBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },

  // ── Upload progress ───────────────────────────────────────────────────────
  uploadProgressBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  uploadProgressFill: {
    height: 3,
    backgroundColor: COLORS.blue,
  },

  // ── Image viewer ──────────────────────────────────────────────────────────
  imageViewerContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageViewerBackdrop: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageViewerImage: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height,
  },
  imageViewerCloseBtn: {
    position: 'absolute',
    top: 50,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageViewerTopBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 50,
    paddingHorizontal: 8,
    paddingBottom: 12,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  imageViewerMenu: {
    position: 'absolute',
    top: 100,
    right: 16,
    backgroundColor: 'rgba(30,30,30,0.95)',
    borderRadius: 12,
    paddingVertical: 8,
    minWidth: 180,
    ...SHADOW.card,
  },
  imageViewerMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  imageViewerMenuText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
  },

  // ── Profile Modal ──────────────────────────────────────────────────────────
  profileOverlay: { flex: 1, justifyContent: 'flex-end' },
  profileBackdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.40)' },
  profileSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    maxHeight: '88%',
    ...SHADOW.glow,
  },
  profileHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(30,156,240,0.30)',
    marginTop: 10,
    marginBottom: 4,
  },
  profileCloseBtn: {
    position: 'absolute',
    top: 14,
    right: 16,
    zIndex: 10,
    padding: 6,
  },
  profileScroll: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 40,
    alignItems: 'center',
    gap: 8,
  },
  profileAvatarWrap: { marginTop: 8, marginBottom: 4 },
  profileName: { fontSize: 20, fontWeight: '800', textAlign: 'center' },
  profileStatus: { fontSize: 13, textAlign: 'center', marginBottom: 8 },
  profileActions: {
    flexDirection: 'row',
    gap: 12,
    marginVertical: 8,
    width: '100%',
    justifyContent: 'center',
  },
  profileActionBtn: {
    flex: 1,
    maxWidth: 150,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: RADIUS.lg,
  },
  profileActionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOW.button,
  },
  profileActionLabel: { fontSize: 12, fontWeight: '600' },
  profileSectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginTop: 16,
    marginBottom: 8,
    alignSelf: 'flex-start',
  },
  infoMediaBox: {
    width: '100%',
    height: 90,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  infoMediaEmpty: {
    fontSize: 13,
  },
  profileMediaRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: RADIUS.lg,
  },
  profileMediaLabel: { fontSize: 14, fontWeight: '600' },
  profileMediaCount: { fontSize: 13 },

  // ── Group Members in Profile Modal ────────────────────────────────────────
  profileMemberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    width: '100%',
    borderRadius: RADIUS.lg,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 8,
  },
  profileMemberName: {
    fontSize: 14,
    fontWeight: '600',
  },
  profileMemberYou: {
    fontSize: 12,
    fontWeight: '400',
  },
  profileMemberStatus: {
    fontSize: 12,
    marginTop: 2,
  },
  profileMemberLoadingBox: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 20,
    borderRadius: RADIUS.lg,
  },
  profileMemberLoadingText: {
    fontSize: 13,
  },
  profileMemberEmptyBox: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 24,
    borderRadius: RADIUS.lg,
  },
  profileMemberEmptyText: {
    fontSize: 13,
  },

  // ── Past Members in Profile Modal ─────────────────────────────────────────
  profilePastMemberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    width: '100%',
    borderRadius: RADIUS.lg,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 8,
    opacity: 0.65, // Reduced opacity to distinguish from active members
  },
  profilePastMemberName: {
    opacity: 0.85, // Slightly reduced opacity for the name
  },

  // ── 3-dot menu dropdown ───────────────────────────────────────────────────
  menuBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'transparent',
  },
  menuCard: {
    position: 'absolute',
    top: 102, // Below the header (52 padding + 40 avatar + 10 spacing)
    right: 14,
    minWidth: 200,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  menuItemText: {
    fontSize: 14,
    fontWeight: '600',
  },
  menuItemDanger: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(239,68,68,0.15)',
  },
  menuItemTextDanger: {
    color: COLORS.missed,
  },

  // ── Search Modal ──────────────────────────────────────────────────────────
  searchOverlay: {
    flex: 1,
    justifyContent: 'flex-start',
    paddingTop: 60,
    paddingHorizontal: 16,
  },
  searchBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  searchModal: {
    borderRadius: RADIUS.xl,
    overflow: 'hidden',
    maxHeight: '80%',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    margin: 16,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    padding: 0,
    margin: 0,
  },
  searchResultsContainer: {
    flex: 1,
    maxHeight: 400,
  },
  searchResultsList: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 8,
  },
  searchEmpty: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchEmptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: RADIUS.lg,
    gap: 12,
  },
  searchResultContent: {
    flex: 1,
    gap: 4,
  },
  searchResultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  searchResultSender: {
    fontSize: 14,
    fontWeight: '600',
  },
  searchResultTime: {
    fontSize: 11,
  },
  searchResultText: {
    fontSize: 13,
    lineHeight: 18,
  },
  searchResultHighlight: {
    fontWeight: '700',
  },
  searchHighlightOverlay: {
    backgroundColor: 'rgba(30,156,240,0.18)',
    borderRadius: RADIUS.md,
    zIndex: 10,
  },
  searchHighlightOverlayActive: {
    backgroundColor: 'rgba(251,191,36,0.40)', // amber for the current active match
  },
  // ── Inline search bar ─────────────────────────────────────────────────────
  searchBar: {
    gap: 6,
    paddingRight: 6,
  },
  searchBarInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(30,156,240,0.08)',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: 'rgba(30,156,240,0.20)',
    color: COLORS.text,
  },
  searchMatchCount: {
    fontSize: 12,
    color: COLORS.sub,
    fontWeight: '600',
    minWidth: 42,
    textAlign: 'right',
  },
  searchNavBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Block Contact in Profile Modal ────────────────────────────────────────
  profileBlockBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    width: '100%',
    borderRadius: RADIUS.lg,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 8,
  },
  profileBlockText: {
    fontSize: 14,
    fontWeight: '600',
  },

  // ── Inline Confirmation Card ──────────────────────────────────────────────
  confirmationCard: {
    width: '100%',
    borderRadius: RADIUS.xl,
    paddingHorizontal: 20,
    paddingVertical: 20,
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  confirmationIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  confirmationTitle: {
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
  },
  confirmationBody: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  confirmationButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    marginTop: 8,
  },
  confirmationCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmationCancelText: {
    fontSize: 15,
    fontWeight: '600',
  },
  confirmationBlockBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmationBlockText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },

  // ── Blocked Banner ────────────────────────────────────────────────────────
  inputBarWithBanner: {
    // Container for banner + input bar when user blocks someone
  },
  blockedBanner: {
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  blockedBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  blockedBannerTitle: {
    fontSize: 14,
    fontWeight: '500',
  },

  // ── Message Action Toolbar ────────────────────────────────────────────────
  selectedMessage: {
    backgroundColor: 'rgba(30,156,240,0.12)',
    borderRadius: RADIUS.md,
  },
  actionToolbar: {
    borderTopWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  actionToolbarContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    gap: 8,
  },
  actionToolbarBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 6,
    gap: 4,
    minWidth: 50,
  },
  actionToolbarLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  actionToolbarClose: {
    padding: 4,
  },

  // ── Reply Preview ──────────────────────────────────────────────────────────
  replyPreview: {
    borderTopWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  replyPreviewBar: {
    width: 3,
    height: 36,
    backgroundColor: COLORS.blue,
    borderRadius: 2,
  },
  replyPreviewContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  replyPreviewLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 2,
  },
  replyPreviewText: {
    fontSize: 13,
  },
  replyPreviewClose: {
    padding: 4,
  },

  // ── Reply Bubble (inside message) ──────────────────────────────────────────
  replyBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 8,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: RADIUS.md,
    marginBottom: 6,
  },
  replyBubbleBar: {
    width: 3,
    height: 32,
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderRadius: 2,
  },
  replyBubbleSender: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  replyBubbleText: {
    fontSize: 12,
  },

  // ── Location Menu ─────────────────────────────────────────────────────────
  locationOption: {
    flexDirection: 'row',
    gap: 16,
    padding: 16,
    borderRadius: RADIUS.lg,
    marginBottom: 12,
  },
  locationIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(30,156,240,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationOptionText: {
    flex: 1,
    gap: 6,
  },
  locationOptionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  locationOptionDesc: {
    fontSize: 13,
  },
  durationButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  durationButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  durationText: {
    fontSize: 14,
    fontWeight: '600',
  },
  startLiveButton: {
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    ...SHADOW.button,
  },
  startLiveButtonInner: {
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startLiveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },

  // ── Contact picker ────────────────────────────────────────────────────────
  contactPickerSheet: {
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingBottom: Platform.OS === 'ios' ? 20 : 20,
    paddingHorizontal: 20, paddingTop: 12,
    maxHeight: '85%',
    minHeight: 320,
    ...SHADOW.glow,
  },
  contactSearchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    borderRadius: RADIUS.full,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  contactSearchInput: { flex: 1, fontSize: 14, padding: 0 },
  contactPickerList: { flexGrow: 1, minHeight: 200 },
  contactPickerContent: { paddingBottom: 20 },
  contactPickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: RADIUS.lg,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
  },

  // ── Contact card bubble (WhatsApp-style) ──────────────────────
  contactBubbleIn: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: RADIUS.lg,
    borderBottomLeftRadius: 4,
    minWidth: 220,
    maxWidth: 280,
    overflow: 'hidden',
    ...SHADOW.card,
  },
  contactBubbleOut: {
    backgroundColor: 'rgba(30,156,240,0.15)',
    borderRadius: RADIUS.lg,
    borderBottomRightRadius: 4,
    minWidth: 220,
    maxWidth: 280,
    overflow: 'hidden',
    ...SHADOW.card,
  },
  contactBubbleTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 10,
  },
  contactBubbleAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.blue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactBubbleInitials: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  contactBubbleName: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  contactBubblePhone: {
    fontSize: 12,
    color: COLORS.sub,
  },
  contactBubbleDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: COLORS.sub,
    opacity: 0.25,
    marginHorizontal: 14,
  },
  contactBubbleTime: {
    fontSize: 11,
    color: COLORS.sub,
    textAlign: 'right',
    paddingHorizontal: 14,
    paddingVertical: 6,
  },

  // ── Received-contact action modal ────────────────────────────
  contactActionOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  contactActionSheet: {
    width: '100%',
    maxWidth: 380,
    borderRadius: RADIUS.xl,
    overflow: 'hidden',
    ...SHADOW.glow,
  },
  contactActionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  contactActionName: {
    fontSize: 16,
    fontWeight: '700',
  },
  contactActionDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: COLORS.sub,
    opacity: 0.2,
  },
  contactActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  contactActionButtonTitle: {
    fontSize: 15,
    fontWeight: '600',
  },

  // ── Group Invite Bubble Styles ────────────────────────────────────────────
  groupInviteBubbleIn: {
    backgroundColor: '#fff',
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
    borderColor: COLORS.blue,
    padding: 14,
    maxWidth: '80%',
    minWidth: 220,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  groupInviteBubbleOut: {
    backgroundColor: COLORS.blue,
    borderRadius: RADIUS.lg,
    padding: 14,
    maxWidth: '80%',
    minWidth: 220,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  groupInviteIconWrap: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(30,156,240,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupInviteTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.sub,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  groupInviteName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
    marginTop: 2,
  },
  groupInviteButtonWrap: {
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: COLORS.blue,
    borderRadius: RADIUS.md,
    alignSelf: 'flex-start',
  },
  groupInviteButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.5,
  },
  groupInviteTime: {
    fontSize: 11,
    color: '#666',
    position: 'absolute',
    bottom: 12,
    right: 12,
  },
  groupInviteTimeWithTick: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },

  // ── Group Invite Preview Modal ────────────────────────────────────────────
  invitePreviewSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    minHeight: 340,
    paddingBottom: 40,
    overflow: 'hidden',
  },
  invitePreviewJoinBtn: {
    marginTop: 24,
    width: '100%',
    paddingVertical: 14,
    borderRadius: RADIUS.lg,
    backgroundColor: '#25D366',
    alignItems: 'center',
    justifyContent: 'center',
  },
  invitePreviewJoinText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
