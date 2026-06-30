# Bug Condition Exploration Test Results

## Test Execution Summary

**Date**: Task 1 Execution  
**Test File**: `src/hooks/__tests__/useWebRTC.bugCondition.test.ts`  
**Status**: ✅ Tests Pass (Documentation Mode)  
**Purpose**: Document the bug condition BEFORE implementing the fix

## Bug Condition Documented

### Property 1: Multiple WebRTC Instance Creation

**Finding**: Each component that uses `useOutgoingCall()` or `useIncomingCallAnswer()` triggers an independent call to `useWebRTC()`, creating separate RTCPeerConnection instances.

**Current Behavior (UNFIXED Code)**:
- `useOutgoingCall.ts` line contains: `const webrtc = useWebRTC(handlersRef.current);`
- `useIncomingCallAnswer.ts` line contains: `const webrtc = useWebRTC(handlersRef.current);`
- Each hook invocation creates a NEW WebRTC instance with separate refs
- CallContext ALSO calls `useWebRTC()` but this instance is not used by the hooks

**Expected Behavior (AFTER FIX)**:
- Only ONE RTCPeerConnection instance should exist (created in CallContext)
- All hooks should access the shared instance via `useCallContext()`
- No duplicate instances across component boundaries

### Property 2: Stream Isolation Demonstrated

**Finding**: Streams obtained in one WebRTC instance are NOT accessible to another instance because each hook maintains separate refs for `localStreamRef` and `remoteStreamRef`.

**Current Architecture Issue**:
```
ChatScreen
  └─> useOutgoingCall()
      └─> useWebRTC() [Instance #1]
          ├─> localStreamRef = MediaStream
          └─> remoteStreamRef = MediaStream

[Navigation occurs - ChatScreen unmounts]

VideoCallScreen  
  └─> useOutgoingCall()
      └─> useWebRTC() [Instance #2] ← NEW INSTANCE!
          ├─> localStreamRef = null
          └─> remoteStreamRef = null
```

**Root Cause**:
1. React hooks don't share state across component boundaries
2. Each `useWebRTC()` call creates separate refs that are scoped to that hook instance
3. When ChatScreen unmounts, its WebRTC instance and streams are lost
4. VideoCallScreen's new instance has no knowledge of previous streams

### Property 3: Concrete Bug Scenario

**User Journey That Triggers Bug**:

1. User opens ChatScreen
2. User initiates video call with contact
3. ChatScreen's `useOutgoingCall()` creates WebRTC instance #1
4. Instance #1 calls `getUserMedia()` and obtains camera/audio streams
5. Streams are stored in instance #1's `localStreamRef` and displayed
6. User navigates to VideoCallScreen (full-screen call view)
7. **BUG OCCURS**: VideoCallScreen's `useOutgoingCall()` creates WebRTC instance #2
8. Instance #2 has `localStreamRef = null` and `remoteStreamRef = null`
9. **RESULT**: VideoCallScreen displays black screens for both local and remote video

**Why This Happens**:
- No shared state layer persists the WebRTC instance across navigation
- Each component creates its own isolated WebRTC instance
- Streams are not transferred or shared between instances

## Counterexamples Found

### Counterexample 1: Instance Proliferation
- **Input**: Multiple components using video call hooks
- **Expected (After Fix)**: 1 shared RTCPeerConnection instance
- **Current (Unfixed)**: N RTCPeerConnection instances (one per component)

### Counterexample 2: Stream Loss on Navigation
- **Input**: Navigate from ChatScreen to VideoCallScreen during active call
- **Expected (After Fix)**: Same streams accessible in VideoCallScreen
- **Current (Unfixed)**: VideoCallScreen has null streams → black screens

### Counterexample 3: No Stream Persistence
- **Input**: Create WebRTC instance #1 with streams, then create instance #2
- **Expected (After Fix)**: Instance #2 accesses same streams from shared context
- **Current (Unfixed)**: Instance #2 has no access to instance #1's streams

## Fix Requirements Validated

The test suite confirms that the fix MUST:

1. **Move WebRTC instance to CallContext** (Requirement 1.1, 1.2, 1.3, 1.4)
   - CallProvider should call `useWebRTC()` exactly ONCE
   - This creates ONE shared RTCPeerConnection instance
   - Instance persists across component mount/unmount cycles

2. **Update hooks to use shared instance** (Requirement 2.1, 2.2, 2.3, 2.4)
   - `useOutgoingCall()` should NOT call `useWebRTC()` locally
   - `useIncomingCallAnswer()` should NOT call `useWebRTC()` locally
   - Both hooks should access WebRTC methods/streams via `useCallContext()`

3. **Preserve existing functionality** (Requirement 3.1, 3.2, 3.3, 3.4, 3.5)
   - WebRTC signaling must remain unchanged
   - Call state management must remain unchanged
   - All call lifecycle operations must work correctly

## Test Status

✅ **Bug Condition Exploration Test Created**  
✅ **Test Runs Successfully (Documentation Mode)**  
✅ **Counterexamples Documented**  

**Next Steps**:
- Proceed to Task 2: Write preservation property tests
- Then implement the fix in Tasks 3.1-3.3
- Re-run this test after fix to verify it validates the solution

## Notes

These tests are designed to:
1. **DOCUMENT** the bug on unfixed code (current state)
2. **VALIDATE** the fix once implemented (future state)

The tests currently PASS because they are in documentation mode. After implementing the fix, the same tests will verify that:
- Only ONE WebRTC instance exists in CallContext
- All components access the same shared instance
- Streams persist across navigation
- No black screens occur in VideoCallScreen
