# WebRTC Shared Context Fix Bugfix Design

## Overview

This bugfix addresses a critical camera feed issue in the video call feature where VideoCallScreen displays black screens instead of video streams. The root cause is that each component using video calling hooks (useOutgoingCall, useIncomingCallAnswer) creates separate WebRTC instances, leading to stream isolation. When ChatScreen initiates a call and obtains camera streams, those streams remain tied to its WebRTC instance. When VideoCallScreen mounts and creates a new WebRTC instance, it has no access to the previously obtained streams, resulting in black screens.

The fix centralizes WebRTC instance management by moving it into the existing CallContext. This ensures all components share the same WebRTC instance and streams, eliminating the isolation problem while preserving all existing call functionality.

## Glossary

- **Bug_Condition (C)**: The condition that triggers the bug - when navigation occurs between ChatScreen and VideoCallScreen after a video call is initiated, causing separate WebRTC instances to be created
- **Property (P)**: The desired behavior - VideoCallScreen should display the same video streams that were obtained in ChatScreen by accessing a shared WebRTC instance
- **Preservation**: Existing WebRTC signaling, call state management, and call lifecycle behaviors that must remain unchanged by the fix
- **useWebRTC**: The hook in `src/hooks/useWebRTC.ts` that manages WebRTC peer connections, streams, and ICE candidates - currently creates a new instance per component
- **CallContext**: The context in `src/context/CallContext.tsx` that provides global call state management - will be extended to hold the shared WebRTC instance
- **useOutgoingCall**: The hook in `src/hooks/useOutgoingCall.ts` that manages initiating outgoing calls - currently creates its own WebRTC instance
- **useIncomingCallAnswer**: The hook in `src/hooks/useIncomingCallAnswer.ts` that manages answering incoming calls - currently creates its own WebRTC instance
- **WebRTC Instance**: The RTCPeerConnection object and associated media streams that handle the actual video/audio communication
- **Stream Isolation**: The problem where multiple independent WebRTC instances cannot share media streams, causing black screens

## Bug Details

### Bug Condition

The bug manifests when a user initiates a video call from ChatScreen and then navigates to VideoCallScreen. The navigation causes React to unmount ChatScreen's component tree and mount VideoCallScreen's component tree. Each component uses either `useOutgoingCall()` or `useIncomingCallAnswer()`, which internally calls `useWebRTC()`. Since `useWebRTC()` is a regular React hook, each component that calls it creates a separate WebRTC instance with separate state. When ChatScreen's WebRTC instance obtains camera streams, those streams are stored in refs within that specific hook instance. When VideoCallScreen mounts and creates a new `useWebRTC()` instance, it has completely separate refs that don't contain any streams, resulting in black screens.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { action: string, callType: string, currentScreen: string, targetScreen: string }
  OUTPUT: boolean
  
  RETURN input.action == "navigate"
         AND input.callType == "video"
         AND input.currentScreen == "ChatScreen"
         AND input.targetScreen == "VideoCallScreen"
         AND webrtcInstanceWasCreatedInChatScreen
         AND newWebrtcInstanceCreatedInVideoCallScreen
END FUNCTION
```

### Examples

- **Example 1**: User initiates video call from ChatScreen → ChatScreen's `useOutgoingCall()` creates WebRTC instance #1 and obtains camera streams → User navigates to VideoCallScreen → VideoCallScreen's `useOutgoingCall()` creates WebRTC instance #2 with no streams → VideoCallScreen displays black screens for both local and remote video
  - **Expected**: VideoCallScreen should access the same WebRTC instance #1 with existing streams and display video feeds correctly

- **Example 2**: User receives incoming video call → IncomingCallManager uses `useIncomingCallAnswer()` to create WebRTC instance #1 → User accepts call and navigates to VideoCallScreen → VideoCallScreen's `useIncomingCallAnswer()` creates WebRTC instance #2 with no streams → Black screens appear
  - **Expected**: VideoCallScreen should access the same WebRTC instance #1 and display video feeds correctly

- **Example 3**: User initiates audio call from ChatScreen → Navigation to AudioCallScreen → Audio works fine because audio streams don't require visual rendering
  - **Expected**: This behavior should continue to work (preservation requirement)

- **Edge Case**: User initiates video call → Navigates to VideoCallScreen → Navigates back to ChatScreen → If ChatScreen attempts to access WebRTC again, it should still use the shared instance
  - **Expected**: All components should always access the same shared instance throughout the call lifecycle

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- WebRTC peer connection establishment must continue to work exactly as before
- Firestore signaling message exchange (offer/answer/ICE candidates) must remain unchanged
- Call state management (outgoingCall, incomingCall, callStatus) must remain unchanged
- Call lifecycle methods (initiateCall, answerCall, endCall, cancelCall) must continue to work correctly
- Camera/audio resource cleanup when calls terminate must remain unchanged
- Network quality monitoring must continue to function
- Audio/video toggle functions must continue to work
- Connection state change handlers must continue to fire correctly

**Scope:**
All WebRTC functionality that does NOT involve sharing instances across components should be completely unaffected by this fix. This includes:
- Internal WebRTC operations (createOffer, createAnswer, setRemoteAnswer, addIceCandidate)
- Stream acquisition (getUserMedia)
- Track management (addTrack, ontrack handlers)
- ICE candidate generation and handling
- Connection state monitoring
- Network statistics collection

## Hypothesized Root Cause

Based on the bug description and code analysis, the root cause is:

1. **Hook Instance Isolation**: `useWebRTC()` is called independently by `useOutgoingCall()` and `useIncomingCallAnswer()`. Each time these hooks are used in a component, a new `useWebRTC()` instance is created with separate state (localStreamRef, remoteStreamRef, peerConnectionRef). React hooks don't share state across component boundaries unless explicitly designed to do so.

2. **Component Lifecycle Independence**: When ChatScreen initiates a call, it mounts and creates its own hook instances. When the user navigates to VideoCallScreen, React unmounts ChatScreen and mounts VideoCallScreen. VideoCallScreen creates entirely new hook instances, losing access to the WebRTC instance and streams from ChatScreen.

3. **Ref-Based State Storage**: The `useWebRTC` hook stores streams in refs (localStreamRef, remoteStreamRef) for performance optimization. While this is good practice for avoiding re-renders, it means the streams are tied to that specific hook instance and cannot be accessed by other components.

4. **Missing Shared State Layer**: There is no shared state layer that persists the WebRTC instance across component boundaries. CallContext exists for call state (callStatus, activeCallId, etc.) but doesn't hold the WebRTC instance itself.

## Correctness Properties

Property 1: Bug Condition - Shared WebRTC Instance Access

_For any_ navigation between components during an active video call where a WebRTC instance has been initialized with camera streams, the target component SHALL access the same shared WebRTC instance from CallContext and display the local and remote video streams without black screens.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4**

Property 2: Preservation - WebRTC Connection Functionality

_For any_ WebRTC operation (peer connection establishment, signaling, ICE candidate exchange, stream acquisition, resource cleanup) that existed before the fix, the fixed code SHALL produce exactly the same behavior as the original code, preserving all WebRTC connection mechanics and call lifecycle operations.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `src/context/CallContext.tsx`

**Function**: CallProvider component and CallContextValue interface

**Specific Changes**:
1. **Import useWebRTC Hook**: Add import for useWebRTC and its types at the top of the file

2. **Extend CallContextValue Interface**: Add WebRTC instance properties and methods to the interface:
   - `localStream: MediaStream | null`
   - `remoteStream: MediaStream | null`
   - `streamVersion: number`
   - `connectionState: string`
   - `networkQuality: NetworkQuality`
   - `initializePeerConnection: (isVideo: boolean) => Promise<RTCPeerConnection>`
   - `createOffer: (isVideo: boolean) => Promise<RTCSessionDescriptionInit>`
   - `createAnswer: (offer: RTCSessionDescriptionInit) => Promise<RTCSessionDescriptionInit>`
   - `setRemoteAnswer: (answer: RTCSessionDescriptionInit) => Promise<void>`
   - `addIceCandidate: (candidate: RTCIceCandidateInit) => Promise<void>`
   - `toggleMute: (muted: boolean) => void`
   - `toggleVideo: (enabled: boolean) => void`
   - `startNetworkMonitoring: () => void`
   - `stopNetworkMonitoring: () => void`
   - `cleanup: () => void`

3. **Create Shared WebRTC Instance in CallProvider**: Call `useWebRTC()` once at the CallProvider level with appropriate handlers

4. **Create WebRTC Handlers**: Define handlers for onIceCandidate, onConnectionStateChange, and onNetworkQualityChange that will be passed to useWebRTC

5. **Expose WebRTC Properties in Context Value**: Spread all webrtc properties and methods into the context value object

**File**: `src/hooks/useOutgoingCall.ts`

**Function**: useOutgoingCall hook

**Specific Changes**:
1. **Remove Local useWebRTC Call**: Delete the line `const webrtc = useWebRTC(handlersRef.current);`

2. **Access WebRTC from Context**: Add destructuring to get WebRTC methods from CallContext:
   ```typescript
   const { 
     setActiveCallId, setCallStatus, resetCallState,
     localStream, remoteStream, streamVersion, connectionState, networkQuality,
     initializePeerConnection, createOffer, setRemoteAnswer, addIceCandidate,
     toggleMute, toggleVideo, startNetworkMonitoring, stopNetworkMonitoring, cleanup
   } = useCallContext();
   ```

3. **Remove webrtc.* Prefixes**: Replace all `webrtc.initializePeerConnection()` calls with `initializePeerConnection()`, and similarly for all other WebRTC methods

4. **Remove webrtcRef and Related useEffect**: Delete the ref that tracked webrtc changes since it's no longer needed

5. **Update Return Statement**: Remove webrtc property spreads and directly return the values from context (localStream, remoteStream, etc.)

**File**: `src/hooks/useIncomingCallAnswer.ts`

**Function**: useIncomingCallAnswer hook

**Specific Changes**:
1. **Remove Local useWebRTC Call**: Delete the lines creating local webrtc instance

2. **Access WebRTC from Context**: Add destructuring to get WebRTC methods from CallContext (same pattern as useOutgoingCall)

3. **Remove webrtc.* Prefixes**: Replace all webrtc method calls with direct calls to methods from context

4. **Remove webrtcRef and Related useEffect**: Delete the ref that tracked webrtc changes

5. **Update Return Statement**: Remove webrtc property spreads and directly return the values from context

**File**: `src/context/CallContext.tsx` (WebRTC Handler Implementation)

**Function**: WebRTC event handlers

**Specific Changes**:
1. **Create activeCallIdRef**: Add a ref to track the current callId for handler callbacks

2. **Update activeCallIdRef on setActiveCallId**: Modify setActiveCallId to also update the ref

3. **Implement onIceCandidate Handler**: Create handler that determines if we're caller or callee based on current call state, then calls SignalingService.addIceCandidate with appropriate flag

4. **Implement onConnectionStateChange Handler**: Create handler that updates callStatus in context when connection state changes

5. **Implement onNetworkQualityChange Handler**: Create handler that logs network quality changes (or updates state if we add network quality to context)

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code by attempting to access video streams after navigation, then verify the fix works correctly by ensuring all components share the same WebRTC instance and can access streams.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm that multiple WebRTC instances are created and streams are isolated.

**Test Plan**: Write tests that simulate initiating a video call in one component, then mounting a different component that tries to access the streams. Run these tests on the UNFIXED code to observe failures (black screens / null streams) and understand the root cause.

**Test Cases**:
1. **ChatScreen to VideoCallScreen Navigation**: Initiate video call in ChatScreen, capture the WebRTC instance reference, navigate to VideoCallScreen, capture the new WebRTC instance reference, assert they are different instances (will fail on unfixed code - proves isolation)
2. **Stream Availability After Navigation**: Initiate video call in ChatScreen with streams, navigate to VideoCallScreen, check if localStream and remoteStream are null (will be null on unfixed code)
3. **Multiple Hook Instances**: Mount two components that both call useOutgoingCall(), verify they create separate WebRTC instances (will create separate on unfixed code)
4. **Ref State Loss**: Store a reference to localStream from ChatScreen's hook, unmount ChatScreen, mount VideoCallScreen, verify VideoCallScreen's hook has null localStream (will be null on unfixed code)

**Expected Counterexamples**:
- Different WebRTC instances are created for each component
- Streams obtained in one component are not accessible in another component
- Navigation causes loss of stream access even though the call is still active

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds (navigation during active video call), the fixed code provides access to the shared WebRTC instance and streams.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := navigateToVideoCallScreenAfterInitiatingCall_fixed(input)
  ASSERT result.webrtcInstanceIsSame = true
  ASSERT result.localStreamIsAccessible = true
  ASSERT result.remoteStreamIsAccessible = true
  ASSERT result.noBlackScreens = true
END FOR
```

**Test Plan**: After implementing the fix, write tests that verify WebRTC instance sharing across components.

**Test Cases**:
1. **Shared Instance Verification**: Initiate call in ChatScreen, capture WebRTC instance reference from context, navigate to VideoCallScreen, access WebRTC instance from context, assert they are the same instance
2. **Stream Persistence**: Initiate video call in ChatScreen with streams, navigate to VideoCallScreen, verify localStream and remoteStream from context are the same objects
3. **Single WebRTC Instance Creation**: Monitor how many times useWebRTC is called across multiple component mounts, verify it's called only once at CallProvider level
4. **Bidirectional Navigation**: Initiate call, navigate ChatScreen → VideoCallScreen → ChatScreen, verify streams remain accessible throughout

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold (non-navigation scenarios, existing WebRTC operations), the fixed code produces the same result as the original code.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT originalBehavior(input) = fixedBehavior(input)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain
- It catches edge cases that manual unit tests might miss
- It provides strong guarantees that behavior is unchanged for all non-buggy inputs

**Test Plan**: Observe WebRTC behavior on UNFIXED code for signaling, connection establishment, and cleanup operations, then write property-based tests capturing that behavior.

**Test Cases**:
1. **Signaling Preservation**: Observe offer/answer/ICE candidate flow on unfixed code, verify the flow remains identical after fix
2. **Connection State Transitions**: Observe connection state changes (new → connecting → connected → closed) on unfixed code, verify same transitions after fix
3. **Call Lifecycle Preservation**: Test initiateCall, answerCall, endCall, cancelCall methods, verify they produce same Firestore documents and WebRTC states
4. **Cleanup Preservation**: Verify that cleanup still stops all tracks, closes peer connection, and resets state correctly
5. **Audio Call Preservation**: Verify audio-only calls continue to work exactly as before (no video streams involved)

### Unit Tests

- Test CallContext provides WebRTC instance to child components
- Test useOutgoingCall accesses WebRTC from context instead of creating local instance
- Test useIncomingCallAnswer accesses WebRTC from context instead of creating local instance
- Test that WebRTC handlers in CallContext correctly update call state
- Test that only one WebRTC instance is created per call regardless of component mounting/unmounting
- Test edge cases: multiple rapid navigations, concurrent hook calls, cleanup during navigation

### Property-Based Tests

- Generate random sequences of component mount/unmount operations during active calls, verify WebRTC instance remains the same
- Generate random call scenarios (audio/video, incoming/outgoing), verify all use the shared instance correctly
- Generate random navigation patterns during calls, verify streams remain accessible
- Test that signaling operations produce identical results regardless of which component invokes them

### Integration Tests

- Test full video call flow: initiate in ChatScreen → navigate to VideoCallScreen → verify video displays → end call → verify cleanup
- Test incoming call flow: receive call in IncomingCallManager → accept → navigate to VideoCallScreen → verify video displays
- Test switching between audio and video modes across component boundaries
- Test that visual feedback (local preview, remote video) appears correctly in VideoCallScreen after navigation
