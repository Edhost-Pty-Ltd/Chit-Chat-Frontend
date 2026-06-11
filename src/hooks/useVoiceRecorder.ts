// ─── useVoiceRecorder Hook ────────────────────────────────────────────────────
// Handles audio recording lifecycle, microphone permissions, duration tracking,
// auto-stop at 120s, warning at 110s, and cleanup on unmount.
//
// Uses expo-av Audio Recording API (SDK 54, expo-av@16.0.8).

import { useState, useRef, useCallback, useEffect } from 'react';
import { Audio } from 'expo-av';
import type { RecordingStatus } from 'expo-av/build/Audio/Recording.types';

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
const PROGRESS_UPDATE_INTERVAL_MS = 1_000;

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
  const recordingRef = useRef<Audio.Recording | null>(null);
  const isStoppingRef = useRef(false);

  // ── Recording status update callback ──────────────────────────
  const onRecordingStatusUpdate = useCallback((status: RecordingStatus) => {
    if (!status.isRecording) return;

    const durationMs = status.durationMillis;
    const metering = status.metering ?? -160;
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
  }, []);

  // ── Internal stop (used by auto-stop) ─────────────────────────
  const stopRecordingInternal = useCallback(async () => {
    const recording = recordingRef.current;
    if (!recording) {
      isStoppingRef.current = false;
      return;
    }

    try {
      const finalStatus = await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      const durationMs = finalStatus.durationMillis;

      recordingRef.current = null;

      // Reset audio mode after recording
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });

      if (uri && durationMs >= MIN_DURATION_MS) {
        setState((prev) => ({
          ...prev,
          status: 'stopped',
          durationMs,
        }));
      } else {
        // Too short — discard
        setState(INITIAL_STATE);
      }
    } catch (error) {
      console.error('[useVoiceRecorder] stopRecordingInternal error:', error);
      recordingRef.current = null;
      setState(INITIAL_STATE);
    } finally {
      isStoppingRef.current = false;
    }
  }, []);

  // ── Start Recording ───────────────────────────────────────────
  const startRecording = useCallback(async () => {
    // Requirement 1.7: Ignore new press if already recording
    if (recordingRef.current) return;

    try {
      // Request permission
      setState((prev) => ({ ...prev, status: 'requesting-permission' }));

      const permissionResponse = await Audio.requestPermissionsAsync();

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
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
      });

      // Create and start recording
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
        onRecordingStatusUpdate,
        PROGRESS_UPDATE_INTERVAL_MS,
      );

      recordingRef.current = recording;

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
      recordingRef.current = null;
      setState(INITIAL_STATE);
    }
  }, [onRecordingStatusUpdate]);

  // ── Stop Recording ────────────────────────────────────────────
  const stopRecording = useCallback(async (): Promise<RecordingResult | null> => {
    const recording = recordingRef.current;
    if (!recording || isStoppingRef.current) return null;

    isStoppingRef.current = true;

    try {
      const finalStatus = await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      const durationMs = finalStatus.durationMillis;

      recordingRef.current = null;

      // Reset audio mode after recording
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });

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
      recordingRef.current = null;
      setState(INITIAL_STATE);
      return null;
    } finally {
      isStoppingRef.current = false;
    }
  }, []);

  // ── Cancel Recording ──────────────────────────────────────────
  const cancelRecording = useCallback(async () => {
    const recording = recordingRef.current;
    if (!recording) return;

    try {
      await recording.stopAndUnloadAsync();
      // The local file URI is discarded — not referenced further
      // On cancel the file is left for OS garbage collection (no expo-file-system dependency)
    } catch (error) {
      console.error('[useVoiceRecorder] cancelRecording error:', error);
    } finally {
      recordingRef.current = null;
      // Reset audio mode after recording
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false }).catch(() => {});
      setState({ ...INITIAL_STATE, status: 'cancelled' });
    }
  }, []);

  // ── Cleanup on unmount ────────────────────────────────────────
  useEffect(() => {
    return () => {
      const recording = recordingRef.current;
      if (recording) {
        recording.stopAndUnloadAsync().catch(() => {});
        recordingRef.current = null;
      }
    };
  }, []);

  return {
    state,
    startRecording,
    stopRecording,
    cancelRecording,
  };
}
