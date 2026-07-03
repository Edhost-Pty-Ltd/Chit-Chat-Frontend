# Notification Debugging Guide

## Check Console Logs

With the updated code, you should see these logs in your console:

### On App Start:
```
[NotificationProvider] Rendered, user: <userId or null>
[useNotificationSync] Effect triggered, userId: <userId>
[useNotificationSync] Setting up listeners for userId: <userId>
[useNotificationSync] Chats snapshot received, docs: X, isInitialLoad: true
[useNotificationSync] Stored initial timestamp for chat: <chatId>
[useNotificationSync] Initial load complete, will notify on next change
[useNotificationSync] Setting up call history listener, will notify for calls after: <timestamp>
[useNotificationSync] All listeners set up successfully
```

### When a Message is Sent:
```
[useNotificationSync] Chats snapshot received, docs: X, isInitialLoad: false
[useNotificationSync] Processing chat updates...
[useNotificationSync] Checking chat: <chatId>, lastMsg: {...}
[useNotificationSync] Chat: <chatId>, senderId: <senderId>, currentUserId: <userId>, lastMsgTime: <time>, lastKnownTime: <time>
[useNotificationSync] NEW MESSAGE DETECTED! Chat: <chatId>
[useNotificationSync] Sender name: <name>
[useNotificationSync] Pushing notification: {...}
[NotificationContext] pushNotification called with: {...}
[NotificationContext] Created notification object: {...}
[NotificationContext] Adding to notifications, prev count: X
[NotificationContext] Setting toast
[NotificationContext] Scheduling native notification
[NotificationContext] Native notification scheduled successfully
```

### When a Call is Missed:
```
[useNotificationSync] Call history snapshot, changes: 1
[useNotificationSync] Call change type: added
[useNotificationSync] New call added, callTime: <time>, lastCallCheck: <time>
[useNotificationSync] Pushing call notification: {...}
[NotificationContext] pushNotification called with: {...}
... (same as message flow)
```

## Common Issues and Solutions

### Issue 1: No logs at all
**Problem:** Hook not being called
**Check:**
- Is the user signed in? Check `[NotificationProvider] Rendered, user: <userId>`
- Is userId null? The hook won't run without a userId

### Issue 2: "isInitialLoad: true" stays true forever
**Problem:** Snapshot never triggers a second time
**Possible causes:**
- No chats exist for the user
- Firestore listener not updating
- Network connection issue

**Solution:** Send a test message to trigger a snapshot update

### Issue 3: Logs show "Message not new or from current user, skipping"
**Problem:** Message detection logic failing
**Check:**
- Is `lastMsg.senderId !== userId` true? (senderId should be different from current user)
- Is `lastMsgTime > lastKnownTime` true? (new message should be newer)

**Debug:** Look at the log line:
```
[useNotificationSync] Chat: <chatId>, senderId: <senderId>, currentUserId: <userId>, lastMsgTime: <time>, lastKnownTime: <time>
```

### Issue 4: Notification created but not visible
**Problem:** UI not updating or toast not showing
**Check:**
- Is `ToastOverlay` component mounted in App.tsx?
- Check NotificationsScreen to see if notification appears in inbox
- Check device notification settings (permissions)

### Issue 5: Call notifications not working
**Problem:** Call history query failing
**Possible causes:**
- Firestore index not created for the compound query
- callHistory collection doesn't exist
- Call status not being set to 'missed' or 'rejected'

**Solution:** Check Firestore console for index requirements

## Manual Testing

### Test Message Notification Manually

Add this button to any screen (temporarily):

```typescript
import { useNotifications } from '../context/NotificationContext';

// In your component:
const { pushNotification } = useNotifications();

<Button 
  title="Test Message Notification" 
  onPress={() => {
    console.log('Manual test notification triggered');
    pushNotification({
      type: 'message',
      title: 'Test User',
      body: 'This is a test message',
      contactId: 'test-user-123',
    });
  }}
/>
```

If this button works, the notification system is functioning - the issue is with the Firestore listener.

### Test Call Notification Manually

```typescript
<Button 
  title="Test Call Notification" 
  onPress={() => {
    console.log('Manual test call notification triggered');
    pushNotification({
      type: 'call',
      title: 'Missed Call',
      body: 'Test Caller tried to call you',
      contactId: 'test-caller-123',
    });
  }}
/>
```

## Verify Firestore Structure

### Check Chat Document Structure:
```javascript
// In Firestore console, check your chat document has:
{
  members: ['userId1', 'userId2'],
  type: 'direct',
  lastMessage: {
    text: 'Hello',
    senderId: 'userId1',
    timestamp: Timestamp
  }
}
```

### Check Call History Document Structure:
```javascript
// In users/{userId}/callHistory/{callId}:
{
  direction: 'incoming',
  status: 'missed',
  type: 'audio',
  otherParty: {
    userId: 'callerId',
    displayName: 'Caller Name',
  },
  timestamp: Timestamp
}
```

## Firestore Rules Check

Make sure your Firestore rules allow reading:

```
// Users can read their own chats
match /chats/{chatId} {
  allow read: if request.auth != null && 
    request.auth.uid in resource.data.members;
}

// Users can read their own call history
match /users/{userId}/callHistory/{callId} {
  allow read: if request.auth != null && 
    request.auth.uid == userId;
}
```

## Expected Behavior

### Message Flow:
1. User A sends message to User B
2. Firestore updates chat document's `lastMessage`
3. User B's app receives snapshot update
4. Hook detects new message (senderId ≠ currentUserId)
5. Hook fetches sender info from Firestore
6. Hook calls `pushNotification()`
7. Notification appears as toast + in inbox + device notification

### Call Flow:
1. User A calls User B
2. Call times out or gets rejected
3. Firestore creates document in User B's callHistory
4. User B's app receives snapshot update (docChange type: 'added')
5. Hook checks if call timestamp is after listener start time
6. Hook calls `pushNotification()`
7. Notification appears

## Next Steps if Still Not Working

1. **Check console logs** - Find which step is failing
2. **Test manual notification** - Rule out UI issues
3. **Check Firestore console** - Verify data structure
4. **Check network tab** - Ensure Firestore queries are executing
5. **Verify permissions** - Check notification permissions in device settings
6. **Try on different device** - Rule out device-specific issues

## Report Issue

If still not working, provide:
1. Full console log output (from app start through sending a message)
2. Screenshot of Firestore chat document
3. Screenshot of NotificationsScreen (to see if notification is in inbox)
4. Result of manual test button
5. Platform (iOS/Android/Web)
6. Device info
