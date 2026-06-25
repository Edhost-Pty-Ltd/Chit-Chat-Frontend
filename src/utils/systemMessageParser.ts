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

  // Return original text for other system messages
  return messageText;
}

/**
 * Check if a message is a system message
 */
export function isSystemMessage(type: string): boolean {
  return type === 'system';
}
