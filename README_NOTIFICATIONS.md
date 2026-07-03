# Notification System - README

## 🎯 Overview

Your Chit-Chat app now has real-time notifications for messages and calls, replacing the previous mock data system.

## ✅ What's Implemented

- ✅ Real-time message notifications (from Firestore)
- ✅ Real-time call notifications (missed/rejected calls)
- ✅ Toast overlays (appear for 4 seconds)
- ✅ Native device notifications with sound
- ✅ App badge counter
- ✅ Notification inbox with unread counts
- ✅ Tap notification to open chat
- ✅ Mark as read / Mark all as read
- ✅ Clear all notifications

## 🚀 Quick Start - Testing

### Option 1: Test with Button (Fastest)

1. Add test panel to any screen:
   ```typescript
   import { NotificationTestPanel } from '../components/NotificationTestPanel';
   
   // In your render:
   <NotificationTestPanel />
   ```

2. Tap "Test Message" or "Test Call" button
3. Check if notification appears

### Option 2: Test with Real Messages

1. Sign in with two different accounts on two devices
2. Send a message from Device A
3. Check if Device B receives notification
4. Check console logs on Device B

## 📋 Files Changed

### Created:
- `src/hooks/useNotificationSync.ts` - Real-time sync hook
- `src/components/NotificationTestPanel.tsx` - Test panel (dev only)
- Documentation files (see below)

### Modified:
- `src/context/NotificationContext.tsx` - Removed mock data, added sync
- `src/screens/NotificationsScreen.tsx` - Added chat navigation

## 🐛 Troubleshooting

### Notifications not appearing?

**Start here:** `NOTIFICATION_DEBUGGING_STEPS.md`

Quick checks:
1. Is user signed in? Check console for userId
2. Does test button work? Verifies system is functional
3. Are Firestore listeners set up? Check for "All listeners set up successfully" log
4. Send from different account? Can't notify yourself
5. Network connection? Required for real-time updates

### Common Issues:

| Issue | Solution |
|-------|----------|
| No logs at all | User not signed in or provider not mounted |
| Test button works, real messages don't | Firestore listener issue - check rules |
| "Message not new" in logs | Sending from same account or timestamp issue |
| Notification created but not visible | Check permissions, ToastOverlay mounting |

## 📚 Documentation Files

| File | Purpose |
|------|---------|
| `README_NOTIFICATIONS.md` | **START HERE** - Overview and quick start |
| `NOTIFICATION_DEBUGGING_STEPS.md` | Step-by-step debugging guide |
| `TESTING_NOTIFICATIONS.md` | How to add and use test panel |
| `NOTIFICATION_DEBUG_GUIDE.md` | Comprehensive troubleshooting |
| `NOTIFICATION_USAGE.md` | Developer API reference |
| `NOTIFICATIONS_IMPLEMENTATION.md` | Architecture and design details |
| `NOTIFICATIONS_CHANGES_SUMMARY.md` | Summary of code changes |

## 🔍 How It Works

```
Message Sent → Firestore Updated → Snapshot Received → 
Hook Detects Change → Fetches Sender Info → Pushes Notification →
Toast Shown + Added to Inbox + Device Notification + Badge Updated
```

## 📊 Console Logs to Expect

### On App Start:
```
[NotificationProvider] Rendered, user: abc123
[useNotificationSync] Setting up listeners for userId: abc123
[useNotificationSync] All listeners set up successfully
```

### When Message Received:
```
[useNotificationSync] NEW MESSAGE DETECTED!
[NotificationContext] pushNotification called
[NotificationContext] Native notification scheduled successfully
```

## ⚙️ Configuration

### Notification Types:
- `message` - Blue icon, for chat messages
- `call` - Green icon, for missed calls
- `system` - Gray icon, for app updates
- `number_change` - Orange icon, for contact updates

### Timing:
- Toast duration: 4 seconds
- Badge updates: Real-time
- Native notifications: Immediate

## 🔐 Required Firestore Structure

### Chat Document:
```javascript
{
  members: ['userId1', 'userId2'],
  lastMessage: {
    text: 'Message text',
    senderId: 'userId1',
    timestamp: Timestamp
  }
}
```

### Call History Document:
```javascript
users/{userId}/callHistory/{callId}: {
  direction: 'incoming',
  status: 'missed',
  type: 'audio',
  otherParty: {
    userId: 'callerId',
    displayName: 'Name'
  },
  timestamp: Timestamp
}
```

## 🎨 Customization

### Change Toast Duration:
In `NotificationContext.tsx`, line ~155:
```typescript
toastTimer.current = setTimeout(() => setToast(null), 4000); // Change 4000
```

### Change Notification Sound:
In `NotificationContext.tsx`, line ~160:
```typescript
sound: true, // or: sound: 'custom-sound.wav'
```

### Add New Notification Type:
1. Add to `NotifType` in `NotificationContext.tsx`
2. Add icon mapping in `NotificationsScreen.tsx`
3. Add color in `TYPE_COLOR` object

## 🧪 Testing Checklist

Before production:
- [ ] Test with real devices (not just simulators)
- [ ] Test notification permissions
- [ ] Test with slow/offline network
- [ ] Test with many notifications (100+)
- [ ] Test app badge clears correctly
- [ ] Test navigation from notifications
- [ ] Test on both iOS and Android
- [ ] Test with background app
- [ ] Test with killed app (requires push tokens)

## 🚧 Known Limitations

1. **Background notifications** - Currently only works when app is open/backgrounded. For killed app notifications, need to implement push notification tokens.

2. **Notification persistence** - Notifications only stored in memory. On app restart, notification history is lost. Consider adding AsyncStorage persistence.

3. **Call detection** - Only detects calls written to callHistory. Make sure your call flow writes to this collection.

4. **Group chat mentions** - Currently all group messages trigger notifications. Consider adding @mention detection.

## 🔮 Future Enhancements

See `NOTIFICATIONS_IMPLEMENTATION.md` for detailed roadmap:
- Push notification tokens for background delivery
- Notification persistence (AsyncStorage)
- Rich media previews
- Quick reply from notification
- Notification preferences per chat
- Typing indicators
- @mention detection in groups

## 🆘 Need Help?

1. **Check console logs** - Most issues are visible in logs
2. **Use test panel** - Isolates system vs. data issues
3. **Review debug guide** - See `NOTIFICATION_DEBUGGING_STEPS.md`
4. **Check Firestore** - Verify data structure matches requirements
5. **Test manually** - Use test button to verify system works

## 📝 Clean Up After Testing

Once you've verified notifications work:

1. Remove test panel import and component
2. (Optional) Remove or reduce console.log statements
3. Remove these test files if desired:
   - `src/components/NotificationTestPanel.tsx`
   - `TESTING_NOTIFICATIONS.md`
   - `NOTIFICATION_DEBUG_GUIDE.md`
   - `NOTIFICATION_DEBUGGING_STEPS.md`

Keep these files:
   - `NOTIFICATION_USAGE.md` (developer reference)
   - `NOTIFICATIONS_IMPLEMENTATION.md` (architecture)

## 📄 License

Part of Chit-Chat application.
