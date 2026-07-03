# Push Notification UI Update Bugfix Design

## Overview

This bugfix addresses a critical issue where native push notifications (messages, missed calls, etc.) fail to update the in-app UI state. While the native OS notification appears correctly, the app's own UI elements (badge counters, in-app notification toast, notification inbox) do not reflect the incoming notification.

The root cause is that `usePushNotifications` is called in App.tsx without the `onNotificationReceived` callback parameter, leaving it undefined. When a push notification arrives, the hook attempts to call this undefined callback, causing the in-app UI update path to be silently skipped. This creates a disconnect between two parallel notification systems:
1. **Native Push → usePushNotifications → undefined callback → ❌ UI never updates**
2. **Firestore → useNotificationSync → NotificationContext.pushNotification → ✅ UI updates correctly**

The fix wires the `pushNotification` function from NotificationContext as the callback parameter to `usePushNotifications`, unifying both notification paths into the same in-app UI update mechanism.

## Glossary

- **Bug_Condition (C)**: The condition that triggers the bug - when a native push notification is received (message, call, or system notification) while the app is in any state (foreground, background, or killed)
- **Property (P)**: The desired behavior when push notifications arrive - the in-app UI (badge counters, toast notification, notification inbox) should be updated in addition to the native OS notification
- **Preservation**: Existing notification behavior that must remain unchanged:
  - Firestore-synced notifications via `useNotificationSync` must continue to work
  - Native OS notifications when app is backgrounded/killed must continue to appear
  - Notification tap navigation behavior must remain unchanged
  - Internal counting logic in NotificationContext must remain unchanged
- **usePushNotifications**: The hook in `src/hooks/usePushNotifications.ts` that sets up Expo Notifications, registers push tokens, and listens for incoming push notifications
- **NotificationContext**: The React context in `src/context/NotificationContext.tsx` that manages in-app notification state (inbox, counters, toast)
- **pushNotification**: The function in NotificationContext (lines 115-150) that updates in-app UI state by adding to inbox, showing toast, and triggering native notification
- **PushNotificationManager**: The component in App.tsx (line 63) that currently calls `usePushNotifications` without the callback parameter
- **onNotificationReceived**: The optional callback parameter in `usePushNotifications` (lines 34-36) that bridges native push notifications to in-app UI updates

## Bug Details

### Bug Condition

The bug manifests when a native push notification is received via Expo Notifications (new message, missed call, or system notification). The `usePushNotifications` hook receives the notification and attempts to call the `onNotificationReceived` callback (line 58-64 in usePushNotifications.ts), but the callback is undefined because it was never passed from App.tsx. This causes the in-app UI update path to be silently skipped - no badge increment, no toast notification, no inbox update.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type NotificationReceivedEvent (from expo-notifications)
  OUTPUT: boolean
  
  RETURN input.notification.request.content EXISTS
         AND input.notification.request.content.data.type IN ['message', 'call', 'system']
         AND onNotificationReceived IS undefined
         AND NotificationContext.pushNotification IS NOT called
END FUNCTION
```

### Examples

- **New message arrives**: OS notification appears → user opens app → no badge increment, no toast shown, notification inbox is empty
- **Missed call notification**: OS notification appears → user already has app open → no badge increment, no in-app alert, missed call not recorded in inbox
- **System notification**: Push notification with type 'system' arrives → OS shows notification → app UI shows no indication of the notification
- **Background/killed state**: Push notification arrives when app is backgrounded or killed → OS notification works correctly → when user opens app later, no UI state reflects the notification that arrived

### Type Mismatch Detail

An additional issue exists in the callback logic: `usePushNotifications.ts` line 59 extracts `contactId` as `number` type, but `NotificationContext.pushNotification` expects `contactId` as `string` type. This will cause a type mismatch when the callback is wired.

### Duplicate Notification Risk

The `setNotificationHandler` in `usePushNotifications.ts` (line 28) currently sets `shouldShowAlert: true` for foreground notifications. When the callback is wired, this may cause duplicate notifications: one from the native handler and one from the in-app toast system.

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Firestore-synced notifications via `useNotificationSync` must continue to trigger in-app UI updates exactly as before
- Native OS notifications when app is backgrounded or killed must continue to appear and behave identically
- Notification tap/interaction behavior must remain unchanged (navigation to chat screen, etc.)
- Internal counting logic in NotificationContext (unreadCount, messageCount, callCount) must remain unchanged
- Badge count updates via `Notifications.setBadgeCountAsync` must remain unchanged
- Toast auto-dismiss timer (4 seconds) must remain unchanged

**Scope:**
All notification inputs that do NOT arrive via the native push notification path (specifically Firestore-synced notifications from `useNotificationSync`) should be completely unaffected by this fix. This includes:
- Real-time message notifications synced from Firestore
- Real-time call notifications synced from Firestore
- Any other notification sources that call `NotificationContext.pushNotification` directly

**Note:** The actual expected correct behavior for push notifications is defined in the Correctness Properties section (Property 1).

## Hypothesized Root Cause

Based on the bug description and code analysis, the root cause is confirmed:

1. **Missing Callback Wiring**: The `PushNotificationManager` component in App.tsx (line 63) calls `usePushNotifications(user?.uid ?? null)` without passing the second parameter `onNotificationReceived`. This leaves the callback undefined.

2. **Undefined Callback Invocation**: When a push notification is received, `usePushNotifications.ts` line 58-64 attempts to call `onNotificationReceived?.()` with the optional chaining operator. Since the callback is undefined, the function call is skipped silently, and the in-app UI is never updated.

3. **Type Mismatch**: The callback expects `contactId?: string` (from AppNotification type), but `usePushNotifications.ts` line 59 extracts `contactId?: number` from the notification data. This will cause a type error when the callback is wired.

4. **Two Parallel Systems**: The app has two notification systems:
   - **Native Push Path**: `usePushNotifications` → undefined callback → ❌ UI not updated
   - **Firestore Path**: `useNotificationSync` → `pushNotification` → ✅ UI updated
   
   Only the Firestore path works correctly because it directly calls `pushNotification`. The native push path is broken due to the missing callback wiring.

## Correctness Properties

Property 1: Bug Condition - Push Notifications Update In-App UI

_For any_ push notification received via Expo Notifications (new message, missed call, or system notification), the `usePushNotifications` hook SHALL call the `onNotificationReceived` callback with the notification data, which SHALL trigger `NotificationContext.pushNotification` to update the in-app UI (badge counters, toast notification, notification inbox).

**Validates: Requirements 2.1 (badge/counter increment), 2.2 (in-app notification shown)**

Property 2: Preservation - Firestore Notification Path Unchanged

_For any_ notification that arrives via the Firestore sync path (through `useNotificationSync`), the notification system SHALL produce exactly the same behavior as before this fix, preserving all existing functionality for real-time Firestore-synced notifications, native OS notifications, tap navigation, and internal counting logic.

**Validates: Requirements 3.1 (Firestore sync unchanged), 3.2 (native OS notifications unchanged), 3.3 (navigation unchanged), 3.4 (counting logic unchanged)**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct (which it is, based on code review):

**File**: `App.tsx`

**Component**: `PushNotificationManager`

**Specific Changes**:
1. **Import useNotifications Hook**: Add `import { useNotifications } from './src/context/NotificationContext';` to App.tsx imports

2. **Consume pushNotification from Context**: In `PushNotificationManager`, call `const { pushNotification } = useNotifications();` to get the function from NotificationContext

3. **Wire Callback Parameter**: Pass `pushNotification` as the second parameter to `usePushNotifications`:
   ```typescript
   usePushNotifications(user?.uid ?? null, pushNotification);
   ```

**File**: `src/hooks/usePushNotifications.ts`

**Function**: `addNotificationReceivedListener` callback (lines 53-64)

**Specific Changes**:
4. **Fix contactId Type Mismatch**: Convert `contactId` from `number` to `string` using `.toString()`:
   ```typescript
   contactId: data?.contactId?.toString(),
   ```

5. **Prevent Duplicate Notifications**: Update `setNotificationHandler` (line 28) to set `shouldShowAlert: false` for foreground notifications, since the in-app toast system will handle the visual alert:
   ```typescript
   handleNotification: async () => ({
     shouldShowAlert: false,  // Changed from true - in-app toast handles this
     shouldPlaySound: true,
     shouldSetBadge: true,
   }),
   ```

**No Changes Required**:
- `NotificationContext.tsx` requires no modifications - the `pushNotification` function already handles all required logic
- `useNotificationSync.ts` requires no modifications - it already correctly calls `pushNotification`
- Navigation logic requires no modifications

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code (verify the callback is undefined and UI doesn't update), then verify the fix works correctly (callback is wired and UI updates) and preserves existing behavior (Firestore path still works).

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm that the callback is undefined and the in-app UI does not update when push notifications arrive.

**Test Plan**: Write tests that simulate push notification reception using Expo Notifications test utilities. Mock the native notification event and verify that the callback is not called and the in-app UI state (notification count, inbox, toast) does not change. Run these tests on the UNFIXED code to observe failures and confirm the root cause.

**Test Cases**:
1. **Message Notification Test**: Simulate receiving a push notification with `type: 'message'` while app is foregrounded → verify callback is undefined → verify badge count remains 0 → verify toast is null → verify inbox is empty (will fail/expose bug on unfixed code)

2. **Call Notification Test**: Simulate receiving a push notification with `type: 'call'` while app is foregrounded → verify callback is undefined → verify call count remains 0 → verify no in-app alert shown (will fail/expose bug on unfixed code)

3. **System Notification Test**: Simulate receiving a push notification with `type: 'system'` while app is foregrounded → verify callback is undefined → verify no UI update occurs (will fail/expose bug on unfixed code)

4. **Background State Test**: Simulate receiving a push notification while app is backgrounded → verify OS notification appears → bring app to foreground → verify in-app UI does not reflect the notification that arrived (may fail/expose bug on unfixed code)

**Expected Counterexamples**:
- `onNotificationReceived` parameter is undefined in `usePushNotifications` call
- `NotificationContext.pushNotification` is never called when push notifications arrive
- Badge counters, toast, and inbox remain unchanged despite push notification arrival
- Possible causes: missing callback parameter, undefined callback invocation, disconnected notification paths

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds (push notifications arrive), the fixed implementation produces the expected behavior (in-app UI updates).

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := usePushNotifications_fixed(input, pushNotification)
  ASSERT onNotificationReceived IS defined
  ASSERT pushNotification WAS called with correct parameters
  ASSERT badgeCount > 0
  ASSERT toast IS NOT null
  ASSERT inbox.length > 0
END FOR
```

**Test Cases**:
1. **Message Notification Fix Test**: Simulate push notification with `type: 'message'` → verify callback is defined → verify `pushNotification` is called → verify badge increments → verify toast appears → verify inbox contains notification

2. **Call Notification Fix Test**: Simulate push notification with `type: 'call'` → verify callback is defined → verify `pushNotification` is called → verify call count increments → verify toast appears

3. **ContactId Type Fix Test**: Simulate push notification with `contactId: 123` (number) → verify callback receives `contactId: "123"` (string) → verify no type errors occur

4. **Foreground Duplicate Prevention Test**: Simulate push notification while app is foregrounded → verify only one toast appears (not two) → verify `shouldShowAlert: false` in handler

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold (notifications arrive via Firestore sync), the fixed implementation produces the same result as the original implementation.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT useNotificationSync_original(input) = useNotificationSync_fixed(input)
  ASSERT FirestoreSyncedNotification UPDATES in-app UI correctly
  ASSERT nativeOSNotification (backgrounded/killed) APPEARS correctly
  ASSERT navigationOnTap WORKS correctly
  ASSERT countingLogic UNCHANGED
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain (various notification types, states, timing)
- It catches edge cases that manual unit tests might miss (race conditions, multiple notifications, state transitions)
- It provides strong guarantees that behavior is unchanged for all non-push notification inputs

**Test Plan**: Observe behavior on UNFIXED code first for Firestore-synced notifications, native OS notifications, and navigation. Document the exact current behavior, then write property-based tests capturing that behavior and verify it remains identical after the fix.

**Test Cases**:
1. **Firestore Sync Preservation**: Observe that Firestore-synced notifications (via `useNotificationSync`) correctly update in-app UI on unfixed code → write property test generating various Firestore notification events → verify identical behavior after fix

2. **Native OS Notification Preservation**: Observe that native OS notifications appear correctly when app is backgrounded/killed on unfixed code → write test simulating app state changes → verify OS notifications still appear identically after fix

3. **Navigation Preservation**: Observe that tapping notifications navigates to correct screen on unfixed code → write test simulating notification tap events → verify navigation behavior unchanged after fix

4. **Counting Logic Preservation**: Observe that unreadCount, messageCount, callCount calculations work correctly on unfixed code → write property test generating various notification combinations → verify counts remain identical after fix

5. **Badge Count Preservation**: Observe that `Notifications.setBadgeCountAsync` is called correctly on unfixed code → write test tracking badge count updates → verify badge behavior unchanged after fix

### Unit Tests

- Test that `PushNotificationManager` correctly wires `pushNotification` callback to `usePushNotifications`
- Test that `onNotificationReceived` callback is defined when passed to hook
- Test that `contactId` type conversion from `number` to `string` works correctly
- Test that `shouldShowAlert: false` prevents duplicate toast notifications in foreground
- Test that push notification data is correctly extracted and passed to callback
- Test that callback is invoked when notification is received

### Property-Based Tests

- Generate random push notification payloads (various types, titles, bodies, contactIds) and verify in-app UI updates correctly for all
- Generate random app states (foreground, background, killed) and verify OS notifications work correctly for all
- Generate random sequences of Firestore-synced notifications and verify behavior is identical before and after fix
- Generate random combinations of push and Firestore notifications and verify no duplicate/missing notifications occur

### Integration Tests

- Test full flow: send push notification → verify OS notification appears → verify in-app UI updates → tap notification → verify navigation occurs
- Test Firestore sync flow: trigger Firestore notification → verify in-app UI updates → verify behavior identical to before fix
- Test mixed notification flow: send push notification → send Firestore notification → verify both update UI correctly without interference
- Test app state transitions: send push when foregrounded → background app → send push → foreground app → verify all notifications reflected correctly in UI
- Test rapid notification sequences: send multiple push notifications quickly → verify all are reflected in UI without dropping any
