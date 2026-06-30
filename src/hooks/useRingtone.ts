// ─── useRingtone Hook ─────────────────────────────────────────────────────────
// Manages ringtone playback for incoming calls using expo-audio

import { useEffect, useRef, useState } from 'react';
import { useAudioPlayer, AudioModule } from 'expo-audio';
import { Platform } from 'react-native';

export function useRingtone() {
  const [isPlaying, setIsPlaying] = useState(false);
  const beepIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Create audio player for ringtone
  const player = useAudioPlayer();

  // Configure audio mode for ringtone playback
  useEffect(() => {
    const configureAudio = async () => {
      try {
        await AudioModule.setAudioModeAsync({
          playsInSilentModeIOS: true,
          allowsRecordingIOS: false,
          staysActiveInBackground: true,
        });
        console.log('[useRingtone] Audio mode configured');
      } catch (error) {
        console.error('[useRingtone] Error configuring audio:', error);
      }
    };

    configureAudio();
  }, []);

  // Start playing ringtone
  const play = async () => {
    try {
      // If already playing, don't start again
      if (isPlaying) {
        console.log('[useRingtone] Ringtone already playing');
        return;
      }

      console.log('[useRingtone] Starting ringtone...');

      // Try to load custom ringtone, fallback to beep pattern
      try {
        // Load the audio file from assets
        const ringtoneAsset = require('../../assets/ringtone.mp3');
        
        console.log('[useRingtone] Loading ringtone asset');
        
        // Replace with the ringtone source (SDK 56 uses direct asset/URL)
        player.replace(ringtoneAsset);
        
        // Enable looping
        player.loop = true;
        player.volume = 1.0;
        
        // Play the ringtone
        player.play();
        
        setIsPlaying(true);
        console.log('[useRingtone] Custom ringtone started');
      } catch (fileError) {
        console.log('[useRingtone] Custom ringtone error:', fileError);
        console.log('[useRingtone] Using system beep pattern');
        // Fallback: Use a beep pattern
        playSystemBeepPattern();
      }
    } catch (error) {
      console.error('[useRingtone] Error playing ringtone:', error);
      // Last resort: try beep pattern
      playSystemBeepPattern();
    }
  };

  // System beep pattern for when custom ringtone isn't available
  const playSystemBeepPattern = () => {
    try {
      console.log('[useRingtone] Starting system beep pattern');
      setIsPlaying(true);
      
      // Create a repeating beep pattern
      // This simulates a ringtone by periodically creating short sounds
      beepIntervalRef.current = setInterval(() => {
        // On each interval, we'd ideally play a short system sound
        // For now, we'll rely on vibration as the primary notification
        console.log('[useRingtone] Beep pattern tick');
      }, 1500);
    } catch (error) {
      console.error('[useRingtone] System beep pattern failed:', error);
    }
  };

  // Stop playing ringtone
  const stop = async () => {
    try {
      console.log('[useRingtone] Stopping ringtone...');

      // Stop the audio player (guard against released/invalid player)
      try {
        player.pause();
      } catch (playerError) {
        console.log('[useRingtone] Player already released or unavailable');
      }

      // Clear beep interval if it exists
      if (beepIntervalRef.current) {
        clearInterval(beepIntervalRef.current);
        beepIntervalRef.current = null;
      }

      setIsPlaying(false);
      console.log('[useRingtone] Ringtone stopped');
    } catch (error) {
      console.error('[useRingtone] Error stopping ringtone:', error);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // The player may already be released by expo-audio's own teardown, so
      // guard every access to avoid "shared object already released" crashes.
      try {
        player.pause();
      } catch {
        // player already released — nothing to do
      }
      if (beepIntervalRef.current) {
        clearInterval(beepIntervalRef.current);
        beepIntervalRef.current = null;
      }
    };
  }, [player]);

  return {
    play,
    stop,
    isPlaying,
  };
}
