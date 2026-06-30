// ─── useLocationSharing Hook (Web Implementation) ────────────────────────────
// Web implementation using browser Geolocation API

import { useState, useEffect, useRef } from 'react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { LocationData } from '../types';

export type LocationSharingState = 
  | 'idle' 
  | 'requesting-permission' 
  | 'getting-location' 
  | 'sharing-live' 
  | 'error';

export interface UseLocationSharingReturn {
  state: LocationSharingState;
  error: string | null;
  shareCurrentLocation: (chatId: string) => Promise<LocationData | null>;
  startLiveLocation: (chatId: string, durationMinutes?: number) => Promise<void>;
  stopLiveLocation: () => void;
}

export function useLocationSharing(): UseLocationSharingReturn {
  const [state, setState] = useState<LocationSharingState>('idle');
  const [error, setError] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const chatIdRef = useRef<string | null>(null);
  const stopTimeRef = useRef<number | null>(null);

  // Share current location once
  const shareCurrentLocation = async (chatId: string): Promise<LocationData | null> => {
    setState('requesting-permission');
    setError(null);

    try {
      // Request permission and get location
      setState('getting-location');
      
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        });
      });

      const locationData: LocationData = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        timestamp: Date.now(),
      };

      console.log('[useLocationSharing-Web] Current location obtained:', locationData);
      setState('idle');
      return locationData;
    } catch (err: any) {
      console.error('[useLocationSharing-Web] Error getting location:', err);
      const errorMessage = err.code === 1 
        ? 'Location permission denied'
        : err.code === 2
        ? 'Location unavailable'
        : err.code === 3
        ? 'Location request timed out'
        : 'Failed to get location';
      
      setError(errorMessage);
      setState('error');
      return null;
    }
  };

  // Start live location sharing with updates
  const startLiveLocation = async (chatId: string, durationMinutes: number = 15): Promise<void> => {
    setState('requesting-permission');
    setError(null);

    try {
      // Check if geolocation is available
      if (!navigator.geolocation) {
        throw new Error('Geolocation not supported');
      }

      chatIdRef.current = chatId;
      stopTimeRef.current = Date.now() + durationMinutes * 60 * 1000;

      console.log('[useLocationSharing-Web] Starting live location for', durationMinutes, 'minutes');

      // Start watching position
      const watchId = navigator.geolocation.watchPosition(
        async (position) => {
          // Check if sharing should stop
          if (stopTimeRef.current && Date.now() >= stopTimeRef.current) {
            stopLiveLocation();
            return;
          }

          const locationData: LocationData = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: Date.now(),
          };

          // Update location in Firestore
          if (chatIdRef.current) {
            try {
              const chatRef = doc(db, 'chats', chatIdRef.current);
              await updateDoc(chatRef, {
                liveLocation: locationData,
                liveLocationUpdatedAt: serverTimestamp(),
              });
              console.log('[useLocationSharing-Web] Live location updated');
            } catch (err) {
              console.error('[useLocationSharing-Web] Failed to update live location:', err);
            }
          }

          setState('sharing-live');
        },
        (err) => {
          console.error('[useLocationSharing-Web] Watch position error:', err);
          const errorMessage = err.code === 1 
            ? 'Location permission denied'
            : err.code === 2
            ? 'Location unavailable'
            : err.code === 3
            ? 'Location request timed out'
            : 'Failed to watch location';
          
          setError(errorMessage);
          setState('error');
          stopLiveLocation();
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 5000,
        }
      );

      watchIdRef.current = watchId;
      console.log('[useLocationSharing-Web] Live location started, watchId:', watchId);
    } catch (err: any) {
      console.error('[useLocationSharing-Web] Error starting live location:', err);
      setError(err.message || 'Failed to start live location');
      setState('error');
    }
  };

  // Stop live location sharing
  const stopLiveLocation = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
      console.log('[useLocationSharing-Web] Live location stopped');
    }

    // Clear live location from Firestore
    if (chatIdRef.current) {
      const chatRef = doc(db, 'chats', chatIdRef.current);
      updateDoc(chatRef, {
        liveLocation: null,
        liveLocationUpdatedAt: null,
      }).catch(err => {
        console.error('[useLocationSharing-Web] Failed to clear live location:', err);
      });
    }

    chatIdRef.current = null;
    stopTimeRef.current = null;
    setState('idle');
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopLiveLocation();
    };
  }, []);

  return {
    state,
    error,
    shareCurrentLocation,
    startLiveLocation,
    stopLiveLocation,
  };
}
