// ─── System Message Parser ───────────────────────────────────────────────────
// Parses system messages and returns personalized text based on current user

/**
 * Parse a system message and return personalized text for the current user
 * 
 * Message format:
 * - BLOCK:[blockerId]:[blockedId]:[blockerName]:[blockedName]
 * - UNBLOCK:[unblockerId]:[unblockedId]:[unblockerName]:[unblockedName]
 * 
 * @param messageText - The system message text from Firestore
 * @param currentUserId - The ID of the current viewing user
 * @returns Personalized message text, or original text if not parseable
 */
export function parseSystemMessage(messageText: string, currentUserId: string | null): string {
  if (!messageText || !currentUserId) return messageText;

  // Parse BLOCK messages
  if (messageText.startsWith('BLOCK:')) {
    const parts = messageText.split(':');
    if (parts.length !== 5) return messageText;

    const [, blockerId, blockedId, blockerName, blockedName] = parts;

    if (currentUserId === blockerId) {
      return `You blocked ${blockedName}`;
    } else if (currentUserId === blockedId) {
      return `You were blocked by ${blockerName}`;
    }
    
    // Fallback for other viewers (shouldn't happen in 1-on-1)
    return `${blockerName} blocked ${blockedName}`;
  }

  // Parse UNBLOCK messages
  if (messageText.startsWith('UNBLOCK:')) {
    const parts = messageText.split(':');
    if (parts.length !== 5) return messageText;

    const [, unblockerId, unblockedId, unblockerName, unblockedName] = parts;

    if (currentUserId === unblockerId) {
      return `You unblocked ${unblockedName}`;
    } else if (currentUserId === unblockedId) {
      return `You were unblocked by ${unblockerName}`;
    }
    
    // Fallback for other viewers (shouldn't happen in 1-on-1)
    return `${unblockerName} unblocked ${unblockedName}`;
  }

  // Parse GROUP_ADD messages: someone added a member to the group
  if (messageText.startsWith('GROUP_ADD:')) {
    const parts = messageText.split(':');
    if (parts.length !== 5) return messageText;
    const [, adderId, addedId, adderName, addedName] = parts;
    if (currentUserId === adderId && currentUserId === addedId) {
      return 'You joined the group';
    } else if (currentUserId === adderId) {
      return `You added ${addedName}`;
    } else if (currentUserId === addedId) {
      return `${adderName} added you`;
    }
    return `${adderName} added ${addedName}`;
  }

  // Parse GROUP_REMOVE messages: someone removed a member from the group
  if (messageText.startsWith('GROUP_REMOVE:')) {
    const parts = messageText.split(':');
    if (parts.length !== 5) return messageText;
    const [, removerId, removedId, removerName, removedName] = parts;
    if (currentUserId === removerId) {
      return `You removed ${removedName}`;
    } else if (currentUserId === removedId) {
      return `${removerName} removed you`;
    }
    return `${removerName} removed ${removedName}`;
  }

  // Parse GROUP_LEAVE messages: someone left the group
  if (messageText.startsWith('GROUP_LEAVE:')) {
    const parts = messageText.split(':');
    if (parts.length !== 3) return messageText;
    const [, leaverId, leaverName] = parts;
    if (currentUserId === leaverId) {
      return 'You left the group';
    }
    return `${leaverName} left`;
  }

  // Parse GROUP_JOIN_LINK messages: someone joined via invite link
  if (messageText.startsWith('GROUP_JOIN_LINK:')) {
    const parts = messageText.split(':');
    if (parts.length !== 3) return messageText;
    const [, joinerId, joinerName] = parts;
    if (currentUserId === joinerId) {
      return 'You joined using invite link';
    }
    return `${joinerName} joined using invite link`;
  }

  // Parse NUMBER_CHANGE messages: someone changed their phone number
  if (messageText.startsWith('NUMBER_CHANGE:')) {
    const parts = messageText.split(':');
    if (parts.length !== 5) return messageText;
    const [, changedUserId, userName, , newNumber] = parts;
    if (currentUserId === changedUserId) {
      return `You changed your number to ${newNumber}`;
    }
    return `${userName} changed their number to ${newNumber}`;
  }

  // Return original text for other system messages
  return messageText;
}

/**
 * Check if a message is a system message
 */
export function isSystemMessage(type: string): boolean {
  return type === 'system';
}
