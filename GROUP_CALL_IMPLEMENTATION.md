# Group Call Implementation - Fix Documentation

## Problem

When initiating a group call, only the initiator joined the Jitsi call. Other group members received no notification and couldn't join the call.

## Root Cause

The original implementation only navigated the initiator to the Jitsi call screen without:
1. Creating a call document in Firestore
2. Sending notifications to other group members
3. Providing a way for members to join ongoing calls

## Solution Overview

Implemented a complete group call notification system with:
- **Firestore-based call tracking** - Stores active group calls
- **Real-time notifications** - Alerts group members when calls start
- **Join call UI** - Modal notification allowing members to join
- **Call lifecycle management** - Tracks who's in the call and cleans up when it ends

## New Files Created

### 1. `src/hooks/useGroupCall.ts`
Hook for managing group calls:
- `initiateGroupCall()` - Creates call document and sends notifications
- `joinGroupCall()` - Adds user to active participants
- `leaveGroupCall()` - Removes user from active participants
- `endGroupCall()` - Ends the call for everyone

### 2. `src/hooks/useGroupCallNotifications.ts`
Hook for listening to incoming group call notifications:
- Real-time listener for pending notifications
- `dismissNotification()` - Dismisses a notification

### 3. `src/components/GroupCallNotification.tsx`
UI component displaying incoming group call invitation:
- Shows call type (audio/video) and initiator name
- Join and Dismiss buttons
- Blue-tinted glassmorphism design

### 4. `src/components/GroupCallNotificationManager.tsx`
Global manager that:
- Listens for notifications across the app
- Shows the modal when calls come in
- Handles join/dismiss actions

## Modified Files

### 1. `src/screens/ChatScreen.tsx`
**Changes:**
- Added `useGroupCall()` hook
- Updated `handleVoiceCall()` to create call documents and send notifications for group calls
- Updated `handleVideoCall()` to create call documents and send notifications for group calls

**Before (Group Call):**
```typescript
navigation.navigate('JitsiCall', {
  roomName: `chitchat-${chatId}`,
  displayName: userDisplayName,
  audioOnly: true,
  chatId,
});
```

**After (Group Call):**
```typescript
const result = await groupCall.initiateGroupCall(
  chatId,
  userId,
  userDisplayName,
  memberIds,
  'audio'
);

if (result) {
  navigation.navigate('JitsiCall', {
    roomName: result.roomName,
    displayName: userDisplayName,
    audioOnly: true,
    chatId,
    callId: result.callId, // Track the call
  });
}
```

### 2. `src/screens/JitsiCallScreen.tsx`
**Changes:**
- Added `useAuth()` and `useGroupCall()` hooks
- Joins group call on mount (updates active participants)
- Leaves group call on unmount (removes from active participants)
- Properly cleans up when user ends call

### 3. `src/types/index.ts`
**Changes:**
- Added `callId?: string` to `JitsiCall` navigation params

### 4. `App.tsx`
**Changes:**
- Added `<GroupCallNotificationManager />` component
- Listens for group call notifications globally

## Firestore Structure

### Collection: `groupCalls`
Document ID: `group-call-{timestamp}-{random}`

```typescript
{
  callId: string;
  chatId: string;
  roomName: string;              // e.g., "chitchat-{chatId}"
  initiatorId: string;
  initiatorName: string;
  callType: 'audio' | 'video';
  status: 'active' | 'ended';
  startedAt: Timestamp;
  participants: string[];         // All group member IDs
  activeParticipants: string[];   // Currently in the call
}
```

### Collection: `users/{userId}/groupCallNotifications`
Document ID: `{callId}`

```typescript
{
  callId: string;
  chatId: string;
  roomName: string;
  initiatorId: string;
  initiatorName: string;
  callType: 'audio' | 'video';
  status: 'pending' | 'dismissed';
  createdAt: Timestamp;
}
```

## Firestore Security Rules

Add these rules to your `firestore.rules`:

```javascript
// Group calls collection
match /groupCalls/{callId} {
  allow read: if request.auth != null;
  allow create: if request.auth != null 
    && request.resource.data.initiatorId == request.auth.uid;
  allow update: if request.auth != null 
    && (request.auth.uid in resource.data.participants 
        || request.auth.uid == resource.data.initiatorId);
}

// Group call notifications
match /users/{userId}/groupCallNotifications/{notificationId} {
  allow read: if request.auth != null && request.auth.uid == userId;
  allow write: if request.auth != null;
}
```

## How It Works

### 1. Initiating a Group Call

```
User A clicks call button
  ↓
ChatScreen.handleVoiceCall()
  ↓
groupCall.initiateGroupCall()
  ↓
Creates groupCalls/{callId} document
  ↓
Sends notifications to users/{userId}/groupCallNotifications/{callId} 
for each group member
  ↓
Navigates User A to JitsiCallScreen
```

### 2. Receiving a Group Call Notification

```
Notification created in Firestore
  ↓
useGroupCallNotifications hook detects new notification
  ↓
GroupCallNotificationManager shows modal
  ↓
User clicks "Join"
  ↓
Updates groupCalls/{callId}.activeParticipants
  ↓
Navigates to JitsiCallScreen with same roomName
```

### 3. Leaving a Call

```
User leaves call or closes screen
  ↓
JitsiCallScreen cleanup effect runs
  ↓
groupCall.leaveGroupCall()
  ↓
Removes user from activeParticipants
  ↓
If last participant, marks call as 'ended'
```

## User Experience

1. **Initiator starts call** → Immediately joins Jitsi room
2. **Group members receive notification** → See modal with Join/Dismiss options
3. **Members join** → Join same Jitsi room, can see/hear each other
4. **Call continues** → All participants in same room
5. **Members leave** → Removed from active participants
6. **Last person leaves** → Call marked as ended automatically

## Testing Checklist

- [ ] Start group voice call - all members notified
- [ ] Start group video call - all members notified
- [ ] Join call from notification - successfully joins
- [ ] Dismiss notification - notification disappears
- [ ] Multiple members join - all can communicate
- [ ] Leave call - removed from active participants
- [ ] Last person leaves - call marked as ended
- [ ] Notification appears even if app is in background (requires FCM)

## Known Limitations

1. **No FCM push notifications yet** - Notifications only work when app is open
2. **No call history** - Group calls aren't saved to call history yet
3. **No "call ended" notification** - Members don't get notified when call ends
4. **No maximum participant limit** - Jitsi might have performance issues with many users

## Future Enhancements

1. **Add FCM push notifications** for background notifications
2. **Add call history** for group calls
3. **Show active call indicator** in chat list
4. **Add "call ended" notification** when initiator ends call
5. **Add participant list** showing who's currently in the call
6. **Add "call in progress" banner** in the chat screen
7. **Add call duration tracking**

## Troubleshooting

### Notifications not showing
- Check Firestore rules are properly configured
- Verify user is logged in (`user?.uid` exists)
- Check console for errors in `useGroupCallNotifications`

### Can't join call
- Verify `callId` is being passed correctly
- Check that call status is 'active' in Firestore
- Ensure user is in the group members list

### Multiple notifications showing
- Check that notifications are being dismissed after join
- Verify `status` field is being updated to 'dismissed'

## Dependencies

All dependencies already exist in the project:
- Firestore (already configured)
- React Navigation (already configured)
- Jitsi Meet via WebView (already implemented)
- expo-av (for audio permissions)
