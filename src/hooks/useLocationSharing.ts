// ─── useLocationSharing Hook ──────────────────────────────────────────────────
// Manages location sharing (current and live location) with permission handling,
// location updates, and cleanup.

import { useState, useEffect, useRef } from 'react';
import * as Location from 'expo-location';
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
  currentLocation: LocationData | null;
  isSharing: boolean;
  sharingExpiresAt: Date | null;
  
  // Actions
  getCurrentLocation: () => Promise<LocationData | null>;
  startLiveSharing: (chatId: string, messageId: string, durationMinutes: number) => Promise<boolean>;
  stopLiveSharing: () => Promise<void>;
  updateLiveLocation: (chatId: string, messageId: string, location: LocationData) => Promise<void>;
}

const LOCATION_UPDATE_INTERVAL_MS = 5000; // Update every 5 seconds
const MIN_UPDATE_DISTANCE_METERS = 10; // Minimum distance change to trigger update

export function useLocationSharing(): UseLocationSharingReturn {
  const [state, setState] = useState<LocationSharingState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [currentLocation, setCurrentLocation] = useState<LocationData | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [sharingExpiresAt, setSharingExpiresAt] = useState<Date | null>(null);
  
  const watchSubscriptionRef = useRef<Location.LocationSubscription | null>(null);
  const expiryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastUpdateRef = useRef<LocationData | null>(null);

  // ── Request location permissions ──────────────────────────────────
  const requestPermissions = async (): Promise<boolean> => {
    try {
      setState('requesting-permission');
      
      const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
      
      if (foregroundStatus !== 'granted') {
        setError('Location permission denied. Please enable it in Settings.');
        setState('error');
        return false;
      }
      
      return true;
    } catch (err) {
      console.error('[useLocationSharing] Permission error:', err);
      setError('Failed to request location permission');
      setState('error');
      return false;
    }
  };

  // ── Get current location (one-time) ───────────────────────────────
  const getCurrentLocation = async (): Promise<LocationData | null> => {
    try {
      setError(null);
      
      // Check and request permissions
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') {
        const hasPermission = await requestPermissions();
        if (!hasPermission) return null;
      }
      
      setState('getting-location');
      
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      
      const locationData: LocationData = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy ?? undefined,
        altitude: location.coords.altitude,
        altitudeAccuracy: location.coords.altitudeAccuracy,
        heading: location.coords.heading,
        speed: location.coords.speed,
        timestamp: location.timestamp,
      };
      
      setCurrentLocation(locationData);
      setState('idle');
      
      return locationData;
    } catch (err) {
      console.error('[useLocationSharing] Get location error:', err);
      setError('Failed to get current location');
      setState('error');
      return null;
    }
  };

  // ── Calculate distance between two locations ──────────────────────
  const calculateDistance = (loc1: LocationData, loc2: LocationData): number => {
    const R = 6371e3; // Earth radius in meters
    const φ1 = (loc1.latitude * Math.PI) / 180;
    const φ2 = (loc2.latitude * Math.PI) / 180;
    const Δφ = ((loc2.latitude - loc1.latitude) * Math.PI) / 180;
    const Δλ = ((loc2.longitude - loc1.longitude) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  };

  // ── Update live location in Firestore ─────────────────────────────
  const updateLiveLocation = async (
    chatId: string,
    messageId: string,
    location: LocationData
  ): Promise<void> => {
    try {
      const messageRef = doc(db, 'chats', chatId, 'messages', messageId);
      
      await updateDoc(messageRef, {
        location: location,
        'location.timestamp': location.timestamp,
        updatedAt: serverTimestamp(),
      });
      
      console.log('[useLocationSharing] Location updated in Firestore');
    } catch (err) {
      console.error('[useLocationSharing] Update error:', err);
    }
  };

  // ── Start live location sharing ───────────────────────────────────
  const startLiveSharing = async (
    chatId: string,
    messageId: string,
    durationMinutes: number
  ): Promise<boolean> => {
    try {
      setError(null);
      
      // Check and request permissions
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') {
        const hasPermission = await requestPermissions();
        if (!hasPermission) return false;
      }
      
      setState('sharing-live');
      setIsSharing(true);
      
      // Calculate expiry time
      const expiryDate = new Date(Date.now() + durationMinutes * 60 * 1000);
      setSharingExpiresAt(expiryDate);
      
      // Get initial location
      const initialLocation = await getCurrentLocation();
      if (!initialLocation) {
        setIsSharing(false);
        setState('error');
        return false;
      }
      
      lastUpdateRef.current = initialLocation;
      
      // Start watching location
      const subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: LOCATION_UPDATE_INTERVAL_MS,
          distanceInterval: MIN_UPDATE_DISTANCE_METERS,
        },
        (location) => {
          const locationData: LocationData = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            accuracy: location.coords.accuracy ?? undefined,
            altitude: location.coords.altitude,
            altitudeAccuracy: location.coords.altitudeAccuracy,
            heading: location.coords.heading,
            speed: location.coords.speed,
            timestamp: location.timestamp,
          };
          
          // Only update if location has changed significantly
          if (lastUpdateRef.current) {
            const distance = calculateDistance(lastUpdateRef.current, locationData);
            if (distance < MIN_UPDATE_DISTANCE_METERS) {
              return;
            }
          }
          
          setCurrentLocation(locationData);
          lastUpdateRef.current = locationData;
          
          // Update in Firestore
          updateLiveLocation(chatId, messageId, locationData);
        }
      );
      
      watchSubscriptionRef.current = subscription;
      
      // Set up auto-stop timer
      expiryTimerRef.current = setTimeout(async () => {
        console.log('[useLocationSharing] Live sharing expired');
        await stopLiveSharing();
      }, durationMinutes * 60 * 1000);
      
      return true;
    } catch (err) {
      console.error('[useLocationSharing] Start live sharing error:', err);
      setError('Failed to start live location sharing');
      setState('error');
      setIsSharing(false);
      return false;
    }
  };

  // ── Stop live location sharing ────────────────────────────────────
  const stopLiveSharing = async (): Promise<void> => {
    try {
      // Stop watching location
      if (watchSubscriptionRef.current) {
        watchSubscriptionRef.current.remove();
        watchSubscriptionRef.current = null;
      }
      
      // Clear expiry timer
      if (expiryTimerRef.current) {
        clearTimeout(expiryTimerRef.current);
        expiryTimerRef.current = null;
      }
      
      setIsSharing(false);
      setSharingExpiresAt(null);
      setState('idle');
      lastUpdateRef.current = null;
      
      console.log('[useLocationSharing] Live sharing stopped');
    } catch (err) {
      console.error('[useLocationSharing] Stop error:', err);
    }
  };

  // ── Cleanup on unmount ────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (watchSubscriptionRef.current) {
        watchSubscriptionRef.current.remove();
      }
      if (expiryTimerRef.current) {
        clearTimeout(expiryTimerRef.current);
      }
    };
  }, []);

  return {
    state,
    error,
    currentLocation,
    isSharing,
    sharingExpiresAt,
    getCurrentLocation,
    startLiveSharing,
    stopLiveSharing,
    updateLiveLocation,
  };
}
