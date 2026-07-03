# Message TTL (Time To Live) Implementation - 72 Hours

## Overview
All messages in Chit-Chat will automatically be deleted 72 hours after creation. This feature ensures privacy and storage efficiency.

## Implementation Strategy

We'll use a **dual approach** for reliability:

1. **Server-Side (Recommended)**: Firebase Cloud Functions to delete expired messages
2. **Client-Side (Backup)**: TTL field + filtering to hide expired messages

## Approach 1: Firebase Cloud Functions (Server-Side)

### Advantages
- ✅ Runs reliably even when app is closed
- ✅ Deletes messages from database (saves storage costs)
- ✅ Centralized logic (one place to maintain)
- ✅ Can batch delete for efficiency

### Implementation

#### Step 1: Add TTL Field to Messages
When creating messages, add an `expiresAt` timestamp field:

```typescript
// In useChatActions.ts - sendMessage, sendVoiceMessage, etc.
const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000); // 72 hours from now

batch.set(msgRef, {
  messageId: msgRef.id,
  senderId,
  text: trimmed,
  timestamp: serverTimestamp(),
  expiresAt: expiresAt, // Add this field
  readBy: [senderId],
});
```

#### Step 2: Create Cloud Function
Create `functions/src/index.ts`:

```typescript
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp();
const db = admin.firestore();

// Run every hour to clean up expired messages
export const cleanupExpiredMessages = functions.pubsub
  .schedule('every 1 hours')
  .onRun(async (context) => {
    const now = admin.firestore.Timestamp.now();
    const batch = db.batch();
    let deletedCount = 0;

    try {
      // Get all chats
      const chatsSnapshot = await db.collection('chats').get();

      for (const chatDoc of chatsSnapshot.docs) {
        const chatId = chatDoc.id;
        
        // Query messages that have expired
        const expiredMessages = await db
          .collection('chats')
          .doc(chatId)
          .collection('messages')
          .where('expiresAt', '<=', now)
          .limit(500) // Batch limit
          .get();

        if (expiredMessages.empty) continue;

        // Delete expired messages
        for (const msgDoc of expiredMessages.docs) {
          batch.delete(msgDoc.ref);
          deletedCount++;
        }
      }

      // Commit the batch
      if (deletedCount > 0) {
        await batch.commit();
        console.log(`Deleted ${deletedCount} expired messages`);
      } else {
        console.log('No expired messages found');
      }

      return null;
    } catch (error) {
      console.error('Error cleaning up expired messages:', error);
      throw error;
    }
  });
```

#### Step 3: Deploy Cloud Function
```bash
# Initialize Firebase Functions
firebase init functions

# Install dependencies
cd functions
npm install firebase-functions firebase-admin

# Deploy
firebase deploy --only functions
```

### Firestore Rules Update
Add TTL validation to Firestore rules:

```javascript
match /chats/{chatId}/messages/{messageId} {
  allow create: if request.auth != null 
    && request.resource.data.expiresAt is timestamp
    && request.resource.data.expiresAt > request.time;
  
  allow read: if request.auth != null 
    && (resource == null || resource.data.expiresAt > request.time);
}
```

## Approach 2: Client-Side Filtering (Backup)

### Advantages
- ✅ Works without Cloud Functions (free tier friendly)
- ✅ Immediate - no wait for scheduled function
- ✅ Simple to implement

### Disadvantages
- ❌ Doesn't delete from database (storage accumulates)
- ❌ Only works when app is open
- ❌ Each client filters independently

### Implementation

#### Step 1: Add TTL to Message Creation
Already shown above - add `expiresAt` field when creating messages.

#### Step 2: Filter Expired Messages in useMessages Hook
Update `src/hooks/useMessages.ts`:

```typescript
// Filter out expired messages
const now = new Date();
const validMessages = messages.filter(msg => {
  if (!msg.expiresAt) return true; // Keep messages without TTL (legacy)
  const expiryDate = msg.expiresAt.toDate();
  return expiryDate > now;
});

return validMessages;
```

#### Step 3: Periodic Cleanup (Optional)
Add a periodic cleanup in the chat screen:

```typescript
// In ChatScreen.tsx
useEffect(() => {
  // Run cleanup every 10 minutes
  const interval = setInterval(async () => {
    const now = new Date();
    const expiredQuery = query(
      collection(db, 'chats', chatId, 'messages'),
      where('expiresAt', '<=', now),
      limit(50)
    );
    
    const snapshot = await getDocs(expiredQuery);
    const batch = writeBatch(db);
    
    snapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    if (!snapshot.empty) {
      await batch.commit();
      console.log(`Deleted ${snapshot.size} expired messages`);
    }
  }, 10 * 60 * 1000); // 10 minutes

  return () => clearInterval(interval);
}, [chatId]);
```

## Recommended Approach

**Use Both!**
- Implement client-side filtering immediately (works on free tier)
- Add Cloud Functions when ready to deploy (better long-term solution)

## Implementation Order

### Phase 1: Immediate (Client-Side)
1. ✅ Add `expiresAt` field to all message creation functions
2. ✅ Filter expired messages in `useMessages` hook
3. ✅ Update Firestore rules to enforce TTL
4. ✅ Test locally

### Phase 2: Production (Server-Side)
1. Set up Firebase Functions
2. Deploy scheduled cleanup function
3. Monitor logs and adjust schedule if needed
4. Remove client-side cleanup (keep filtering)

## Testing Checklist

### Development Testing (Use 5 minutes instead of 72 hours)
```typescript
// For testing, use 5 minutes
const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
```

- [ ] Send a message with TTL
- [ ] Wait 5 minutes
- [ ] Verify message disappears from UI
- [ ] Check Firestore console - message still exists (client-side)
- [ ] Run Cloud Function manually
- [ ] Verify message deleted from Firestore

### Production Testing
- [ ] Deploy with 72-hour TTL
- [ ] Send test messages
- [ ] Wait 72 hours
- [ ] Verify automatic cleanup occurred
- [ ] Check Cloud Function logs

## Cost Considerations

### Storage Costs (Without Cloud Functions)
- 1 million messages × 1KB each = 1GB storage
- Firestore: $0.18/GB/month = **$0.18/month** for 1M messages
- Without cleanup, storage grows indefinitely

### Cloud Function Costs
- Scheduled every hour = 720 invocations/month
- Assuming 5 seconds per run = 3,600 seconds/month
- Free tier: 2 million invocations, 400K GB-seconds/month
- **Cost: $0** (well within free tier)

### Bandwidth Costs (Client-Side Deletion)
- Each client deletes 50 messages every 10 minutes
- 100 active users = 5,000 deletes/10 min = 720K deletes/day
- Firestore: $0.06 per 100K deletes = **$0.43/day** = **$13/month**

**Recommendation**: Use Cloud Functions to save on bandwidth costs.

## Migration Plan (For Existing Messages)

If you already have messages without `expiresAt`:

```typescript
// One-time migration script
async function migrateExistingMessages() {
  const chatsSnapshot = await getDocs(collection(db, 'chats'));
  
  for (const chatDoc of chatsSnapshot.docs) {
    const messagesSnapshot = await getDocs(
      collection(db, 'chats', chatDoc.id, 'messages')
    );
    
    const batch = writeBatch(db);
    let count = 0;
    
    for (const msgDoc of messagesSnapshot.docs) {
      const msgData = msgDoc.data();
      
      // Skip if already has expiresAt
      if (msgData.expiresAt) continue;
      
      // Calculate expiry from timestamp
      const timestamp = msgData.timestamp?.toDate() || new Date();
      const expiresAt = new Date(timestamp.getTime() + 72 * 60 * 60 * 1000);
      
      batch.update(msgDoc.ref, { expiresAt });
      count++;
      
      // Firestore batch limit is 500
      if (count >= 500) {
        await batch.commit();
        count = 0;
      }
    }
    
    if (count > 0) {
      await batch.commit();
    }
  }
  
  console.log('Migration complete');
}
```

## Privacy & Legal Compliance

This feature helps with:
- ✅ GDPR compliance (data minimization)
- ✅ User privacy (ephemeral messaging)
- ✅ Storage efficiency (reduced costs)

## User Communication

Consider adding:
1. **In-app notice**: "Messages automatically delete after 72 hours"
2. **Settings option**: Allow users to export chat history before deletion
3. **Visual indicator**: Show remaining time on messages (optional)

---

## Next Steps

Let me know which approach you'd like to implement first:
1. **Client-side filtering only** (quick, free tier friendly)
2. **Cloud Functions only** (best long-term solution)
3. **Both** (most reliable, recommended)
