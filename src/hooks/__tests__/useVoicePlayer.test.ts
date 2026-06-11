// ─── useVoicePlayer Unit Tests ────────────────────────────────────────────────
// Tests: single-active-player, playback reset on didJustFinish, pause retains
// position, and cleanup on unmount.
// Requirements: 6.2, 5.4, 5.5, 6.3

import { renderHook, act } from '@testing-library/react-native';

// ─── Mock expo-av ─────────────────────────────────────────────────────────────

const mockPlayAsync = jest.fn().mockResolvedValue({});
const mockPauseAsync = jest.fn().mockResolvedValue({});
const mockStopAsync = jest.fn().mockResolvedValue({});
const mockUnloadAsync = jest.fn().mockResolvedValue({});
const mockSetOnPlaybackStatusUpdate = jest.fn();

let capturedOnPlaybackStatusUpdate: ((status: any) => void) | null = null;

const mockCreateAsync = jest.fn().mockImplementation(
  (_source: any, _initialStatus: any, onPlaybackStatusUpdate?: any) => {
    capturedOnPlaybackStatusUpdate = onPlaybackStatusUpdate ?? null;
    return Promise.resolve({
      sound: {
        playAsync: mockPlayAsync,
        pauseAsync: mockPauseAsync,
        stopAsync: mockStopAsync,
        unloadAsync: mockUnloadAsync,
        setOnPlaybackStatusUpdate: mockSetOnPlaybackStatusUpdate,
      },
    });
  }
);

const mockSetAudioModeAsync = jest.fn().mockResolvedValue({});

jest.mock('expo-av', () => ({
  Audio: {
    Sound: {
      createAsync: (...args: any[]) => mockCreateAsync(...args),
    },
    setAudioModeAsync: (...args: any[]) => mockSetAudioModeAsync(...args),
  },
  InterruptionModeIOS: {
    MixWithOthers: 0,
    DoNotMix: 1,
    DuckOthers: 2,
  },
  InterruptionModeAndroid: {
    DoNotMix: 1,
    DuckOthers: 2,
  },
}));

import { useVoicePlayer } from '../useVoicePlayer';

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('useVoicePlayer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    capturedOnPlaybackStatusUpdate = null;
  });

  // ── Requirement 6.2: Single-active-player stops previous when new one starts ──
  describe('single-active-player (Req 6.2)', () => {
    it('stops and unloads the first sound before playing a second', async () => {
      const { result } = renderHook(() => useVoicePlayer());

      // Play first voice note
      await act(async () => {
        await result.current.play('https://example.com/voice1.m4a', 'msg-1', 5000);
      });

      expect(mockCreateAsync).toHaveBeenCalledTimes(1);

      // Play second voice note — should stop the first
      await act(async () => {
        await result.current.play('https://example.com/voice2.m4a', 'msg-2', 8000);
      });

      // First sound's stopAsync and unloadAsync should have been called
      expect(mockStopAsync).toHaveBeenCalled();
      expect(mockUnloadAsync).toHaveBeenCalled();
      // Second sound was created
      expect(mockCreateAsync).toHaveBeenCalledTimes(2);
    });
  });

  // ── Requirement 5.5: Playback reset on didJustFinish ──
  describe('playback reset on didJustFinish (Req 5.5)', () => {
    it('resets state to idle with positionMs: 0 when playback finishes', async () => {
      const { result } = renderHook(() => useVoicePlayer());

      // Start playback
      await act(async () => {
        await result.current.play('https://example.com/voice1.m4a', 'msg-1', 5000);
      });

      expect(result.current.state.status).toBe('playing');

      // Simulate playback finishing
      await act(async () => {
        capturedOnPlaybackStatusUpdate?.({
          isLoaded: true,
          didJustFinish: true,
          isPlaying: false,
          positionMillis: 5000,
          durationMillis: 5000,
        });
      });

      expect(result.current.state.status).toBe('idle');
      expect(result.current.state.positionMs).toBe(0);
    });
  });

  // ── Requirement 5.4: Pause retains position ──
  describe('pause retains position (Req 5.4)', () => {
    it('calls pauseAsync and sets status to paused', async () => {
      const { result } = renderHook(() => useVoicePlayer());

      // Start playback
      await act(async () => {
        await result.current.play('https://example.com/voice1.m4a', 'msg-1', 5000);
      });

      // Simulate some progress
      await act(async () => {
        capturedOnPlaybackStatusUpdate?.({
          isLoaded: true,
          didJustFinish: false,
          isPlaying: true,
          positionMillis: 2500,
          durationMillis: 5000,
        });
      });

      expect(result.current.state.status).toBe('playing');
      expect(result.current.state.positionMs).toBe(2500);

      // Pause
      await act(async () => {
        await result.current.pause();
      });

      expect(mockPauseAsync).toHaveBeenCalledTimes(1);
      expect(result.current.state.status).toBe('paused');
    });
  });

  // ── Requirement 6.3: Cleanup on unmount ──
  describe('cleanup on unmount (Req 6.3)', () => {
    it('calls unloadAsync on the sound when the hook unmounts', async () => {
      const { result, unmount } = renderHook(() => useVoicePlayer());

      // Start playback to create a sound instance
      await act(async () => {
        await result.current.play('https://example.com/voice1.m4a', 'msg-1', 5000);
      });

      // Clear previous calls to unloadAsync (from any internal cleanup)
      mockUnloadAsync.mockClear();

      // Unmount the hook
      unmount();

      // unloadAsync should be called during cleanup
      expect(mockUnloadAsync).toHaveBeenCalled();
    });
  });
});
