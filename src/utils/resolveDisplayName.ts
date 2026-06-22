// ─── Display Name Resolution ─────────────────────────────────────────────────
// Pure utility that resolves a human-readable display name for chat participants.
// Priority chain:
//   1. Group chat → groupName or "Group"
//   2. Direct chat → phone book contact name (if phone in contacts map)
//   3. Direct chat → Firestore displayName (if exists and differs from phone)
//   4. Direct chat → raw phone number

/**
 * Minimal chat shape required for display name resolution.
 */
export interface ChatInfo {
  type: string;
  members: string[];
  groupName: string | null;
}

/**
 * Firestore user data needed for display name fallback.
 */
export interface FirestoreUserInfo {
  displayName: string;
  phone: string;
}

/**
 * Resolves the display name for a chat based on the following priority:
 *  1. Group chat → groupName (or "Group" if null)
 *  2. Direct chat → contact name from device phone book
 *  3. Direct chat → Firestore displayName (if it differs from the raw phone)
 *  4. Direct chat → raw phone number
 *
 * @param chat - Chat data with type, members, and groupName
 * @param currentUserId - The current authenticated user's UID
 * @param contactsMap - Map of phone number (E.164) → device contact name
 * @param firestoreUsers - Map of UID → { displayName, phone }
 * @returns The resolved display name string
 */
export function resolveDisplayName(
  chat: ChatInfo,
  currentUserId: string,
  contactsMap: Map<string, string>,
  firestoreUsers: Map<string, FirestoreUserInfo>,
): string {
  // 1. Group chats use groupName or fallback to "Group"
  if (chat.type === 'group') {
    return chat.groupName ?? 'Group';
  }

  // 2-4. Direct chats — find the other member
  const otherMemberId = chat.members.find((id) => id !== currentUserId);
  if (!otherMemberId) return 'Unknown';

  const otherUser = firestoreUsers.get(otherMemberId);
  if (!otherUser) return 'Unknown';

  // Priority 2: Phone book contact name
  const contactName = contactsMap.get(otherUser.phone);
  if (contactName) return contactName;

  // Priority 3: Firestore displayName (only if it's a real name, not just the phone number)
  if (otherUser.displayName && otherUser.displayName !== otherUser.phone) {
    return otherUser.displayName;
  }

  // Priority 4: Raw phone number
  return otherUser.phone;
}
