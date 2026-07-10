// ─── Display Name Resolution ─────────────────────────────────────────────────
// Pure utility that resolves a human-readable display name for chat participants.
// Priority chain:
//   1. Group chat → groupName or "Group"
//   2. Direct chat → phone book contact name (if phone is saved in contacts)
//   3. Direct chat → raw phone number (if NOT saved in contacts)
//
// Note: a user's self-set Firestore displayName is intentionally NOT used for
// direct chats — names come only from the viewer's own phone book, falling back
// to the phone number.

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
 *  3. Direct chat → raw phone number
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
  savedContactNamesByUserId?: Map<string, string>,
): string {
  // 1. Group chats use groupName or fallback to "Group"
  if (chat.type === 'group') {
    return chat.groupName ?? 'Group';
  }

  // 2-3. Direct chats — find the other member
  const otherMemberId = chat.members.find((id) => id !== currentUserId);
  if (!otherMemberId) return 'Unknown';

  // Priority 2 (preferred): the other member's saved contact name, looked up
  // directly by userId. This is the same join useContacts() already did when
  // cross-referencing the device phone book against registered accounts, so
  // it's guaranteed correct — unlike re-matching phone number strings below,
  // which silently breaks if the two sources normalize a number differently.
  const savedName = savedContactNamesByUserId?.get(otherMemberId);
  if (savedName) return savedName;

  const otherUser = firestoreUsers.get(otherMemberId);
  if (!otherUser) return 'Unknown';

  // Fallback: phone book contact name matched by phone number string (only
  // reached if the userId-keyed lookup above found nothing).
  const contactName = contactsMap.get(otherUser.phone);
  if (contactName) return contactName;

  // Priority 3: Raw phone number (contact not saved on this device)
  return otherUser.phone;
}
