// ─── ForwardModal Component ──────────────────────────────────────────────────
// Modal for selecting contacts/chats to forward a message to
// Combines existing chats and contacts list, deduplicated by userId

import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Modal,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Avatar } from './index';
import { AppBg, AppText, AppIcon, useForeground, useTypography, useGlass } from '../context/ThemeContext';
import { COLORS, RADIUS, SHADOW } from '../types/theme';
import { useContacts } from '../hooks/useContacts';

interface ForwardRecipient {
  id: string; // Unique identifier: chatId for groups, userId for direct chats/contacts
  displayName: string;
  photoURL: string | null;
  type: 'group' | 'direct' | 'contact'; // Type of recipient
  userId?: string; // For deduplication - user ID if it's a person
  chatId?: string; // Existing chat ID if there's already a conversation
}

interface ForwardModalProps {
  visible: boolean;
  onClose: () => void;
  onForward: (selectedChatIds: string[]) => Promise<void>;
  currentUserId: string;
}

export function ForwardModal({ visible, onClose, onForward, currentUserId }: ForwardModalProps) {
  const { FG } = useForeground();
  const { textColor, fontFamily } = useTypography();
  const { bevel } = useGlass();

  const [recipients, setRecipients] = useState<ForwardRecipient[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [forwarding, setForwarding] = useState(false);

  // Get contacts from hook
  const { contacts } = useContacts(currentUserId);

  // Load chats and merge with contacts (deduplicated)
  useEffect(() => {
    if (!visible || !currentUserId) return;

    let cancelled = false;

    const loadRecipientsAsync = async () => {
      setLoading(true);
      try {
        console.log('[ForwardModal] Loading recipients for user:', currentUserId);

        // 1. Fetch existing chats
        const chatsRef = collection(db, 'chats');
        const q = query(
          chatsRef,
          where('members', 'array-contains', currentUserId),
          orderBy('lastMessage.timestamp', 'desc'),
          limit(50)
        );

        const snapshot = await getDocs(q);
        const recipientsMap = new Map<string, ForwardRecipient>();

        // 2. Process chats
        for (const docSnap of snapshot.docs) {
          if (cancelled) return;
          
          const data = docSnap.data();
          
          if (data.isGroup) {
            // Group chat - add directly (groups don't have duplicate issue)
            recipientsMap.set(docSnap.id, {
              id: docSnap.id,
              displayName: data.groupName || 'Unnamed Group',
              photoURL: data.groupPhoto || null,
              type: 'group',
              chatId: docSnap.id,
            });
          } else {
            // Direct chat - use userId as key for deduplication
            const otherUserId = (data.members as string[]).find((id: string) => id !== currentUserId);
            if (otherUserId) {
              try {
                const userDoc = await getDocs(
                  query(collection(db, 'users'), where('__name__', '==', otherUserId), limit(1))
                );
                if (!userDoc.empty && !cancelled) {
                  const userData = userDoc.docs[0].data();
                  // Use userId as key to prevent duplicates
                  recipientsMap.set(otherUserId, {
                    id: otherUserId, // Use userId as ID for direct chats
                    displayName: userData.displayName || userData.phone || 'Unknown',
                    photoURL: userData.photoURL || null,
                    type: 'direct',
                    userId: otherUserId,
                    chatId: docSnap.id, // Store existing chat ID
                  });
                }
              } catch (error) {
                console.warn('[ForwardModal] Could not fetch user data:', error);
              }
            }
          }
        }

        // 3. Add contacts that aren't already in chats
        if (contacts && !cancelled) {
          for (const contact of contacts) {
            // Only add if not already in map (deduplicated by userId)
            if (contact.userId && !recipientsMap.has(contact.userId)) {
              recipientsMap.set(contact.userId, {
                id: contact.userId,
                displayName: contact.displayName || contact.phone,
                photoURL: contact.photoURL || null,
                type: 'contact',
                userId: contact.userId,
                // No chatId - will need to create chat when forwarding
              });
            }
          }
        }

        if (!cancelled) {
          // Convert map to array and sort: groups first, then by display name
          const recipientsList = Array.from(recipientsMap.values()).sort((a, b) => {
            // Groups first
            if (a.type === 'group' && b.type !== 'group') return -1;
            if (a.type !== 'group' && b.type === 'group') return 1;
            // Then alphabetically
            return a.displayName.localeCompare(b.displayName);
          });

          console.log('[ForwardModal] Loaded', recipientsList.length, 'unique recipients');
          console.log('[ForwardModal] Breakdown:', {
            groups: recipientsList.filter(r => r.type === 'group').length,
            directChats: recipientsList.filter(r => r.type === 'direct').length,
            contactsOnly: recipientsList.filter(r => r.type === 'contact').length,
          });
          
          setRecipients(recipientsList);
        }
      } catch (error) {
        console.error('[ForwardModal] Error loading recipients:', error);
        if (!cancelled) {
          setRecipients([]); // Reset on error
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadRecipientsAsync();
    setSelectedIds([]); // Reset selection when modal opens

    return () => {
      cancelled = true;
    };
  }, [visible, currentUserId, contacts]);

  const toggleRecipientSelection = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id)
        ? prev.filter((selectedId) => selectedId !== id)
        : [...prev, id]
    );
  };

  const handleForward = async () => {
    if (selectedIds.length === 0) return;

    setForwarding(true);
    try {
      // Map selected IDs to chat IDs
      // For groups and existing direct chats, use the chatId
      // For contacts without chats, we'll need to create or find the chat
      const chatIds: string[] = [];
      
      for (const id of selectedIds) {
        const recipient = recipients.find(r => r.id === id);
        if (!recipient) continue;

        if (recipient.chatId) {
          // Existing chat
          chatIds.push(recipient.chatId);
        } else if (recipient.userId) {
          // Contact without existing chat - need to find or create chat
          // For now, we'll generate a deterministic chat ID
          // The forward function will need to handle chat creation
          const members = [currentUserId, recipient.userId].sort();
          const chatId = members.join('_');
          chatIds.push(chatId);
        }
      }

      await onForward(chatIds);
      onClose();
      setSelectedIds([]); // Reset after successful forward
    } catch (error) {
      console.error('[ForwardModal] Forward failed:', error);
    } finally {
      setForwarding(false);
    }
  };

  const getInitials = (name: string): string => {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  const renderRecipientItem = ({ item }: { item: ForwardRecipient }) => {
    const isSelected = selectedIds.includes(item.id);

    let subtitle = '';
    if (item.type === 'group') {
      subtitle = 'Group';
    } else if (item.type === 'direct') {
      subtitle = 'Direct chat';
    } else {
      subtitle = 'Contact';
    }

    return (
      <TouchableOpacity
        style={[styles.chatItem, bevel, isSelected && styles.chatItemSelected]}
        onPress={() => toggleRecipientSelection(item.id)}
        activeOpacity={0.7}
      >
        <Avatar
          initials={getInitials(item.displayName)}
          color={COLORS.blue}
          size={48}
          imageUrl={item.photoURL}
        />
        <View style={styles.chatItemContent}>
          <AppText style={[styles.chatItemName, { color: textColor, fontFamily }]}>
            {item.displayName}
          </AppText>
          <AppText style={[styles.chatItemType, { color: FG.secondary }]}>
            {subtitle}
          </AppText>
        </View>
        <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
          {isSelected && <AppIcon name="checkmark" size={16} color="#fff" fixedColor />}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onClose}
        />
        <View style={[styles.modalContent, { backgroundColor: FG.glassBg }]}>
          <AppBg />
          
          {/* Handle */}
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            <AppText style={[styles.title, { color: textColor, fontFamily }]}>
              Forward Message
            </AppText>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <AppIcon name="close" size={24} color={FG.secondary} />
            </TouchableOpacity>
          </View>

          {/* Selected count */}
          {selectedIds.length > 0 && (
            <View style={styles.selectedBanner}>
              <AppText style={[styles.selectedText, { color: COLORS.blue }]}>
                {selectedIds.length} selected
              </AppText>
            </View>
          )}

          {/* Recipients list */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={COLORS.blue} />
              <AppText style={[styles.loadingText, { color: FG.secondary }]}>
                Loading...
              </AppText>
            </View>
          ) : recipients.length === 0 ? (
            <View style={styles.emptyContainer}>
              <AppIcon name="people-outline" size={48} color={FG.secondary} />
              <AppText style={[styles.emptyText, { color: FG.secondary }]}>
                No contacts or chats available
              </AppText>
            </View>
          ) : (
            <FlatList
              data={recipients}
              keyExtractor={(item) => item.id}
              renderItem={renderRecipientItem}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
            />
          )}

          {/* Forward button */}
          <TouchableOpacity
            style={[
              styles.forwardBtn,
              (selectedIds.length === 0 || forwarding) && styles.forwardBtnDisabled,
            ]}
            onPress={handleForward}
            disabled={selectedIds.length === 0 || forwarding}
            activeOpacity={0.8}
          >
            {forwarding ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <AppIcon name="arrow-forward" size={20} color="#fff" fixedColor />
                <AppText fixedColor style={styles.forwardBtnText}>
                  Forward to {selectedIds.length}
                </AppText>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    paddingBottom: 20,
    ...SHADOW.glow,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(30,156,240,0.40)',
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(30,156,240,0.15)',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 4,
  },
  selectedBanner: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: 'rgba(30,156,240,0.08)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(30,156,240,0.15)',
  },
  selectedText: {
    fontSize: 14,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: RADIUS.lg,
    gap: 12,
  },
  chatItemSelected: {
    backgroundColor: 'rgba(30,156,240,0.12)',
  },
  chatItemContent: {
    flex: 1,
    gap: 2,
  },
  chatItemName: {
    fontSize: 15,
    fontWeight: '600',
  },
  chatItemType: {
    fontSize: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(30,156,240,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: COLORS.blue,
    borderColor: COLORS.blue,
  },
  forwardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.blue,
    marginHorizontal: 20,
    marginTop: 12,
    paddingVertical: 14,
    borderRadius: RADIUS.md,
    ...SHADOW.button,
  },
  forwardBtnDisabled: {
    backgroundColor: 'rgba(30,156,240,0.35)',
    opacity: 0.6,
  },
  forwardBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
