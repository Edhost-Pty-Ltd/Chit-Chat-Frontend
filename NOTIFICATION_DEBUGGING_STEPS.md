# Notification Debugging - Start Here

## Quick Steps to Debug

### Step 1: Check if notifications work at all

1. **Add the test panel** (see `TESTING_NOTIFICATIONS.md`)
2. **Run your app**
3. **Tap "Test Message" button**
4. **Check console for logs**

**If you see notifications from the test button:** ✅ Notification system works!
→ Problem is with Firestore listeners (go to Step 2)

**If you don't see notifications from test button:** ❌ System issue
→ Check:
- Is user signed in? Look for `[NotificationProvider] Rendered, user: <userId>`
- Any JavaScript errors in console?
- Is ToastOverlay mounted in App.tsx?
- Device notification permissions granted?

### Step 2: Check Firestore listeners are set up

Look for these logs when app starts:
```
[useNotificationSync] Effect triggered, userId: <your-user-id>
[useNotificationSync] Setting up listeners for userId: <your-user-id>
[useNotificationSync] Chats snapshot received, docs: X, isInitialLoad: true
[useNotificationSync] Stored initial timestamp for chat: <chatId>
[useNotificationSync] Initial load complete, will notify on next change
[useNotificationSync] Setting up call history listener
[useNotificationSync] All listeners set up successfully
```

**If you see these logs:** ✅ Listeners are running!
→ Go to Step 3

**If you don't see these logs:**
- User might not be signed in
- Check `userId` is not null
- Check for Firebase connection errors

### Step 3: Send a test message

1. **Open two devices** with different accounts (Device A and Device B)
2. **Make sure Device B is on the Chats screen** (or any screen)
3. **Send a message from Device A to Device B**
4. **Watch Device B's console**

**Expected logs on Device B:**
```
[useNotificationSync] Chats snapshot received, docs: 1, isInitialLoad: false
[useNotificationSync] Processing chat updates, changes: 1
[useNotificationSync] Chat change: modified, chatId: <chatId>
[useNotificationSync] Chat: <chatId>, senderId: <device-a-user-id>, currentUserId: <device-b-user-id>
[useNotificationSync] NEW MESSAGE DETECTED! Chat: <chatId>
[useNotificationSync] Sender name: <sender-name>
[useNotificationSync] Pushing notification: {...}
[NotificationContext] pushNotification called with: {...}
[NotificationContext] Native notification scheduled successfully
```

### Common Problems and Solutions

#### Problem: "Chats snapshot received" never appears after sending message

**Cause:** Firestore listener not updating

**Solutions:**
1. Check network connection
2. Verify Firestore rules allow reading chats:
   ```
   match /chats/{chatId} {
     allow read: if request.auth != null && 
       request.auth.uid in resource.data.members;
   }
   ```
3. Check chat document exists and has correct structure
4. Try refreshing/restarting the app

#### Problem: "Message not new or from current user, skipping"

**Cause 1:** You're sending from the same account
- `senderId === currentUserId`
- Notifications only show for messages from OTHER users

**Solution:** Send from a different account

**Cause 2:** Message timestamp not updating correctly
- Check the log line showing `lastMsgTime` vs `lastKnownTime`
- New message should have newer timestamp

#### Problem: Snapshot received but no "Chat change" logs

**Cause:** No actual changes in the snapshot

**Solution:** Send a NEW message (not just open the chat)

#### Problem: "Error fetching sender info"

**Cause:** Sender user document doesn't exist or can't be read

**Solutions:**
1. Verify sender's user document exists in Firestore
2. Check Firestore rules allow reading users collection
3. Check sender ID is correct

## What Each Log Means

| Log | Meaning | Action if Missing |
|-----|---------|------------------|
| `[NotificationProvider] Rendered, user: <userId>` | Provider loaded with user | Sign in |
| `[useNotificationSync] Effect triggered` | Hook starting | Check provider is mounted |
| `[useNotificationSync] Setting up listeners` | Subscribing to Firestore | Check Firebase connection |
| `[useNotificationSync] Chats snapshot received` | Got chat data | Check Firestore rules |
| `[useNotificationSync] isInitialLoad: false` | Ready for notifications | Send a message |
| `[useNotificationSync] Chat change: modified` | Chat document changed | Check chat is being updated |
| `[useNotificationSync] NEW MESSAGE DETECTED!` | Passed all checks | - |
| `[NotificationContext] pushNotification called` | Notification created | Check previous steps |

## Test Checklist

Use this checklist to systematically test:

- [ ] App starts without errors
- [ ] Console shows `[NotificationProvider] Rendered, user: <userId>`
- [ ] Console shows `[useNotificationSync] All listeners set up successfully`
- [ ] Test button creates notification (appears as toast and in inbox)
- [ ] Two devices with different accounts ready
- [ ] Device B shows "Initial load complete" log
- [ ] Send message from Device A
- [ ] Device B shows "Chats snapshot received, isInitialLoad: false"
- [ ] Device B shows "Chat change: modified"
- [ ] Device B shows "NEW MESSAGE DETECTED!"
- [ ] Device B shows "pushNotification called"
- [ ] Notification appears on Device B (toast + inbox + device)
- [ ] Tapping notification opens correct chat

## Still Not Working?

If you've gone through all steps and it's still not working:

1. **Share console logs** - Copy ALL logs from app start through sending a message
2. **Check Firestore console** - Verify chat document structure matches requirements
3. **Try manual notification** - Does the test button work?
4. **Try different device/simulator** - Rule out device-specific issues
5. **Check Firebase project** - Correct project connected?

## Files to Check

1. **App.tsx** - Is NotificationProvider mounted inside AuthProvider?
2. **NotificationContext.tsx** - Is useNotificationSync being called?
3. **useNotificationSync.ts** - Are listeners set up correctly?
4. **Firestore rules** - Can users read chats and call history?
5. **Chat document** - Does it have lastMessage with timestamp?

## Quick Reference: Required Data Structure

### Chat Document:
```typescript
{
  members: ['userId1', 'userId2'],
  type: 'direct',
  lastMessage: {
    text: 'Hello',
    senderId: 'userId1',
    timestamp: Timestamp  // MUST be Firestore Timestamp
  }
}
```

### Call History Document:
```typescript
users/{userId}/callHistory/{callId}: {
  direction: 'incoming',
  status: 'missed', // or 'rejected'
  type: 'audio',    // or 'video'
  otherParty: {
    userId: 'callerId',
    displayName: 'Caller Name'
  },
  timestamp: Timestamp  // MUST be Firestore Timestamp
}
```

## Next Steps

Once working:
1. Remove test panel
2. Remove or reduce console.log statements (optional)
3. Test on physical devices
4. Test with multiple chats
5. Test with group chats
6. Test call notifications

See other documentation files:
- `TESTING_NOTIFICATIONS.md` - How to add test panel
- `NOTIFICATION_DEBUG_GUIDE.md` - Comprehensive debugging guide
- `NOTIFICATION_USAGE.md` - API usage for developers
- `NOTIFICATIONS_IMPLEMENTATION.md` - Architecture and design
