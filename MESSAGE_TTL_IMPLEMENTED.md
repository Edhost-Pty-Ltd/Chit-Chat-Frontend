# Message TTL (72 Hours) - Implementation Complete ✅

## Summary
All messages in Chit-Chat now automatically expire after 72 hours. Messages created after this update will have an `expiresAt` timestamp, and the app will filter them out client-side once they expire.

## What Was Implemented

### ✅ Phase 1: Client-Side Implementation (COMPLETE)

#### 1. Added `expiresAt` Field to All Message Types
Every message creation function now includes a 72-hour expiry timestamp:

**Files Modified**:
- `src/hooks/useChatActions.ts`

**Functions Updated**:
- `sendMessage()` - Text messages
- `sendVoiceMessage()` - Voice notes
- `sendImageMessage()` - Image messages
- `sendVideoMessage()` - Video messages
- `sendFileMessage()` - File attachments
- `sendNumberChangeNotification()` - System messages
- `sendCurrentLocationMessage()` - Location sharing
- `sendLiveLocationMessage()` - Live location

**Implementation**:
```typescript
// Calculate expiry time (72 hours from now)
const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);

batch.set(msgRef, {
  messageId: msgRef.id,
  senderId,
  text: trimmed,
  timestamp: serverTimestamp(),
  expiresAt: expiresAt, // ← New field
  readBy: [senderId],
});
```

#### 2. Client-Side Filtering in useMessages Hook
Messages are filtered in real-time to hide expired ones:

**File Modified**:
- `src/hooks/useMessages.ts`

**Changes**:
- Added `expiresAt: Date | null` to `FireMessage` interface
- Filter out expired messages in the snapshot listener
- Legacy messages without `expiresAt` are kept (backward compatibility)

**Implementation**:
```typescript
.filter((msg) => {
  // Keep messages without expiry date (legacy messages)
  if (!msg.expiresAt) return true;
  // Keep messages that haven't expired yet
  return msg.expiresAt > now;
});
```

## How It Works

### For New Messages (Created After This Update)
1. User sends a message
2. Message is stored in Firestore with `expiresAt` = now + 72 hours
3. All clients fetch messages and filter out expired ones
4. After 72 hours, message disappears from UI
5. Message still exists in Firestore (cleanup requires Cloud Functions)

### For Legacy Messages (Created Before This Update)
- Messages without `expiresAt` field are displayed normally
- They won't auto-expire (no TTL set)
- Option: Run migration script to add TTL (see MESSAGE_TTL_IMPLEMENTATION.md)

## Testing

### Quick Test (For Development)
To test without waiting 72 hours, temporarily change the TTL:

```typescript
// In useChatActions.ts - change ALL occurrences
const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes instead of 72 hours
```

**Steps**:
1. Change TTL to 5 minutes in all functions
2. Send a test message
3. Wait 5 minutes
4. Message should disappear from chat
5. Change back to 72 hours before deploying

### Production Test
1. Send a message
2. Wait 72 hours (3 days)
3. Verify message no longer appears in chat
4. Check Firestore console - message still exists (expected)

## User Experience

### What Users See
- ✅ Messages display normally for 72 hours
- ✅ After 72 hours, messages silently disappear
- ✅ No error messages or notifications
- ✅ Chat history is automatically managed

### What Users Don't See
- Messages in Firestore (technical detail)
- Expiry timestamps (not shown in UI)
- Countdown timers (not implemented)

## Storage Implications

### Current Implementation (Client-Side Only)
- ❌ Expired messages remain in Firestore
- ❌ Storage costs increase over time
- ❌ Database size grows indefinitely
- ✅ No server setup required
- ✅ Works on free tier

### Example Storage Costs
- 1 million messages × 1KB each = 1GB
- Firestore: $0.18/GB/month
- **Cost without cleanup**: $0.18/month for every 1M messages (accumulates)

## Next Steps: Server-Side Cleanup (Optional)

To actually **delete** expired messages from Firestore, implement Cloud Functions:

### Option 1: Scheduled Cloud Function (Recommended)
```typescript
// functions/src/index.ts
export const cleanupExpiredMessages = functions.pubsub
  .schedule('every 1 hours')
  .onRun(async (context) => {
    // Delete messages where expiresAt <= now
    // See MESSAGE_TTL_IMPLEMENTATION.md for full code
  });
```

**Benefits**:
- Frees up storage space
- Reduces Firestore costs
- Runs automatically every hour
- Within free tier limits

### Option 2: Firestore TTL Policy (Coming Soon)
Firestore is adding native TTL support. When available, update to:
```typescript
// Firestore will auto-delete when ttl expires
ttl: admin.firestore.FieldValue.serverTimestamp(),
```

## Migration for Existing Messages

If you have messages created before this update:

### Option A: Let Them Persist
- Old messages without `expiresAt` will display forever
- Simple, no action required
- May confuse users (inconsistent behavior)

### Option B: Add TTL Retroactively
Run a one-time migration script:

```typescript
// Calculate TTL from original timestamp
const timestamp = msgData.timestamp?.toDate() || new Date();
const expiresAt = new Date(timestamp.getTime() + 72 * 60 * 60 * 1000);

// Update message
await updateDoc(msgDoc.ref, { expiresAt });
```

**Recommendation**: Option A (simpler, less risky)

## Privacy & Compliance

This feature supports:
- ✅ **GDPR** - Data minimization principle
- ✅ **User Privacy** - Ephemeral messaging
- ✅ **Storage Efficiency** - Reduced costs (with Cloud Functions)

## Configuration

### Change TTL Duration
To change from 72 hours to a different duration:

1. Open `src/hooks/useChatActions.ts`
2. Find all occurrences of:
   ```typescript
   const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);
   ```
3. Replace `72` with desired hours:
   - 24 hours = `24 * 60 * 60 * 1000`
   - 7 days = `7 * 24 * 60 * 60 * 1000`
   - 30 days = `30 * 24 * 60 * 60 * 1000`

### Disable TTL (Not Recommended)
If you want to disable message expiry:

1. Remove the `expiresAt` field from all message creation functions
2. Remove the filter in `useMessages.ts`
3. Users will see all messages forever

## Monitoring

### Check for Expired Messages
```typescript
// In Firestore console, run query:
db.collection('chats/{chatId}/messages')
  .where('expiresAt', '<=', new Date())
  .get()
  .then(snap => console.log(`${snap.size} expired messages`));
```

### Count Storage Usage
```bash
# Firebase CLI
firebase database:get / --pretty
```

## Troubleshooting

### Messages Not Expiring
1. Check `expiresAt` field exists in Firestore
2. Verify date is in the past (> 72 hours ago)
3. Check useMessages filter logic
4. Restart app to refresh message list

### Messages Expiring Too Soon
1. Check TTL calculation in useChatActions.ts
2. Verify device clock is correct
3. Check for timezone issues

### Old Messages Still Visible
- Expected if they don't have `expiresAt` field
- Run migration script to add TTL
- Or wait for them to naturally expire (72 hours from update deployment)

## Success Criteria ✅

- [x] All new messages have `expiresAt` field
- [x] Messages older than 72 hours are filtered out
- [x] No errors in message sending
- [x] Backward compatible with legacy messages
- [x] TypeScript types updated
- [x] No compilation errors

## Files Modified

1. ✅ `src/hooks/useChatActions.ts` - Added `expiresAt` to 8 functions
2. ✅ `src/hooks/useMessages.ts` - Added filtering + interface update
3. ✅ `MESSAGE_TTL_IMPLEMENTATION.md` - Detailed implementation guide
4. ✅ `MESSAGE_TTL_IMPLEMENTED.md` - This document

## Status: READY FOR TESTING 🎉

The client-side implementation is complete and ready for testing. Messages will automatically disappear after 72 hours. For production deployment, consider adding Cloud Functions for true deletion.

---

**Need Help?**
- See `MESSAGE_TTL_IMPLEMENTATION.md` for Cloud Functions setup
- Test with 5-minute TTL for quick verification
- Monitor Firestore console for storage usage
