// ─── LocationMessageBubble Component ──────────────────────────────────────────
// Displays a location message with a map preview and option to open in maps app

import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Platform,
  Alert,
  Image,
} from 'react-native';
import { AppText, AppIcon, useForeground } from '../context/ThemeContext';
import { COLORS, RADIUS } from '../types/theme';
import { LocationData } from '../types';

/** Format time to HH:MM */
function formatTime(date: Date | null): string {
  if (!date) return '';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

interface LocationMessageBubbleProps {
  location: LocationData;
  isLiveLocation?: boolean;
  liveLocationExpiry?: Date | null;
  isSender: boolean;
  onStopSharing?: () => void;
  timestamp?: Date | null;
  tickIcon?: {
    icon: 'checkmark' | 'checkmark-done';
    color: string;
  };
}

export function LocationMessageBubble({
  location,
  isLiveLocation = false,
  liveLocationExpiry,
  isSender,
  onStopSharing,
  timestamp,
  tickIcon,
}: LocationMessageBubbleProps) {
  const { FG } = useForeground();
  const [isLive, setIsLive] = useState(isLiveLocation);
  const [timeRemaining, setTimeRemaining] = useState<string>('');

  // Check if live location has expired
  useEffect(() => {
    if (!isLiveLocation || !liveLocationExpiry) return;

    const checkExpiry = () => {
      const now = new Date();
      const expiry = new Date(liveLocationExpiry);
      
      if (now >= expiry) {
        setIsLive(false);
        return;
      }

      // Calculate time remaining
      const diffMs = expiry.getTime() - now.getTime();
      const diffMinutes = Math.floor(diffMs / 60000);
      const diffSeconds = Math.floor((diffMs % 60000) / 1000);

      if (diffMinutes > 0) {
        setTimeRemaining(`${diffMinutes}m remaining`);
      } else {
        setTimeRemaining(`${diffSeconds}s remaining`);
      }
    };

    checkExpiry();
    const interval = setInterval(checkExpiry, 1000);

    return () => clearInterval(interval);
  }, [isLiveLocation, liveLocationExpiry]);

  // Generate static map image URL using Google Maps Static API
  const getStaticMapUrl = () => {
    const { latitude, longitude } = location;
    const zoom = 15;
    const width = 600;
    const height = 360;
    const scale = 2; // For retina displays
    
    // Using Google Maps Static API
    // Note: You'll need to add your API key in production
    const apiKey = 'YOUR_GOOGLE_MAPS_API_KEY'; // Replace with actual key
    
    // For now, using MapQuest static map (no key required for basic usage)
    return `https://www.mapquestapi.com/staticmap/v5/map?locations=${latitude},${longitude}&size=${width},${height}&zoom=${zoom}&defaultMarker=marker-sm-blue`;
    
    // Alternative: Google Maps (requires API key)
    // return `https://maps.googleapis.com/maps/api/staticmap?center=${latitude},${longitude}&zoom=${zoom}&size=${width}x${height}&scale=${scale}&markers=color:blue%7C${latitude},${longitude}&key=${apiKey}`;
  };

  // Open location in maps app
  const openInMaps = () => {
    const { latitude, longitude } = location;
    const label = isLive ? 'Live Location' : 'Location';
    
    const scheme = Platform.select({
      ios: `maps:0,0?q=${label}@${latitude},${longitude}`,
      android: `geo:0,0?q=${latitude},${longitude}(${label})`,
      default: `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`,
    });

    Linking.openURL(scheme).catch(() => {
      Alert.alert('Error', 'Unable to open maps application');
    });
  };

  const handleStopSharing = () => {
    if (onStopSharing) {
      Alert.alert(
        'Stop Sharing',
        'Are you sure you want to stop sharing your live location?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Stop', style: 'destructive', onPress: onStopSharing },
        ]
      );
    }
  };

  return (
    <View style={[
      styles.container,
      isSender ? styles.senderContainer : styles.receiverContainer,
    ]}>
      {/* Live location indicator */}
      {isLive && (
        <View style={styles.liveIndicator}>
          <View style={styles.liveDot} />
          <AppText style={styles.liveText}>Live Location</AppText>
          {timeRemaining && (
            <AppText style={styles.timeText}> • {timeRemaining}</AppText>
          )}
        </View>
      )}

      {/* Map preview with actual map image */}
      <TouchableOpacity 
        style={styles.mapPreview}
        onPress={openInMaps}
        activeOpacity={0.8}
      >
        <Image
          source={{ uri: getStaticMapUrl() }}
          style={styles.mapImage}
          resizeMode="cover"
        />
        
        {/* Location pin overlay */}
        <View style={styles.pinOverlay}>
          <AppIcon name="location-sharp" size={32} color={COLORS.missed} />
        </View>
        
        {/* Coordinates overlay */}
        <View style={styles.coordsOverlay}>
          <AppText style={styles.coordsText}>
            {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
          </AppText>
          {location.accuracy && (
            <AppText style={styles.accuracyText}>
              ±{Math.round(location.accuracy)}m accuracy
            </AppText>
          )}
        </View>
      </TouchableOpacity>

      {/* Action buttons */}
      <View style={styles.actions}>
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={openInMaps}
        >
          <AppIcon name="map" size={20} color={COLORS.blue} />
          <AppText style={styles.actionText}>Open in Maps</AppText>
        </TouchableOpacity>

        {isLive && isSender && (
          <TouchableOpacity 
            style={[styles.actionButton, styles.stopButton]}
            onPress={handleStopSharing}
          >
            <AppIcon name="stop-circle" size={20} color={COLORS.missed} />
            <AppText style={[styles.actionText, styles.stopText]}>Stop Sharing</AppText>
          </TouchableOpacity>
        )}
      </View>

      {/* Timestamp and tick at bottom right */}
      {timestamp && (
        <View style={styles.timestampRow}>
          <AppText style={styles.timestamp}>
            {formatTime(timestamp)}
          </AppText>
          {isSender && tickIcon && (
            <AppIcon name={tickIcon.icon} size={13} color={tickIcon.color} fixedColor />
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    maxWidth: 300,
  },
  senderContainer: {
    backgroundColor: COLORS.blue + '15',
  },
  receiverContainer: {
    backgroundColor: COLORS.glass,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    paddingBottom: 8,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.green,
    marginRight: 6,
  },
  liveText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.green,
  },
  timeText: {
    fontSize: 12,
    color: COLORS.sub,
  },
  mapPreview: {
    width: '100%',
    height: 180,
    backgroundColor: COLORS.bg2,
    position: 'relative',
  },
  mapImage: {
    width: '100%',
    height: '100%',
  },
  pinOverlay: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -16 }, { translateY: -32 }],
  },
  coordsOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 8,
    alignItems: 'center',
  },
  coordsText: {
    fontSize: 11,
    color: '#ffffff',
    fontWeight: '500',
  },
  accuracyText: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    padding: 12,
    paddingTop: 8,
    gap: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.bg2,
    gap: 6,
  },
  stopButton: {
    backgroundColor: COLORS.missed + '15',
  },
  actionText: {
    fontSize: 13,
    color: COLORS.blue,
    fontWeight: '500',
  },
  stopText: {
    color: COLORS.missed,
  },
  timestampRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 3,
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  timestamp: {
    fontSize: 10,
    color: COLORS.sub,
  },
});
