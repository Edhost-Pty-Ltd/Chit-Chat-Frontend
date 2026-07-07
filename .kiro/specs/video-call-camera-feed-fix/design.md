# Video Call Camera Feed Fix - Bugfix Design

## Overview

The video call feature successfully establishes WebRTC connections with excellent network quality, but camera feeds display as black screens instead of showing the actual video. The root cause is that MediaStream objects are stored in React state within `useWebRTC`, and when parent hooks (`useOutgoingCall`, `useIncomingCallAnswer`) re-render, they create new instances of `useWebRTC`, causing the stream state to be lost. The fix involves moving stream storage from React state to refs within `useWebRTC`, ensuring stream references persist across parent hook re-renders while maintaining all existing functionality.

## Glossary

- **Bug_Condition (C)**: The condition that triggers the bug - when parent hooks re-render, causing useWebRTC to lose stream state
- **Property (P)**: The desired behavior - MediaStream references persist across re-renders and remain accessible to VideoCallScreen
- **Preservation**: All existing WebRTC functionality (connection establishment, ICE negotiation, network monitoring, track management, cleanup) that must remain unchanged
- **useWebRTC**: The hook in `src/hooks/useWebRTC.ts` that manages WebRTC peer connections and MediaStream objects
- **localStream**: MediaStream object containing the user's camera and microphone tracks
- **remoteStream**: MediaStream object containing the remote peer's camera and microphone tracks
- **Parent Hooks**: `useOutgoingCall` and `useIncomingCallAnswer` hooks that consume useWebRTC
- **Stream Persistence**: Maintaining MediaStream references across component/hook re-renders

## Bug Details

### Bug Condition

The bug manifests when parent hooks (`useOutgoingCall` or `useIncomingCallAnswer`) re-render during a video call. The `useWebRTC` hook stores `localStream` and `remoteStream` in React state using `useState`, but each time a parent hook re-renders, it creates a new instance of `useWebRTC` with fresh state, discarding the previous instance's stream references. This results in `VideoCallScreen` always receiving `null` for both streams, even though the streams are created successfully (evidenced by console logs showing "Local stream obtained" and "Remote track received: video").

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { hookRenderCycle, videoCallActive, streamsCreated }
  OUTPUT: boolean
  
  RETURN input.videoCallActive == true
         AND input.streamsCreated == true
         AND parentHookRerendered(input.hookRenderCycle)
         AND streamReferencesLost()
END FUNCTION
```

### Examples

- **Video call initiated**: User A calls User B with video enabled. WebRTC creates localStream successfully and logs "Local stream obtained". Parent hook `useOutgoingCall` re-renders due to state change. New `useWebRTC` instance is created with `localStream: null`. VideoCallScreen receives `null` and displays black screen.

- **Video call answered**: User B answers incoming video call. WebRTC creates localStream and later receives remoteStream with video tracks. Console shows "Remote track received: video" and stream has active tracks. Parent hook `useIncomingCallAnswer` re-renders. Both stream references are lost. VideoCallScreen displays two black screens.

- **During active call**: Video call is connected and working. A Firestore update triggers parent hook to re-render. The useWebRTC hook is recreated, losing stream state. Camera feeds that were potentially visible now turn to black screens.

- **Edge case - rapid re-renders**: Parent hook re-renders multiple times in quick succession (e.g., multiple Firestore updates). Each re-render creates a new useWebRTC instance, potentially causing memory leaks from orphaned MediaStream objects that are no longer referenced.

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- WebRTC connection establishment flow (peer connection creation, offer/answer exchange, ICE negotiation) must continue to work exactly as before
- Stream cleanup when calls end (stopping tracks, closing peer connections) must remain unchanged
- Network quality monitoring and reporting must continue to function correctly
- Mute/unmute and camera enable/disable toggles must continue to work by enabling/disabling tracks on the MediaStream objects
- ICE candidate exchange and addition must remain unchanged
- Connection state change callbacks and logging must remain unchanged
- Audio-only calls (without video tracks) must continue to work correctly

**Scope:**
All functionality that does NOT involve reading stream references from `useWebRTC`'s return value should be completely unaffected by this fix. This includes:
- WebRTC signaling through Firestore (offer, answer, ICE candidates)
- Call status management and state transitions
- Timer and duration tracking in VideoCallScreen
- Navigation and screen transitions
- Error handling and retry logic
- Handler callbacks (onIceCandidate, onConnectionStateChange, onNetworkQualityChange)

## Hypothesized Root Cause

Based on the bug description and code analysis, the root cause is:

1. **State Storage Pattern**: The `useWebRTC` hook uses `useState` to store `localStream` and `remoteStream`:
   ```typescript
   const [localStream, setLocalStream] = useState<MediaStream | null>(null);
   const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
   ```

2. **Hook Instance Recreation**: Parent hooks `useOutgoingCall` and `useIncomingCallAnswer` call `useWebRTC()` directly in their function body:
   ```typescript
   const webrtc = useWebRTC(handlersRef.current);
   ```
   When these parent hooks re-render (due to their own state changes), they create a NEW instance of `useWebRTC` with fresh state.

3. **State Reset**: React's `useState` initializes with the default value (`null`) for each new hook instance. The streams that were stored in the previous instance's state are discarded and become inaccessible.

4. **Stream Creation vs Access Timing**: Streams are created during `initializePeerConnection()` and stored via `setLocalStream()` and `setRemoteStream()`. However, if a parent hook re-renders before VideoCallScreen reads these values, the new useWebRTC instance returns `null` for both streams.

## Correctness Properties

Property 1: Bug Condition - Stream Persistence Across Re-renders

_For any_ video call where MediaStream objects have been created and parent hooks subsequently re-render, the fixed useWebRTC hook SHALL maintain the stream references and continue returning the valid MediaStream objects (not null) to VideoCallScreen, allowing camera feeds to display correctly.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4**

Property 2: Preservation - WebRTC Functionality Unchanged

_For any_ WebRTC operation that does NOT involve the stream storage mechanism (connection establishment, ICE negotiation, track management, cleanup, callbacks), the fixed code SHALL produce exactly the same behavior as the original code, preserving all existing WebRTC signaling, connection management, and cleanup functionality.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7**

## Fix Implementation

### Changes Required

**File**: `src/hooks/useWebRTC.ts`

**Function**: `useWebRTC`

**Specific Changes**:

1. **Replace useState with useRef for stream storage**:
   - Change `localStream` from state to ref: `const localStreamRef = useRef<MediaStream | null>(null);`
   - Change `remoteStream` from state to ref: `const remoteStreamRef = useRef<MediaStream | null>(null);`
   - Refs persist across re-renders and maintain the same reference, preventing stream loss

2. **Update stream assignment logic**:
   - In `initializePeerConnection()`, change `setLocalStream(stream)` to `localStreamRef.current = stream`
   - In `pc.ontrack` handler, change `setRemoteStream(event.streams[0])` to `remoteStreamRef.current = event.streams[0]`
   - Direct ref assignment provides immediate access without waiting for state update

3. **Create state trigger for UI updates**:
   - Add `const [streamVersion, setStreamVersion] = useState(0);`
   - After assigning stream to ref, increment version: `setStreamVersion(v => v + 1);`
   - This triggers re-render of components consuming useWebRTC, updating the UI when streams change

4. **Update return statement**:
   - Change from returning state values to returning ref values:
   ```typescript
   return {
     localStream: localStreamRef.current,
     remoteStream: remoteStreamRef.current,
     // ... other properties unchanged
   };
   ```

5. **Update cleanup logic**:
   - In `cleanup()` function, change `setLocalStream(null)` to `localStreamRef.current = null`
   - Change `setRemoteStream(null)` to `remoteStreamRef.current = null`
   - Keep `setStreamVersion(v => v + 1)` to trigger UI update for cleanup

6. **Update toggleMute and toggleVideo dependencies**:
   - These functions currently depend on `localStream` from state closure
   - Change to read from ref: `if (localStreamRef.current) { ... }`
   - This ensures they always access the current stream reference

7. **Update cleanup useEffect dependencies**:
   - Remove `localStream` and `remoteStream` from cleanup function dependencies
   - The cleanup function already accesses refs directly, not closure values

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, write tests that demonstrate the bug on unfixed code by simulating parent hook re-renders and confirming stream loss, then verify the fix maintains stream references across re-renders while preserving all existing WebRTC functionality.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm that parent hook re-renders cause stream references to be lost.

**Test Plan**: Write tests that create a video call, obtain streams successfully, then force parent component re-renders and verify that stream references become null. Run these tests on the UNFIXED code to observe failures and confirm the root cause.

**Test Cases**:
1. **Outgoing Video Call Re-render Test**: Initiate outgoing video call, wait for localStream creation, force useOutgoingCall to re-render by updating its state, verify that localStream becomes null (will fail on unfixed code - streams lost)
2. **Incoming Video Call Re-render Test**: Answer incoming video call, wait for localStream and remoteStream creation, force useIncomingCallAnswer to re-render, verify streams become null (will fail on unfixed code)
3. **Mid-Call State Update Test**: Establish connected video call, simulate Firestore update that triggers parent hook re-render, verify streams are lost (will fail on unfixed code)
4. **Rapid Re-renders Test**: Create video call and trigger multiple rapid re-renders, verify streams are lost and potentially causing memory leaks from orphaned MediaStream objects (may fail on unfixed code)

**Expected Counterexamples**:
- Stream references become null after parent hook re-renders despite streams being created successfully
- Console logs show "Local stream obtained" and "Remote track received: video" but VideoCallScreen receives null
- Possible causes: useState resets on new hook instance, stream references not persisted, hook instance recreation

### Fix Checking

**Goal**: Verify that for all scenarios where parent hooks re-render after streams are created, the fixed useWebRTC hook maintains stream references and returns valid MediaStream objects.

**Pseudocode:**
```
FOR ALL scenario WHERE isBugCondition(scenario) DO
  result := useWebRTC_fixed.localStream AND useWebRTC_fixed.remoteStream
  ASSERT result !== null
  ASSERT result.getVideoTracks().length > 0
  ASSERT result.getVideoTracks()[0].readyState === 'live'
END FOR
```

### Preservation Checking

**Goal**: Verify that for all WebRTC operations not involving stream storage mechanism, the fixed code produces the same result as the original code.

**Pseudocode:**
```
FOR ALL operation WHERE NOT affectsStreamStorage(operation) DO
  ASSERT useWebRTC_original.operation() === useWebRTC_fixed.operation()
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across different call scenarios (audio-only, video, outgoing, incoming)
- It catches edge cases that manual unit tests might miss (rapid state changes, connection failures, cleanup timing)
- It provides strong guarantees that behavior is unchanged for all non-stream-storage operations

**Test Plan**: Observe behavior on UNFIXED code first for all WebRTC operations (connection establishment, ICE exchange, cleanup, toggles), then write property-based tests capturing that exact behavior and run on fixed code.

**Test Cases**:
1. **Connection Establishment Preservation**: Observe that peer connection creation, offer/answer exchange, and ICE negotiation work correctly on unfixed code, then write test to verify this continues after fix
2. **Cleanup Preservation**: Observe that track stopping, peer connection closing, and state reset work correctly on unfixed code, then write test to verify cleanup behavior unchanged after fix
3. **Toggle Functions Preservation**: Observe that toggleMute and toggleVideo correctly enable/disable tracks on unfixed code, then write test to verify toggle behavior unchanged after fix (but now works with ref-based streams)
4. **Callback Preservation**: Observe that onIceCandidate, onConnectionStateChange, and onNetworkQualityChange callbacks fire correctly on unfixed code, then verify they continue firing with same data after fix

### Unit Tests

- Test stream persistence across parent hook re-renders for both outgoing and incoming calls
- Test that localStream and remoteStream remain non-null after multiple re-renders
- Test that video tracks remain active and in 'live' readyState after re-renders
- Test that cleanup properly nullifies stream refs and triggers UI update
- Test that toggleMute and toggleVideo work with ref-based stream access
- Test edge cases: re-render before streams created, re-render during stream creation, cleanup during re-render

### Property-Based Tests

- Generate random sequences of call events (initiate, answer, re-render, ICE candidates, cleanup) and verify streams persist correctly
- Generate random re-render patterns and verify stream references never become null once created
- Generate random call configurations (audio-only, video, different network conditions) and verify preservation of all non-stream-storage functionality
- Test that memory leaks don't occur from orphaned streams when hooks are recreated

### Integration Tests

- Test full outgoing video call flow with simulated parent hook re-renders at various stages
- Test full incoming video call flow with simulated state updates triggering re-renders
- Test that VideoCallScreen displays camera feeds correctly after fix, even with parent re-renders
- Test switching between audio and video calls with re-renders occurring during transition
- Test rapid Firestore updates causing multiple re-renders don't break stream display
