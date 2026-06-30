// ─── useRingtone Hook (Web Implementation) ───────────────────────────────────
// Web implementation using HTML5 Audio API

import { useEffect, useRef, useState } from 'react';

export function useRingtone(soundUri?: string) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const play = async () => {
    try {
      if (!soundUri) {
        console.warn('[useRingtone-Web] No sound URI provided');
        return;
      }

      // Stop current playback
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }

      // Create new audio element
      const audio = new Audio(soundUri);
      audio.loop = true; // Ringtone should loop
      audioRef.current = audio;

      audio.onplay = () => setIsPlaying(true);
      audio.onpause = () => setIsPlaying(false);
      audio.onended = () => setIsPlaying(false);

      await audio.play();
      console.log('[useRingtone-Web] Ringtone started');
    } catch (err) {
      console.error('[useRingtone-Web] Failed to play ringtone:', err);
    }
  };

  const stop = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
      setIsPlaying(false);
      console.log('[useRingtone-Web] Ringtone stopped');
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  return {
    play,
    stop,
    isPlaying,
  };
}
