# Testing Notifications - Quick Start

## Step 1: Add Test Panel (Temporary)

Add the test panel to your ChatsScreen or any screen:

```typescript
// In src/screens/ChatsScreen.tsx
import { NotificationTestPanel } from '../components/NotificationTestPanel';

// Inside your render method, add at the top:
export default function ChatsScreen() {
  // ... existing code ...

  return (
    <View style={styles.root}>
      <AppBg />
      
      {/* ADD THIS - TEMPORARY FOR TESTING */}
      <NotificationTestPanel />
      
      {/* ... rest of your existing code ... */}
    </View>
  );
}
```

## Step 2: Run the App

1. Start your app: `npm start` or `yarn start`
2. Open the Chats screen
3. You should see a yellow test panel at the top

## Step 3: Test Manual Notifications

1. **Open your console/terminal** to see logs
2. Tap "Test Message" button
3. You should see:
   - Console logs showing notification flow
   - A toast notification appear at the top
   - The notification in your notifications inbox
   - App badge increase

Expected console output:
```
[TEST] Triggering test message notification
[NotificationContext] pushNotification called with: {...}
[NotificationContext] Created notification object: {...}
[NotificationContext] Adding to notifications, prev count: 0
[NotificationContext] Setting toast
[NotificationContext] Scheduling native notification
[NotificationContext] Native notification scheduled successfully
```

## Step 4: Test Real Messages

If manual test works, test with real messages:

1. Open two devices/simulators with different accounts
2. Send a message from Device A to Device B
3. Watch console logs on Device B

Expected logs on Device B:
```
[useNotificationSync] Chats snapshot received, docs: 1, isInitialLoad: false
[useNotificationSync] Processing chat updates...
[useNotificationSync] Checking chat: <chatId>
[useNotificationSync] NEW MESSAGE DETECTED!
[useNotificationSync] Pushing notification: {...}
[NotificationContext] pushNotification called with: {...}
```

## Step 5: Troubleshooting

### Manual test works, but real messages don't trigger notifications?

**Issue is with Firestore listener**

Check these logs:
- `[useNotificationSync] Effect triggered, userId: <userId>` - Should show your userId
- `[useNotificationSync] Chats snapshot received` - Should trigger when message is sent
- `[useNotificationSync] isInitialLoad: false` - Should be false after first load

**If no snapshot received when message is sent:**
- Check network connection
- Verify Firestore rules allow reading chats
- Check chat document has correct structure

**If snapshot received but "Message not new or from current user":**
- Check the detailed log line showing senderId vs userId
- Verify lastMsgTime > lastKnownTime
- Message might be from yourself (notifications only for others' messages)

### Manual test doesn't work?

**Issue is with UI or notification system**

1. Check notification permissions in device settings
2. Verify ToastOverlay is mounted in App.tsx
3. Check for JavaScript errors in console
4. Try refreshing/restarting the app

### No logs at all?

**Hook not running**

1. Check user is signed in: Look for `[NotificationProvider] Rendered, user: <userId>`
2. If userId is null, sign in first
3. Verify NotificationProvider is mounted (it is, in your App.tsx)

## Step 6: Remove Test Panel

Once testing is complete, remove the import and component from your screen:

```typescript
// Remove these lines:
import { NotificationTestPanel } from '../components/NotificationTestPanel';
<NotificationTestPanel />
```

## Quick Checklist

- [ ] Test panel appears on screen
- [ ] Console logs are visible
- [ ] Tapping "Test Message" shows notification
- [ ] Notification appears in notifications inbox
- [ ] Toast appears at top of screen
- [ ] App badge increases
- [ ] User is signed in (check logs for userId)
- [ ] Real message from another device triggers notification
- [ ] Notification opens correct chat when tapped

## Common Log Patterns

### ✅ Working correctly:
```
[useNotificationSync] Effect triggered, userId: abc123
[useNotificationSync] Setting up listeners
[useNotificationSync] Chats snapshot received, docs: 2, isInitialLoad: true
[useNotificationSync] Initial load complete
[useNotificationSync] Chats snapshot received, docs: 2, isInitialLoad: false
[useNotificationSync] NEW MESSAGE DETECTED!
[NotificationContext] pushNotification called
[NotificationContext] Native notification scheduled successfully
```

### ❌ Not working - No userId:
```
[NotificationProvider] Rendered, user: null
[useNotificationSync] Effect triggered, userId: null
[useNotificationSync] No userId, cleaning up
```
**Fix:** Sign in first

### ❌ Not working - Initial load stuck:
```
[useNotificationSync] Effect triggered, userId: abc123
[useNotificationSync] Setting up listeners
[useNotificationSync] Chats snapshot received, docs: 1, isInitialLoad: true
[useNotificationSync] Initial load complete
(no further snapshots)
```
**Fix:** Send a message to trigger snapshot update

### ❌ Not working - Message ignored:
```
[useNotificationSync] Chats snapshot received, docs: 1, isInitialLoad: false
[useNotificationSync] Checking chat: xyz
[useNotificationSync] Chat: xyz, senderId: abc123, currentUserId: abc123
[useNotificationSync] Message not new or from current user, skipping
```
**Reason:** senderId === currentUserId (you sent the message yourself)
**Fix:** Send from a different account

## Need More Help?

See `NOTIFICATION_DEBUG_GUIDE.md` for comprehensive troubleshooting steps.
