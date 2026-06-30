// ─── useVoicePlayer Hook (Web Implementation) ────────────────────────────────
// Web implementation using HTML5 Audio API

import { useState, useRef, useEffect, useCallback } from 'react';

export interface UseVoicePlayerReturn {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  isBuffering: boolean;
  error: string | null;
  play: (uri: string) => Promise<void>;
  pause: () => void;
  stop: () => void;
  seekTo: (positionMs: number) => void;
}

export function useVoicePlayer(sourceUri?: string): UseVoicePlayerReturn {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isBuffering, setIsBuffering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const play = useCallback(async (uri: string) => {
    try {
      console.log('[useVoicePlayer-Web] Playing:', uri);
      setError(null);
      setIsBuffering(true);

      // Stop current playback if any
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }

      // Create new audio element
      const audio = new Audio(uri);
      audioRef.current = audio;

      // Set up event listeners
      audio.onloadedmetadata = () => {
        setDuration(Math.floor(audio.duration * 1000)); // Convert to ms
        setIsBuffering(false);
      };

      audio.onplay = () => {
        setIsPlaying(true);
      };

      audio.onpause = () => {
        setIsPlaying(false);
      };

      audio.onended = () => {
        setIsPlaying(false);
        setCurrentTime(0);
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      };

      audio.onerror = (err) => {
        console.error('[useVoicePlayer-Web] Playback error:', err);
        setError('Failed to play audio');
        setIsBuffering(false);
        setIsPlaying(false);
      };

      // Start playback
      await audio.play();

      // Start progress tracker
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      intervalRef.current = setInterval(() => {
        if (audio && !audio.paused) {
          setCurrentTime(Math.floor(audio.currentTime * 1000)); // Convert to ms
        }
      }, 100);

      console.log('[useVoicePlayer-Web] Playback started');
    } catch (err: any) {
      console.error('[useVoicePlayer-Web] Failed to play:', err);
      setError(err.message || 'Failed to play audio');
      setIsBuffering(false);
      setIsPlaying(false);
    }
  }, []);

  const pause = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      console.log('[useVoicePlayer-Web] Paused');
    }
  }, []);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
      console.log('[useVoicePlayer-Web] Stopped');
    }

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    setIsPlaying(false);
    setCurrentTime(0);
  }, []);

  const seekTo = useCallback((positionMs: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = positionMs / 1000; // Convert to seconds
      setCurrentTime(positionMs);
      console.log('[useVoicePlayer-Web] Seeked to:', positionMs);
    }
  }, []);

  // Auto-play if sourceUri provided
  useEffect(() => {
    if (sourceUri) {
      play(sourceUri);
    }
  }, [sourceUri, play]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  return {
    isPlaying,
    currentTime,
    duration,
    isBuffering,
    error,
    play,
    pause,
    stop,
    seekTo,
  };
}
