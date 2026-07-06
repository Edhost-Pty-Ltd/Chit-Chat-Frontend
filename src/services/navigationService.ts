// ─── Navigation Service ──────────────────────────────────────────────────────
// Provides global navigation methods that can be called from anywhere,
// particularly for handling notification tap navigation.

import { createNavigationContainerRef, NavigationContainerRefWithCurrent, StackActions } from '@react-navigation/native';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { getAuth } from '@react-native-firebase/auth';
import { RootStackParamList } from '../types';

// Create a navigation ref that can be accessed globally
export const navigationRef = createNavigationContainerRef<RootStackParamList>();

/**
 * Navigate to a specific screen with params
 * Safe to call from anywhere - checks if navigator is ready
 */
export function navigate(name: keyof RootStackParamList, params?: any) {
  if (navigationRef.isReady()) {
    console.log('[NavigationService] Navigating to:', name, 'with params:', params);
    navigationRef.navigate(name as any, params);
  } else {
    console.warn('[NavigationService] Navigator not ready, cannot navigate to:', name);
  }
}

/**
 * Navigate to Chat screen with chatId
 * Fetches required chat data from Firestore before navigating
 * Used by notification tap handlers
 */
export async function navigateToChat(chatId: string) {
  if (!navigationRef.isReady()) {
    console.warn('[NavigationService] Navigator not ready, cannot navigate to chat:', chatId);
    return;
  }

  try {
    console.log('[NavigationService] Fetching chat data for:', chatId);
    
    // Fetch chat document from Firestore
    const chatRef = doc(db, 'chats', chatId);
    const chatSnap = await getDoc(chatRef);
    
    if (!chatSnap.exists()) {
      console.error('[NavigationService] Chat not found:', chatId);
      return;
    }
    
    const chatData = chatSnap.data();
    const currentUser = getAuth().currentUser;
    
    if (!currentUser) {
      console.error('[NavigationService] No authenticated user');
      return;
    }
    
    // Determine if this is a group chat or direct chat
    const isGroup = chatData.type === 'group' || chatData.isGroup || false;
    
    let displayName = 'Chat';
    let otherUserId: string | undefined;
    let otherUserPhoto: string | null = null;
    
    if (isGroup) {
      // Group chat
      displayName = chatData.groupName || chatData.name || 'Group Chat';
    } else {
      // Direct chat - find the other user
      const members = chatData.members as string[];
      otherUserId = members.find((id: string) => id !== currentUser.uid);
      
      if (otherUserId) {
        // Fetch other user's profile
        const userRef = doc(db, 'users', otherUserId);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
          const userData = userSnap.data();
          displayName = userData.displayName || userData.phone || 'Unknown';
          otherUserPhoto = userData.photoURL || null;
        }
      }
    }
    
    console.log('[NavigationService] Navigating to chat with params:', {
      chatId,
      displayName,
      isGroup,
      otherUserId,
      otherUserPhoto,
    });
    
    navigationRef.navigate('Chat' as any, {
      chatId,
      displayName,
      isGroup,
      otherUserId,
      otherUserPhoto,
    });
  } catch (error) {
    console.error('[NavigationService] Error navigating to chat:', error);
  }
}

/**
 * Check if navigator is ready
 */
export function isNavigatorReady(): boolean {
  return navigationRef.isReady();
}

/**
 * Get current route name
 */
export function getCurrentRouteName(): string | undefined {
  if (navigationRef.isReady()) {
    return navigationRef.getCurrentRoute()?.name;
  }
  return undefined;
}

/**
 * Queue a navigation action to be executed when navigator becomes ready
 * Useful for handling notifications that arrive before app is fully initialized
 */
class NavigationQueue {
  private queue: Array<() => void | Promise<void>> = [];
  private isReady = false;

  enqueue(action: () => void | Promise<void>) {
    if (this.isReady) {
      // Execute immediately if ready
      action();
    } else {
      // Queue for later
      console.log('[NavigationQueue] Queuing navigation action');
      this.queue.push(action);
    }
  }

  setReady() {
    console.log('[NavigationQueue] Navigator ready, processing', this.queue.length, 'queued actions');
    this.isReady = true;
    
    // Process all queued actions
    while (this.queue.length > 0) {
      const action = this.queue.shift();
      if (action) {
        try {
          const result = action();
          // Handle async actions
          if (result instanceof Promise) {
            result.catch((error) => {
              console.error('[NavigationQueue] Error executing queued async action:', error);
            });
          }
        } catch (error) {
          console.error('[NavigationQueue] Error executing queued action:', error);
        }
      }
    }
  }

  reset() {
    this.isReady = false;
    this.queue = [];
  }
}

export const navigationQueue = new NavigationQueue();

/**
 * Navigate to chat when ready (queues if not ready)
 * This is the recommended method for notification handlers
 */
export function navigateToChatWhenReady(chatId: string) {
  navigationQueue.enqueue(() => {
    navigateToChat(chatId);
  });
}
