# Notification System Usage Guide

## For Developers

### How to Trigger a Notification Manually

```typescript
import { useNotifications } from '../context/NotificationContext';

function MyComponent() {
  const { pushNotification } = useNotifications();

  const handleEvent = () => {
    pushNotification({
      type: 'message',           // 'message' | 'call' | 'number_change' | 'system'
      title: 'John Doe',         // Notification title
      body: 'Hey, how are you?', // Notification body
      contactId: 'user123',      // Optional: Firebase user ID to link to
    });
  };

  return <Button onPress={handleEvent} title="Send Notification" />;
}
```

### Notification Types

| Type | Icon | Color | Use Case |
|------|------|-------|----------|
| `message` | chatbubble | Blue | New messages |
| `call` | call | Green | Missed/rejected calls |
| `number_change` | phone-portrait | Orange | Contact phone number changed |
| `system` | information-circle | Gray | App updates, backups, alerts |

### Reading Notification State

```typescript
import { useNotifications } from '../context/NotificationContext';

function NotificationBadge() {
  const { 
    notifications,   // All notifications
    unreadCount,     // Total unread count
    messageCount,    // Unread messages only
    callCount,       // Missed calls only
  } = useNotifications();

  return (
    <View>
      <Text>Total Unread: {unreadCount}</Text>
      <Text>Messages: {messageCount}</Text>
      <Text>Calls: {callCount}</Text>
    </View>
  );
}
```

### Managing Notifications

```typescript
import { useNotifications } from '../context/NotificationContext';

function NotificationActions() {
  const { markRead, markAllRead, clearAll } = useNotifications();

  return (
    <View>
      <Button 
        title="Mark as Read" 
        onPress={() => markRead('notification-id')} 
      />
      <Button 
        title="Mark All Read" 
        onPress={markAllRead} 
      />
      <Button 
        title="Clear All" 
        onPress={clearAll} 
      />
    </View>
  );
}
```

### Toast Notifications

Toast notifications automatically appear for 4 seconds when a new notification is triggered.

```typescript
import { useNotifications } from '../context/NotificationContext';

function ToastDisplay() {
  const { toast, dismissToast } = useNotifications();

  if (!toast) return null;

  return (
    <View style={styles.toast}>
      <Text>{toast.title}</Text>
      <Text>{toast.body}</Text>
      <Button title="Dismiss" onPress={dismissToast} />
    </View>
  );
}
```

## Automatic Notifications

These notifications are triggered automatically by the `useNotificationSync` hook:

### 1. Message Notifications
- Triggered when someone sends you a message
- Shows sender name and message preview
- Automatically links to the chat when tapped
- Works for both direct and group chats

### 2. Call Notifications
- Triggered for missed or rejected incoming calls
- Shows caller name and call type (audio/video)
- Automatically links to Chats screen when tapped

## Data Requirements

### For Message Notifications

Your Firestore chat document must have:
```typescript
{
  members: ['userId1', 'userId2'],
  type: 'direct' | 'group',
  groupName?: 'Group Name',
  lastMessage: {
    text: 'Message content',
    senderId: 'userId1',
    timestamp: Timestamp
  }
}
```

### For Call Notifications

Your Firestore call history document must have:
```typescript
users/{userId}/callHistory/{callId}: {
  direction: 'incoming',
  status: 'missed' | 'rejected',
  type: 'audio' | 'video',
  otherParty: {
    userId: 'userId123',
    displayName: 'John Doe',
    photoUrl: 'https://...'
  },
  timestamp: Timestamp
}
```

## Advanced Features

### Custom Notification Sounds

Modify `NotificationContext.tsx`:

```typescript
await Notifications.scheduleNotificationAsync({
  content: {
    title: notif.title,
    body: notif.body,
    sound: 'custom-sound.wav',  // Add your sound file to assets
    // ...
  },
  trigger: null,
});
```

### Notification Categories (iOS)

```typescript
await Notifications.setNotificationCategoryAsync('message', [
  {
    identifier: 'reply',
    buttonTitle: 'Reply',
    options: { opensAppToForeground: true },
  },
  {
    identifier: 'mark-read',
    buttonTitle: 'Mark as Read',
    options: { opensAppToForeground: false },
  },
]);
```

### Deep Linking from Notifications

The system automatically handles deep linking when a notification with `contactId` is tapped:

```typescript
// In NotificationsScreen.tsx
const handlePress = async () => {
  if (notif.contactId && user?.uid) {
    const chatId = await getOrCreateDirectChat(user.uid, notif.contactId);
    navigation.navigate('Chat', { 
      chatId, 
      displayName: notif.title,
      isGroup: false,
      otherUserId: notif.contactId,
    });
  }
};
```

## Debugging

### Enable Notification Logs

```typescript
// In NotificationContext.tsx or useNotificationSync.ts
console.log('[Notifications] New notification:', notif);
console.log('[Notifications] Current badge count:', unreadCount);
```

### Common Issues

**Notifications not appearing?**
- Check notification permissions are granted
- Verify Firestore listeners are subscribed
- Check user is signed in (userId is not null)
- Verify Firestore data structure matches requirements

**Badge count not updating?**
- Check platform permissions (iOS requires explicit badge permission)
- Verify `Notifications.setBadgeCountAsync()` is not throwing errors

**Toast not showing?**
- Ensure `ToastOverlay` component is mounted in App.tsx
- Check `toast` state is being set correctly
- Verify 4-second auto-dismiss timer is working

## Performance Optimization

### Debounce Multiple Notifications

If receiving many notifications at once:

```typescript
const debounceTimer = useRef<NodeJS.Timeout>();

const debouncedNotification = (notif: AppNotification) => {
  if (debounceTimer.current) clearTimeout(debounceTimer.current);
  
  debounceTimer.current = setTimeout(() => {
    pushNotification(notif);
  }, 300);
};
```

### Limit Notification History

```typescript
const MAX_NOTIFICATIONS = 100;

const pushNotification = useCallback((n) => {
  setNotifications((prev) => {
    const updated = [notif, ...prev];
    return updated.slice(0, MAX_NOTIFICATIONS); // Keep only latest 100
  });
}, []);
```

## Testing

### Manual Testing
```typescript
// Add test button in development
<Button 
  title="Test Notification" 
  onPress={() => {
    pushNotification({
      type: 'message',
      title: 'Test User',
      body: 'This is a test notification',
      contactId: 'test-user-id',
    });
  }}
/>
```

### Unit Testing
```typescript
import { renderHook, act } from '@testing-library/react-hooks';
import { useNotifications } from '../context/NotificationContext';

test('pushNotification adds notification to list', () => {
  const { result } = renderHook(() => useNotifications());
  
  act(() => {
    result.current.pushNotification({
      type: 'message',
      title: 'Test',
      body: 'Test body',
    });
  });
  
  expect(result.current.notifications).toHaveLength(1);
  expect(result.current.unreadCount).toBe(1);
});
```

## Security Considerations

- Never include sensitive data in notification body text
- Respect user privacy settings (read receipts, online status, etc.)
- Filter notifications from blocked users
- Implement rate limiting to prevent notification spam
- Validate contactId before navigation to prevent unauthorized access

## Future Enhancements

See `NOTIFICATIONS_IMPLEMENTATION.md` for planned features and improvements.
