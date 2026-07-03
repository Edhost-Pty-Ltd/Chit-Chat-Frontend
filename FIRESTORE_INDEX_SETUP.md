# Firestore Composite Index Setup

## Problem
Query in `useNotificationSync.ts` (line ~168) requires a composite index that doesn't exist:

```typescript
const callHistoryQuery = query(
  collection(db, 'users', userId, 'callHistory'),
  where('direction', '==', 'incoming'),
  where('status', 'in', ['missed', 'rejected']),
  orderBy('timestamp', 'desc'),
);
```

**Error**: Firestore requires a composite index for queries with multiple filters and sorting.

## Query Analysis

### Collection Path
`users/{userId}/callHistory` (subcollection)

### Query Constraints
1. **Filter**: `direction == 'incoming'` (Ascending)
2. **Filter**: `status IN ['missed', 'rejected']` (Ascending)
3. **Order**: `timestamp` (Descending)

### Required Index
```
Collection: callHistory
Fields:
  - direction: Ascending
  - status: Ascending
  - timestamp: Descending
```

## Solution

### Files Created/Modified

#### 1. `firestore.indexes.json` (NEW)
```json
{
  "indexes": [
    {
      "collectionGroup": "callHistory",
      "queryScope": "COLLECTION",
      "fields": [
        {
          "fieldPath": "direction",
          "order": "ASCENDING"
        },
        {
          "fieldPath": "status",
          "order": "ASCENDING"
        },
        {
          "fieldPath": "timestamp",
          "order": "DESCENDING"
        }
      ]
    }
  ],
  "fieldOverrides": []
}
```

**Why `collectionGroup`?**
- The query is on a subcollection: `users/{userId}/callHistory`
- `collectionGroup` allows the index to work for ALL users' callHistory subcollections
- Without it, you'd need a separate index for each user

#### 2. `firebase.json` (UPDATED)
Added Firestore configuration:
```json
{
  "firestore": {
    "indexes": "firestore.indexes.json"
  }
}
```

## Deployment

### Deploy the Index
```bash
firebase deploy --only firestore:indexes
```

**Expected output**:
```
=== Deploying to 'chit-chat-67a7f'...

i  firestore: checking indexes...
✓  firestore: indexes deployed successfully

✓  Deploy complete!
```

### Index Building Time
- Firestore will build the index in the background
- Can take **minutes to hours** depending on existing data
- Monitor progress in Firebase Console

### Verify Index
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select project: **chit-chat-67a7f**
3. Navigate to: **Firestore Database** → **Indexes**
4. You should see:
   - **Collection**: callHistory
   - **Fields indexed**: direction (Asc), status (Asc), timestamp (Desc)
   - **Status**: Building → Enabled

## Query Behavior

### Before Index is Built
```
[useNotificationSync] Error in call history listener: 
FirebaseError: The query requires an index. You can create it here: [link]
```

The code already handles this gracefully:
```typescript
try {
  // Set up call history listener
  const unsubCalls = onSnapshot(callHistoryQuery, ...);
} catch (error) {
  console.error('[useNotificationSync] Failed to set up call history listener (index may be missing):', error);
  console.log('[useNotificationSync] Continuing with message notifications only');
  // Message notifications continue to work
}
```

### After Index is Enabled
```
[useNotificationSync] Call history listener set up successfully
[useNotificationSync] All listeners set up successfully
```

The query will work automatically - **no code changes needed**.

## Manual Setup (Alternative)

If you prefer to create the index manually via Firebase Console:

### Step 1: Get the Index Creation Link
1. Run your app
2. Trigger the query (receive a call)
3. Check console for error with a link like:
   ```
   https://console.firebase.google.com/v1/r/project/chit-chat-67a7f/firestore/indexes?create_composite=...
   ```

### Step 2: Click the Link
- Opens Firebase Console with pre-filled index configuration
- Click "Create Index"

### Step 3: Wait for Build
- Index status: Building → Enabled
- Can take minutes to hours

**Downside**: Not in version control, not deployable via CLI

## Why This Solution is Better

### ✅ Version Controlled
- Index definition in `firestore.indexes.json`
- Tracked in git
- Team members get same indexes

### ✅ Deployable
```bash
firebase deploy --only firestore:indexes
```

### ✅ Repeatable
- Set up new environments easily
- Staging, production, etc. get same indexes

### ✅ Documented
- Clear what indexes exist
- No need to export from Console

## Index Details

### Collection Group vs Collection
**Collection Group** (what we're using):
```json
"collectionGroup": "callHistory",
"queryScope": "COLLECTION"
```
- Works for: `users/alice/callHistory`, `users/bob/callHistory`, etc.
- Single index for all subcollections with same name

**Collection** (alternative):
```json
"collectionGroup": "users/{userId}/callHistory",
"queryScope": "COLLECTION"
```
- Would only work for specific path
- Not recommended for subcollections

### Query Scope
- `COLLECTION`: Standard subcollection queries
- `COLLECTION_GROUP`: Cross-user queries (e.g., "all call history for all users")

We use `COLLECTION` because each user queries their own `callHistory`.

## Testing

### Before Deploying
The app will log:
```
[useNotificationSync] Failed to set up call history listener (index may be missing)
[useNotificationSync] Continuing with message notifications only
```

Message notifications work, call notifications don't.

### After Deploying (While Building)
Same error until index finishes building.

### After Index is Built
```
[useNotificationSync] Setting up call history listener
[useNotificationSync] Call history listener set up successfully
```

Both message and call notifications work.

### Verify Index is Working
1. Receive a missed call
2. Check console:
   ```
   [useNotificationSync] New call added
   [useNotificationSync] Pushing call notification
   ```
3. Notification should appear

## Troubleshooting

### Issue: Deploy fails with "indexes file not found"
**Cause**: `firebase.json` references wrong path
**Fix**: Verify `firestore.indexes.json` exists in project root

### Issue: Index takes too long to build
**Cause**: Large existing dataset
**Solution**: 
- Check Firebase Console for progress
- Index builds incrementally
- Query will work once "Enabled"

### Issue: Query still fails after index is enabled
**Possible causes**:
1. Index fields don't match query exactly
   - Check field names: `direction`, `status`, `timestamp`
   - Check order: Ascending vs Descending
   
2. Collection path mismatch
   - Verify `collectionGroup: "callHistory"`
   - Verify query uses correct subcollection path

3. Browser cache
   - Hard refresh (Ctrl+Shift+R)
   - Clear site data

### Issue: Index not showing in Console
**Cause**: Not deployed
**Fix**: Run `firebase deploy --only firestore:indexes`

## Related Files

- `src/hooks/useNotificationSync.ts` (line 168) - Query that needs the index
- `firestore.indexes.json` - Index definition (NEW)
- `firebase.json` - Firebase configuration (UPDATED)

## Summary

✅ **Created**: `firestore.indexes.json` with composite index  
✅ **Updated**: `firebase.json` to reference indexes file  
✅ **Confirmed**: Query filters on `direction` and `status`, orders by `timestamp`  
✅ **No code changes needed**: Query will work automatically after index builds  

**Next step**: Run `firebase deploy --only firestore:indexes`
