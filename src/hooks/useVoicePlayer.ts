// ─── useVoicePlayer Hook ──────────────────────────────────────────────────────
// Manages audio playback for voice notes. Single-active-player pattern ensures
// only one voice note plays at a time. Handles audio mode configuration,
// progress tracking, interruption, and cleanup.

import { useState, useRef, useEffect, useCallback } from 'react';
import { Audio, InterruptionModeIOS, InterruptionModeAndroid } from 'expo-av';
import type { AVPlaybackStatus } from 'expo-av';

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface PlaybackState {
  activeMessageId: string | null;
  status: 'idle' | 'loading' | 'playing' | 'paused' | 'error';
  positionMs: number;
  durationMs: number;
  error: string | null;
}

export interface UseVoicePlayerReturn {
  state: PlaybackState;
  play: (voiceUrl: string, messageId: string, durationMs: number) => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  stop: () => Promise<void>;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const INITIAL_STATE: PlaybackState = {
  activeMessageId: null,
  status: 'idle',
  positionMs: 0,
  durationMs: 0,
  error: null,
};

const LOADING_TIMEOUT_MS = 15_000;

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useVoicePlayer(): UseVoicePlayerReturn {
  const [state, setState] = useState<PlaybackState>(INITIAL_STATE);

  const soundRef = useRef<Audio.Sound | null>(null);
  const loadingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track whether we were previously playing — helps detect audio interruption
  const wasPlayingRef = useRef(false);

  // ── Cleanup on unmount ──────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      cleanupSound();
      clearLoadingTimeout();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Helpers ─────────────────────────────────────────────────────────────

  function clearLoadingTimeout() {
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
      loadingTimeoutRef.current = null;
    }
  }

  async function cleanupSound() {
    if (soundRef.current) {
      try {
        await soundRef.current.unloadAsync();
      } catch {
        // Ignore unload errors during cleanup
      }
      soundRef.current = null;
    }
    // Reset audio mode
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: false,
        staysActiveInBackground: false,
        interruptionModeIOS: InterruptionModeIOS.MixWithOthers,
        interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });
    } catch {
      // Ignore audio mode reset errors
    }
  }

  // ── Playback Status Update Handler ──────────────────────────────────────

  const onPlaybackStatusUpdate = useCallback((status: AVPlaybackStatus) => {
    if (!status.isLoaded) {
      // Handle error state when sound fails/unloads
      if (status.error) {
        setState((prev) => ({
          ...prev,
          status: 'error',
          error: status.error ?? 'Playback error',
        }));
        wasPlayingRef.current = false;
      }
      return;
    }

    // Detect didJustFinish — reset position to 0, show play button
    if (status.didJustFinish) {
      setState((prev) => ({
        ...prev,
        status: 'idle',
        positionMs: 0,
      }));
      wasPlayingRef.current = false;
      return;
    }

    // Update position for waveform progress
    if (status.isPlaying) {
      wasPlayingRef.current = true;
      setState((prev) => ({
        ...prev,
        status: 'playing',
        positionMs: status.positionMillis,
        durationMs: status.durationMillis ?? prev.durationMs,
      }));
    } else if (wasPlayingRef.current && !status.isBuffering) {
      // Audio interruption: was playing but now stopped unexpectedly
      // This handles external interruptions like phone calls
      wasPlayingRef.current = false;
      setState((prev) => {
        // Only set paused if we were in a playing state
        if (prev.status === 'playing') {
          return {
            ...prev,
            status: 'paused',
            positionMs: status.positionMillis,
          };
        }
        return prev;
      });
    } else {
      // Standard position update while paused or buffering
      setState((prev) => ({
        ...prev,
        positionMs: status.positionMillis,
        durationMs: status.durationMillis ?? prev.durationMs,
      }));
    }
  }, []);

  // ── Play ────────────────────────────────────────────────────────────────

  const play = useCallback(async (voiceUrl: string, messageId: string, durationMs: number) => {
    // Stop any currently playing sound
    await stopInternal();

    // Set loading state
    setState({
      activeMessageId: messageId,
      status: 'loading',
      positionMs: 0,
      durationMs,
      error: null,
    });

    // Configure audio mode for playback with ducking
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        interruptionModeIOS: InterruptionModeIOS.DuckOthers,
        interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });
    } catch {
      setState((prev) => ({
        ...prev,
        status: 'error',
        error: 'Failed to configure audio mode',
      }));
      return;
    }

    // Set up loading timeout
    const timeoutPromise = new Promise<never>((_, reject) => {
      loadingTimeoutRef.current = setTimeout(() => {
        reject(new Error('LOADING_TIMEOUT'));
      }, LOADING_TIMEOUT_MS);
    });

    try {
      // Create and load sound from URL — race against timeout
      const createPromise = Audio.Sound.createAsync(
        { uri: voiceUrl },
        { shouldPlay: true },
        onPlaybackStatusUpdate,
      );

      const { sound } = await Promise.race([createPromise, timeoutPromise]);

      clearLoadingTimeout();
      soundRef.current = sound;
      wasPlayingRef.current = true;

      setState((prev) => ({
        ...prev,
        status: 'playing',
      }));
    } catch (error: any) {
      clearLoadingTimeout();

      // Clean up any partially loaded sound
      if (soundRef.current) {
        try {
          await soundRef.current.unloadAsync();
        } catch {
          // Ignore
        }
        soundRef.current = null;
      }

      const errorMessage = error?.message === 'LOADING_TIMEOUT'
        ? 'Voice note unavailable — network timeout'
        : 'Failed to load voice note';

      setState((prev) => ({
        ...prev,
        status: 'error',
        error: errorMessage,
      }));
    }
  }, [onPlaybackStatusUpdate]);

  // ── Pause ───────────────────────────────────────────────────────────────

  const pause = useCallback(async () => {
    if (!soundRef.current) return;

    try {
      await soundRef.current.pauseAsync();
      wasPlayingRef.current = false;
      setState((prev) => ({
        ...prev,
        status: 'paused',
      }));
    } catch {
      // If pause fails, try to get current status
    }
  }, []);

  // ── Resume ──────────────────────────────────────────────────────────────

  const resume = useCallback(async () => {
    if (!soundRef.current) return;

    try {
      await soundRef.current.playAsync();
      wasPlayingRef.current = true;
      setState((prev) => ({
        ...prev,
        status: 'playing',
      }));
    } catch {
      setState((prev) => ({
        ...prev,
        status: 'error',
        error: 'Failed to resume playback',
      }));
    }
  }, []);

  // ── Stop (internal — used before new play and during cleanup) ───────────

  async function stopInternal() {
    clearLoadingTimeout();
    wasPlayingRef.current = false;

    if (soundRef.current) {
      try {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
      } catch {
        // Ignore stop/unload errors
      }
      soundRef.current = null;
    }
  }

  // ── Stop (public) ──────────────────────────────────────────────────────

  const stop = useCallback(async () => {
    await stopInternal();
    setState(INITIAL_STATE);
  }, []);

  return { state, play, pause, resume, stop };
}
