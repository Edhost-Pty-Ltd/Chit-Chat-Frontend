# Quick Test: Message TTL (72 Hours)

## Testing with 5-Minute TTL (Recommended for Development)

### Step 1: Enable Quick Testing Mode

Open `src/hooks/useChatActions.ts` and replace **ALL** occurrences of:

```typescript
const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);
```

With:

```typescript
const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes for testing
```

**Find and replace in these functions**:
- [ ] `sendMessage()`
- [ ] `sendVoiceMessage()`
- [ ] `sendImageMessage()`
- [ ] `sendVideoMessage()`
- [ ] `sendFileMessage()`
- [ ] `sendNumberChangeNotification()`
- [ ] `sendCurrentLocationMessage()`
- [ ] `sendLiveLocationMessage()`

**Quick Replace Command**:
```
Find: const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);
Replace: const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes for testing
```

### Step 2: Test the Feature

1. **Start the app**
   ```bash
   npx expo start
   ```

2. **Send a test message**
   - Open any chat
   - Send a text message: "Testing TTL - should disappear in 5 minutes"
   - Note the current time

3. **Wait 5 minutes**
   - Keep the app open or close it
   - Do other things

4. **Check if message disappeared**
   - After 5 minutes, go back to the chat
   - The message should no longer be visible
   - ✅ **Success!** TTL is working

5. **Verify in Firestore**
   - Go to Firebase Console → Firestore
   - Navigate to: `chats/{chatId}/messages`
   - Find the test message
   - Check the `expiresAt` field
   - ✅ Message should still exist (expected - deletion requires Cloud Functions)

### Step 3: Restore Production Settings

After testing, change **ALL** occurrences back to 72 hours:

```typescript
const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);
```

**Quick Replace Command**:
```
Find: const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes for testing
Replace: const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);
```

## Visual Test Checklist

| Time | Expected Result | Status |
|------|----------------|--------|
| T+0 min | Message visible in chat | ⏳ |
| T+3 min | Message still visible | ⏳ |
| T+5 min | Message disappeared | ⏳ |
| T+5 min | Message exists in Firestore | ⏳ |

## Automated Test (Optional)

Create a test message with 1-minute TTL:

```typescript
// Temporary test function
async function testTTL() {
  const expiresAt = new Date(Date.now() + 60 * 1000); // 1 minute
  
  const msgRef = doc(collection(db, 'chats', chatId, 'messages'));
  await setDoc(msgRef, {
    messageId: msgRef.id,
    senderId: currentUserId,
    text: 'Test message - expires in 1 minute',
    type: 'text',
    timestamp: new Date(),
    expiresAt: expiresAt,
    readBy: [currentUserId],
  });
  
  console.log('Test message created. Check in 1 minute.');
}
```

## Edge Cases to Test

### Test 1: Message at Exact Expiry Time
- Send message with 1-second TTL
- Should disappear immediately

### Test 2: Multiple Messages with Different TTLs
- Send 3 messages with 1, 3, 5 minute TTLs
- Verify they disappear at correct times

### Test 3: Legacy Messages (No TTL)
- Manually create message in Firestore without `expiresAt`
- Should remain visible forever

### Test 4: App Closed During Expiry
- Send message with 5-minute TTL
- Close app
- Wait 6 minutes
- Reopen app
- Message should already be gone

## Firestore Console Verification

### Check expiresAt Field
1. Go to Firebase Console
2. Navigate to: Firestore Database
3. Collection: `chats/{chatId}/messages/{messageId}`
4. Look for `expiresAt` field
5. Verify it's a Timestamp type
6. Check the date is ~72 hours in the future

### Query Expired Messages
Run this query in Firestore:
```javascript
messages.where('expiresAt', '<=', new Date())
```

Should return messages older than TTL.

## Troubleshooting

### Message Not Disappearing
- ✅ Check `expiresAt` field exists in message
- ✅ Verify expiry date is in the past
- ✅ Check console for filtering errors
- ✅ Restart the app

### Message Disappeared Too Early
- ✅ Check device time is correct
- ✅ Verify TTL calculation in code
- ✅ Check for timezone issues

### All Messages Disappeared
- ✅ You might have set TTL too short (e.g., 1 second)
- ✅ Check the TTL value in useChatActions.ts

## Production Deployment Checklist

Before deploying to production:

- [ ] Restore 72-hour TTL in all functions
- [ ] Test with at least 2 different message types (text + image)
- [ ] Verify legacy messages (without TTL) still display
- [ ] Check Firestore rules allow expiresAt field
- [ ] Document the feature in user-facing help/FAQ
- [ ] Consider adding "Messages expire after 72 hours" notice in UI
- [ ] Monitor Firestore storage usage

## Next: Enable Server-Side Deletion

Once client-side filtering is working:
1. Set up Firebase Cloud Functions
2. Deploy scheduled cleanup function
3. Verify messages are deleted from Firestore
4. Monitor Cloud Function logs

See `MESSAGE_TTL_IMPLEMENTATION.md` for Cloud Functions setup.

---

**Quick Commands**

```bash
# Start testing
npm run android  # or npm run ios

# Check for errors
npx tsc --noEmit

# Deploy to Firebase (after Cloud Functions setup)
firebase deploy --only functions
```

**Test Status**: Ready for testing! 🧪
