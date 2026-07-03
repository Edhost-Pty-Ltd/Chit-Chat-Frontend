# Presence Not Showing - Debugging Guide

## Problem
The app no longer shows if a user is online or offline.

## Quick Diagnosis

### 1. Check Console Logs

**When you open the app and sign in, you should see:**

✅ **Good logs** (writes working):
```
[usePresence] Writing presence to RTDB: userId=..., online=true
[usePresence] ✅ RTDB write successful
[usePresence] ✅ Firestore write successful
[usePresence] ✅ RTDB disconnect handler configured
[usePresence] Heartbeat started
[usePresence] ✅ Heartbeat sent successfully
```

❌ **Bad logs** (writes failing):
```
[usePresence] Failed to write presence: [error details]
[usePresence] Failed to send heartbeat: PERMISSION_DENIED
```

**When viewing another user's chat:**

✅ **Good logs** (reads working):
```
[usePresence] RTDB snapshot received for userId: { exists: true, data: {...}, online: true, lastSeen: 123... }
[usePresence] Read presence for userId: online=true, lastSeen=...
```

❌ **Bad logs** (no data):
```
[usePresence] RTDB snapshot received for userId: { exists: false, data: null }
[usePresence] No presence data for userId, showing offline
```

❌ **Bad logs** (read permission error):
```
[usePresence] Error reading presence for userId: { error: "PERMISSION_DENIED", code: ... }
```

---

### 2. Check Firebase Console - Realtime Database

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select project: **chit-chat-67a7f**
3. Navigate to: **Realtime Database** → **Data** tab
4. Look for `presence/` node

**What you should see:**
```json
{
  "presence": {
    "userId1": {
      "online": true,
      "lastSeen": 1719911770000,
      "lastHeartbeat": 1719911770000
    },
    "userId2": {
      "online": false,
      "lastSeen": 1719911700000,
      "lastHeartbeat": null
    }
  }
}
```

**If you see nothing:**
- ❌ Writes are failing completely
- Check console for PERMISSION_DENIED errors
- Verify rules are deployed

**If `presence/` doesn't exist:**
- ❌ No writes have succeeded yet
- Rules might not be deployed
- Or app hasn't tried to write yet

---

### 3. Check Firebase Console - Realtime Database Rules

1. Firebase Console → **Realtime Database** → **Rules** tab
2. Verify you see:
```json
{
  "rules": {
    "presence": {
      "$uid": {
        ".read": true,
        ".write": true
      }
    }
  }
}
```

3. Check the **Published** timestamp - should be recent (after the fix)

**If rules are different:**
- Run: `firebase deploy --only database`
- Refresh the Rules tab to verify

---

## Common Issues & Fixes

### Issue 1: "No presence data" in logs

**Symptom:**
```
[usePresence] RTDB snapshot received: { exists: false, data: null }
[usePresence] No presence data for userId, showing offline
```

**Cause:** RTDB is empty - writes never succeeded

**Fix:**
1. Check if writes are happening at all (look for write logs)
2. If no write logs, check if `useWritePresence` is being called
3. If write logs show errors, check Firebase Console rules
4. Verify rules are deployed: `firebase deploy --only database`

---

### Issue 2: PERMISSION_DENIED on writes

**Symptom:**
```
[usePresence] Failed to write presence: { error: "PERMISSION_DENIED" }
```

**Cause:** Rules not deployed or incorrect

**Fix:**
1. Deploy rules: `firebase deploy --only database`
2. Verify in Firebase Console → Realtime Database → Rules
3. Rules should have `.write: true` for presence nodes

---

### Issue 3: PERMISSION_DENIED on reads

**Symptom:**
```
[usePresence] Error reading presence: { error: "PERMISSION_DENIED", code: ... }
```

**Cause:** Rules don't allow reads

**Fix:**
1. Check rules have `.read: true`
2. Deploy if needed: `firebase deploy --only database`

---

### Issue 4: Data exists in RTDB but not showing in UI

**Symptom:**
- Firebase Console shows presence data
- Logs show successful reads
- UI doesn't show online/offline status

**Debugging:**
1. Check console logs for `[usePresence] Read presence for userId: online=...`
2. Verify `online` value is boolean `true`/`false`, not string
3. Check if privacy settings are hiding status
4. Inspect component rendering - is `presenceText` being displayed?

---

### Issue 5: Writes succeed but data is wrong format

**Symptom:**
- Logs show "✅ RTDB write successful"
- Firebase Console shows data but UI doesn't understand it

**Check data format in Firebase Console:**

✅ **Correct format:**
```json
{
  "online": true,
  "lastSeen": 1719911770000,
  "lastHeartbeat": 1719911770000
}
```

❌ **Wrong format:**
```json
{
  "online": "true",           // String instead of boolean
  "lastSeen": "2024-07-02",   // String instead of timestamp
  "lastHeartbeat": {}         // Object instead of number
}
```

**Fix:** Check `writePresence()` and `sendHeartbeat()` functions

---

## Step-by-Step Debugging

### Step 1: Verify Rules Are Deployed

```bash
firebase deploy --only database
```

**Expected output:**
```
✓  database: rules for database chit-chat-67a7f-default-rtdb released successfully
```

### Step 2: Restart App Completely

- Force-close the app
- Clear app cache/data (optional)
- Relaunch app
- Sign in

### Step 3: Watch Console Logs

Look for the write sequence:
1. `[usePresence] Writing presence to RTDB: userId=..., online=true`
2. `[usePresence] ✅ RTDB write successful`
3. `[usePresence] ✅ Firestore write successful`
4. `[usePresence] ✅ RTDB disconnect handler configured`
5. `[usePresence] Heartbeat started`
6. (30 seconds later) `[usePresence] ✅ Heartbeat sent successfully`

### Step 4: Check Firebase Console Data

1. Go to Firebase Console → Realtime Database → Data
2. Find `presence/{your-userId}`
3. Verify structure:
   ```json
   {
     "online": true,
     "lastSeen": <number>,
     "lastHeartbeat": <number>
   }
   ```

### Step 5: Test Reading Another User's Presence

1. Open a chat with another user
2. Watch for read logs:
   ```
   [usePresence] RTDB snapshot received for {otherUserId}: { exists: true, ... }
   [usePresence] Read presence for {otherUserId}: online=true
   ```
3. Check if status appears in chat header

### Step 6: Verify onDisconnect

1. Open app → Check presence node in Firebase Console (should be `online: true`)
2. Force-close app
3. Wait 10 seconds
4. Refresh Firebase Console
5. Presence node should update to `online: false`

---

## Manual Test Script

If automated presence isn't working, test RTDB directly:

```javascript
// In browser console or React Native debugger
import { ref, set, onValue } from 'firebase/database';
import { rtdb } from './src/config/firebase';

// Manual write test
const testWrite = async () => {
  const testRef = ref(rtdb, 'presence/test-user-123');
  await set(testRef, {
    online: true,
    lastSeen: Date.now(),
    lastHeartbeat: Date.now()
  });
  console.log('Test write successful');
};

// Manual read test
const testRead = () => {
  const testRef = ref(rtdb, 'presence/test-user-123');
  onValue(testRef, (snapshot) => {
    console.log('Test read result:', snapshot.val());
  });
};

testWrite().then(testRead);
```

If this fails with PERMISSION_DENIED, rules aren't deployed correctly.

---

## Expected Flow

### On App Open (Current User)

```
User opens app
  ↓
useWritePresence(userId) called in App.tsx
  ↓
goOnline(userId) executes
  ↓
writePresence(userId, true) called
  ↓
RTDB write: presence/{userId} = { online: true, ... }
  ↓
Firestore write: users/{userId} = { online: true, ... }
  ↓
setupDisconnectHandler(userId) configures onDisconnect
  ↓
startHeartbeat(userId) begins 30s interval
  ↓
✅ User is online in RTDB
```

### On Viewing Another User (Other User)

```
User opens chat with contact
  ↓
useOtherUserPresence(otherUserId) called in ChatScreen.tsx
  ↓
fetchUserPrivacySettings(otherUserId) checks privacy
  ↓
Subscribe to RTDB: presence/{otherUserId}
  ↓
onValue listener fires with snapshot
  ↓
Extract data: { online: true/false, lastSeen: number }
  ↓
Update UI state: statusText = "Online" or "last seen..."
  ↓
✅ Status displayed in chat header
```

---

## Rollback to Firestore (Emergency Fix)

If RTDB continues to fail, temporarily revert to Firestore-only:

1. Update `useOtherUserPresence` to read from Firestore:
```typescript
// Change from:
const presenceRef = dbRef(rtdb, `presence/${otherUserId}`);
presenceUnsub = onValue(presenceRef, ...);

// To:
const userDocRef = doc(db, 'users', otherUserId);
presenceUnsub = onSnapshot(userDocRef, (snap) => {
  const data = snap.data();
  const online = !!data?.online;
  // ... rest of logic
});
```

2. This won't fix force-close detection, but restores basic online/offline

---

## Get Help

If still not working after trying everything above:

1. **Share console logs** - Copy full logs from app startup through viewing a chat
2. **Share Firebase Console screenshot** - Realtime Database → Data tab
3. **Share Firebase Console screenshot** - Realtime Database → Rules tab
4. **Confirm**: Are rules deployed? Check Rules tab "Published" timestamp
5. **Confirm**: Is RTDB initialized? Check logs for "[Firebase] Realtime Database initialized"

---

## Quick Checklist

Before asking for help, verify:

- [ ] Rules deployed: `firebase deploy --only database`
- [ ] Rules visible in Firebase Console → Realtime Database → Rules
- [ ] App restarted after deploying rules
- [ ] Console shows `[Firebase] Realtime Database initialized`
- [ ] Console shows write attempts (successful or failed)
- [ ] Firebase Console → Realtime Database → Data shows `presence/` node
- [ ] If data exists, format is correct (boolean `online`, number timestamps)
- [ ] No PERMISSION_DENIED errors in console
- [ ] Privacy settings aren't hiding status (test with lastSeen visible)

---

**Most common fix**: Deploy rules and restart app
```bash
firebase deploy --only database
# Then force-close and reopen the app
```
