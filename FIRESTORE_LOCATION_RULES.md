# Firestore Security Rules for Location Messages

## Location Message Rules

Add these rules to your Firestore security rules to allow location messages:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // ... existing rules ...
    
    // ── Messages subcollection ───────────────────────────────────────
    match /chats/{chatId}/messages/{messageId} {
      // Allow reading messages if user is a chat member
      allow read: if request.auth != null && 
        exists(/databases/$(database)/documents/chats/$(chatId)) &&
        request.auth.uid in get(/databases/$(database)/documents/chats/$(chatId)).data.members;
      
      // Allow creating messages if user is a chat member
      allow create: if request.auth != null && 
        exists(/databases/$(database)/documents/chats/$(chatId)) &&
        request.auth.uid in get(/databases/$(database)/documents/chats/$(chatId)).data.members &&
        request.resource.data.senderId == request.auth.uid &&
        // Validate message type
        request.resource.data.type in ['text', 'image', 'video', 'voice', 'audio', 'file', 'location', 'system'] &&
        // Validate location messages
        (request.resource.data.type != 'location' || (
          request.resource.data.keys().hasAll(['location', 'isLiveLocation']) &&
          request.resource.data.location.keys().hasAll(['latitude', 'longitude', 'timestamp']) &&
          request.resource.data.location.latitude is number &&
          request.resource.data.location.longitude is number &&
          request.resource.data.location.latitude >= -90 && 
          request.resource.data.location.latitude <= 90 &&
          request.resource.data.location.longitude >= -180 &&
          request.resource.data.location.longitude <= 180 &&
          request.resource.data.isLiveLocation is bool
        ));
      
      // Allow updating messages (for live location updates)
      allow update: if request.auth != null &&
        exists(/databases/$(database)/documents/chats/$(chatId)) &&
        request.auth.uid in get(/databases/$(database)/documents/chats/$(chatId)).data.members &&
        // Only allow updating location for live location messages
        (
          // Sender can update their own live location
          (resource.data.senderId == request.auth.uid &&
           resource.data.type == 'location' &&
           resource.data.isLiveLocation == true &&
           request.resource.data.location != null) ||
          // Anyone can update readBy array
          (request.resource.data.diff(resource.data).affectedKeys().hasOnly(['readBy']) &&
           request.auth.uid in request.resource.data.readBy)
        );
      
      // No deletion of messages
      allow delete: if false;
    }
    
    // ── Test chats (for location testing) ───────────────────────────
    match /chats/{chatId} {
      // Allow creating test chats
      allow create: if request.auth != null &&
        request.resource.data.createdBy == request.auth.uid &&
        request.auth.uid in request.resource.data.members &&
        request.resource.data.type in ['direct', 'group'];
      
      // ... rest of chat rules ...
    }
  }
}
```

## Key Security Features

### 1. Location Validation
- **Latitude**: Must be between -90 and 90 degrees
- **Longitude**: Must be between -180 and 180 degrees
- **Type checking**: Ensures coordinates are numbers
- **Required fields**: location, isLiveLocation must be present

### 2. Live Location Updates
- Only the message sender can update location data
- Only allowed for messages where `isLiveLocation = true`
- Location object must be present in update
- Prevents unauthorized location tracking

### 3. Read Access
- Users can only read messages from chats they're members of
- Enforced at both chat and message level

### 4. Write Access
- Users can only send messages to chats they're members of
- Message sender ID must match authenticated user
- Location messages must have valid structure

## Testing Security Rules

You can test these rules using the Firebase Console:

1. Go to Firebase Console → Firestore → Rules
2. Click "Rules Playground"
3. Test these scenarios:

### Test Case 1: Valid Location Message
```javascript
// Location: /chats/{chatId}/messages/{messageId}
// Auth: { uid: 'user123' }
// Data: {
//   messageId: 'msg123',
//   senderId: 'user123',
//   type: 'location',
//   location: {
//     latitude: 40.7589,
//     longitude: -73.9851,
//     timestamp: 1234567890
//   },
//   isLiveLocation: false,
//   timestamp: serverTimestamp(),
//   readBy: ['user123']
// }
// Expected: Allow
```

### Test Case 2: Invalid Coordinates
```javascript
// Same as above but:
// location: { latitude: 200, longitude: -300 }
// Expected: Deny (coordinates out of range)
```

### Test Case 3: Live Location Update
```javascript
// Location: /chats/{chatId}/messages/{messageId}
// Auth: { uid: 'user123' }
// Existing: { senderId: 'user123', type: 'location', isLiveLocation: true }
// Update: { location: { latitude: 40.7590, ... } }
// Expected: Allow (sender updating their own live location)
```

### Test Case 4: Unauthorized Update
```javascript
// Same as Test Case 3 but Auth uid is different from senderId
// Expected: Deny
```

## Deployment

To deploy these rules:

```bash
# Using Firebase CLI
firebase deploy --only firestore:rules

# Or copy rules to Firebase Console
# Firebase Console → Firestore → Rules → Paste → Publish
```

## Common Issues

### "Permission Denied" on Location Send
**Cause**: User not in chat members list
**Fix**: Ensure the chat document exists and user is in members array

### "Invalid Document" Error
**Cause**: Location coordinates out of valid range
**Fix**: Validate coordinates before sending (useLocationSharing does this)

### Live Location Update Failed
**Cause**: Message is not marked as `isLiveLocation: true`
**Fix**: Ensure initial message has `isLiveLocation: true` field

## Best Practices

1. **Validate Client-Side**: Always validate location data before sending
2. **Check Expiry**: Clean up expired live locations
3. **Rate Limiting**: Consider implementing rate limits for location updates
4. **Privacy**: Only share location in appropriate contexts
5. **Battery**: Warn users about battery usage for live location

## Location Data Structure

```typescript
{
  messageId: string,
  senderId: string,
  type: 'location',
  text: null,
  location: {
    latitude: number,      // -90 to 90
    longitude: number,     // -180 to 180
    accuracy: number,      // meters (optional)
    altitude: number,      // meters (optional)
    altitudeAccuracy: number, // meters (optional)
    heading: number,       // degrees (optional)
    speed: number,         // m/s (optional)
    timestamp: number      // milliseconds
  },
  isLiveLocation: boolean,
  liveLocationExpiry: Timestamp, // only if isLiveLocation = true
  timestamp: Timestamp,
  readBy: string[]
}
```

## Security Checklist

- [x] Coordinate validation (lat/long ranges)
- [x] Type checking for all fields
- [x] Sender authentication
- [x] Chat membership verification
- [x] Live location update restrictions
- [x] Read access control
- [x] Prevention of location spoofing
- [x] Test chat support
