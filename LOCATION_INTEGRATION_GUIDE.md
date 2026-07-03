# Location Sharing Integration Guide

This guide explains how to integrate the location sharing feature into your ChatScreen.

## Quick Integration Steps

### Step 1: Import Required Dependencies

Add these imports to your `ChatScreen.tsx`:

```typescript
import { useLocationSharing } from '../hooks/useLocationSharing';
import { LocationMessageBubble } from '../components';
import { 
  sendCurrentLocationMessage, 
  sendLiveLocationMessage, 
  stopLiveLocationSharing 
} from '../hooks/useChatActions';
```

### Step 2: Initialize the Hook

In your ChatScreen component:

```typescript
export default function ChatScreen() {
  // ... existing code
  
  const locationSharing = useLocationSharing();
  const [showLocationMenu, setShowLocationMenu] = useState(false);
  const [selectedDuration, setSelectedDuration] = useState(15);
  
  // ... rest of component
}
```

### Step 3: Add Location Sharing Handlers

Add these handler functions:

```typescript
// Handle sending current location
const handleSendCurrentLocation = async () => {
  if (!userId) return;
  
  setShowLocationMenu(false);
  
  const location = await locationSharing.getCurrentLocation();
  if (!location) {
    Alert.alert('Error', locationSharing.error || 'Failed to get location');
    return;
  }
  
  const result = await sendCurrentLocationMessage(chatId, userId, location);
  
  if (!result.success) {
    Alert.alert('Error', 'Failed to send location');
  }
};

// Handle starting live location
const handleStartLiveLocation = async () => {
  if (!userId) return;
  
  setShowLocationMenu(false);
  
  const location = await locationSharing.getCurrentLocation();
  if (!location) {
    Alert.alert('Error', locationSharing.error || 'Failed to get location');
    return;
  }
  
  const result = await sendLiveLocationMessage(
    chatId,
    userId,
    location,
    selectedDuration
  );
  
  if (!result.success) {
    Alert.alert('Error', 'Failed to send live location');
    return;
  }
  
  const started = await locationSharing.startLiveSharing(
    chatId,
    result.messageId,
    selectedDuration
  );
  
  if (!started) {
    Alert.alert('Error', locationSharing.error || 'Failed to start live sharing');
  }
};

// Handle stopping live location
const handleStopLiveLocation = async (messageId: string) => {
  await locationSharing.stopLiveSharing();
  await stopLiveLocationSharing(chatId, messageId);
};
```

### Step 4: Add Location Button to Attachment Menu

Update your attachment menu (the one that shows when you tap the paperclip icon):

```typescript
{showAttach && (
  <View style={styles.attachMenu}>
    {/* Existing attachment options */}
    <TouchableOpacity 
      style={styles.attachOption}
      onPress={() => {
        setShowAttach(false);
        setShowLocationMenu(true);
      }}
    >
      <AppIcon name="location" size={24} color={COLORS.primary} />
      <AppText style={styles.attachLabel}>Location</AppText>
    </TouchableOpacity>
  </View>
)}
```

### Step 5: Add Location Menu Modal

Add a modal for location options:

```typescript
{/* Location Sharing Menu */}
<Modal
  visible={showLocationMenu}
  transparent
  animationType="fade"
  onRequestClose={() => setShowLocationMenu(false)}
>
  <TouchableOpacity 
    style={styles.modalOverlay}
    activeOpacity={1}
    onPress={() => setShowLocationMenu(false)}
  >
    <View style={styles.locationMenu}>
      <AppText style={styles.locationMenuTitle}>Share Location</AppText>
      
      {/* Current Location */}
      <TouchableOpacity 
        style={styles.locationOption}
        onPress={handleSendCurrentLocation}
      >
        <AppIcon name="location" size={24} color={COLORS.primary} />
        <View style={styles.locationOptionText}>
          <AppText style={styles.locationOptionTitle}>Current Location</AppText>
          <AppText style={styles.locationOptionDesc}>Send your current location</AppText>
        </View>
      </TouchableOpacity>
      
      {/* Live Location */}
      <View style={styles.locationOption}>
        <AppIcon name="navigate" size={24} color={COLORS.primary} />
        <View style={styles.locationOptionText}>
          <AppText style={styles.locationOptionTitle}>Live Location</AppText>
          <AppText style={styles.locationOptionDesc}>Share for:</AppText>
          <View style={styles.durationButtons}>
            {[5, 15, 30, 60].map((duration) => (
              <TouchableOpacity
                key={duration}
                style={[
                  styles.durationButton,
                  selectedDuration === duration && styles.durationButtonActive,
                ]}
                onPress={() => setSelectedDuration(duration)}
              >
                <AppText style={styles.durationText}>{duration}m</AppText>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity 
            style={styles.startLiveButton}
            onPress={handleStartLiveLocation}
          >
            <AppText style={styles.startLiveButtonText}>Start Sharing</AppText>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  </TouchableOpacity>
</Modal>
```

### Step 6: Render Location Messages

In your message rendering section, add handling for location messages:

```typescript
// In your renderMessage function or message list
const renderMessage = ({ item: msg }: { item: FireMessage }) => {
  const isSender = msg.senderId === userId;
  
  // ... existing message type handling
  
  // Location message
  if (msg.type === 'location' && msg.location) {
    return (
      <View style={[styles.messageBubble, isSender ? styles.senderBubble : styles.receiverBubble]}>
        <LocationMessageBubble
          location={msg.location}
          isLiveLocation={msg.isLiveLocation}
          liveLocationExpiry={msg.liveLocationExpiry}
          isSender={isSender}
          onStopSharing={() => handleStopLiveLocation(msg.messageId)}
        />
        <AppText style={styles.messageTime}>
          {formatTime(msg.timestamp)}
        </AppText>
      </View>
    );
  }
  
  // ... other message types
};
```

### Step 7: Add Styles

Add these styles to your StyleSheet:

```typescript
const styles = StyleSheet.create({
  // ... existing styles
  
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  locationMenu: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    padding: 20,
    gap: 16,
  },
  locationMenuTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  locationOption: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.lg,
  },
  locationOptionText: {
    flex: 1,
    gap: 4,
  },
  locationOptionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  locationOptionDesc: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  durationButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  durationButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surface,
  },
  durationButtonActive: {
    backgroundColor: COLORS.primary,
  },
  durationText: {
    fontSize: 14,
    fontWeight: '600',
  },
  startLiveButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    marginTop: 12,
  },
  startLiveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
```

### Step 8: Update FireMessage Type

Make sure your `FireMessage` type includes location fields:

```typescript
interface FireMessage {
  messageId: string;
  senderId: string;
  text: string | null;
  type: 'text' | 'image' | 'video' | 'voice' | 'audio' | 'file' | 'location';
  timestamp: Date;
  readBy: string[];
  
  // Location fields
  location?: LocationData | null;
  isLiveLocation?: boolean;
  liveLocationExpiry?: Date | null;
  
  // ... other fields
}
```

## Minimal Integration (Simpler Version)

If you want a simpler integration without the full UI:

```typescript
// Add button next to send button
<TouchableOpacity 
  style={styles.iconButton}
  onPress={async () => {
    if (!userId) return;
    const location = await locationSharing.getCurrentLocation();
    if (location) {
      await sendCurrentLocationMessage(chatId, userId, location);
    }
  }}
>
  <AppIcon name="location" size={24} color={COLORS.primary} />
</TouchableOpacity>

// Render in message list
{msg.type === 'location' && msg.location && (
  <LocationMessageBubble
    location={msg.location}
    isLiveLocation={msg.isLiveLocation}
    liveLocationExpiry={msg.liveLocationExpiry}
    isSender={msg.senderId === userId}
    onStopSharing={() => handleStopLiveLocation(msg.messageId)}
  />
)}
```

## Testing After Integration

1. Test sending current location
2. Test starting live location with different durations
3. Test stopping live location manually
4. Test live location expiration
5. Test opening in maps app
6. Test with location permission denied
7. Test with location services disabled

## Common Issues

**Location not updating:**
- Ensure device has location services enabled
- Check app has location permission
- Verify not in battery saver mode

**Permission errors:**
- Make sure `app.json` is configured correctly
- Rebuild app after adding location plugin
- Check platform-specific permission settings

**Maps not opening:**
- Verify maps app is installed on device
- Check URL scheme is correct for platform
- Test fallback to web URL

## Next Steps

After basic integration works:
1. Add loading states during location fetch
2. Add permission explanation UI
3. Improve error messages
4. Add location sharing indicator in chat header
5. Consider adding map preview instead of placeholder
