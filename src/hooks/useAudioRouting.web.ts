// ─── Hook: Audio Routing (Web Implementation) ────────────────────────────────
// Web audio routing using Web Audio API

import { useState, useCallback } from 'react';

export function useAudioRouting() {
  const [isSpeakerOn, setIsSpeakerOn] = useState(true); // Web defaults to speaker
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize audio session for call
  const initializeAudioSession = useCallback(async () => {
    try {
      console.log('[useAudioRouting-Web] Initializing audio session...');
      
      // On web, audio goes through default output device (speakers/headphones)
      // No special initialization needed
      
      setIsInitialized(true);
      console.log('[useAudioRouting-Web] Audio session initialized');
    } catch (error) {
      console.error('[useAudioRouting-Web] Failed to initialize audio session:', error);
    }
  }, []);

  // Toggle between speaker and earpiece (no-op on web)
  const toggleSpeaker = useCallback(async () => {
    try {
      const newSpeakerState = !isSpeakerOn;
      setIsSpeakerOn(newSpeakerState);
      console.log('[useAudioRouting-Web] Speaker toggle (web has no effect):', newSpeakerState);
      
      // On web, audio output is controlled by browser/OS
      // Users can select output device from browser settings
    } catch (error) {
      console.error('[useAudioRouting-Web] Failed to toggle speaker:', error);
    }
  }, [isSpeakerOn]);

  // Set speaker on/off (no-op on web)
  const setSpeaker = useCallback(async (enabled: boolean) => {
    try {
      setIsSpeakerOn(enabled);
      console.log('[useAudioRouting-Web] Speaker set (web has no effect):', enabled);
    } catch (error) {
      console.error('[useAudioRouting-Web] Failed to set speaker:', error);
    }
  }, []);

  // Cleanup audio session
  const cleanup = useCallback(async () => {
    try {
      console.log('[useAudioRouting-Web] Cleaning up audio session...');
      setIsSpeakerOn(true);
      setIsInitialized(false);
    } catch (error) {
      console.error('[useAudioRouting-Web] Cleanup error:', error);
    }
  }, []);

  return {
    isSpeakerOn,
    isInitialized,
    initializeAudioSession,
    toggleSpeaker,
    setSpeaker,
    cleanup,
  };
}
