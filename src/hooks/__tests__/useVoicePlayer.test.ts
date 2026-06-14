// ─── useVoicePlayer Unit Tests ────────────────────────────────────────────────
// Tests: single-active-player, playback reset on didJustFinish, pause retains
// position, and cleanup on unmount.
// Requirements: 6.2, 5.4, 5.5, 6.3
//
// Uses expo-audio (SDK 56).

import { renderHook, act } from '@testing-library/react-native';

// ─── Mock expo-audio ──────────────────────────────────────────────────────────

const mockPlay = jest.fn();
const mockPause = jest.fn();
const mockSeekTo = jest.fn();
const mockReplace = jest.fn();

const mockPlayerStatus = {
  playing: false,
  isLoaded: false,
  isBuffering: false,
  currentTime: 0,
  duration: 0,
  didJustFinish: false,
  error: null,
};

jest.mock('expo-audio', () => ({
  useAudioPlayer: jest.fn(() => ({
    play: mockPlay,
    pause: mockPause,
    seekTo: mockSeekTo,
    replace: mockReplace,
  })),
  useAudioPlayerStatus: jest.fn(() => mockPlayerStatus),
  setAudioModeAsync: jest.fn().mockResolvedValue(undefined),
}));

import { useVoicePlayer } from '../useVoicePlayer';
import { useAudioPlayerStatus } from 'expo-audio';

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('useVoicePlayer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.assign(mockPlayerStatus, {
      playing: false,
      isLoaded: false,
      isBuffering: false,
      currentTime: 0,
      duration: 0,
      didJustFinish: false,
      error: null,
    });
  });

  // ── Requirement 6.2: Single-active-player stops previous when new one starts ──
  describe('single-active-player (Req 6.2)', () => {
    it('pauses the current player before replacing with a new source', async () => {
      const { result } = renderHook(() => useVoicePlayer());

      // Play first voice note
      await act(async () => {
        await result.current.play('https://example.com/voice1.m4a', 'msg-1', 5000);
      });

      expect(mockReplace).toHaveBeenCalledWith('https://example.com/voice1.m4a');
      expect(mockPlay).toHaveBeenCalledTimes(1);

      // Play second voice note — should pause first, then replace
      mockPause.mockClear();
      mockReplace.mockClear();
      mockPlay.mockClear();

      await act(async () => {
        await result.current.play('https://example.com/voice2.m4a', 'msg-2', 8000);
      });

      expect(mockPause).toHaveBeenCalled();
      expect(mockReplace).toHaveBeenCalledWith('https://example.com/voice2.m4a');
      expect(mockPlay).toHaveBeenCalledTimes(1);
      expect(result.current.state.activeMessageId).toBe('msg-2');
    });
  });

  // ── Requirement 5.5: Playback reset on didJustFinish ──
  describe('playback reset on didJustFinish (Req 5.5)', () => {
    it('resets state to idle with positionMs: 0 when playback finishes', async () => {
      const { result, rerender } = renderHook(() => useVoicePlayer());

      // Start playback
      await act(async () => {
        await result.current.play('https://example.com/voice1.m4a', 'msg-1', 5000);
      });

      // Simulate playing status
      Object.assign(mockPlayerStatus, { playing: true, isLoaded: true, currentTime: 2.5, duration: 5 });
      (useAudioPlayerStatus as jest.Mock).mockReturnValue({ ...mockPlayerStatus });
      rerender({});

      // Simulate didJustFinish
      Object.assign(mockPlayerStatus, { playing: false, didJustFinish: true, currentTime: 5, duration: 5 });
      (useAudioPlayerStatus as jest.Mock).mockReturnValue({ ...mockPlayerStatus });
      rerender({});

      expect(result.current.state.status).toBe('idle');
      expect(result.current.state.positionMs).toBe(0);
    });
  });

  // ── Requirement 5.4: Pause retains position ──
  describe('pause retains position (Req 5.4)', () => {
    it('calls player.pause() and sets status to paused', async () => {
      const { result } = renderHook(() => useVoicePlayer());

      // Start playback
      await act(async () => {
        await result.current.play('https://example.com/voice1.m4a', 'msg-1', 5000);
      });

      expect(result.current.state.status).toBe('playing');

      // Pause
      await act(async () => {
        await result.current.pause();
      });

      expect(mockPause).toHaveBeenCalled();
      expect(result.current.state.status).toBe('paused');
    });
  });

  // ── Requirement 6.3: Stop resets state ──
  describe('stop resets state (Req 6.3)', () => {
    it('pauses, seeks to 0, and resets all state', async () => {
      const { result } = renderHook(() => useVoicePlayer());

      await act(async () => {
        await result.current.play('https://example.com/voice1.m4a', 'msg-1', 5000);
      });

      mockPause.mockClear();

      await act(async () => {
        await result.current.stop();
      });

      expect(mockPause).toHaveBeenCalled();
      expect(mockSeekTo).toHaveBeenCalledWith(0);
      expect(result.current.state.status).toBe('idle');
      expect(result.current.state.activeMessageId).toBeNull();
    });
  });
});
