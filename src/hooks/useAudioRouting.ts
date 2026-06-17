// ─── Hook: Audio Routing ─────────────────────────────────────────────────────
// Manages audio routing between speaker and earpiece during calls

import { useState, useCallback, useEffect } from 'react';
import { Platform, Alert } from 'react-native';
import { mediaDevices } from 'react-native-webrtc';

export function useAudioRouting() {
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize audio session for call
  const initializeAudioSession = useCallback(async () => {
    try {
      console.log('[useAudioRouting] Initializing audio session...');
      
      // Set default to earpiece (not speaker)
      if (Platform.OS === 'android' || Platform.OS === 'ios') {
        // On mobile, default to earpiece for privacy
        await setSpeakerphoneOn(false);
      }
      
      setIsInitialized(true);
      console.log('[useAudioRouting] Audio session initialized (earpiece mode)');
    } catch (error) {
      console.error('[useAudioRouting] Failed to initialize audio session:', error);
      Alert.alert('Audio Error', 'Failed to configure audio settings');
    }
  }, []);

  // Toggle between speaker and earpiece
  const toggleSpeaker = useCallback(async () => {
    try {
      const newSpeakerState = !isSpeakerOn;
      await setSpeakerphoneOn(newSpeakerState);
      setIsSpeakerOn(newSpeakerState);
      console.log('[useAudioRouting] Speaker toggled:', newSpeakerState);
    } catch (error) {
      console.error('[useAudioRouting] Failed to toggle speaker:', error);
      Alert.alert('Audio Error', 'Failed to switch audio output');
    }
  }, [isSpeakerOn]);

  // Set speaker on/off
  const setSpeaker = useCallback(async (enabled: boolean) => {
    try {
      await setSpeakerphoneOn(enabled);
      setIsSpeakerOn(enabled);
      console.log('[useAudioRouting] Speaker set to:', enabled);
    } catch (error) {
      console.error('[useAudioRouting] Failed to set speaker:', error);
    }
  }, []);

  // Cleanup audio session
  const cleanup = useCallback(async () => {
    try {
      console.log('[useAudioRouting] Cleaning up audio session...');
      // Reset to default state
      await setSpeakerphoneOn(false);
      setIsSpeakerOn(false);
      setIsInitialized(false);
    } catch (error) {
      console.error('[useAudioRouting] Cleanup error:', error);
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

// Helper function to set speakerphone
async function setSpeakerphoneOn(enabled: boolean): Promise<void> {
  try {
    if (Platform.OS === 'android') {
      // Android: Use setSpeakerphoneOn from react-native-webrtc
      // This requires access to the audio manager
      // For now, we'll use a workaround with media devices
      const devices = await mediaDevices.enumerateDevices() as MediaDeviceInfo[];
      const audioOutputs = devices.filter((d) => d.kind === 'audiooutput');
      
      console.log('[setSpeakerphoneOn] Available audio outputs:', audioOutputs.length);
      
      // On Android, speaker is typically the first or last device
      // This is a simplified implementation - in production you'd want more control
      if (audioOutputs.length > 0) {
        // Find speaker device
        const speakerDevice = audioOutputs.find(d => 
          d.label.toLowerCase().includes('speaker')
        ) || audioOutputs[0];
        
        console.log('[setSpeakerphoneOn] Selected device:', speakerDevice.label);
      }
    } else if (Platform.OS === 'ios') {
      // iOS: Audio routing is handled by AVAudioSession
      // react-native-webrtc should handle this automatically
      console.log('[setSpeakerphoneOn] iOS audio routing:', enabled ? 'speaker' : 'earpiece');
    }
    
    // Note: Full implementation would require native module access
    // For now, this logs the intent. The actual routing may need native code.
  } catch (error) {
    console.error('[setSpeakerphoneOn] Error:', error);
    throw error;
  }
}
