// ─── Navigation Service ──────────────────────────────────────────────────────
// Provides global navigation methods that can be called from anywhere,
// particularly for handling notification tap navigation.

import { createNavigationContainerRef, NavigationContainerRefWithCurrent, StackActions } from '@react-navigation/native';
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
 * Used by notification tap handlers
 */
export function navigateToChat(chatId: string) {
  if (navigationRef.isReady()) {
    console.log('[NavigationService] Navigating to chat:', chatId);
    navigationRef.navigate('Chat' as any, { chatId });
  } else {
    console.warn('[NavigationService] Navigator not ready, cannot navigate to chat:', chatId);
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
  private queue: Array<() => void> = [];
  private isReady = false;

  enqueue(action: () => void) {
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
          action();
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
