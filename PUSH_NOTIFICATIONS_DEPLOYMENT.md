# Push Notifications Deployment Guide

This guide explains how to deploy the Firebase Cloud Functions that enable push notifications when the app is **not running** (background or killed state).

## Overview

The app now has server-side push notifications via Firebase Cloud Functions that trigger on Firestore writes:

| Function | Trigger | Purpose |
|----------|---------|---------|
| `onMessageCreated` | New message in `/chats/{chatId}/messages/{messageId}` | Notifies chat members of new messages |
| `onCallCreated` | New call in `/calls/{callId}` | Notifies callee of incoming call |
| `onGroupCallCreated` | New group call in `/groupCalls/{callId}` | Notifies all participants |
| `onCallUpdated` | Call status changes to missed/rejected | Notifies about missed calls |

## Prerequisites

1. **Firebase CLI** installed globally:
   ```bash
   npm install -g firebase-tools
   ```

2. **Logged into Firebase**:
   ```bash
   firebase login
   ```

3. **Firebase project configured** (already done - see `.firebaserc`)

## Deployment Steps

### 1. Install dependencies in the functions folder

```bash
cd functions
npm install
```

### 2. Build the TypeScript

```bash
npm run build
```

### 3. Deploy to Firebase

```bash
npm run deploy
```

Or from the project root:
```bash
firebase deploy --only functions
```

### 4. Verify deployment

Check the Firebase Console → Functions to see all deployed functions:
- `generateLiveKitToken` (existing)
- `cleanupExpiredStatuses` (existing)
- `cleanupExpiredMessages` (existing)
- `cleanupStaleCalls` (existing)
- `onMessageCreated` (new)
- `onCallCreated` (new)
- `onGroupCallCreated` (new)
- `onCallUpdated` (new)

## How It Works

### Push Token Flow
1. User opens app → `usePushNotifications` requests permission
2. Expo Push Token is saved to Firestore: `/users/{userId}/pushToken`
3. When a message/call is created, Cloud Function reads recipient's push token
4. Function sends notification via Expo Push API
5. Device receives notification even when app is closed

### Notification Data Structure

**Message notifications** include:
```json
{
  "type": "message",
  "chatId": "...",
  "messageId": "...",
  "senderId": "...",
  "displayName": "...",
  "isGroup": false,
  "otherUserId": "..."
}
```

**Call notifications** include:
```json
{
  "type": "incoming-call",
  "callId": "...",
  "callerId": "...",
  "callerName": "...",
  "callType": "audio|video"
}
```

## Troubleshooting

### Functions not triggering
- Check Firebase Console → Functions → Logs for errors
- Verify Firestore security rules allow the function service account to read

### Notifications not arriving
- Check if push token is saved in `/users/{userId}/pushToken`
- Verify token is a valid Expo push token (starts with `ExponentPushToken[`)
- Check Expo push receipts for delivery errors

### View logs
```bash
firebase functions:log
```

Or in Firebase Console → Functions → Logs

## Testing

1. Send a message from Device A to Device B
2. Close the app on Device B completely
3. Device B should receive a push notification

## Cost Considerations

- Cloud Functions: Pay per invocation (free tier: 2M invocations/month)
- Expo Push: Free for all projects
- Firestore reads: Each notification triggers reads for user docs

## Security Notes

- Push tokens are stored in Firestore and only readable by the user and Cloud Functions
- Functions run with Admin SDK privileges (bypass security rules)
- Invalid/expired tokens are logged but not automatically removed (TODO)
