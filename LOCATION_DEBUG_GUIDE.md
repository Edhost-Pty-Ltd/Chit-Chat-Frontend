# Location Message Empty Bubble - Debug Guide

## Issue
Location message bubbles appear empty on the receiver's side.

## Changes Made for Debugging

### 1. Added Debug Message Display
**File**: `src/screens/ChatScreen.tsx`

Changed the location rendering logic to show a debug message when location data is missing:
- If `item.location` is undefined/null, it now shows `[Location data unavailable]`
- In development mode (`__DEV__`), it also shows the full message object as JSON
- This applies to both sender and receiver sides

### 2. Added Console Logging
**File**: `src/hooks/useMessages.ts`

Added console logging when location messages are received:
```javascript
if (d.type === 'location') {
  console.log('[useMessages] Location message received:', {
    messageId: doc.id,
    hasLocation: !!d.location,
    location: d.location,
    isLiveLocation: d.isLiveLocation,
  });
}
```

## How to Debug

### Step 1: Send a Location Message
1. Open a chat
2. Tap attachment button → Location
3. Send current location

### Step 2: Check Console Logs
Look for these log messages:

**From the sender:**
```
[sendCurrentLocationMessage] Sending location...
[sendCurrentLocationMessage] Message created successfully
```

**From the receiver:**
```
[useMessages] Location message received: {
  messageId: "...",
  hasLocation: true/false,
  location: {...} or null,
  isLiveLocation: false
}
```

### Step 3: Check the Message Bubble

**If you see the LocationMessageBubble component:**
✅ Location data is being passed correctly

**If you see `[Location data unavailable]`:**
❌ Location data is missing from the message
- Check the debug JSON output to see what fields are present
- This indicates the data isn't being saved to Firestore correctly

## Possible Issues to Check

### 1. Firestore Security Rules
The location field might be blocked by security rules. Check your Firestore rules to ensure:
```javascript
allow update: if request.auth != null && 
  request.resource.data.keys().hasAll(['location', 'type', 'timestamp']);
```

### 2. Location Data Structure
The location object should have this structure:
```typescript
{
  latitude: number,
  longitude: number,
  accuracy?: number,
  altitude?: number | null,
  altitudeAccuracy?: number | null,
  heading?: number | null,
  speed?: number | null,
  timestamp: number
}
```

### 3. Message Type
Verify the message type is set to `'location'` in Firestore

### 4. Check Firestore Console
1. Go to Firebase Console
2. Navigate to Firestore Database
3. Find: `chats/{chatId}/messages/{messageId}`
4. Verify the document has:
   - `type: 'location'`
   - `location: { latitude, longitude, ... }`

## Next Steps Based on Console Output

### If `hasLocation: false`
The location data isn't being saved to Firestore:
- Check Firestore security rules
- Check the `sendCurrentLocationMessage` function
- Verify the location object is properly formed before sending

### If `hasLocation: true` but bubble is empty
The LocationMessageBubble component has an issue:
- Check if the component is receiving props correctly
- Check if there's a rendering error in the component
- Look for JavaScript errors in the console

### If you see the message on sender but not receiver
This is a real-time sync issue:
- Ensure both devices are connected to the internet
- Check if Firestore real-time listeners are working
- Try refreshing the receiver's app

## Remove Debug Code Later

Once the issue is resolved, you can remove:
1. The `[Location data unavailable]` fallback in ChatScreen.tsx (keep the check, but remove debug display)
2. The console.log statement in useMessages.ts (optional)

Or keep them for future debugging purposes.
