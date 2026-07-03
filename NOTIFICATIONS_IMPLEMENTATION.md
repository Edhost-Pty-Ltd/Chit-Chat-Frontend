# Real Notifications Implementation

## Overview

The notification system has been upgraded from mock data to real-time Firestore integration. Notifications now automatically appear when:
- Someone sends you a message
- You receive an incoming call (missed or rejected)
- System events occur (extensible for future features)

## Changes Made

### 1. New Hook: `useNotificationSync.ts`

**Location:** `src/hooks/useNotificationSync.ts`

This hook listens to Firestore events and triggers notifications:

**Message Notifications:**
- Monitors all chats where the user is a member
- Detects new messages from other users
- Fetches sender information from Firestore
- Handles both direct and group chats
- Shows sender name and message preview

**Call Notifications:**
- Monitors user's call history collection
- Detects missed and rejected incoming calls
- Shows caller name and call type (audio/video)

**Key Features:**
- **Initial load protection:** Doesn't show notifications for existing messages on first load
- **Real-time updates:** Uses Firestore `onSnapshot` for instant notifications
- **Proper cleanup:** Unsubscribes from listeners when component unmounts or user signs out

### 2. Updated: `NotificationContext.tsx`

**Removed:**
- All mock notification data
- Demo welcome toast on app load
- Auto-simulation timer (15-second fake notifications)

**Added:**
- Integration with `useAuth` to get current user ID
- Integration with `useNotificationSync` hook
- Helper function `formatNotificationTime()` for relative time display ("2m ago", "Yesterday", etc.)

**Updated:**
- `AppNotification.contactId` type changed from `number` to `string` (matches Firebase user IDs)
- `pushNotification()` now uses the new time formatting function

### 3. Updated: `NotificationsScreen.tsx`

**Changed:**
- Import `useAuth` and `getOrCreateDirectChat`
- Notification tap handler now properly navigates to the chat with the contact
- When tapped, creates or opens existing direct chat with the user
- Passes correct parameters to Chat screen (chatId, displayName, isGroup, otherUserId)

## Data Flow

```
Firestore Event (new message/call)
    ↓
useNotificationSync detects change
    ↓
Calls pushNotification() from NotificationContext
    ↓
NotificationContext:
  - Adds to notifications array
  - Shows toast overlay
  - Sends native device notification
  - Updates badge count
    ↓
User sees notification in:
  - Toast overlay (4 seconds)
  - Notifications screen
  - Device notification center
  - App badge
```

## Firestore Structure Expected

### Messages
```
chats/{chatId}/
  members: [userId1, userId2, ...]
  type: 'direct' | 'group'
  groupName?: string
  lastMessage: {
    text: string
    senderId: string
    timestamp: Timestamp
  }
```

### Call History
```
users/{userId}/callHistory/{callId}/
  direction: 'incoming' | 'outgoing'
  status: 'completed' | 'missed' | 'rejected' | 'busy' | 'failed'
  type: 'audio' | 'video'
  otherParty: {
    userId: string
    displayName: string
    photoUrl?: string
  }
  timestamp: Timestamp
```

## How to Test

1. **Message Notifications:**
   - Open two accounts on different devices
   - Send a message from device A to device B
   - Device B should show a notification with sender name and message preview
   - Tapping the notification should open the chat

2. **Call Notifications:**
   - Make a call from device A to device B
   - Let it ring out (missed) or reject it
   - Device B should show a "Missed Call" or "Rejected Call" notification
   - Tapping should navigate to Chats screen

3. **Badge Count:**
   - App icon badge should update with unread notification count
   - Mark all as read should clear the badge

## Future Enhancements

### Possible additions:
1. **Typing indicators:** Show "X is typing..." notification
2. **Status updates:** When contacts post new status
3. **Group mentions:** Special notification for @mentions in groups
4. **Message reactions:** Notify when someone reacts to your message
5. **Contact updates:** When contacts change their profile photo or name
6. **Scheduled messages:** Notifications for scheduled message delivery
7. **Notification preferences:** Allow users to mute specific chats or types

### Technical improvements:
1. **Notification persistence:** Store notifications in AsyncStorage for offline access
2. **Background fetch:** Continue syncing notifications when app is closed
3. **Push notification tokens:** Register device tokens for server-side push
4. **Rich notifications:** Show image previews for media messages
5. **Action buttons:** Quick reply or call back from notification
6. **Notification channels:** Separate channels for messages, calls, and system (Android)

## Notification Categories

The system supports 4 notification types (extensible):

- `message` - New message received (blue icon)
- `call` - Missed or rejected call (green icon)
- `number_change` - Contact changed phone number (orange icon)
- `system` - App updates, backups, alerts (gray icon)

## Privacy Considerations

- Only shows notifications when user is signed in
- Respects blocked contacts (messages from blocked users are silently ignored)
- Does not show message content in notifications if user has enabled "Hide Previews" (future feature)
- Only processes events after the listener starts (doesn't retroactively notify about old messages)

## Performance Notes

- Uses Firestore's compound indexes for efficient queries
- Limits queries using `where` clauses to reduce data transfer
- Unsubscribes from all listeners when user signs out
- Fetches user data on-demand only when notification is triggered
- Implements initial load protection to avoid notification spam on app start
