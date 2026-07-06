# Notification Tap-to-Chat Navigation Implementation

## Overview
This implementation enables users to tap a message or call notification and navigate directly to the relevant chat screen, regardless of the app state (foreground, background, or killed/terminated).

## Architecture

### 1. Navigation Service (`src/services/navigationService.ts`)
A centralized service that provides:
- **Global navigation ref**: Accessible from anywhere in the app
- **Navigation queue**: Queues navigation actions that arrive before the navigator is ready
- **Safe navigation methods**: Check navigator readiness before navigating
- **`navigateToChatWhenReady(chatId)`**: Primary method for notification handlers

### 2. Notification Payload Structure
All notifications now include:
```typescript
{
  type: 'message' | 'call' | 'system' | 'number_change',
  title: string,
  body: string,
  contactId?: string,  // User ID (for backward compatibility)
  chatId?: string,     // Chat ID (takes precedence for navigation)
}
```

**Priority**: `chatId` > `contactId`
- If `chatId` is present, navigate directly to that chat
- If only `contactId` is present, could be used to find/create chat (future enhancement)

### 3. Notification Sources

#### A. Firestore-synced Notifications (`useNotificationSync.ts`)
- **Message notifications**: Include both `chatId` and `contactId`
  - `chatId`: The chat document ID
  - `contactId`: The sender's user ID (for direct chats only)
  
- **Call notifications**: Include `contactId`
  - `contactId`: The caller's user ID

#### B. Push Notifications (`usePushNotifications.ts`)
- Receives notifications from Expo Notifications
- Bridges data to in-app notification context
- Preserves `chatId` and `contactId` from payload

### 4. Tap Handling (All App States)

#### Component: `NotificationTapHandler` in `App.tsx`

**Foreground/Background State**:
```typescript
Notifications.addNotificationResponseReceivedListener((response) => {
  const { chatId, contactId } = response.notification.request.content.data;
  if (chatId) {
    navigateToChatWhenReady(chatId);
  }
});
```

**Killed/Terminated State**:
```typescript
const response = await Notifications.getLastNotificationResponseAsync();
if (response && response.notification.request.content.data.chatId) {
  navigateToChatWhenReady(chatId);
}
```

### 5. Navigation Flow

```
┌─────────────────────────────────────────────────┐
│  Notification Tapped                            │
└─────────────────┬───────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────┐
│  NotificationTapHandler extracts chatId         │
└─────────────────┬───────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────┐
│  navigateToChatWhenReady(chatId)                │
└─────────────────┬───────────────────────────────┘
                  │
                  ▼
         ┌────────┴────────┐
         │  Is navigator   │
         │     ready?      │
         └────────┬────────┘
                  │
         ┌────────┴────────┐
         │                 │
         ▼                 ▼
    ┌─────────┐      ┌──────────┐
    │   YES   │      │    NO    │
    └────┬────┘      └─────┬────┘
         │                 │
         ▼                 ▼
    ┌─────────────┐   ┌────────────┐
    │  Navigate   │   │  Queue in  │
    │  to Chat    │   │  navQueue  │
    └─────────────┘   └─────┬──────┘
                            │
                            ▼
                      ┌──────────────┐
                      │ Wait for     │
                      │ onReady()    │
                      └──────┬───────┘
                             │
                             ▼
                      ┌──────────────┐
                      │ Execute      │
                      │ queued nav   │
                      └──────────────┘
```

## Files Modified

### 1. `src/context/NotificationContext.tsx`
- Added `chatId?: string` to `AppNotification` interface
- Updated `pushNotification` to include `chatId` in native notification data

### 2. `src/hooks/useNotificationSync.ts`
- Updated message notifications to include `chatId: chatId`
- Call notifications already had `contactId`

### 3. `src/hooks/usePushNotifications.ts`
- Updated to extract and pass `chatId` from push notification data
- Removed old `handleNotificationResponse` stub (now handled centrally)

### 4. `App.tsx`
- Added `NotificationTapHandler` component
- Wired up `navigationRef` to `NavigationContainer`
- Set up `navigationQueue.setReady()` in `onReady` callback

### 5. `src/services/navigationService.ts` (NEW)
- Created centralized navigation service
- Implemented navigation queue for killed-state launches

## Testing Scenarios

### Scenario 1: Foreground Notification Tap
1. App is open and visible
2. Receive a message notification
3. Tap the notification
4. ✅ Should navigate to chat immediately

### Scenario 2: Background Notification Tap
1. App is running but in background (home screen)
2. Receive a message notification
3. Tap the notification
4. ✅ App comes to foreground and navigates to chat

### Scenario 3: Killed State Notification Tap
1. App is fully closed (killed)
2. Receive a message notification
3. Tap the notification
4. ✅ App launches and navigates to chat once navigator is ready

### Scenario 4: Call Notification Tap
1. Miss a call
2. Receive missed call notification with `contactId`
3. Tap the notification
4. ✅ Should navigate to chat with that contact
   - Note: If no chat exists yet, may need to create one (future enhancement)

## Logging & Debugging

All components include comprehensive logging:

```typescript
// Navigation service
[NavigationService] Navigating to: Chat with params: { chatId: '...' }
[NavigationQueue] Queuing navigation action
[NavigationQueue] Navigator ready, processing N queued actions

// Notification handlers
[NotificationTapHandler] Notification tapped (foreground/background): { chatId: '...' }
[NotificationTapHandler] App opened from notification (killed state): { chatId: '...' }

// Push notifications
[usePushNotifications] Notification received: { ... }
[usePushNotifications] Notification tapped (logged here, handled in App.tsx)

// Firestore sync
[useNotificationSync] Pushing notification: { chatId: '...', contactId: '...' }
```

## Future Enhancements

### 1. Contact-to-Chat Mapping
When `contactId` is provided but no `chatId`:
- Query Firestore to find existing direct chat with that user
- If no chat exists, create one or navigate to contact profile

### 2. Group Chat Support
- Ensure group message notifications include proper `chatId`
- Test navigation to group chats

### 3. Deep Linking
- Extend this system to support deep links from external sources
- Universal links for web → app transitions

### 4. Notification Categories
- Implement iOS notification categories (Reply, Mark as Read, etc.)
- Handle category actions without opening the app

## Assumptions & Dependencies

### Assumptions:
1. `chatId` is always the Firestore document ID of the chat
2. Chat screen accepts `chatId` param via route params
3. User is authenticated when receiving notifications
4. Navigator is set up with 'Chat' route name

### Dependencies:
- `expo-notifications` v56.x
- `@react-navigation/native` v7.x
- Firebase Firestore for chat data

## Known Limitations

1. **Contact-only notifications**: If only `contactId` is provided (no `chatId`), navigation doesn't happen yet. This is logged for future implementation.

2. **Authentication timing**: If notification is tapped before user completes sign-in, navigation may fail. The queue system helps but doesn't solve auth-related issues.

3. **Web platform**: Push notifications are not supported on web, but the navigation system works for in-app notifications.

## Troubleshooting

### Issue: Navigation doesn't work from killed state
- **Check**: Navigator `onReady` callback is firing
- **Check**: Notification data includes `chatId`
- **Check**: Logs show queued action being executed
- **Solution**: Ensure `getLastNotificationResponseAsync` is called after app launch

### Issue: Multiple navigation attempts
- **Check**: `NotificationTapHandler` mounted multiple times
- **Solution**: Should only be mounted once in App.tsx

### Issue: Navigator not ready warning
- **Check**: Navigation queue is working correctly
- **Check**: `setReady()` is called in `onReady` callback
- **Solution**: Actions should queue and execute when ready
