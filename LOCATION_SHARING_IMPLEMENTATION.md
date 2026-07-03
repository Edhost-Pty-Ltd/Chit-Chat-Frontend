# Location Sharing Implementation

This document describes the location sharing feature implementation in Chit-Chat, including current location and live location sharing capabilities.

## Overview

The location sharing feature allows users to:
1. **Share Current Location**: Send a one-time snapshot of their current location
2. **Share Live Location**: Continuously share location updates for a specified duration (5, 15, 30, or 60 minutes)

## Architecture

### 1. Core Components

#### `useLocationSharing` Hook (`src/hooks/useLocationSharing.ts`)
- Manages all location-related operations
- Handles permission requests
- Provides methods for current and live location sharing
- Tracks sharing state and expiration
- Updates Firestore with location changes every 5 seconds or 10 meters

**Key Features:**
- Automatic cleanup on unmount
- Distance-based update filtering (minimum 10m change)
- Time-based updates (every 5 seconds)
- Expiry timer management
- Permission handling with user-friendly error messages

#### `LocationMessageBubble` Component (`src/components/LocationMessageBubble.tsx`)
- Displays location messages in chat
- Shows live location indicator with countdown
- Provides "Open in Maps" functionality
- Includes "Stop Sharing" button for senders
- Real-time expiry checking

#### `useChatActions` Updates (`src/hooks/useChatActions.ts`)
New functions added:
- `sendCurrentLocationMessage()` - Send one-time location
- `sendLiveLocationMessage()` - Start live location sharing
- `stopLiveLocationSharing()` - Stop live location updates

### 2. Data Model

#### Location Data Type (`src/types/index.ts`)
```typescript
interface LocationData {
  latitude: number;
  longitude: number;
  accuracy?: number;
  altitude?: number | null;
  altitudeAccuracy?: number | null;
  heading?: number | null;
  speed?: number | null;
  timestamp: number;
}
```

#### Chat Message Updates
```typescript
interface ChatMessage {
  // ... existing fields
  type: 'text' | 'image' | 'video' | 'voice' | 'audio' | 'file' | 'location';
  
  // Location-specific fields
  location?: LocationData | null;
  isLiveLocation?: boolean;
  liveLocationExpiry?: Date | null;
}
```

### 3. Firestore Structure

#### Location Messages
```
chats/{chatId}/messages/{messageId}
  - messageId: string
  - senderId: string
  - type: "location"
  - location: LocationData
  - isLiveLocation: boolean
  - liveLocationExpiry: Timestamp (for live location)
  - timestamp: Timestamp
  - readBy: string[]
```

#### Live Location Updates
The same message document is updated with new location data:
```
chats/{chatId}/messages/{messageId}
  - location: LocationData (updated)
  - updatedAt: Timestamp
```

## Configuration

### Permissions

#### Android (`app.json`)
```json
"permissions": [
  "android.permission.ACCESS_FINE_LOCATION",
  "android.permission.ACCESS_COARSE_LOCATION",
  "android.permission.ACCESS_BACKGROUND_LOCATION"
]
```

#### iOS (`app.json`)
```json
"infoPlist": {
  "NSLocationWhenInUseUsageDescription": "Chit-Chat needs access to your location to share it with your contacts.",
  "NSLocationAlwaysUsageDescription": "Chit-Chat needs access to your location to share live location updates."
}
```

#### Expo Plugin Configuration
```json
[
  "expo-location",
  {
    "locationAlwaysAndWhenInUsePermission": "...",
    "locationAlwaysPermission": "...",
    "locationWhenInUsePermission": "...",
    "isAndroidBackgroundLocationEnabled": true,
    "isAndroidForegroundServiceEnabled": true
  }
]
```

## Usage

### Testing

A test screen has been created at `src/screens/LocationSharingTestScreen.tsx` to demonstrate and test both location sharing features.

**Access the test screen:**
1. Open the app and sign in
2. Navigate to Settings
3. Find "TESTING" section
4. Tap "Location Sharing Test"

**Test Features:**
- View current sharing status
- Send current location
- Start live location sharing (5, 15, 30, or 60 minutes)
- Stop live location sharing
- Preview location messages

### Integration in Chat Screen

To integrate location sharing into the chat screen:

1. **Import the hook and components:**
```typescript
import { useLocationSharing } from '../hooks/useLocationSharing';
import { LocationMessageBubble } from '../components';
import { sendCurrentLocationMessage, sendLiveLocationMessage } from '../hooks/useChatActions';
```

2. **Initialize the hook:**
```typescript
const locationSharing = useLocationSharing();
```

3. **Add UI for location sharing:**
```typescript
// Button to send current location
<TouchableOpacity onPress={async () => {
  const location = await locationSharing.getCurrentLocation();
  if (location && userId) {
    await sendCurrentLocationMessage(chatId, userId, location);
  }
}}>
  <AppIcon name="location" />
</TouchableOpacity>

// Button to share live location
<TouchableOpacity onPress={async () => {
  const location = await locationSharing.getCurrentLocation();
  if (location && userId) {
    const result = await sendLiveLocationMessage(chatId, userId, location, 15);
    if (result.success) {
      await locationSharing.startLiveSharing(chatId, result.messageId, 15);
    }
  }
}}>
  <AppIcon name="navigate" />
</TouchableOpacity>
```

4. **Render location messages:**
```typescript
{message.type === 'location' && message.location && (
  <LocationMessageBubble
    location={message.location}
    isLiveLocation={message.isLiveLocation}
    liveLocationExpiry={message.liveLocationExpiry}
    isSender={message.senderId === userId}
    onStopSharing={async () => {
      await locationSharing.stopLiveSharing();
      await stopLiveLocationSharing(chatId, message.messageId);
    }}
  />
)}
```

## How It Works

### Current Location Sharing

1. User taps "Send Location" button
2. App requests location permission (if not granted)
3. `getCurrentLocation()` retrieves current position
4. `sendCurrentLocationMessage()` creates a Firestore message with:
   - Type: 'location'
   - Location data
   - isLiveLocation: false
5. Message appears in chat with map preview

### Live Location Sharing

1. User selects duration and taps "Share Live Location"
2. App requests location permission
3. `getCurrentLocation()` retrieves initial position
4. `sendLiveLocationMessage()` creates Firestore message with:
   - Type: 'location'
   - Initial location data
   - isLiveLocation: true
   - liveLocationExpiry: current time + duration
5. `startLiveSharing()` starts location watch:
   - Updates every 5 seconds OR when moved 10+ meters
   - Updates same message in Firestore
   - Shows live indicator in UI
6. Automatically stops after duration expires
7. User can manually stop sharing anytime

### Location Updates (Live Sharing)

The `watchPositionAsync` callback:
1. Receives new location from device
2. Calculates distance from last update
3. If moved 10+ meters, updates Firestore
4. Receivers see location update in real-time
5. Updates are throttled by time (5s) and distance (10m)

### Opening in Maps

When user taps location message:
- **iOS**: Opens Apple Maps
- **Android**: Opens Google Maps  
- **Web**: Opens Google Maps in browser

## Constants and Configuration

```typescript
// Update intervals
LOCATION_UPDATE_INTERVAL_MS = 5000  // 5 seconds
MIN_UPDATE_DISTANCE_METERS = 10     // 10 meters

// Location accuracy
Location.Accuracy.Balanced

// Available durations
[5, 15, 30, 60] minutes
```

## Error Handling

The implementation handles:
- Permission denied (temporary)
- Permission denied permanently (with Settings link)
- Location unavailable
- Network errors during Firestore updates
- Location service disabled
- Timeout scenarios

## Security Considerations

1. **Permission Requests**: Always request permission before accessing location
2. **User Control**: Users can stop live sharing at any time
3. **Expiry**: Live location automatically stops after specified duration
4. **Read Receipts**: Location messages track who has read them
5. **Privacy**: Location shared only within specific chats

## Performance Optimizations

1. **Distance Filtering**: Only updates when moved 10+ meters
2. **Time Throttling**: Maximum update frequency of 5 seconds
3. **Balanced Accuracy**: Uses balanced accuracy mode (not high precision)
4. **Cleanup**: Properly removes location watchers on unmount
5. **Lazy Loading**: Location services only active when sharing

## Future Enhancements

Potential improvements:
1. Add interactive map view using expo-maps
2. Support for location history/trail visualization
3. ETA calculation between users
4. Nearby places/POI information
5. Custom duration selection
6. Battery optimization settings
7. Offline location queueing
8. Location sharing in group chats with multiple active sharers

## Dependencies

- `expo-location` (v56.x): Location services
- `firebase/firestore`: Data persistence
- `react-native-maps` (optional): For map view integration

## Testing Checklist

- [ ] Grant location permission
- [ ] Deny location permission (temporary)
- [ ] Deny location permission (permanently)
- [ ] Send current location
- [ ] Start live location (5 min)
- [ ] Stop live location manually
- [ ] Let live location expire naturally
- [ ] Open location in maps
- [ ] Test on iOS
- [ ] Test on Android
- [ ] Test with poor GPS signal
- [ ] Test with location services disabled
- [ ] Test background location updates (if needed)

## Troubleshooting

**Location permission not working:**
- Check `app.json` configuration
- Rebuild native app after permission changes
- Clear app data and reinstall

**Live location not updating:**
- Check minimum distance threshold (10m)
- Verify update interval (5s)
- Check Firestore security rules allow updates
- Ensure location services are enabled

**Maps not opening:**
- Verify device has maps app installed
- Check URL scheme permissions
- Test fallback to web maps

## References

- [Expo Location Docs](https://docs.expo.dev/versions/latest/sdk/location/)
- [Firestore Real-time Updates](https://firebase.google.com/docs/firestore/query-data/listen)
- [React Native Maps](https://github.com/react-native-maps/react-native-maps)
