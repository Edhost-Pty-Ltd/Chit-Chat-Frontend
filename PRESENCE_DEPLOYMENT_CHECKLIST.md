# Presence System Fix - Deployment Checklist

## Pre-Deployment

### 1. Code Review
- [ ] Review changes in `src/hooks/usePresence.ts`
- [ ] Verify RTDB imports are correct
- [ ] Check all functions write to both RTDB and Firestore
- [ ] Confirm `onDisconnect` only updates RTDB
- [ ] Verify `useOtherUserPresence` reads from RTDB

### 2. Configuration Files
- [ ] `database.rules.json` exists and is correct
- [ ] `firebase.json` references database rules
- [ ] `src/config/firebase.ts` has RTDB initialized

### 3. Tests
- [ ] Run `npm test src/hooks/__tests__/usePresence.test.ts`
- [ ] All tests pass
- [ ] Tests verify both RTDB and Firestore writes

### 4. TypeScript Compilation
- [ ] Run `npm run typecheck` (or `tsc --noEmit`)
- [ ] No TypeScript errors in `usePresence.ts`

## Deployment Steps

### Step 1: Deploy Database Rules (CRITICAL - DO THIS FIRST)

```bash
# Ensure you're logged in
firebase login

# Deploy only database rules
firebase deploy --only database
```

**IMPORTANT: Auth Hybrid Issue**
The app uses `@react-native-firebase/auth` (native) but `firebase/database` (JS SDK). They don't share auth sessions automatically. The RTDB rules are temporarily permissive to work around this:

```json
{
  "rules": {
    "presence": {
      "$uid": {
        ".read": true,
        ".write": true  // Permissive - see PRESENCE_AUTH_HYBRID_ISSUE.md
      }
    }
  }
}
```

For production, implement custom token bridging (see `PRESENCE_AUTH_HYBRID_ISSUE.md`).

**Expected output**:
```
=== Deploying to 'chit-chat-67a7f'...

i  database: checking rules syntax...
✓  database: rules syntax is valid

i  database: deploying rules...
✓  database: released

✓  Deploy complete!
```

**Verify in Firebase Console**:
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project (chit-chat-67a7f)
3. Navigate to: Realtime Database → Rules
4. Verify you see:
   ```json
   {
     "rules": {
       "presence": {
         "$uid": {
           ".read": true,
           ".write": "$uid === auth.uid"
         }
       }
     }
   }
   ```
5. Check the rules were published (timestamp should be recent)

### Step 2: Build the App

```bash
# For development testing
npm start

# For production build (Android)
npm run android

# For production build (iOS)
npm run ios

# For web
npm run web
```

### Step 3: Test in Development

**Before deploying to production, test all scenarios:**

- [ ] App opens → Goes online
- [ ] App backgrounds → Goes offline after 2s
- [ ] App force-closes → Goes offline within 10s
- [ ] Quick app switch → No flicker
- [ ] Heartbeat sends every 30s
- [ ] Network loss → Goes offline
- [ ] Network reconnect → Goes online

**Use `TESTING_PRESENCE_FIX.md` for detailed test steps.**

### Step 4: Monitor Logs

**During testing, watch for these logs**:

✅ **Good logs**:
```
[Firebase] Realtime Database initialized
[usePresence] Presence updated in RTDB and Firestore: online
[usePresence] RTDB disconnect handler configured for user: [userId]
[usePresence] Heartbeat started
[usePresence] Heartbeat sent to RTDB and Firestore
[usePresence] Read presence for [userId]: online=true, lastSeen=...
```

❌ **Bad logs (investigate if you see these)**:
```
[usePresence] Failed to write presence: [error]
[usePresence] Failed to setup disconnect handler: [error]
[usePresence] Failed to send heartbeat: [error]
Permission denied
RTDB connection failed
```

### Step 5: Check Firebase Console Data

**Realtime Database**:
1. Go to Firebase Console → Realtime Database
2. Navigate to `presence/`
3. Verify you see entries like:
   ```json
   {
     "userId123": {
       "online": true,
       "lastSeen": 1234567890123,
       "lastHeartbeat": 1234567890123
     }
   }
   ```
4. Force-close an app and verify the entry updates to `online: false`

**Firestore (backup data)**:
1. Go to Firebase Console → Firestore
2. Navigate to `users/{userId}`
3. Verify presence fields are mirrored:
   ```
   online: true
   lastSeen: Timestamp
   lastHeartbeat: Timestamp
   ```

## Post-Deployment Monitoring

### Day 1: Close Monitoring

**Metrics to watch**:
- [ ] No errors in Sentry/error tracking
- [ ] RTDB read/write operations within expected range
- [ ] No spike in Firestore operations
- [ ] User reports confirm fix works

**Check Firebase Console Usage**:
1. Realtime Database → Usage tab
2. Monitor:
   - Simultaneous connections
   - Bandwidth usage
   - Storage usage
3. Ensure no abnormal spikes

### Week 1: Stability Check

- [ ] Monitor user feedback for presence issues
- [ ] Check error logs for any RTDB-related errors
- [ ] Verify heartbeat mechanism not draining battery
- [ ] Confirm no performance degradation

## Rollback Plan (If Issues Occur)

### If Critical Issues Found:

1. **Immediate**: Deploy previous version of app
2. **Investigate**: Check logs and Firebase Console data
3. **Fix**: Address specific issue
4. **Re-test**: Full testing cycle again
5. **Re-deploy**: Follow this checklist again

### Common Issues and Fixes:

**Issue: Permission denied errors**
- Check database rules are deployed
- Verify user is authenticated
- Confirm userId matches auth.uid

**Issue: onDisconnect not firing**
- Verify RTDB is initialized
- Check network connectivity
- Look for RTDB connection errors in logs

**Issue: Data not syncing between RTDB and Firestore**
- Check both databases in Firebase Console
- Verify `writePresence` is called
- Look for write errors in logs

**Issue: Excessive RTDB operations (cost concern)**
- Verify heartbeat is only sending every 30s
- Check heartbeat stops on background
- Monitor Firebase Console usage tab

## Success Criteria

### Required Before Production Release:

✅ All tests pass in `src/hooks/__tests__/usePresence.test.ts`  
✅ Database rules deployed successfully  
✅ Manual testing completed (all scenarios in TESTING_PRESENCE_FIX.md)  
✅ No TypeScript errors  
✅ No console errors in production build  
✅ Firebase Console shows correct RTDB data  
✅ Force-close test passes (user goes offline within 10s)  
✅ Heartbeat logging shows correct behavior  
✅ Privacy settings still work correctly  
✅ No performance degradation  
✅ No battery drain on mobile  

### Nice-to-Have Before Production:

- [ ] Performance testing with 100+ concurrent users
- [ ] Load testing RTDB presence reads
- [ ] Battery usage profiling on mobile devices
- [ ] Network efficiency testing (data usage)
- [ ] Accessibility testing with screen readers

## Documentation

**User-facing**:
- No user documentation needed (implementation detail)

**Developer-facing**:
- [ ] `PRESENCE_FORCE_CLOSE_FIX.md` - Implementation details
- [ ] `PRESENCE_ARCHITECTURE_COMPARISON.md` - Before/after architecture
- [ ] `TESTING_PRESENCE_FIX.md` - Testing guide
- [ ] `PRESENCE_DEPLOYMENT_CHECKLIST.md` - This file
- [ ] `PRESENCE_FIX_SUMMARY.md` - Quick summary

**Code comments**:
- [ ] `src/hooks/usePresence.ts` has clear header comments
- [ ] Each function has JSDoc comments
- [ ] Complex logic has inline comments

## Team Communication

### Notify Team Members:

**Before deployment**:
- [ ] Share testing results
- [ ] Share deployment timeline
- [ ] Explain what changed and why

**After deployment**:
- [ ] Confirm deployment successful
- [ ] Share monitoring plan
- [ ] Request feedback from team on presence behavior

### Key Points to Communicate:

1. **What was fixed**: Force-close now correctly marks users offline
2. **How it works**: RTDB `onDisconnect` provides server-side detection
3. **What changed**: RTDB is now source of truth for presence
4. **User impact**: Minimal - presence will be more accurate
5. **Performance impact**: Negligible - same number of writes

## Final Verification

### Before Marking as Complete:

- [ ] All checklist items above are completed
- [ ] All tests pass
- [ ] Manual testing confirms fix works
- [ ] No regressions in other features
- [ ] Database rules deployed
- [ ] Team is notified
- [ ] Documentation is complete

### Sign-Off:

**Developer**: _________________ Date: _________

**Reviewer**: _________________ Date: _________

**QA**: _________________ Date: _________

---

## Quick Reference Commands

```bash
# Deploy database rules
firebase deploy --only database

# Run tests
npm test src/hooks/__tests__/usePresence.test.ts

# TypeScript check
npm run typecheck

# Start development
npm start

# Build for production
npm run android  # or npm run ios, npm run web
```

---

## Contact for Issues

If you encounter issues during deployment:

1. Check Firebase Console for error messages
2. Review logs for RTDB connection errors
3. Verify database rules are correctly deployed
4. Consult `TESTING_PRESENCE_FIX.md` for debugging tips
5. Review `PRESENCE_FORCE_CLOSE_FIX.md` for implementation details

---

**IMPORTANT**: Do not skip Step 1 (Deploy Database Rules). The app will not work correctly without RTDB security rules in place.
