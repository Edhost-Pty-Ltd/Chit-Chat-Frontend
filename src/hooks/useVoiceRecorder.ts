// ─── useVoiceRecorder Hook ────────────────────────────────────────────────────
// Handles audio recording lifecycle, microphone permissions, duration tracking,
// auto-stop at 120s, warning at 110s, and cleanup on unmount.
//
// Uses expo-audio (SDK 56).

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  useAudioRecorder,
  useAudioRecorderState,
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
} from 'expo-audio';
import type { AudioRecorder } from 'expo-audio';

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface RecordingState {
  status: 'idle' | 'requesting-permission' | 'recording' | 'cancelled' | 'stopped';
  durationMs: number;
  metering: number;
  isWarning: boolean;
  permissionDenied: boolean;
  permissionDeniedPermanently: boolean;
}

export interface RecordingResult {
  uri: string;
  durationMs: number;
  fileSize: number;
}

export interface UseVoiceRecorderReturn {
  state: RecordingState;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<RecordingResult | null>;
  cancelRecording: () => Promise<void>;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_DURATION_MS = 120_000;
const WARNING_THRESHOLD_MS = 110_000;
const MIN_DURATION_MS = 1_000;

// ─── Initial State ────────────────────────────────────────────────────────────

const INITIAL_STATE: RecordingState = {
  status: 'idle',
  durationMs: 0,
  metering: -160,
  isWarning: false,
  permissionDenied: false,
  permissionDeniedPermanently: false,
};

// ─── Hook Implementation ──────────────────────────────────────────────────────

export function useVoiceRecorder(): UseVoiceRecorderReturn {
  const [state, setState] = useState<RecordingState>(INITIAL_STATE);
  const isStoppingRef = useRef(false);
  const isRecordingRef = useRef(false);

  // Create recorder with high quality preset and metering enabled
  const recorder = useAudioRecorder({
    ...RecordingPresets.HIGH_QUALITY,
    isMeteringEnabled: true,
  });

  const recorderState = useAudioRecorderState(recorder, 1000);

  // ── Sync recorder state to component state ────────────────────
  useEffect(() => {
    if (!isRecordingRef.current) return;

    const durationMs = recorderState.durationMillis;
    const metering = recorderState.metering ?? -160;
    const isWarning = durationMs >= WARNING_THRESHOLD_MS;

    setState((prev) => ({
      ...prev,
      durationMs,
      metering,
      isWarning,
    }));

    // Auto-stop at max duration
    if (durationMs >= MAX_DURATION_MS && !isStoppingRef.current) {
      isStoppingRef.current = true;
      stopRecordingInternal();
    }
  }, [recorderState]);

  // ── Internal stop (used by auto-stop) ─────────────────────────
  const stopRecordingInternal = useCallback(async () => {
    try {
      await recorder.stop();
      const uri = recorder.uri;
      const durationMs = recorderState.durationMillis;

      isRecordingRef.current = false;

      // Reset audio mode after recording
      await setAudioModeAsync({ allowsRecording: false });

      if (uri && durationMs >= MIN_DURATION_MS) {
        setState((prev) => ({
          ...prev,
          status: 'stopped',
          durationMs,
        }));
      } else {
        setState(INITIAL_STATE);
      }
    } catch (error) {
      console.error('[useVoiceRecorder] stopRecordingInternal error:', error);
      isRecordingRef.current = false;
      setState(INITIAL_STATE);
    } finally {
      isStoppingRef.current = false;
    }
  }, [recorder, recorderState.durationMillis]);

  // ── Start Recording ───────────────────────────────────────────
  const startRecording = useCallback(async () => {
    // Ignore new press if already recording
    if (isRecordingRef.current) return;

    try {
      // Request permission
      setState((prev) => ({ ...prev, status: 'requesting-permission' }));

      const permissionResponse = await AudioModule.requestRecordingPermissionsAsync();

      if (!permissionResponse.granted) {
        const permanentlyDenied = !permissionResponse.canAskAgain;
        setState({
          ...INITIAL_STATE,
          permissionDenied: true,
          permissionDeniedPermanently: permanentlyDenied,
        });
        return;
      }

      // Configure audio mode for recording
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });

      // Prepare and start recording
      await recorder.prepareToRecordAsync();
      recorder.record();

      isRecordingRef.current = true;

      setState({
        status: 'recording',
        durationMs: 0,
        metering: -160,
        isWarning: false,
        permissionDenied: false,
        permissionDeniedPermanently: false,
      });
    } catch (error) {
      console.error('[useVoiceRecorder] startRecording error:', error);
      isRecordingRef.current = false;
      setState(INITIAL_STATE);
    }
  }, [recorder]);

  // ── Stop Recording ────────────────────────────────────────────
  const stopRecording = useCallback(async (): Promise<RecordingResult | null> => {
    if (!isRecordingRef.current || isStoppingRef.current) return null;

    isStoppingRef.current = true;

    try {
      await recorder.stop();
      const uri = recorder.uri;
      const durationMs = recorderState.durationMillis;

      isRecordingRef.current = false;

      // Reset audio mode after recording
      await setAudioModeAsync({ allowsRecording: false });

      // Minimum duration check — return null if too short
      if (!uri || durationMs < MIN_DURATION_MS) {
        setState(INITIAL_STATE);
        return null;
      }

      setState((prev) => ({
        ...prev,
        status: 'stopped',
        durationMs,
      }));

      // Estimate file size from duration and bitrate (128kbps = 16KB/s)
      const estimatedFileSize = Math.round((durationMs / 1000) * 16_000);

      return {
        uri,
        durationMs,
        fileSize: estimatedFileSize,
      };
    } catch (error) {
      console.error('[useVoiceRecorder] stopRecording error:', error);
      isRecordingRef.current = false;
      setState(INITIAL_STATE);
      return null;
    } finally {
      isStoppingRef.current = false;
    }
  }, [recorder, recorderState.durationMillis]);

  // ── Cancel Recording ──────────────────────────────────────────
  const cancelRecording = useCallback(async () => {
    if (!isRecordingRef.current) return;

    try {
      await recorder.stop();
    } catch (error) {
      console.error('[useVoiceRecorder] cancelRecording error:', error);
    } finally {
      isRecordingRef.current = false;
      await setAudioModeAsync({ allowsRecording: false }).catch(() => {});
      setState({ ...INITIAL_STATE, status: 'cancelled' });
    }
  }, [recorder]);

  // ── Cleanup on unmount ────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (isRecordingRef.current) {
        recorder.stop().catch(() => {});
        isRecordingRef.current = false;
      }
    };
  }, [recorder]);

  return {
    state,
    startRecording,
    stopRecording,
    cancelRecording,
  };
}
