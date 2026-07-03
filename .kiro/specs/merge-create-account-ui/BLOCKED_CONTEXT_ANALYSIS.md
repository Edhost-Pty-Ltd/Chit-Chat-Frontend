# BlockedContext Analysis - Task 15.1

## Executive Summary

**Decision: INTEGRATE BlockedContext with Firebase Enhancement**

BlockedContext from create-account branch provides NEW functionality that does NOT exist in Frontend-FeaturesMJ. The current implementation uses AsyncStorage for local-only blocked contacts. This should be integrated AND enhanced with Firebase Firestore for cross-device synchronization.

---

## Current State Analysis

### Frontend-FeaturesMJ Branch (Current)

**Blocked Users Functionality:**
- ❌ **No implementation** - Only UI placeholder exists
- ❌ **No hook** - No `useBlocked` or similar hook
- ❌ **No context** - No BlockedContext or blocked state management
- ✅ **UI exists** - PrivacySettingsScreen has "Blocked Contacts" row (line 104-106)
  - Currently shows: `Alert.alert('Blocked', 'No contacts blocked.')`
  - Displays hardcoded "0" as right label
  - Non-functional - just a placeholder

**Existing Firestore Collections:**
```
/chats/                          # Chat documents
  {chatId}/messages/             # Message subcollection
/calls/                          # Call signaling documents
/users/                          # User profiles
  {userId}/callHistory/          # Call history subcollection
```

**Note:** No `blockedContacts` collection or user-level blocked list exists.

---

### Create-Account Branch (Source)

**BlockedContext Implementation:**
- ✅ Full context provider with React hooks
- ✅ AsyncStorage persistence (`blocked_contact_ids` key)
- ✅ Methods: `blockContact`, `unblockContact`, `isBlocked`
- ✅ State management with React Context API
- ❌ **Local only** - No Firebase integration
- ❌ **Not synced** - Blocked list doesn't sync across devices
- ❌ **Uses numeric IDs** - Expects `number[]` instead of Firebase UIDs

**Implementation Details:**
```typescript
interface BlockedContextValue {
  blockedIds: number[];              // ⚠️ Should be string[] for Firebase UIDs
  blockContact:   (id: number) => Promise<void>;
  unblockContact: (id: number) => Promise<void>;
  isBlocked:      (id: number) => boolean;
}
```

**Storage:**
- Uses `@react-native-async-storage/async-storage`
- Key: `'blocked_contact_ids'`
- Format: JSON array of contact IDs

**Comments from Source Code:**
```
// • Blocker:  sees an inline "You've blocked this person" banner in the chat.
//             Their messages are still visible (they sent them before blocking)
//             New outgoing messages are allowed (one-sided block).
// • Blocked:  their incoming messages are silently dropped from the UI.
//             They see no indication — messages appear to send normally on their end.
```

---

## Integration Decision

### Why Integrate?

1. **Non-conflicting** - No existing blocked users functionality in Frontend-FeaturesMJ
2. **Adds value** - Implements the placeholder UI in PrivacySettingsScreen
3. **User expectation** - Privacy settings screen already shows "Blocked Contacts" option
4. **Requirements alignment** - Requirement 10.1, 10.5, 10.6, 10.8 specify evaluating and integrating new contexts

### Why Enhance with Firebase?

1. **Cross-device sync** - Users expect blocked list to sync across devices
2. **Consistent with app architecture** - All other features use Firebase (chats, calls, contacts)
3. **Persistence** - Server-side storage is more reliable than local-only
4. **Real-time updates** - Firebase listeners enable immediate UI updates
5. **Data integrity** - Firebase UIDs (strings) instead of numeric IDs

---

## Proposed Firebase Integration

### Firestore Schema

Add a new subcollection under each user:

```
/users/{userId}/blockedContacts/{blockedUserId}
  - blockedAt: timestamp
  - blockedBy: string (userId - redundant but useful for queries)
```

**Alternative: Array field approach**
```
/users/{userId}
  - blockedContactIds: string[] (array of UIDs)
```

**Recommendation: Subcollection approach**
- Better scalability (no 1MB document size limits)
- Easier to query and paginate
- Can add metadata (blockedAt timestamp, reason, etc.)
- Follows existing pattern (callHistory subcollection)

### Enhanced Context Interface

```typescript
interface BlockedContextValue {
  blockedIds: string[];                    // Changed from number[] to string[]
  blockContact:   (uid: string) => Promise<void>;
  unblockContact: (uid: string) => Promise<void>;
  isBlocked:      (uid: string) => boolean;
  loading: boolean;                        // NEW: Loading state
  error: Error | null;                     // NEW: Error state
}
```

### Implementation Strategy

**Phase 1: Basic Integration (Minimal)**
1. Copy BlockedContext.tsx to `src/context/`
2. Change `number` types to `string` types (for Firebase UIDs)
3. Keep AsyncStorage as primary storage
4. Export `useBlocked` hook

**Phase 2: Firebase Enhancement (Recommended)**
1. Add Firestore subcollection: `/users/{userId}/blockedContacts/{blockedUid}`
2. Implement real-time listener with `onSnapshot`
3. Keep AsyncStorage as cache/fallback
4. Add loading and error states
5. Handle offline scenarios (Firestore offline persistence)

**Phase 3: UI Integration**
1. Update PrivacySettingsScreen to use `useBlocked` hook
2. Replace Alert with navigation to BlockedContactsScreen (create new screen)
3. Display actual count from `blockedIds.length`
4. Show list of blocked contacts with unblock button

**Phase 4: Chat Integration**
1. Update ChatScreen to check `isBlocked` before rendering
2. Show "You've blocked this person" banner if blocked
3. Update useMessages to filter out messages from blocked users (optional)
4. Prevent new chats with blocked users in useChatActions

---

## Implementation Code

### Enhanced BlockedContext.tsx

```typescript
// ─── Blocked Contacts Context with Firebase ─────────────────────────────────
// Manages blocked contacts list with Firestore sync and AsyncStorage cache.

import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  onSnapshot,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../hooks/useAuth';

const STORAGE_KEY = 'blocked_contact_ids';

interface BlockedContextValue {
  blockedIds: string[];
  blockContact:   (uid: string) => Promise<void>;
  unblockContact: (uid: string) => Promise<void>;
  isBlocked:      (uid: string) => boolean;
  loading: boolean;
  error: Error | null;
}

const BlockedContext = createContext<BlockedContextValue>({
  blockedIds:     [],
  blockContact:   async () => {},
  unblockContact: async () => {},
  isBlocked:      () => false,
  loading:        false,
  error:          null,
});

export function BlockedProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [blockedIds, setBlockedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Load from AsyncStorage on mount (cache)
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw) {
        try { 
          const cached = JSON.parse(raw);
          setBlockedIds(cached);
          setLoading(false);
        } catch (err) {
          console.error('[BlockedContext] Failed to parse cached blocked IDs:', err);
        }
      } else {
        setLoading(false);
      }
    });
  }, []);

  // Real-time listener for Firestore
  useEffect(() => {
    if (!user?.uid) {
      setBlockedIds([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const blockedRef = collection(db, 'users', user.uid, 'blockedContacts');

    const unsubscribe = onSnapshot(
      blockedRef,
      (snapshot) => {
        const ids = snapshot.docs.map(doc => doc.id);
        setBlockedIds(ids);
        setLoading(false);
        setError(null);
        
        // Update cache
        AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
      },
      (err) => {
        console.error('[BlockedContext] Firestore listener error:', err);
        setError(err as Error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user?.uid]);

  const blockContact = async (uid: string) => {
    if (!user?.uid) {
      throw new Error('User not authenticated');
    }

    try {
      const docRef = doc(db, 'users', user.uid, 'blockedContacts', uid);
      await setDoc(docRef, {
        blockedAt: serverTimestamp(),
        blockedBy: user.uid,
      });
      
      // Optimistic update (Firestore listener will sync)
      if (!blockedIds.includes(uid)) {
        const updated = [...blockedIds, uid];
        setBlockedIds(updated);
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      }
    } catch (err) {
      console.error('[BlockedContext] Failed to block contact:', err);
      setError(err as Error);
      throw err;
    }
  };

  const unblockContact = async (uid: string) => {
    if (!user?.uid) {
      throw new Error('User not authenticated');
    }

    try {
      const docRef = doc(db, 'users', user.uid, 'blockedContacts', uid);
      await deleteDoc(docRef);
      
      // Optimistic update
      const updated = blockedIds.filter((id) => id !== uid);
      setBlockedIds(updated);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (err) {
      console.error('[BlockedContext] Failed to unblock contact:', err);
      setError(err as Error);
      throw err;
    }
  };

  const isBlocked = (uid: string) => blockedIds.includes(uid);

  return (
    <BlockedContext.Provider 
      value={{ blockedIds, blockContact, unblockContact, isBlocked, loading, error }}
    >
      {children}
    </BlockedContext.Provider>
  );
}

export function useBlocked() {
  return useContext(BlockedContext);
}
```

### Update App.tsx (or AppNavigator.tsx)

```typescript
// Add BlockedProvider to the provider tree
import { BlockedProvider } from './context/BlockedContext';

// Wrap existing providers
<BlockedProvider>
  <AuthProvider>
    <ThemeProvider>
      {/* ... rest of app */}
    </ThemeProvider>
  </AuthProvider>
</BlockedProvider>
```

### Update PrivacySettingsScreen.tsx

```typescript
// Import useBlocked hook
import { useBlocked } from '../context/BlockedContext';

export default function PrivacySettingsScreen() {
  const { blockedIds, loading } = useBlocked();
  
  // Update the Blocked Contacts row
  <Row icon="ban-outline" label="Blocked Contacts"
    sub="Manage who can't contact you"
    onPress={() => navigation.navigate('BlockedContacts')} 
    rightLabel={loading ? '...' : blockedIds.length.toString()} 
  />
}
```

---

## Firestore Security Rules

Add rules for blocked contacts subcollection:

```javascript
// Add to firestore.rules
match /users/{userId}/blockedContacts/{blockedUid} {
  // User can read/write their own blocked list
  allow read, write: if request.auth.uid == userId;
  
  // Prevent reading other users' blocked lists
  allow read, write: if false;
}
```

---

## Testing Strategy

### Unit Tests (Optional)
- Test `blockContact` adds UID to blockedIds
- Test `unblockContact` removes UID from blockedIds
- Test `isBlocked` returns correct boolean
- Test AsyncStorage cache on mount

### Integration Tests
1. **Block a contact**
   - Open PrivacySettings → Blocked Contacts
   - Block a user
   - Verify count updates
   - Verify Firestore document created

2. **Unblock a contact**
   - Open blocked contacts list
   - Unblock a user
   - Verify count decrements
   - Verify Firestore document deleted

3. **Cross-device sync**
   - Block user on device A
   - Open app on device B
   - Verify blocked list syncs

4. **Offline behavior**
   - Disable network
   - Block a user (should queue operation)
   - Enable network
   - Verify operation completes

---

## Migration Strategy

### No Migration Needed
- Frontend-FeaturesMJ has no existing blocked users data
- Fresh integration with no data conflicts

### If Users Have Cached Data (AsyncStorage)
1. On first Firestore sync, check AsyncStorage
2. If cached data exists, migrate to Firestore
3. Clear AsyncStorage after successful migration

```typescript
// In BlockedProvider useEffect
useEffect(() => {
  const migrateIfNeeded = async () => {
    const cached = await AsyncStorage.getItem(STORAGE_KEY);
    if (cached && user?.uid) {
      try {
        const oldIds = JSON.parse(cached);
        // Migrate to Firestore
        for (const id of oldIds) {
          await blockContact(id);
        }
        console.log('[BlockedContext] Migrated cached blocked contacts to Firestore');
      } catch (err) {
        console.error('[BlockedContext] Migration failed:', err);
      }
    }
  };
  
  migrateIfNeeded();
}, [user?.uid]);
```

---

## Dependencies

### Already Installed (verify in package.json)
- `@react-native-async-storage/async-storage`
- `firebase` (Firestore SDK)

### No New Dependencies Required
All required packages already exist in Frontend-FeaturesMJ.

---

## Conflicts and Risks

### Conflicts: NONE
- ✅ No existing blocked users functionality
- ✅ No conflicting hooks or contexts
- ✅ PrivacySettingsScreen placeholder ready for integration

### Risks: LOW
- **Risk:** Firestore offline mode conflicts
  - **Mitigation:** Use AsyncStorage as fallback cache
- **Risk:** UID vs numeric ID mismatch
  - **Mitigation:** Change all `number` types to `string` during integration
- **Risk:** Provider nesting order
  - **Mitigation:** Place BlockedProvider above AuthProvider or at same level

---

## Recommendation

**INTEGRATE BlockedContext with Firebase Enhancement**

### Implementation Steps:
1. ✅ Copy `BlockedContext.tsx` from create-account branch
2. ✅ Modify types: `number[]` → `string[]` for Firebase UIDs
3. ✅ Add Firestore integration with real-time listener
4. ✅ Keep AsyncStorage as cache
5. ✅ Add to provider tree in App.tsx or AppNavigator.tsx
6. ✅ Update PrivacySettingsScreen to use `useBlocked` hook
7. ✅ Add Firestore security rules
8. ✅ (Optional) Create BlockedContactsScreen to show list
9. ✅ (Optional) Integrate with ChatScreen to hide blocked users

### Estimated Effort:
- **Phase 1 (Basic):** 1-2 hours
- **Phase 2 (Firebase):** 2-3 hours
- **Phase 3 (UI):** 2-3 hours
- **Phase 4 (Chat Integration):** 2-3 hours
- **Total:** 7-11 hours

### Priority: MEDIUM-HIGH
- Completes existing UI placeholder
- Adds expected user feature
- Non-breaking integration
- Aligns with requirements 10.1, 10.5, 10.6, 10.8

---

## Next Steps

1. Create BlockedContext.tsx with Firebase integration
2. Add to provider tree
3. Update PrivacySettingsScreen
4. Test blocking/unblocking functionality
5. (Optional) Create BlockedContactsScreen
6. (Optional) Integrate with ChatScreen

---

## Related Files

- `src/context/BlockedContext.tsx` (NEW - from create-account)
- `src/screens/PrivacySettingsScreen.tsx` (UPDATE - line 104-106)
- `src/navigation/AppNavigator.tsx` (UPDATE - add provider)
- `firestore.rules` (UPDATE - add security rules)
- (Optional) `src/screens/BlockedContactsScreen.tsx` (NEW - list screen)
- (Optional) `src/screens/ChatScreen.tsx` (UPDATE - hide blocked users)

---

## Validation Requirements 10.1, 10.5, 10.6, 10.8

✅ **10.1:** BlockedContext adds NEW non-conflicting functionality  
✅ **10.5:** No duplication with existing hooks (no useBlocked exists)  
✅ **10.6:** Integration with Firebase_Implementation planned  
✅ **10.8:** Context provider evaluation complete - INTEGRATE decision
