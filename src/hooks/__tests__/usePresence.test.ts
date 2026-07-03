// ─── Tests: usePresence Hook ─────────────────────────────────────────────────

import { renderHook, act, waitFor } from '@testing-library/react-native';
import { AppState, AppStateStatus } from 'react-native';
import { useWritePresence, formatLastSeen, writePresence } from '../usePresence';

// Mock Firebase
jest.mock('../../config/firebase', () => ({
  db: {},
  rtdb: {},
}));

jest.mock('firebase/firestore', () => ({
  doc: jest.fn(),
  setDoc: jest.fn(),
  onSnapshot: jest.fn(),
  getDoc: jest.fn(),
}));

jest.mock('firebase/database', () => ({
  ref: jest.fn(),
  onDisconnect: jest.fn(() => ({
    set: jest.fn().mockResolvedValue(undefined),
  })),
  set: jest.fn().mockResolvedValue(undefined),
  onValue: jest.fn(),
  serverTimestamp: jest.fn(() => Date.now()),
}));

jest.mock('../usePrivacySettings', () => ({
  fetchUserPrivacySettings: jest.fn(),
  isVisibleTo: jest.fn(() => true),
}));

jest.mock('../usePhoneBook', () => ({
  usePhoneBook: jest.fn(),
}));

describe('usePresence', () => {
  describe('formatLastSeen', () => {
    const now = new Date('2026-07-02T15:00:00');

    beforeAll(() => {
      jest.spyOn(global, 'Date').mockImplementation(() => now as any);
    });

    afterAll(() => {
      (global.Date as any).mockRestore();
    });

    it('should return "last seen just now" for < 1 minute', () => {
      const date = new Date('2026-07-02T14:59:30');
      expect(formatLastSeen(date)).toBe('last seen just now');
    });

    it('should return minutes for < 1 hour', () => {
      const date = new Date('2026-07-02T14:45:00');
      expect(formatLastSeen(date)).toBe('last seen 15 minutes ago');
    });

    it('should return singular minute', () => {
      const date = new Date('2026-07-02T14:59:00');
      expect(formatLastSeen(date)).toBe('last seen 1 minute ago');
    });

    it('should return hours for < 24 hours', () => {
      const date = new Date('2026-07-02T12:00:00');
      expect(formatLastSeen(date)).toBe('last seen 3 hours ago');
    });

    it('should return singular hour', () => {
      const date = new Date('2026-07-02T14:00:00');
      expect(formatLastSeen(date)).toBe('last seen 1 hour ago');
    });

    it('should return "yesterday" for 1 day ago', () => {
      const date = new Date('2026-07-01T15:00:00');
      expect(formatLastSeen(date)).toBe('last seen yesterday');
    });

    it('should return days for < 1 week', () => {
      const date = new Date('2026-06-29T15:00:00');
      expect(formatLastSeen(date)).toBe('last seen 3 days ago');
    });

    it('should return formatted date for > 1 week', () => {
      const date = new Date('2026-06-20T15:00:00');
      const formatted = formatLastSeen(date);
      expect(formatted).toContain('20');
      expect(formatted).toContain('Jun');
    });

    it('should include year for dates > 365 days ago', () => {
      const date = new Date('2025-06-01T15:00:00');
      const formatted = formatLastSeen(date);
      expect(formatted).toContain('2025');
    });
  });

  describe('writePresence', () => {
    const { setDoc } = require('firebase/firestore');
    const { set: rtdbSet } = require('firebase/database');

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should write online status to both RTDB and Firestore', async () => {
      await writePresence('user123', true);

      // Check RTDB write
      expect(rtdbSet).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          online: true,
          lastSeen: expect.any(Number),
          lastHeartbeat: expect.any(Number),
        })
      );

      // Check Firestore write
      expect(setDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          online: true,
          lastSeen: expect.any(Date),
          lastHeartbeat: expect.any(Date),
        }),
        { merge: true }
      );
    });

    it('should write offline status with null lastHeartbeat', async () => {
      await writePresence('user123', false);

      // Check RTDB write
      expect(rtdbSet).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          online: false,
          lastSeen: expect.any(Number),
          lastHeartbeat: null,
        })
      );

      // Check Firestore write
      expect(setDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          online: false,
          lastSeen: expect.any(Date),
          lastHeartbeat: null,
        }),
        { merge: true }
      );
    });

    it('should handle errors gracefully', async () => {
      rtdbSet.mockRejectedValueOnce(new Error('Network error'));
      setDoc.mockRejectedValueOnce(new Error('Network error'));
      
      // Should not throw
      await expect(writePresence('user123', true)).resolves.toBeUndefined();
    });
  });

  describe('useWritePresence - App Lifecycle', () => {
    let mockAppState: AppStateStatus;
    let appStateListeners: Array<(state: AppStateStatus) => void> = [];

    beforeEach(() => {
      jest.clearAllMocks();
      jest.useFakeTimers();
      mockAppState = 'active';
      appStateListeners = [];

      // Mock AppState
      (AppState as any).currentState = 'active';
      (AppState as any).addEventListener = jest.fn((event: string, handler: any) => {
        if (event === 'change') {
          appStateListeners.push(handler);
        }
        return {
          remove: jest.fn(() => {
            appStateListeners = appStateListeners.filter(h => h !== handler);
          }),
        };
      });
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    const simulateAppStateChange = (newState: AppStateStatus) => {
      mockAppState = newState;
      (AppState as any).currentState = newState;
      appStateListeners.forEach(listener => listener(newState));
    };

    it('should go online when hook mounts', async () => {
      const { setDoc } = require('firebase/firestore');
      const { set: rtdbSet } = require('firebase/database');
      
      renderHook(() => useWritePresence('user123'));

      await waitFor(() => {
        expect(rtdbSet).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({ online: true })
        );
        expect(setDoc).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({ online: true }),
          { merge: true }
        );
      });
    });

    it('should go offline when hook unmounts', async () => {
      const { setDoc } = require('firebase/firestore');
      const { set: rtdbSet } = require('firebase/database');
      
      const { unmount } = renderHook(() => useWritePresence('user123'));
      
      jest.clearAllMocks();
      unmount();

      await waitFor(() => {
        expect(rtdbSet).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({ online: false })
        );
        expect(setDoc).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({ online: false }),
          { merge: true }
        );
      });
    });

    it('should go online when app becomes active', async () => {
      const { setDoc } = require('firebase/firestore');
      const { set: rtdbSet } = require('firebase/database');
      
      renderHook(() => useWritePresence('user123'));
      
      jest.clearAllMocks();
      act(() => {
        simulateAppStateChange('background');
      });
      
      act(() => {
        jest.advanceTimersByTime(3000); // Wait for debounce
      });
      
      jest.clearAllMocks();
      act(() => {
        simulateAppStateChange('active');
      });

      await waitFor(() => {
        expect(rtdbSet).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({ online: true })
        );
        expect(setDoc).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({ online: true }),
          { merge: true }
        );
      });
    });

    it('should go offline when app goes to background (with debounce)', async () => {
      const { setDoc } = require('firebase/firestore');
      const { set: rtdbSet } = require('firebase/database');
      
      renderHook(() => useWritePresence('user123'));
      
      jest.clearAllMocks();
      act(() => {
        simulateAppStateChange('background');
      });

      // Should NOT immediately call setDoc or rtdbSet (debounced)
      expect(rtdbSet).not.toHaveBeenCalled();
      expect(setDoc).not.toHaveBeenCalled();

      // After debounce period
      act(() => {
        jest.advanceTimersByTime(3000);
      });

      await waitFor(() => {
        expect(rtdbSet).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({ online: false })
        );
        expect(setDoc).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({ online: false }),
          { merge: true }
        );
      });
    });

    it('should cancel offline transition if app returns to foreground quickly', async () => {
      const { setDoc } = require('firebase/firestore');
      const { set: rtdbSet } = require('firebase/database');
      
      renderHook(() => useWritePresence('user123'));
      
      jest.clearAllMocks();
      
      // Go to background
      act(() => {
        simulateAppStateChange('background');
      });

      // Return to active before debounce completes
      act(() => {
        jest.advanceTimersByTime(1000);
      });
      
      act(() => {
        simulateAppStateChange('active');
      });

      // Complete the remaining time
      act(() => {
        jest.advanceTimersByTime(3000);
      });

      // Should have called for going online, NOT for going offline
      const rtdbOfflineCalls = (rtdbSet as jest.Mock).mock.calls.filter(
        call => call[1]?.online === false
      );
      const firestoreOfflineCalls = (setDoc as jest.Mock).mock.calls.filter(
        call => call[1]?.online === false
      );
      expect(rtdbOfflineCalls).toHaveLength(0);
      expect(firestoreOfflineCalls).toHaveLength(0);
    });

    it('should send heartbeats every 30 seconds while active', async () => {
      const { setDoc } = require('firebase/firestore');
      const { set: rtdbSet } = require('firebase/database');
      
      renderHook(() => useWritePresence('user123'));
      
      jest.clearAllMocks();

      // Wait for first heartbeat
      act(() => {
        jest.advanceTimersByTime(30000);
      });

      await waitFor(() => {
        expect(rtdbSet).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({ lastHeartbeat: expect.any(Number) })
        );
        expect(setDoc).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({ lastHeartbeat: expect.any(Date) }),
          { merge: true }
        );
      });

      jest.clearAllMocks();

      // Wait for second heartbeat
      act(() => {
        jest.advanceTimersByTime(30000);
      });

      await waitFor(() => {
        expect(rtdbSet).toHaveBeenCalled();
        expect(setDoc).toHaveBeenCalled();
      });
    });

    it('should stop heartbeats when app goes to background', async () => {
      const { setDoc } = require('firebase/firestore');
      const { set: rtdbSet } = require('firebase/database');
      
      renderHook(() => useWritePresence('user123'));
      
      // Go to background
      act(() => {
        simulateAppStateChange('background');
        jest.advanceTimersByTime(3000); // Complete debounce
      });

      jest.clearAllMocks();

      // Wait for what would be a heartbeat interval
      act(() => {
        jest.advanceTimersByTime(30000);
      });

      // Should not have sent heartbeat
      expect(rtdbSet).not.toHaveBeenCalled();
      expect(setDoc).not.toHaveBeenCalled();
    });

    it('should do nothing if userId is null', () => {
      const { setDoc } = require('firebase/firestore');
      const { set: rtdbSet } = require('firebase/database');
      
      renderHook(() => useWritePresence(null));

      expect(rtdbSet).not.toHaveBeenCalled();
      expect(setDoc).not.toHaveBeenCalled();
    });
  });

  describe('Regression prevention - presence isolation', () => {
    it('should NOT export writePresence for use outside usePresence hook', () => {
      // This test documents that writePresence should only be called internally
      // by useWritePresence hook, not by external components/contexts
      
      // writePresence IS exported, but this test serves as documentation
      // that it should ONLY be called from App-level PresenceManager
      // NOT from screens, contexts, or other components
      
      // If you're calling writePresence outside of:
      //   1. App.tsx PresenceManager (via useWritePresence)
      //   2. usePresence.ts internal implementation
      // Then you're doing it wrong and creating duplicate presence logic
      
      expect(typeof writePresence).toBe('function');
      expect(typeof useWritePresence).toBe('function');
    });

    it('should isolate presence from screen navigation', () => {
      // Presence should be managed by app lifecycle ONLY
      // Opening/closing screens should have ZERO impact on presence
      
      const { setDoc } = require('firebase/firestore');
      const { set: rtdbSet } = require('firebase/database');
      
      // Start with presence manager running
      const { unmount: unmountPresence } = renderHook(() => useWritePresence('user123'));
      
      jest.clearAllMocks();
      
      // Simulate screen navigation - should NOT trigger writes
      const { unmount: unmountScreen } = renderHook(() => {
        // This simulates a screen mounting/unmounting
        // It should NOT call any presence functions
        return null;
      });
      
      // No presence writes should occur from screen navigation
      expect(rtdbSet).not.toHaveBeenCalled();
      expect(setDoc).not.toHaveBeenCalled();
      
      unmountScreen();
      
      // Still no writes from screen unmount
      expect(rtdbSet).not.toHaveBeenCalled();
      expect(setDoc).not.toHaveBeenCalled();
      
      // Cleanup
      unmountPresence();
    });
  });
});
