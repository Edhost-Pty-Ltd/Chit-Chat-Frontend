/**
 * Preservation Property Tests - Notification System Baseline Behavior
 * 
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
 * 
 * CRITICAL: These tests MUST PASS on both unfixed and fixed code
 * 
 * This test suite captures the baseline behavior of the notification system
 * for all operations that should remain unchanged after the fix. We observe
 * behavior on UNFIXED code first for non-push-notification paths (Firestore sync,
 * native OS notifications, navigation, counting logic), then write property-based
 * tests capturing that exact behavior to ensure the fix doesn't break existing
 * functionality.
 * 
 * Expected outcome: Tests PASS on unfixed code, continue PASSING on fixed code
 * 
 * Test Coverage:
 * - 3.1: Firestore-synced notifications via useNotificationSync correctly update in-app UI
 * - 3.2: Native OS notifications appear when app is backgrounded or killed
 * - 3.3: Notification tap navigation works correctly
 * - 3.4: Internal counting logic (unreadCount, messageCount, callCount) works correctly
 * - Badge count updates via Notifications.setBadgeCountAsync work correctly
 * - Toast auto-dismiss timer (4 seconds) works correctly
 */

import React from 'react';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { NotificationProvider, useNotifications, AppNotification } from '../../context/NotificationContext';
import * as fc from 'fast-check';
import * as Notifications from 'expo-notifications';

// Mock expo-notifications
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn().mockResolvedValue(undefined),
  getPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  requestPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  scheduleNotificationAsync: jest.fn().mockResolvedValue('mock-notification-id'),
  setBadgeCountAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

jest.mock('../../config/firebase', () => ({
  db: {},
}));

jest.mock('../../hooks/useAuth', () => ({
  useAuth: jest.fn(() => ({ user: { uid: 'test-user-id' } })),
}));

jest.mock('../../hooks/useNotificationSync', () => ({
  useNotificationSync: jest.fn((userId, pushNotification) => {
    // Mock implementation - does nothing, we'll trigger notifications manually
  }),
}));

// ─── Minimal renderHook for node environment ──────────────────────────────────

function renderHook<T>(hookFn: () => T): { result: { current: T } } {
  const result: { current: T } = {} as any;

  function TestComponent() {
    result.current = hookFn();
    return null;
  }

  let renderer: ReactTestRenderer;
  act(() => {
    renderer = create(
      React.createElement(
        NotificationProvider,
        null,
        React.createElement(TestComponent)
      )
    );
  });

  return { result };
}

describe('Property 2: Preservation - Notification System Baseline Behavior', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  describe('Test 1: Firestore-synced Notifications Update In-App UI (Requirement 3.1)', () => {
    test('pushNotification adds notification to inbox', () => {
      const { result } = renderHook(() => useNotifications());

      expect(result.current.notifications).toHaveLength(0);

      act(() => {
        result.current.pushNotification({
          type: 'message',
          title: 'Test User',
          body: 'Hello from Firestore',
        });
      });

      expect(result.current.notifications).toHaveLength(1);
      expect(result.current.notifications[0].type).toBe('message');
      expect(result.current.notifications[0].title).toBe('Test User');
      expect(result.current.notifications[0].body).toBe('Hello from Firestore');
      expect(result.current.notifications[0].read).toBe(false);
    });

    test('pushNotification shows toast notification', () => {
      const { result } = renderHook(() => useNotifications());

      expect(result.current.toast).toBeNull();

      act(() => {
        result.current.pushNotification({
          type: 'call',
          title: 'Missed Call',
          body: 'Alice tried to call you',
        });
      });

      expect(result.current.toast).not.toBeNull();
      expect(result.current.toast?.type).toBe('call');
      expect(result.current.toast?.title).toBe('Missed Call');
    });

    test('pushNotification triggers native notification', () => {
      const { result } = renderHook(() => useNotifications());

      act(() => {
        result.current.pushNotification({
          type: 'system',
          title: 'System Update',
          body: 'New features available',
        });
      });

      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith({
        content: {
          title: 'System Update',
          body: 'New features available',
          sound: true,
          data: { 
            contactId: undefined,
            type: 'system',
          },
        },
        trigger: null,
      });
    });

    test('PROPERTY: All Firestore-synced notifications update in-app UI identically', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('message', 'call', 'system', 'number_change'),
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.option(fc.string(), { nil: undefined }),
          (type, title, body, contactId) => {
            const { result } = renderHook(() => useNotifications());
            
            const initialCount = result.current.notifications.length;

            act(() => {
              result.current.pushNotification({
                type: type as any,
                title,
                body,
                contactId,
              });
            });

            // Invariant: Notification added to inbox
            expect(result.current.notifications.length).toBe(initialCount + 1);
            
            // Invariant: Toast shown
            expect(result.current.toast).not.toBeNull();
            expect(result.current.toast?.type).toBe(type);
            
            // Invariant: Native notification triggered
            expect(Notifications.scheduleNotificationAsync).toHaveBeenCalled();
            
            return true;
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  describe('Test 2: Native OS Notifications Appear Correctly (Requirement 3.2)', () => {
    test('Native notification includes correct content structure', () => {
      const { result } = renderHook(() => useNotifications());

      act(() => {
        result.current.pushNotification({
          type: 'message',
          title: 'Bob',
          body: 'Hey there!',
          contactId: 'user-123',
        });
      });

      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.objectContaining({
            title: 'Bob',
            body: 'Hey there!',
            sound: true,
            data: expect.objectContaining({
              contactId: 'user-123',
              type: 'message',
            }),
          }),
          trigger: null,
        })
      );
    });

    test('Native notification preserves contactId for navigation', () => {
      const { result } = renderHook(() => useNotifications());

      act(() => {
        result.current.pushNotification({
          type: 'call',
          title: 'Missed Call',
          body: 'Charlie called',
          contactId: 'user-456',
        });
      });

      const callArgs = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls[0][0];
      expect(callArgs.content.data.contactId).toBe('user-456');
    });

    test('PROPERTY: Native OS notifications always include required data', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('message', 'call', 'system'),
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.string({ minLength: 1, maxLength: 100 }),
          (type, title, body) => {
            jest.clearAllMocks();
            const { result } = renderHook(() => useNotifications());

            act(() => {
              result.current.pushNotification({
                type: type as any,
                title,
                body,
              });
            });

            // Invariant: Native notification called
            expect(Notifications.scheduleNotificationAsync).toHaveBeenCalled();
            
            const callArgs = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls[0][0];
            
            // Invariant: Required fields present
            expect(callArgs.content.title).toBe(title);
            expect(callArgs.content.body).toBe(body);
            expect(callArgs.content.sound).toBe(true);
            expect(callArgs.content.data.type).toBe(type);
            expect(callArgs.trigger).toBeNull();
            
            return true;
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  describe('Test 3: Notification Tap Navigation Works Correctly (Requirement 3.3)', () => {
    test('Notification includes contactId for direct navigation', () => {
      const { result } = renderHook(() => useNotifications());

      act(() => {
        result.current.pushNotification({
          type: 'message',
          title: 'Direct Message',
          body: 'Tap to view',
          contactId: 'contact-789',
        });
      });

      expect(result.current.notifications[0].contactId).toBe('contact-789');
    });

    test('Notification without contactId has undefined contactId', () => {
      const { result } = renderHook(() => useNotifications());

      act(() => {
        result.current.pushNotification({
          type: 'system',
          title: 'System Alert',
          body: 'No navigation',
        });
      });

      expect(result.current.notifications[0].contactId).toBeUndefined();
    });

    test('PROPERTY: Navigation data preserved in notification structure', () => {
      fc.assert(
        fc.property(
          fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
          (contactId) => {
            jest.clearAllMocks(); // Clear mocks between property test runs
            const { result } = renderHook(() => useNotifications());

            act(() => {
              result.current.pushNotification({
                type: 'message',
                title: 'Test',
                body: 'Body',
                contactId,
              });
            });

            // Invariant: contactId preserved exactly as provided
            const notification = result.current.notifications[0];
            expect(notification.contactId).toBe(contactId);
            
            // Invariant: Native notification data includes contactId
            const callArgs = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls[0][0];
            expect(callArgs.content.data.contactId).toBe(contactId);
            
            return true;
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  describe('Test 4: Internal Counting Logic Works Correctly (Requirement 3.4)', () => {
    test('unreadCount increments with each notification', () => {
      const { result } = renderHook(() => useNotifications());

      expect(result.current.unreadCount).toBe(0);

      act(() => {
        result.current.pushNotification({
          type: 'message',
          title: 'Message 1',
          body: 'First',
        });
      });

      expect(result.current.unreadCount).toBe(1);

      act(() => {
        result.current.pushNotification({
          type: 'call',
          title: 'Call 1',
          body: 'Missed',
        });
      });

      expect(result.current.unreadCount).toBe(2);
    });

    test('messageCount counts only message-type notifications', () => {
      const { result } = renderHook(() => useNotifications());

      expect(result.current.messageCount).toBe(0);

      act(() => {
        result.current.pushNotification({
          type: 'message',
          title: 'Message 1',
          body: 'First',
        });
      });

      expect(result.current.messageCount).toBe(1);

      act(() => {
        result.current.pushNotification({
          type: 'call',
          title: 'Call 1',
          body: 'Should not count',
        });
      });

      expect(result.current.messageCount).toBe(1); // Still 1, not 2

      act(() => {
        result.current.pushNotification({
          type: 'message',
          title: 'Message 2',
          body: 'Second',
        });
      });

      expect(result.current.messageCount).toBe(2);
    });

    test('callCount counts only call-type notifications', () => {
      const { result } = renderHook(() => useNotifications());

      expect(result.current.callCount).toBe(0);

      act(() => {
        result.current.pushNotification({
          type: 'call',
          title: 'Call 1',
          body: 'Missed',
        });
      });

      expect(result.current.callCount).toBe(1);

      act(() => {
        result.current.pushNotification({
          type: 'message',
          title: 'Message 1',
          body: 'Should not count',
        });
      });

      expect(result.current.callCount).toBe(1); // Still 1, not 2

      act(() => {
        result.current.pushNotification({
          type: 'call',
          title: 'Call 2',
          body: 'Another missed',
        });
      });

      expect(result.current.callCount).toBe(2);
    });

    test('markRead decreases unreadCount', () => {
      const { result } = renderHook(() => useNotifications());

      act(() => {
        result.current.pushNotification({
          type: 'message',
          title: 'Test',
          body: 'Body',
        });
      });

      const notificationId = result.current.notifications[0].id;
      expect(result.current.unreadCount).toBe(1);

      act(() => {
        result.current.markRead(notificationId);
      });

      expect(result.current.unreadCount).toBe(0);
      expect(result.current.notifications[0].read).toBe(true);
    });

    test('markAllRead sets all notifications to read', () => {
      const { result } = renderHook(() => useNotifications());

      act(() => {
        result.current.pushNotification({
          type: 'message',
          title: 'Msg 1',
          body: 'Body 1',
        });
        result.current.pushNotification({
          type: 'call',
          title: 'Call 1',
          body: 'Body 2',
        });
        result.current.pushNotification({
          type: 'system',
          title: 'Sys 1',
          body: 'Body 3',
        });
      });

      expect(result.current.unreadCount).toBe(3);

      act(() => {
        result.current.markAllRead();
      });

      expect(result.current.unreadCount).toBe(0);
      expect(result.current.notifications.every(n => n.read)).toBe(true);
    });

    test('PROPERTY: Counting logic produces correct counts for any notification sequence', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              type: fc.constantFrom('message', 'call', 'system'),
              title: fc.string({ minLength: 1, maxLength: 20 }),
              body: fc.string({ minLength: 1, maxLength: 50 }),
            }),
            { minLength: 0, maxLength: 20 }
          ),
          (notifications) => {
            const { result } = renderHook(() => useNotifications());

            // Push all notifications
            act(() => {
              notifications.forEach(n => {
                result.current.pushNotification(n);
              });
            });

            // Calculate expected counts
            const expectedTotal = notifications.length;
            const expectedMessages = notifications.filter(n => n.type === 'message').length;
            const expectedCalls = notifications.filter(n => n.type === 'call').length;

            // Invariant: Counts match expectations
            expect(result.current.notifications.length).toBe(expectedTotal);
            expect(result.current.unreadCount).toBe(expectedTotal);
            expect(result.current.messageCount).toBe(expectedMessages);
            expect(result.current.callCount).toBe(expectedCalls);
            
            return true;
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  describe('Test 5: Badge Count Updates Work Correctly', () => {
    test('Badge count updates when unreadCount changes', () => {
      const { result } = renderHook(() => useNotifications());

      act(() => {
        result.current.pushNotification({
          type: 'message',
          title: 'Test',
          body: 'Body',
        });
      });

      // Fast-forward to let useEffect run
      act(() => {
        jest.runAllTimers();
      });

      expect(Notifications.setBadgeCountAsync).toHaveBeenCalledWith(1);
    });

    test('Badge count resets when all notifications marked read', () => {
      const { result } = renderHook(() => useNotifications());

      act(() => {
        result.current.pushNotification({
          type: 'message',
          title: 'Test 1',
          body: 'Body 1',
        });
        result.current.pushNotification({
          type: 'message',
          title: 'Test 2',
          body: 'Body 2',
        });
      });

      act(() => {
        jest.runAllTimers();
      });

      expect(Notifications.setBadgeCountAsync).toHaveBeenCalledWith(2);

      act(() => {
        result.current.markAllRead();
      });

      act(() => {
        jest.runAllTimers();
      });

      expect(Notifications.setBadgeCountAsync).toHaveBeenCalledWith(0);
    });

    test('PROPERTY: Badge count always equals unreadCount', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 10 }),
          (numNotifications) => {
            jest.clearAllMocks();
            const { result } = renderHook(() => useNotifications());

            // Push notifications
            act(() => {
              for (let i = 0; i < numNotifications; i++) {
                result.current.pushNotification({
                  type: 'message',
                  title: `Test ${i}`,
                  body: `Body ${i}`,
                });
              }
            });

            act(() => {
              jest.runAllTimers();
            });

            // Invariant: Badge count equals unreadCount
            const lastCall = (Notifications.setBadgeCountAsync as jest.Mock).mock.calls.slice(-1)[0];
            if (lastCall) {
              expect(lastCall[0]).toBe(result.current.unreadCount);
            }
            
            return true;
          }
        ),
        { numRuns: 10 }
      );
    });
  });

  describe('Test 6: Toast Auto-Dismiss Timer Works Correctly', () => {
    test('Toast auto-dismisses after 4 seconds', () => {
      const { result } = renderHook(() => useNotifications());

      act(() => {
        result.current.pushNotification({
          type: 'message',
          title: 'Test',
          body: 'Body',
        });
      });

      expect(result.current.toast).not.toBeNull();

      // Advance timers by 4 seconds
      act(() => {
        jest.advanceTimersByTime(4000);
      });

      expect(result.current.toast).toBeNull();
    });

    test('Toast can be manually dismissed before timer', () => {
      const { result } = renderHook(() => useNotifications());

      act(() => {
        result.current.pushNotification({
          type: 'message',
          title: 'Test',
          body: 'Body',
        });
      });

      expect(result.current.toast).not.toBeNull();

      act(() => {
        result.current.dismissToast();
      });

      expect(result.current.toast).toBeNull();
    });

    test('New toast replaces existing toast and resets timer', () => {
      const { result } = renderHook(() => useNotifications());

      act(() => {
        result.current.pushNotification({
          type: 'message',
          title: 'First',
          body: 'First body',
        });
      });

      expect(result.current.toast?.title).toBe('First');

      // Advance 2 seconds
      act(() => {
        jest.advanceTimersByTime(2000);
      });

      // Still showing first toast
      expect(result.current.toast?.title).toBe('First');

      // Push second notification
      act(() => {
        result.current.pushNotification({
          type: 'call',
          title: 'Second',
          body: 'Second body',
        });
      });

      // Now showing second toast
      expect(result.current.toast?.title).toBe('Second');

      // Advance 3 seconds (would have dismissed first toast)
      act(() => {
        jest.advanceTimersByTime(3000);
      });

      // Second toast still showing (timer was reset)
      expect(result.current.toast?.title).toBe('Second');

      // Advance 1 more second (total 4 seconds since second toast)
      act(() => {
        jest.advanceTimersByTime(1000);
      });

      // Now dismissed
      expect(result.current.toast).toBeNull();
    });

    test('PROPERTY: Toast always auto-dismisses after 4 seconds', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('message', 'call', 'system'),
          (type) => {
            const { result } = renderHook(() => useNotifications());

            act(() => {
              result.current.pushNotification({
                type: type as any,
                title: 'Test',
                body: 'Body',
              });
            });

            // Invariant: Toast visible immediately
            expect(result.current.toast).not.toBeNull();

            // Advance just before 4 seconds
            act(() => {
              jest.advanceTimersByTime(3999);
            });

            // Invariant: Still visible
            expect(result.current.toast).not.toBeNull();

            // Advance to exactly 4 seconds
            act(() => {
              jest.advanceTimersByTime(1);
            });

            // Invariant: Now dismissed
            expect(result.current.toast).toBeNull();
            
            return true;
          }
        ),
        { numRuns: 10 }
      );
    });
  });

  describe('Test 7: Notification Metadata Preserved', () => {
    test('Notification has unique ID', () => {
      const { result } = renderHook(() => useNotifications());

      act(() => {
        result.current.pushNotification({
          type: 'message',
          title: 'Test 1',
          body: 'Body 1',
        });
        result.current.pushNotification({
          type: 'message',
          title: 'Test 2',
          body: 'Body 2',
        });
      });

      const id1 = result.current.notifications[0].id;
      const id2 = result.current.notifications[1].id;

      expect(id1).toBeDefined();
      expect(id2).toBeDefined();
      expect(id1).not.toBe(id2);
    });

    test('Notification has formatted time', () => {
      const { result } = renderHook(() => useNotifications());

      act(() => {
        result.current.pushNotification({
          type: 'message',
          title: 'Test',
          body: 'Body',
        });
      });

      expect(result.current.notifications[0].time).toBeDefined();
      expect(typeof result.current.notifications[0].time).toBe('string');
      // Should show "Just now" for immediate notifications
      expect(result.current.notifications[0].time).toBe('Just now');
    });

    test('Notification starts as unread', () => {
      const { result } = renderHook(() => useNotifications());

      act(() => {
        result.current.pushNotification({
          type: 'message',
          title: 'Test',
          body: 'Body',
        });
      });

      expect(result.current.notifications[0].read).toBe(false);
    });

    test('PROPERTY: All notifications have required metadata fields', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('message', 'call', 'system'),
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.string({ minLength: 1, maxLength: 100 }),
          (type, title, body) => {
            const { result } = renderHook(() => useNotifications());

            act(() => {
              result.current.pushNotification({
                type: type as any,
                title,
                body,
              });
            });

            const notification = result.current.notifications[0];

            // Invariant: Required fields exist
            expect(notification.id).toBeDefined();
            expect(notification.time).toBeDefined();
            expect(notification.read).toBe(false);
            expect(notification.type).toBe(type);
            expect(notification.title).toBe(title);
            expect(notification.body).toBe(body);
            
            return true;
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  describe('Test 8: ClearAll Functionality Preserved', () => {
    test('clearAll removes all notifications', () => {
      const { result } = renderHook(() => useNotifications());

      act(() => {
        result.current.pushNotification({
          type: 'message',
          title: 'Test 1',
          body: 'Body 1',
        });
        result.current.pushNotification({
          type: 'call',
          title: 'Test 2',
          body: 'Body 2',
        });
        result.current.pushNotification({
          type: 'system',
          title: 'Test 3',
          body: 'Body 3',
        });
      });

      expect(result.current.notifications.length).toBe(3);

      act(() => {
        result.current.clearAll();
      });

      expect(result.current.notifications.length).toBe(0);
      expect(result.current.unreadCount).toBe(0);
      expect(result.current.messageCount).toBe(0);
      expect(result.current.callCount).toBe(0);
      
      // Note: Toast is not cleared by clearAll, it will auto-dismiss after 4s
    });

    test('PROPERTY: clearAll always resets to empty state', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 10 }),
          (numNotifications) => {
            const { result } = renderHook(() => useNotifications());

            // Push notifications
            act(() => {
              for (let i = 0; i < numNotifications; i++) {
                result.current.pushNotification({
                  type: 'message',
                  title: `Test ${i}`,
                  body: `Body ${i}`,
                });
              }
            });

            // Clear all
            act(() => {
              result.current.clearAll();
            });

            // Invariant: Notifications cleared
            expect(result.current.notifications).toHaveLength(0);
            expect(result.current.unreadCount).toBe(0);
            expect(result.current.messageCount).toBe(0);
            expect(result.current.callCount).toBe(0);
            
            // Note: Toast is independent and not cleared by clearAll
            // It will auto-dismiss after 4 seconds as normal behavior
            
            return true;
          }
        ),
        { numRuns: 10 }
      );
    });
  });
});
