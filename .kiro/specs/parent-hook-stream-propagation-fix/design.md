# Parent Hook Stream Propagation Fix - Bugfix Design

## Overview

This bugfix addresses a critical issue in the video call feature where camera feeds do not display in VideoCallScreen despite WebRTC successfully creating streams. The root cause is that parent hooks (useOutgoingCall and useIncomingCallAnswer) capture the initial `null` stream values from useWebRTC when they first render and do not re-render when useWebRTC's internal `streamVersion` state changes, preventing updated stream references from propagating to VideoCallScreen.

The fix ensures that when useWebRTC obtains media streams and increments `streamVersion`, the parent hooks automatically re-render and return the updated stream references, enabling VideoCallScreen to receive and display the camera feeds correctly.

## Glossary

- **Bug_Condition (C)**: The condition that triggers the bug - when useWebRTC updates `streamVersion` after obtaining streams but parent hooks do not re-render to capture the updated stream refs
- **Property (P)**: The desired behavior when streams are obtained - parent hooks should re-render and return the updated stream references from useWebRTC
- **Preservation**: Existing behaviors that must remain unchanged - initial `null` stream values, other state propagation, cleanup logic, and multi-component consistency
- **useWebRTC**: The hook in `src/hooks/useWebRTC.ts` that manages WebRTC connections and stores stream references in refs (`localStreamRef`, `remoteStreamRef`) with a `streamVersion` state trigger
- **Parent Hooks**: The hooks `useOutgoingCall` and `useIncomingCallAnswer` that wrap useWebRTC and expose stream values to components
- **streamVersion**: A state variable in useWebRTC that increments when streams change, intended to trigger re-renders in consuming components
- **Stream Refs**: The `localStreamRef` and `remoteStreamRef` in useWebRTC that persist stream instances across re-renders
- **VideoCallScreen**: The component that displays camera feeds by reading `localStream` and `remoteStream` from parent hooks

## Bug Details

### Bug Condition

The bug manifests when useWebRTC successfully obtains local and remote streams and updates its internal refs, but the parent hooks do not propagate these updated values to VideoCallScreen. The parent hooks return `webrtc.localStream` and `webrtc.remoteStream`, which are captured values from when useWebRTC first renders (both `null`). Even though useWebRTC increments `streamVersion` to signal changes, the parent hooks don't depend on this value in their dependency arrays or return statements, so they don't re-render to capture the updated refs.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type WebRTCStateUpdate
  OUTPUT: boolean
  
  RETURN input.streamVersion > 0
         AND (input.localStreamRef.current !== null OR input.remoteStreamRef.current !== null)
         AND parentHookReturnValue.localStream === null
         AND parentHookReturnValue.remoteStream === null
END FUNCTION
```

### Examples

- **Example 1**: Caller initiates video call → useWebRTC calls `getUserMedia` → `localStreamRef.current` assigned → `streamVersion` incremented → useOutgoingCall returns `webrtc.localStream` (still `null` from initial render) → VideoCallScreen receives `null` for localStream → camera feed does not display
- **Example 2**: Callee answers video call → useWebRTC receives remote track → `remoteStreamRef.current` assigned → `streamVersion` incremented → useIncomingCallAnswer returns `webrtc.remoteStream` (still `null` from initial render) → VideoCallScreen receives `null` for remoteStream → remote camera feed does not display
- **Example 3**: During audio call → useWebRTC obtains audio-only stream → `localStreamRef.current` assigned → `streamVersion` incremented → parent hook returns old `null` value → audio plays but stream ref is not accessible for UI indicators
- **Edge Case**: Multiple rapid stream updates → `streamVersion` increments multiple times → parent hooks should eventually propagate the final stream refs, not remain stuck on initial `null` values

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Initial state behavior: when useWebRTC has not yet obtained streams, parent hooks must continue to return `null` for localStream and remoteStream
- Other state propagation: when other useWebRTC state updates occur (connectionState, networkQuality, etc.), parent hooks must continue to propagate these correctly
- Video rendering logic: when VideoCallScreen receives stream updates, the existing video rendering logic must continue to work as designed
- Multi-component consistency: when multiple components use the same parent hook instance, they must continue to receive consistent stream references
- Cleanup behavior: when useWebRTC's cleanup logic runs (component unmount, call end), parent hooks must continue to handle cleanup correctly without memory leaks

**Scope:**
All behaviors that do NOT involve propagating updated stream references after `streamVersion` changes should be completely unaffected by this fix. This includes:
- Parent hooks returning `null` streams before useWebRTC initializes
- Parent hooks propagating connectionState, networkQuality, and other non-stream properties
- VideoCallScreen's internal rendering logic for video elements
- Parent hooks' internal state management (callIdRef, unsubscribeRef, etc.)
- Cleanup and unmount logic in all hooks

## Hypothesized Root Cause

Based on the bug description and code analysis, the most likely issues are:

1. **Missing Dependency on streamVersion**: The parent hooks call `useWebRTC()` once and capture the return value, but they don't include `webrtc.streamVersion` in any dependency array. React's hooks model means the parent hooks won't re-render when `streamVersion` changes internally in useWebRTC unless they explicitly depend on it or consume it in their return statement.

2. **Value Capture vs Reference Propagation**: The parent hooks return `webrtc.localStream` and `webrtc.remoteStream`, which are **values** (the current contents of the refs at the moment useWebRTC returned). These values are `null` on first render. Even when useWebRTC internally updates the refs and increments `streamVersion`, the parent hooks have already captured the `null` values and don't re-evaluate their return statements unless they themselves re-render.

3. **useWebRTC Returns Values Not Reactive Props**: The useWebRTC hook returns `localStreamRef.current` and `remoteStreamRef.current` as plain values, not as reactive dependencies. React doesn't track ref changes, so parent hooks that consume these values won't automatically re-render when the refs change, even though `streamVersion` changes.

4. **Parent Hooks Don't Spread streamVersion**: The parent hooks return an object that includes `localStream: webrtc.localStream` and `remoteStream: webrtc.remoteStream`, but they don't include or depend on `webrtc.streamVersion`. Without spreading or using `streamVersion`, the parent hooks have no trigger to re-render and re-evaluate their return statements.

## Correctness Properties

Property 1: Bug Condition - Stream Propagation After Update

_For any_ state update where useWebRTC obtains a stream and increments `streamVersion`, the parent hooks (useOutgoingCall and useIncomingCallAnswer) SHALL re-render and return the updated stream references from useWebRTC's refs, ensuring that VideoCallScreen receives non-null stream values.

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Preservation - Initial Null Stream Behavior

_For any_ state where useWebRTC has NOT yet obtained streams (initial state or after cleanup), the parent hooks SHALL continue to return `null` for localStream and remoteStream, preserving the existing behavior for uninitialized states.

**Validates: Requirements 3.1**

Property 3: Preservation - Non-Stream State Propagation

_For any_ state update in useWebRTC that involves connectionState, networkQuality, or other non-stream properties, the parent hooks SHALL continue to propagate these updates correctly as they do now, preserving all existing state management behavior.

**Validates: Requirements 3.2, 3.4**

Property 4: Preservation - Cleanup and Unmount Behavior

_For any_ cleanup event (call end, component unmount, error state), the parent hooks SHALL continue to execute cleanup logic correctly without memory leaks, preserving all existing resource management behavior.

**Validates: Requirements 3.5**

## Hypothesized Root Cause

Based on the code analysis, the root cause is:

**The parent hooks do not depend on or expose `streamVersion` from useWebRTC, so they don't re-render when streams are obtained and `streamVersion` increments. They capture the initial `null` stream values and continue returning those stale values even after useWebRTC updates its refs.**

Specifically:
- `useOutgoingCall` calls `const webrtc = useWebRTC(handlersRef.current)` once
- It returns `localStream: webrtc.localStream, remoteStream: webrtc.remoteStream`
- These are the **values** of `localStreamRef.current` and `remoteStreamRef.current` at the moment useWebRTC first rendered (both `null`)
- When useWebRTC later obtains streams, it updates the refs and increments `streamVersion`
- But the parent hook doesn't re-render because it doesn't depend on `streamVersion` anywhere
- So the parent hook continues returning the originally captured `null` values
- VideoCallScreen receives `null` and cannot display camera feeds

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `src/hooks/useOutgoingCall.ts` and `src/hooks/useIncomingCallAnswer.ts`

**Function**: Both hook implementations

**Specific Changes**:
1. **Add streamVersion to Return Object**: Include `streamVersion` in the parent hooks' return objects to ensure they re-render when useWebRTC's `streamVersion` changes. This creates a reactive dependency chain.
   - Change: `return { ..., localStream: webrtc.localStream, remoteStream: webrtc.remoteStream, ...}`
   - To: `return { ..., localStream: webrtc.localStream, remoteStream: webrtc.remoteStream, streamVersion: webrtc.streamVersion, ...}`
   - Rationale: By including `streamVersion` in the return object, the parent hooks will re-render whenever `streamVersion` changes, causing them to re-evaluate `webrtc.localStream` and `webrtc.remoteStream` and capture the updated values

2. **Export streamVersion from useWebRTC**: Ensure `streamVersion` is included in useWebRTC's return object so parent hooks can access it
   - Change: `return { localStream: localStreamRef.current, remoteStream: remoteStreamRef.current, ... }`
   - To: `return { localStream: localStreamRef.current, remoteStream: remoteStreamRef.current, streamVersion, ... }`
   - Rationale: Parent hooks need access to `streamVersion` to create the reactive dependency

3. **Update VideoCallScreen (if needed)**: VideoCallScreen may need to ignore or handle the new `streamVersion` property in the parent hook return values
   - Change: Destructure return values carefully to avoid passing `streamVersion` to components that don't expect it
   - Rationale: Maintain backward compatibility with VideoCallScreen's expected props

4. **Test Reactivity**: Add logging or test that when `streamVersion` changes, parent hooks re-render and return updated stream values
   - Rationale: Verify the fix creates the intended reactive dependency

5. **Alternative Approach - Use streamVersion in useEffect**: If adding `streamVersion` to return objects causes issues, use a `useEffect` in parent hooks that depends on `webrtc.streamVersion` and triggers a local state update
   - Change: Add `const [streams, setStreams] = useState({ local: null, remote: null })` and `useEffect(() => { setStreams({ local: webrtc.localStream, remote: webrtc.remoteStream }) }, [webrtc.streamVersion])`
   - Rationale: This forces parent hooks to re-render when `streamVersion` changes without exposing `streamVersion` externally

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code (streams obtained but parent hooks return `null`), then verify the fix works correctly (parent hooks return updated stream refs) and preserves existing behavior (initial `null`, cleanup, etc.).

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm that parent hooks do not propagate updated stream refs when `streamVersion` changes. If we refute this hypothesis, we will need to re-hypothesize.

**Test Plan**: Write tests that simulate the following sequence on UNFIXED code:
1. Mount VideoCallScreen with a parent hook (useOutgoingCall or useIncomingCallAnswer)
2. Trigger stream initialization in useWebRTC (mock `getUserMedia`)
3. Assert that useWebRTC's refs are updated and `streamVersion` increments
4. Assert that parent hooks' return values for `localStream` and `remoteStream` are still `null` (demonstrating the bug)
5. Assert that VideoCallScreen receives `null` for streams

**Test Cases**:
1. **Outgoing Call Stream Capture Test**: Mount component using useOutgoingCall → call `initiateCall` → wait for `getUserMedia` → assert `webrtc.localStream` in parent hook return is `null` despite useWebRTC having non-null ref (will fail on unfixed code)
2. **Incoming Call Stream Capture Test**: Mount component using useIncomingCallAnswer → call `answerCall` → wait for `getUserMedia` → assert `webrtc.localStream` in parent hook return is `null` despite useWebRTC having non-null ref (will fail on unfixed code)
3. **Remote Stream Propagation Test**: Simulate receiving remote track → assert `webrtc.remoteStream` in parent hook return is `null` despite useWebRTC having non-null ref (will fail on unfixed code)
4. **streamVersion Increment Test**: Assert that `streamVersion` increments in useWebRTC but parent hooks don't re-render to capture new values (will fail on unfixed code)

**Expected Counterexamples**:
- Parent hooks return `{ localStream: null, remoteStream: null }` even after useWebRTC obtains streams and increments `streamVersion`
- VideoCallScreen components receive `null` for streams and cannot render video elements
- Possible confirmation: Adding `console.log` shows useWebRTC's refs are non-null but parent hook returns are `null`

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds (streams obtained and `streamVersion` incremented), the fixed parent hooks produce the expected behavior (return updated stream refs).

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := parentHook_fixed(input)
  ASSERT expectedBehavior(result)
  // Expected: result.localStream !== null when useWebRTC has localStream
  // Expected: result.remoteStream !== null when useWebRTC has remoteStream
  // Expected: VideoCallScreen can render video elements
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold (initial state, cleanup, other state updates), the fixed parent hooks produce the same result as the original hooks.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT parentHook_original(input) = parentHook_fixed(input)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain (initial state, cleanup, various connectionState values, etc.)
- It catches edge cases that manual unit tests might miss (rapid state changes, concurrent updates, etc.)
- It provides strong guarantees that behavior is unchanged for all non-buggy inputs

**Test Plan**: Observe behavior on UNFIXED code first for initial state, cleanup, and other state propagation, then write property-based tests capturing that behavior.

**Test Cases**:
1. **Initial State Preservation**: Before `initializePeerConnection` is called, verify parent hooks return `{ localStream: null, remoteStream: null }` on both unfixed and fixed code
2. **Cleanup Preservation**: After `cleanup()` is called, verify parent hooks return `{ localStream: null, remoteStream: null }` and no memory leaks occur
3. **ConnectionState Preservation**: Verify that changes to `connectionState` propagate correctly on both unfixed and fixed code
4. **NetworkQuality Preservation**: Verify that changes to `networkQuality` propagate correctly on both unfixed and fixed code
5. **Multi-Component Consistency**: Mount multiple components using the same parent hook instance and verify they receive consistent stream refs after fix

### Unit Tests

- Test that useWebRTC increments `streamVersion` when streams are obtained
- Test that parent hooks include `streamVersion` in their return objects (or use it in useEffect)
- Test that parent hooks re-render when `streamVersion` changes
- Test that parent hooks return updated stream refs after re-render
- Test that VideoCallScreen receives non-null streams after fix
- Test edge cases: rapid stream updates, cleanup during stream initialization, multiple simultaneous calls

### Property-Based Tests

- Generate random sequences of WebRTC events (initialize, receive remote track, cleanup) and verify parent hooks always return current stream refs after initialization
- Generate random initial states and verify parent hooks return `null` before initialization
- Generate random cleanup sequences and verify parent hooks return `null` after cleanup and no memory leaks
- Test that all non-stream state propagation (connectionState, networkQuality) continues to work across many scenarios

### Integration Tests

- Test full outgoing call flow: initiate → obtain local stream → verify VideoCallScreen displays local camera feed
- Test full incoming call flow: answer → obtain local and remote streams → verify VideoCallScreen displays both feeds
- Test call flow with rapid state changes: streams obtained → cleanup → re-initialize → verify correct stream propagation at each step
- Test that visual feedback (camera feed rendering) occurs when streams are obtained and propagated correctly
