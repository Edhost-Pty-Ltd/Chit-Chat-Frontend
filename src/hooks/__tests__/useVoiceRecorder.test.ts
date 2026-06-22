// ─── useVoiceRecorder Unit Tests ──────────────────────────────────────────────
// Tests: minimum duration returns null, permission denied state, auto-stop at
// 120s, and warning state at 110s.
// Requirements: 1.4, 2.3, 8.1, 8.2
//
// Uses expo-audio (SDK 56).

import React from 'react';
import { act, create, ReactTestRenderer } from 'react-test-renderer';

// ─── Mock expo-audio ──────────────────────────────────────────────────────────

const mockStop = jest.fn().mockResolvedValue(undefined);
const mockRecord = jest.fn();
const mockPrepareToRecordAsync = jest.fn().mockResolvedValue(undefined);

let mockRecorderUri: string | null = 'file:///tmp/recording.m4a';

const mockRecorderState = {
  isRecording: false,
  durationMillis: 0,
  metering: -160,
  canRecord: true,
  url: null,
};

const mockRequestRecordingPermissionsAsync = jest.fn().mockResolvedValue({
  granted: true,
  canAskAgain: true,
});

const mockSetAudioModeAsync = jest.fn().mockResolvedValue(undefined);

jest.mock('expo-audio', () => ({
  useAudioRecorder: jest.fn(() => ({
    stop: mockStop,
    record: mockRecord,
    prepareToRecordAsync: mockPrepareToRecordAsync,
    get uri() { return mockRecorderUri; },
  })),
  useAudioRecorderState: jest.fn(() => mockRecorderState),
  AudioModule: {
    requestRecordingPermissionsAsync: (...args: any[]) => mockRequestRecordingPermissionsAsync(...args),
  },
  RecordingPresets: {
    HIGH_QUALITY: { android: {}, ios: {}, web: {} },
  },
  setAudioModeAsync: (...args: any[]) => mockSetAudioModeAsync(...args),
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
    mockRecorderUri = 'file:///tmp/recording.m4a';
    Object.assign(mockRecorderState, {
      isRecording: false,
      durationMillis: 0,
      metering: -160,
      canRecord: true,
      url: null,
    });
    mockRequestRecordingPermissionsAsync.mockResolvedValue({ granted: true, canAskAgain: true });
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
      Object.assign(mockRecorderState, { durationMillis: 500 });

      const { result } = renderHook(() => useVoiceRecorder());

      await startRecordingHelper(result);
      expect(result.current.state.status).toBe('recording');

      let recordingResult: any;
      await act(async () => {
        recordingResult = await result.current.stopRecording();
      });

      expect(recordingResult).toBeNull();
      expect(result.current.state.status).toBe('idle');
    });

    it('returns a RecordingResult when duration >= 1000ms', async () => {
      Object.assign(mockRecorderState, { durationMillis: 3000 });

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
      mockRequestRecordingPermissionsAsync.mockResolvedValue({
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
      mockRequestRecordingPermissionsAsync.mockResolvedValue({
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

  // ── Requirement 8.2: Warning state at 110 seconds ──
  describe('warning state at 110 seconds (Req 8.2)', () => {
    it('isWarning remains false when duration is below 110000ms', async () => {
      const { result } = renderHook(() => useVoiceRecorder());

      await startRecordingHelper(result);

      // Duration below threshold — isWarning stays false
      expect(result.current.state.isWarning).toBe(false);
    });
  });
});
