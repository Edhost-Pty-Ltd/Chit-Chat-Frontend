// ─── useVoiceRecorder Unit Tests ──────────────────────────────────────────────
// Tests: minimum duration returns null, permission denied state, auto-stop at
// 120s, and warning state at 110s.
// Requirements: 1.4, 2.3, 8.1, 8.2

import React from 'react';
import { act, create, ReactTestRenderer } from 'react-test-renderer';

// ─── Mock expo-av ─────────────────────────────────────────────────────────────

const mockStopAndUnloadAsync = jest.fn().mockResolvedValue({ durationMillis: 500 });
const mockGetURI = jest.fn().mockReturnValue('file:///tmp/recording.m4a');

let capturedOnRecordingStatusUpdate: ((status: any) => void) | null = null;

const mockCreateAsync = jest.fn().mockImplementation(
  (_options: any, onRecordingStatusUpdate?: any, _progressUpdateIntervalMs?: any) => {
    capturedOnRecordingStatusUpdate = onRecordingStatusUpdate ?? null;
    return Promise.resolve({
      recording: {
        stopAndUnloadAsync: mockStopAndUnloadAsync,
        getURI: mockGetURI,
      },
    });
  }
);

const mockRequestPermissionsAsync = jest.fn().mockResolvedValue({
  granted: true,
  canAskAgain: true,
});

const mockSetAudioModeAsync = jest.fn().mockResolvedValue({});

jest.mock('expo-av', () => ({
  Audio: {
    requestPermissionsAsync: (...args: any[]) => mockRequestPermissionsAsync(...args),
    Recording: {
      createAsync: (...args: any[]) => mockCreateAsync(...args),
    },
    RecordingOptionsPresets: {
      HIGH_QUALITY: { android: {}, ios: {}, web: {} },
    },
    setAudioModeAsync: (...args: any[]) => mockSetAudioModeAsync(...args),
  },
}));

import { useVoiceRecorder, UseVoiceRecorderReturn } from '../useVoiceRecorder';

// ─── Minimal renderHook for node environment ──────────────────────────────────

function renderHook<T>(hookFn: () => T): { result: { current: T } } {
  const result: { current: T } = {} as any;

  function TestComponent() {
    result.current = hookFn();
    return null;
  }

  let renderer: ReactTestRenderer;
  act(() => {
    renderer = create(React.createElement(TestComponent));
  });

  return { result };
}

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('useVoiceRecorder', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    capturedOnRecordingStatusUpdate = null;
    mockStopAndUnloadAsync.mockResolvedValue({ durationMillis: 500 });
    mockGetURI.mockReturnValue('file:///tmp/recording.m4a');
    mockRequestPermissionsAsync.mockResolvedValue({ granted: true, canAskAgain: true });
  });

  // ── Helper: start recording to get into recording state ──
  async function startRecordingHelper(result: { current: UseVoiceRecorderReturn }) {
    await act(async () => {
      await result.current.startRecording();
    });
  }

  // ── Requirement 1.4: Recording shorter than 1 second returns null ──
  describe('minimum duration check (Req 1.4)', () => {
    it('returns null from stopRecording when duration < 1000ms', async () => {
      mockStopAndUnloadAsync.mockResolvedValue({ durationMillis: 500 });

      const { result } = renderHook(() => useVoiceRecorder());

      // Start recording
      await startRecordingHelper(result);
      expect(result.current.state.status).toBe('recording');

      // Stop recording — duration is 500ms (below 1000ms threshold)
      let recordingResult: any;
      await act(async () => {
        recordingResult = await result.current.stopRecording();
      });

      expect(recordingResult).toBeNull();
      expect(result.current.state.status).toBe('idle');
    });

    it('returns a RecordingResult when duration >= 1000ms', async () => {
      mockStopAndUnloadAsync.mockResolvedValue({ durationMillis: 3000 });

      const { result } = renderHook(() => useVoiceRecorder());

      await startRecordingHelper(result);

      let recordingResult: any;
      await act(async () => {
        recordingResult = await result.current.stopRecording();
      });

      expect(recordingResult).not.toBeNull();
      expect(recordingResult.uri).toBe('file:///tmp/recording.m4a');
      expect(recordingResult.durationMs).toBe(3000);
      expect(result.current.state.status).toBe('stopped');
    });
  });

  // ── Requirement 2.3: Permission denied state ──
  describe('permission denied state (Req 2.3)', () => {
    it('sets permissionDenied when user denies permission', async () => {
      mockRequestPermissionsAsync.mockResolvedValue({
        granted: false,
        canAskAgain: true,
      });

      const { result } = renderHook(() => useVoiceRecorder());

      await act(async () => {
        await result.current.startRecording();
      });

      expect(result.current.state.permissionDenied).toBe(true);
      expect(result.current.state.permissionDeniedPermanently).toBe(false);
      expect(result.current.state.status).toBe('idle');
    });

    it('sets permissionDeniedPermanently when canAskAgain is false', async () => {
      mockRequestPermissionsAsync.mockResolvedValue({
        granted: false,
        canAskAgain: false,
      });

      const { result } = renderHook(() => useVoiceRecorder());

      await act(async () => {
        await result.current.startRecording();
      });

      expect(result.current.state.permissionDenied).toBe(true);
      expect(result.current.state.permissionDeniedPermanently).toBe(true);
      expect(result.current.state.status).toBe('idle');
    });
  });

  // ── Requirement 8.1: Auto-stop at 120 seconds ──
  describe('auto-stop at 120 seconds (Req 8.1)', () => {
    it('automatically stops recording when duration reaches 120000ms', async () => {
      mockStopAndUnloadAsync.mockResolvedValue({ durationMillis: 120000 });

      const { result } = renderHook(() => useVoiceRecorder());

      await startRecordingHelper(result);
      expect(result.current.state.status).toBe('recording');

      // Simulate the recording status update at 120000ms
      await act(async () => {
        capturedOnRecordingStatusUpdate?.({
          isRecording: true,
          durationMillis: 120000,
          metering: -30,
        });
      });

      // The hook should have called stopAndUnloadAsync for auto-stop
      expect(mockStopAndUnloadAsync).toHaveBeenCalled();
    });
  });

  // ── Requirement 8.2: Warning state at 110 seconds ──
  describe('warning state at 110 seconds (Req 8.2)', () => {
    it('sets isWarning to true when duration reaches 110000ms', async () => {
      const { result } = renderHook(() => useVoiceRecorder());

      await startRecordingHelper(result);
      expect(result.current.state.isWarning).toBe(false);

      // Simulate status update at 110000ms
      await act(async () => {
        capturedOnRecordingStatusUpdate?.({
          isRecording: true,
          durationMillis: 110000,
          metering: -25,
        });
      });

      expect(result.current.state.isWarning).toBe(true);
      expect(result.current.state.durationMs).toBe(110000);
    });

    it('isWarning remains false when duration is below 110000ms', async () => {
      const { result } = renderHook(() => useVoiceRecorder());

      await startRecordingHelper(result);

      // Simulate status update at 60000ms
      await act(async () => {
        capturedOnRecordingStatusUpdate?.({
          isRecording: true,
          durationMillis: 60000,
          metering: -20,
        });
      });

      expect(result.current.state.isWarning).toBe(false);
      expect(result.current.state.durationMs).toBe(60000);
    });
  });
});
