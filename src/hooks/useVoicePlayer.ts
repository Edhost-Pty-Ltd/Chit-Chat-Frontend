// ─── useVoicePlayer Hook ──────────────────────────────────────────────────────
// Manages audio playback for voice notes. Single-active-player pattern ensures
// only one voice note plays at a time. Handles audio mode configuration,
// progress tracking, interruption, and cleanup.
//
// Uses expo-audio (SDK 56).

import { useState, useRef, useEffect, useCallback } from 'react';
import { useAudioPlayer, useAudioPlayerStatus, setAudioModeAsync } from 'expo-audio';

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
  const [currentSource, setCurrentSource] = useState<string | null>(null);

  // Create a player with current source
  const player = useAudioPlayer(currentSource);
  const playerStatus = useAudioPlayerStatus(player);

  const activeMessageIdRef = useRef<string | null>(null);
  const loadingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasPlayingRef = useRef(false);

  // ── Sync player status to state ─────────────────────────────────────────
  useEffect(() => {
    // Only process status updates when we have an active message
    if (!activeMessageIdRef.current) return;

    if (playerStatus.error) {
      setState((prev) => ({
        ...prev,
        status: 'error',
        error: playerStatus.error ?? 'Playback error',
      }));
      wasPlayingRef.current = false;
      return;
    }

    if (playerStatus.didJustFinish) {
      setState((prev) => ({
        ...prev,
        status: 'idle',
        positionMs: 0,
      }));
      wasPlayingRef.current = false;
      return;
    }

    if (playerStatus.playing) {
      wasPlayingRef.current = true;
      setState((prev) => ({
        ...prev,
        status: 'playing',
        positionMs: Math.round(playerStatus.currentTime * 1000),
        durationMs: playerStatus.duration > 0 ? Math.round(playerStatus.duration * 1000) : prev.durationMs,
      }));
    } else if (playerStatus.isLoaded && wasPlayingRef.current && !playerStatus.isBuffering) {
      // Audio was interrupted externally (phone call etc.)
      wasPlayingRef.current = false;
      setState((prev) => {
        if (prev.status === 'playing') {
          return {
            ...prev,
            status: 'paused',
            positionMs: Math.round(playerStatus.currentTime * 1000),
          };
        }
        return prev;
      });
    } else if (playerStatus.isLoaded) {
      setState((prev) => ({
        ...prev,
        positionMs: Math.round(playerStatus.currentTime * 1000),
        durationMs: playerStatus.duration > 0 ? Math.round(playerStatus.duration * 1000) : prev.durationMs,
      }));
    }
  }, [playerStatus]);

  // ── Auto-play when source is set ────────────────────────────────────────
  useEffect(() => {
    if (currentSource && player && activeMessageIdRef.current) {
      // Source was set, start playing
      try {
        player.play();
      } catch (err) {
        console.error('[useVoicePlayer] Auto-play error:', err);
      }
    }
  }, [currentSource, player]);

  // ── Cleanup on unmount ──────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      clearLoadingTimeout();
    };
  }, []);

  // ── Helpers ─────────────────────────────────────────────────────────────

  function clearLoadingTimeout() {
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
      loadingTimeoutRef.current = null;
    }
  }

  // ── Play ────────────────────────────────────────────────────────────────

  const play = useCallback(async (voiceUrl: string, messageId: string, durationMs: number) => {
    console.log('[useVoicePlayer] play() called:', {
      voiceUrl,
      messageId,
      durationMs,
      currentSource,
      isLocal: voiceUrl.startsWith('file://'),
      isFirebase: voiceUrl.startsWith('https://firebasestorage'),
    });
    
    // If this is a new voice note (different URL), stop the current one first
    if (currentSource && currentSource !== voiceUrl) {
      try {
        if (player) {
          player.pause();
        }
      } catch (err) {
        // Ignore errors from pausing - player might not be loaded
        console.warn('[useVoicePlayer] Pause before new play (expected):', err);
      }
    }
    
    clearLoadingTimeout();
    activeMessageIdRef.current = messageId;

    // Set loading state
    setState({
      activeMessageId: messageId,
      status: 'loading',
      positionMs: 0,
      durationMs,
      error: null,
    });

    // Configure audio mode for playback
    try {
      await setAudioModeAsync({
        playsInSilentMode: true,
        interruptionMode: 'duckOthers',
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
    loadingTimeoutRef.current = setTimeout(() => {
      setState((prev) => ({
        ...prev,
        status: 'error',
        error: 'Voice note unavailable — network timeout',
      }));
      activeMessageIdRef.current = null;
    }, LOADING_TIMEOUT_MS);

    try {
      // If same source, just seek to start and play
      if (currentSource === voiceUrl && player) {
        console.log('[useVoicePlayer] Replaying same audio, seeking to start');
        player.seekTo(0);
        player.play();
        clearLoadingTimeout();
        wasPlayingRef.current = true;
        setState((prev) => ({
          ...prev,
          status: 'playing',
        }));
      } else {
        // Different source - update source to trigger player recreation
        console.log('[useVoicePlayer] Loading new audio source');
        setCurrentSource(voiceUrl);
        clearLoadingTimeout();
        wasPlayingRef.current = true;
        setState((prev) => ({
          ...prev,
          status: 'playing',
        }));
      }
    } catch (error: any) {
      clearLoadingTimeout();
      activeMessageIdRef.current = null;

      console.error('[useVoicePlayer] Play error:', error);
      setState((prev) => ({
        ...prev,
        status: 'error',
        error: 'Failed to load voice note',
      }));
    }
  }, [currentSource, player]);

  // ── Pause ───────────────────────────────────────────────────────────────

  const pause = useCallback(async () => {
    try {
      if (player) {
        player.pause();
        wasPlayingRef.current = false;
        setState((prev) => ({
          ...prev,
          status: 'paused',
        }));
      }
    } catch (err) {
      console.error('[useVoicePlayer] Pause error:', err);
    }
  }, [player]);

  // ── Resume ──────────────────────────────────────────────────────────────

  const resume = useCallback(async () => {
    try {
      if (player) {
        player.play();
        wasPlayingRef.current = true;
        setState((prev) => ({
          ...prev,
          status: 'playing',
        }));
      }
    } catch (err) {
      console.error('[useVoicePlayer] Resume error:', err);
    }
  }, [player]);

  // ── Stop (public) ──────────────────────────────────────────────────────

  const stop = useCallback(async () => {
    try {
      clearLoadingTimeout();
      wasPlayingRef.current = false;
      activeMessageIdRef.current = null;
      
      if (player && currentSource) {
        player.pause();
        player.seekTo(0);
      }
      
      // Don't set currentSource to null - keep it so replay works
      setState(INITIAL_STATE);
    } catch (err) {
      console.error('[useVoicePlayer] Stop error:', err);
      // Reset state even if stop fails
      setState(INITIAL_STATE);
    }
  }, [player, currentSource]);

  return { state, play, pause, resume, stop };
}
