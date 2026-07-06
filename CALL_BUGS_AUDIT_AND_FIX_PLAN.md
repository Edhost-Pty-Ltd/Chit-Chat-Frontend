# Call Bugs Audit & Fix Plan

## Date: July 6, 2026

---

## AUDIT FINDINGS

### Current Call Flow

#### 1. **Call Initiation (CallsScreen.tsx, lines 346-387)**

```typescript
const startLiveKitCall = async (calleeUserId, displayName, callType) => {
  // Line 367: Creates Firestore call document via groupCall.initiateGroupCall()
  const result = await groupCall.initiateGroupCall(
    chatId,
    user.uid,
    callerName,
    [user.uid, calleeUserId],  // ← Always 2 participants for 1-on-1
    callType,
  );

  if (result) {
    // Line 371: IMMEDIATELY starts the active call (joins LiveKit room!)
    startActiveCall({
      roomName: result.roomName,
      displayName: callerName,
      audioOnly: callType === 'audio',
      groupName: displayName,   // ← Other person's name
      memberCount: 2,
      chatId,
      callId: result.callId,
    });
  }
};
```

#### 2. **Firestore Call Document Creation (useGroupCall.ts, lines 38-73)**

```typescript
const groupCallData: GroupCallData = {
  callId,
  chatId,
  roomName,
  initiatorId,
  initiatorName,
  callType,
  status: 'active',  // ← BUG: Should be 'ringing' for caller!
  startedAt: serverTimestamp(),
  participants: groupMemberIds,
  activeParticipants: [initiatorId],  // ← Initiator added immediately
};

await setDoc(groupCallRef, groupCallData);
```

**Problem:** Document is created with `status: 'active'` and initiator in `activeParticipants` immediately.

#### 3. **ActiveCall Context → CallHost → LiveKit Room Join**

**Flow:**
1. `startActiveCall()` sets call params in ActiveCallContext (ActiveCallContext.tsx, line 48)
2. `CallHost` component renders when `call !== null` (CallHost.tsx, line 16)
3. `CallHost` renders `GroupCallContent` (CallHost.tsx, line 25)
4. `GroupCallContent` fetches token and **immediately joins LiveKit room** (GroupCallScreen.tsx, line 181):

```typescript
return (
  <LiveKitRoom
    serverUrl={LIVEKIT_CONFIG.url}
    token={token}
    connect={true}  // ← CONNECTS IMMEDIATELY!
    audio={true}
    video={!audioOnly}
    ...
  >
```

**Bug 1 Root Cause:** The LiveKit room connection happens immediately when `GroupCallContent` renders, which happens as soon as `startActiveCall()` is called.

#### 4. **No Outgoing Call Screen**

**Finding:** There is NO dedicated outgoing/ringing screen component in the codebase.
- RingingCallScreen.tsx exists but is for WebRTC-based calls (AudioCallScreen/VideoCallScreen)
- GroupCallScreen only shows the full call UI, not a ringing state

**Bug 2 Root Cause:** No ringing screen exists for LiveKit calls, and even if it did, the call would skip it because `startActiveCall()` immediately renders the full call UI.

#### 5. **Call Type Determination (Always Group)**

**useGroupCall.ts naming:** The hook is called "useGroupCall" and creates documents in the `groupCalls` collection.

**groupCallData structure:**
- No `isGroup` field
- Uses `memberCount` to show label (GroupCallNotificationManager.tsx, line 28)

**UI Logic (GroupCallNotificationManager.tsx, lines 55-59):**
```typescript
if (chatSnap.exists()) {
  const chatData = chatSnap.data();
  // Group chats have a name; for direct (1-on-1) chats fall back to caller's name
  groupName = chatData.groupName || chatData.name || currentNotification.initiatorName;
  memberCount = (chatData.members as string[])?.length || 2;
}
```

**Bug 3 Root Cause:** 
- All calls use `groupCalls` collection (even 1-on-1)
- UI uses `memberCount` from chat document to determine label
- For 1-on-1 calls: `memberCount = 2` but no explicit `isGroup: false` field

---

## DETAILED FIX PLAN

### Bug 1: Caller connects before receiver answers

#### **File 1: `src/hooks/useGroupCall.ts`**

**Line 65:** Change initial status from `'active'` to `'ringing'`
```typescript
// BEFORE:
status: 'active',

// AFTER:
status: 'ringing',
```

**Line 68:** Do NOT add initiator to `activeParticipants` initially
```typescript
// BEFORE:
activeParticipants: [initiatorId],

// AFTER:
activeParticipants: [],  // Empty until someone joins
```

**Add new field for initiator status tracking:**
```typescript
// AFTER line 66, add:
initiatorStatus: 'calling',  // 'calling' | 'joined' | 'cancelled'
```

#### **File 2: `src/screens/CallsScreen.tsx`**

**Lines 367-387:** Do NOT call `startActiveCall()` immediately. Instead:
1. Create call document (already done by `initiateGroupCall`)
2. Set up listener for status changes
3. Only call `startActiveCall()` when status becomes `'active'`

```typescript
// REPLACE lines 371-384 with:
if (result) {
  // Set up listener for call status changes
  const callRef = doc(db, 'groupCalls', result.callId);
  
  const unsubscribe = onSnapshot(callRef, (snapshot) => {
    if (!snapshot.exists()) {
      // Call was cancelled/deleted
      console.log('[CallsScreen] Call document deleted');
      unsubscribe();
      setCalling(false);
      return;
    }

    const callData = snapshot.data();
    
    if (callData.status === 'active') {
      // Receiver accepted! Now join the room
      console.log('[CallsScreen] Call accepted, joining room');
      unsubscribe();
      
      startActiveCall({
        roomName: result.roomName,
        displayName: callerName,
        audioOnly: callType === 'audio',
        groupName: displayName,
        memberCount: 2,
        chatId,
        callId: result.callId,
      });
      
      setCalling(false);
    } else if (callData.status === 'declined' || callData.status === 'cancelled') {
      // Call was rejected/cancelled
      console.log('[CallsScreen] Call', callData.status);
      unsubscribe();
      setCalling(false);
      Alert.alert('Call ended', `The call was ${callData.status}.`);
    }
  });
  
  // TODO: Add timeout to cancel call after 30 seconds
  setTimeout(() => {
    // Check if call is still ringing
    getDoc(callRef).then((snap) => {
      if (snap.exists() && snap.data().status === 'ringing') {
        updateDoc(callRef, { status: 'missed' });
        unsubscribe();
        setCalling(false);
        Alert.alert('No answer', 'The call was not answered.');
      }
    });
  }, 30000);
}
```

**Import additions needed at top of file:**
```typescript
import { doc, onSnapshot, updateDoc, getDoc } from 'firebase/firestore';
```

#### **File 3: `src/components/GroupCallNotificationManager.tsx`**

**Line 62:** When receiver joins, update call status to `'active'`

```typescript
// AFTER line 62 (const joined = await joinGroupCall(...)):
if (joined) {
  // Update call status to 'active' so caller knows to join
  const callRef = doc(db, 'groupCalls', currentNotification.callId);
  await updateDoc(callRef, { status: 'active' });
  
  // ... rest of existing code
}
```

**Import addition needed:**
```typescript
import { doc, getDoc, updateDoc } from 'firebase/firestore';
```

---

### Bug 2: No outgoing/ringing screen shown

#### **File 1: Create `src/screens/OutgoingCallScreen.tsx`**

New file needed:

```typescript
// ─── Screen: Outgoing Call (Ringing) ─────────────────────────────────────────
// Shows while waiting for receiver to answer

import React, { useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRoute, RouteProp, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { AppText, AppIcon, AppBg } from '../context/ThemeContext';
import { Avatar } from '../components';
import { COLORS, GRADIENTS } from '../types/theme';
import { RootStackParamList } from '../types';

type RouteP = RouteProp<RootStackParamList, 'OutgoingCall'>;
type NavProp = NativeStackNavigationProp<RootStackParamList, 'OutgoingCall'>;

export default function OutgoingCallScreen() {
  const route = useRoute<RouteP>();
  const navigation = useNavigation<NavProp>();
  const { callId, displayName, callType, photoUrl } = route.params;

  const handleCancel = async () => {
    // Update call status to 'cancelled'
    try {
      const callRef = doc(db, 'groupCalls', callId);
      await updateDoc(callRef, { status: 'cancelled' });
    } catch (err) {
      console.error('[OutgoingCall] Failed to cancel call:', err);
    }
    navigation.goBack();
  };

  // Listen for back button
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      e.preventDefault();
      handleCancel();
    });
    return unsubscribe;
  }, [navigation]);

  return (
    <View style={styles.root}>
      <AppBg />
      <LinearGradient colors={GRADIENTS.dark} style={StyleSheet.absoluteFill} />

      <View style={styles.content}>
        {/* Avatar */}
        <View style={styles.avatarContainer}>
          <Avatar
            imageUrl={photoUrl}
            initials={displayName.slice(0, 2).toUpperCase()}
            color={COLORS.blue}
            size={120}
          />
        </View>

        {/* Name and status */}
        <AppText fixedColor style={styles.name}>{displayName}</AppText>
        <AppText fixedColor style={styles.status}>
          {callType === 'video' ? 'Video calling...' : 'Calling...'}
        </AppText>

        {/* Activity indicator */}
        <ActivityIndicator size="large" color="#fff" style={styles.spinner} />

        {/* Cancel button */}
        <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
          <LinearGradient colors={['#E74C3C', '#C0392B']} style={styles.cancelGradient}>
            <AppIcon name="phone" size={28} color="#fff" />
          </LinearGradient>
          <AppText fixedColor style={styles.cancelLabel}>Cancel</AppText>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
  },
  avatarContainer: {
    marginBottom: 20,
  },
  name: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
  },
  status: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.7)',
  },
  spinner: {
    marginVertical: 30,
  },
  cancelButton: {
    alignItems: 'center',
    gap: 8,
    marginTop: 40,
  },
  cancelGradient: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    transform: [{ rotate: '135deg' }],
  },
  cancelLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
  },
});
```

#### **File 2: `src/navigation/AppNavigator.tsx`**

**Line 209:** Add OutgoingCall screen

```typescript
<Stack.Screen name="GroupCall" component={GroupCallScreen} />
<Stack.Screen name="OutgoingCall" component={OutgoingCallScreen} />  // ← ADD THIS
<Stack.Screen name="AccountSettings" component={AccountSettingsScreen} />
```

**Import addition:**
```typescript
import OutgoingCallScreen from '../screens/OutgoingCallScreen';
```

#### **File 3: `src/types/index.ts`**

Add to RootStackParamList:

```typescript
OutgoingCall: {
  callId: string;
  displayName: string;
  callType: 'audio' | 'video';
  photoUrl: string | null;
};
```

#### **File 4: `src/screens/CallsScreen.tsx`**

**After line 370 (inside `if (result)`), BEFORE setting up listener:**

```typescript
// Navigate to outgoing call screen
navigation.navigate('OutgoingCall', {
  callId: result.callId,
  displayName: displayName,
  callType: callType,
  photoUrl: null,  // TODO: Fetch from user profile
});
```

---

### Bug 3: 1-on-1 calls identified as group calls

#### **File 1: `src/hooks/useGroupCall.ts`**

**Line 60:** Add `isGroup` field based on participant count

```typescript
// AFTER line 59 (participants: groupMemberIds), ADD:
isGroup: groupMemberIds.length > 2,  // true if 3+, false if 2
```

**Update TypeScript interface at line 17:**

```typescript
export interface GroupCallData {
  callId: string;
  chatId: string;
  roomName: string;
  initiatorId: string;
  initiatorName: string;
  callType: 'audio' | 'video';
  status: 'ringing' | 'active' | 'ended' | 'declined' | 'cancelled' | 'missed';  // ← Update types
  isGroup: boolean;  // ← ADD THIS
  startedAt: Timestamp;
  participants: string[];
  activeParticipants?: string[];
}
```

#### **File 2: `src/screens/GroupCallScreen.tsx`**

**Line 301:** Use `isGroup` to determine UI label

Currently uses `memberCount` to show label. Change to use `isGroup` from call document.

**Add state for isGroup:**
```typescript
const [isGroupCall, setIsGroupCall] = useState(memberCount > 2);
```

**In Firestore listener (after line 328), add:**
```typescript
if (data) {
  setIsGroupCall(data.isGroup ?? (memberCount > 2));
}
```

**Update UI label (around line 650):**
```typescript
// Change from memberCount check to isGroup check
{isGroupCall ? 'Group Call' : '1-on-1 Call'}
```

---

## SUMMARY OF CHANGES

### Files to Modify
1. ✅ `src/hooks/useGroupCall.ts` - Change initial status, add isGroup field
2. ✅ `src/screens/CallsScreen.tsx` - Add listener, delay LiveKit join
3. ✅ `src/components/GroupCallNotificationManager.tsx` - Update status to 'active' on join
4. ✅ `src/screens/GroupCallScreen.tsx` - Use isGroup for UI
5. ✅ `src/navigation/AppNavigator.tsx` - Add OutgoingCall screen
6. ✅ `src/types/index.ts` - Add OutgoingCall params

### Files to Create
1. ✅ `src/screens/OutgoingCallScreen.tsx` - New ringing screen

### Firebase Schema Changes
**`groupCalls` collection - add fields:**
- `status`: Change initial value from `'active'` to `'ringing'`
- `isGroup`: boolean (true if 3+ participants)
- `initiatorStatus`: 'calling' | 'joined' | 'cancelled' (optional)

### Flow After Fix

**Caller:**
1. Taps call button
2. `groupCall.initiateGroupCall()` creates document with `status: 'ringing'`
3. Navigates to `OutgoingCallScreen` (shows "Calling...")
4. Listens to call document
5. When `status` changes to `'active'` → calls `startActiveCall()` → joins LiveKit room
6. If `status` changes to `'declined'/'cancelled'` → shows alert, goes back

**Receiver:**
1. Receives notification via `GroupCallNotificationManager`
2. Taps "Join"
3. `joinGroupCall()` adds to `activeParticipants`
4. Updates call document: `status: 'active'`
5. Caller's listener detects change → joins room
6. Receiver joins room
7. Both connected simultaneously

### Constraints Met
- ✅ LiveKit token/room logic unchanged
- ✅ Incoming call screen unchanged
- ✅ Hang-up logic unchanged
- ✅ Call type derived from participant count
- ✅ No changes to existing call screens (Audio/Video)

---

## TESTING CHECKLIST

After implementation:
- [ ] Caller sees outgoing screen, NOT call UI
- [ ] Caller doesn't join LiveKit room until receiver accepts
- [ ] Receiver can accept/decline
- [ ] Both join simultaneously when accepted
- [ ] Call cancelled if declined
- [ ] 30-second timeout works
- [ ] 1-on-1 calls show "1-on-1 Call" label
- [ ] Group calls (3+) show "Group Call" label
- [ ] Cancel button works on outgoing screen

