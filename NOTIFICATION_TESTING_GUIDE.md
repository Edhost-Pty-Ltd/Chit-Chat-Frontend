# Notification Tap Navigation - Testing Guide

## Quick Test Commands

### Test 1: Send a Test Notification with Chat ID
You can test notification navigation by sending a local notification with the proper data structure:

```typescript
import { sendLocalNotification } from './src/hooks/usePushNotifications';

// In any component or debug panel:
sendLocalNotification(
  'Test Message',
  'Tap to navigate to chat',
  {
    type: 'message',
    chatId: 'YOUR_CHAT_ID_HERE',  // Replace with a real chat ID from Firestore
    contactId: 'SENDER_USER_ID',
  }
);
```

### Test 2: Verify Notification Data Structure
Add this to ChatScreen or any screen to inspect notification payloads:

```typescript
useEffect(() => {
  const subscription = Notifications.addNotificationReceivedListener((notif) => {
    console.log('📱 Notification received:', {
      title: notif.request.content.title,
      body: notif.request.content.body,
      data: notif.request.content.data,
    });
  });
  return () => subscription.remove();
}, []);
```

## Testing Scenarios

### ✅ Scenario 1: Foreground Navigation
**Setup:**
1. Open the app and navigate to the Chats screen
2. Have the app fully visible in the foreground

**Test:**
1. Send yourself a message from another device/account
2. Wait for notification to appear as a banner
3. Tap the notification banner

**Expected Result:**
- ✅ App should navigate to the chat screen with the correct chat
- ✅ Console logs should show:
  ```
  [NotificationTapHandler] Notification tapped (foreground/background): { chatId: '...', ... }
  [NavigationService] Navigating to chat: <chatId>
  ```

---

### ✅ Scenario 2: Background Navigation
**Setup:**
1. Open the app
2. Press home button (put app in background)

**Test:**
1. Send yourself a message from another device/account
2. Wait for notification to appear in notification center
3. Tap the notification

**Expected Result:**
- ✅ App should come to foreground
- ✅ App should navigate to the chat screen
- ✅ Console logs should show navigation happening

---

### ✅ Scenario 3: Killed State Navigation
**Setup:**
1. Force quit the app completely (swipe up from app switcher)

**Test:**
1. Send yourself a message from another device/account
2. Wait for notification to appear
3. Tap the notification

**Expected Result:**
- ✅ App should launch from scratch
- ✅ After sign-in/auth loads, app should navigate to chat
- ✅ Console logs should show:
  ```
  [NotificationTapHandler] App opened from notification (killed state): { chatId: '...' }
  [NavigationQueue] Queuing navigation action
  [App] Navigation container ready
  [NavigationQueue] Navigator ready, processing 1 queued actions
  [NavigationService] Navigating to chat: <chatId>
  ```

---

### ✅ Scenario 4: Call Notification Navigation
**Setup:**
1. Have another user call you
2. Miss the call (don't answer)

**Test:**
1. Wait for missed call notification
2. Tap the notification

**Expected Result:**
- ✅ App should navigate to chat with that user (or their profile)
- ✅ Console shows contactId being used

---

### ✅ Scenario 5: Multiple Queued Navigations
**Setup:**
1. Kill the app
2. Receive multiple notifications while app is closed

**Test:**
1. Tap one notification to open the app
2. While app is loading, tap another notification

**Expected Result:**
- ✅ First navigation should queue
- ✅ Second navigation should also queue
- ✅ Once navigator is ready, the most recent one should execute
- ✅ Console shows multiple items being queued and processed

## Debugging Checklist

### If navigation doesn't work:

#### 1. Check Notification Data
```typescript
// Add this temporarily to NotificationTapHandler
console.log('[DEBUG] Full notification response:', JSON.stringify(response, null, 2));
```

**Verify:**
- ✅ `chatId` is present in data
- ✅ `chatId` is a valid Firestore document ID
- ✅ Data structure matches expected format

#### 2. Check Navigator Status
```typescript
import { navigationRef } from './src/services/navigationService';

console.log('[DEBUG] Navigator ready?', navigationRef.isReady());
console.log('[DEBUG] Current route:', navigationRef.getCurrentRoute()?.name);
```

#### 3. Check Authentication
```typescript
const { isSignedIn } = useAuth();
console.log('[DEBUG] User signed in?', isSignedIn);
```

If `isSignedIn` is false, navigation to Chat won't work (user needs to be authenticated).

#### 4. Check Chat Exists
```typescript
import { doc, getDoc } from 'firebase/firestore';
import { db } from './src/config/firebase';

const chatRef = doc(db, 'chats', chatId);
const chatSnap = await getDoc(chatRef);
console.log('[DEBUG] Chat exists?', chatSnap.exists());
```

#### 5. Check Console Logs
Look for these key log patterns:

**Success Pattern:**
```
[NotificationTapHandler] Notification tapped (foreground/background): { chatId: 'abc123', ... }
[NavigationService] Navigating to chat: abc123
```

**Queued Pattern (Killed State):**
```
[NotificationTapHandler] App opened from notification (killed state): { chatId: 'abc123' }
[NavigationQueue] Queuing navigation action
[App] Navigation container ready
[NavigationQueue] Navigator ready, processing 1 queued actions
[NavigationService] Navigating to chat: abc123
```

**Warning Pattern:**
```
[NavigationService] Navigator not ready, cannot navigate to chat: abc123
```
This means navigation queue isn't working - check `onReady` callback.

## Common Issues & Solutions

### Issue: "Navigator not ready" warning
**Cause:** Navigation attempted before NavigationContainer mounted
**Solution:** Should auto-resolve via queue system. If persists, check:
- `navigationRef` is passed to `NavigationContainer`
- `onReady` callback calls `navigationQueue.setReady()`

### Issue: Navigation works in foreground but not killed state
**Cause:** `getLastNotificationResponseAsync()` not being called
**Solution:** Verify `NotificationTapHandler` is mounted in App.tsx

### Issue: Navigation to wrong chat
**Cause:** Wrong `chatId` in notification data
**Solution:** Check `useNotificationSync.ts` - ensure correct `chatId` is being passed

### Issue: Notification has no data
**Cause:** Notification created without data payload
**Solution:** Check `NotificationContext.tsx` - ensure `data` object includes `chatId`

### Issue: Multiple navigations happening
**Cause:** Multiple listeners set up
**Solution:** Ensure `NotificationTapHandler` only mounted once

## Manual Test with Custom Data

Add this to a test screen or debug panel:

```typescript
import * as Notifications from 'expo-notifications';

async function testNotificationNavigation(chatId: string) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Test Navigation',
      body: 'Tap to test chat navigation',
      data: {
        type: 'message',
        chatId: chatId,
        contactId: 'test-user-id',
      },
    },
    trigger: {
      seconds: 2, // Show in 2 seconds
    },
  });
  
  console.log('[Test] Notification scheduled with chatId:', chatId);
}

// Usage:
testNotificationNavigation('your-test-chat-id-here');
```

## Verification Steps

After implementing, verify:

- ✅ App builds without TypeScript errors
- ✅ App runs without runtime errors
- ✅ Notifications include `chatId` in logs
- ✅ Tapping notification navigates to chat (foreground)
- ✅ Tapping notification navigates to chat (background)
- ✅ Tapping notification navigates to chat (killed state)
- ✅ Navigation queue works (check logs)
- ✅ No duplicate navigations
- ✅ No crashes on navigation

## Production Readiness Checklist

Before deploying:

- ✅ Remove or disable debug console.logs (or keep them for monitoring)
- ✅ Test on both iOS and Android
- ✅ Test with real push notifications (not just local)
- ✅ Test with various chat types (direct, group)
- ✅ Test with expired/deleted chats (error handling)
- ✅ Test navigation while app is performing other tasks
- ✅ Test with slow network conditions
- ✅ Verify no memory leaks from listeners
- ✅ Check battery usage patterns

## Performance Notes

- Navigation queue is lightweight (in-memory array)
- Listeners clean up properly on unmount
- No performance impact in normal operation
- Queue automatically clears after execution

## Future Test Scenarios

### Group Chat Notifications
Test that group message notifications navigate correctly to group chat screen.

### Notification Actions
When implementing quick actions (Reply, Mark as Read):
- Test that they don't interfere with tap navigation
- Test that they perform their action without opening app

### Deep Links
When integrating with deep links:
- Test that notification navigation works alongside deep link navigation
- Test priority handling (notification vs deep link)
