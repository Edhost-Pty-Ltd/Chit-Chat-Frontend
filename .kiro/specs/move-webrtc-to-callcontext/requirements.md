# Requirements Document

## Introduction

This bugfix addresses the root cause of MediaStream loss in WebRTC-based voice and video calls. The current architecture creates separate useWebRTC instances in each parent hook (useOutgoingCall, useIncomingCallAnswer), causing MediaStream objects to be lost when components unmount/remount or navigate between screens. The solution moves WebRTC instance management into CallContext, establishing a single shared instance accessible across all components throughout the call lifecycle.

## Glossary

- **CallContext**: Global React Context that manages call state including activeCallId, incomingCall, callStatus, audio/video settings, and call duration
- **WebRTC_Instance**: Single instance of WebRTC functionality including peer connection, local stream, remote stream, and signaling handlers
- **Parent_Hook**: Either useOutgoingCall or useIncomingCallAnswer hook that orchestrates call flow
- **MediaStream**: Object representing audio/video stream from getUserMedia or remote peer
- **Call_Lifecycle**: Complete sequence from call initiation through connection establishment to call termination
- **Stream_Persistence**: Requirement that MediaStream objects remain accessible across component remounts and screen navigation

## Requirements

### Requirement 1: WebRTC Instance Ownership

**User Story:** As a developer, I want WebRTC instance creation and management in CallContext, so that all components access the same instance throughout the call lifecycle

#### Acceptance Criteria

1. THE CallContext SHALL own the WebRTC_Instance creation and lifecycle management
2. WHEN CallContext is initialized, THE CallContext SHALL create a single WebRTC_Instance
3. THE CallContext SHALL expose WebRTC_Instance methods and state through its context value
4. WHEN a component mounts, THE component SHALL access the WebRTC_Instance from CallContext
5. WHEN a component unmounts, THE WebRTC_Instance in CallContext SHALL persist unchanged

### Requirement 2: Stream Persistence Across Navigation

**User Story:** As a user, I want my audio/video streams to remain active when navigating between screens during a call, so that the call continues without interruption

#### Acceptance Criteria

1. WHEN a call is active and navigation occurs, THE CallContext SHALL maintain the same MediaStream references
2. WHEN ChatScreen navigates to VideoCallScreen, THE VideoCallScreen SHALL receive non-null MediaStream objects from CallContext
3. WHEN VideoCallScreen unmounts, THE MediaStream objects in CallContext SHALL remain unchanged
4. THE CallContext SHALL provide localStream and remoteStream as stable references across all component renders

### Requirement 3: Parent Hook Refactoring

**User Story:** As a developer, I want parent hooks to delegate WebRTC operations to CallContext, so that they no longer create isolated WebRTC instances

#### Acceptance Criteria

1. THE Parent_Hook SHALL NOT create its own useWebRTC instance
2. WHEN Parent_Hook needs WebRTC functionality, THE Parent_Hook SHALL invoke methods on CallContext WebRTC_Instance
3. THE Parent_Hook SHALL access localStream and remoteStream from CallContext
4. THE Parent_Hook SHALL pass WebRTC handlers to CallContext during initialization
5. WHEN Parent_Hook unmounts and remounts, THE Parent_Hook SHALL access the same WebRTC_Instance from CallContext

### Requirement 4: Peer Connection Initialization

**User Story:** As a developer, I want peer connection initialization to occur once per call in CallContext, so that streams are created in the shared instance

#### Acceptance Criteria

1. WHEN initiateCall is invoked, THE CallContext SHALL invoke initializePeerConnection on its WebRTC_Instance
2. WHEN answerCall is invoked, THE CallContext SHALL invoke initializePeerConnection on its WebRTC_Instance
3. THE CallContext SHALL pass the callType parameter to determine audio-only or video initialization
4. WHEN initializePeerConnection succeeds, THE CallContext SHALL store the resulting MediaStream in its WebRTC_Instance
5. THE CallContext SHALL expose the stored MediaStream to all consuming components

### Requirement 5: WebRTC Cleanup on Call End

**User Story:** As a user, I want my camera and microphone to be released when a call ends, so that resources are properly freed

#### Acceptance Criteria

1. WHEN a call ends, THE CallContext SHALL invoke cleanup on its WebRTC_Instance
2. WHEN cleanup is invoked, THE WebRTC_Instance SHALL stop all MediaStream tracks
3. WHEN cleanup is invoked, THE WebRTC_Instance SHALL close the peer connection
4. WHEN cleanup completes, THE CallContext SHALL reset localStream and remoteStream to null
5. WHEN a new call is initiated after cleanup, THE CallContext SHALL create a fresh WebRTC_Instance

### Requirement 6: Handler Injection Pattern

**User Story:** As a developer, I want parent hooks to provide signaling handlers to CallContext, so that WebRTC events trigger appropriate Firestore operations

#### Acceptance Criteria

1. THE Parent_Hook SHALL create handler functions for onIceCandidate, onConnectionStateChange, and onNetworkQualityChange
2. WHEN Parent_Hook initiates a call, THE Parent_Hook SHALL pass handlers to CallContext WebRTC initialization
3. WHEN WebRTC_Instance generates an ICE candidate, THE CallContext SHALL invoke the onIceCandidate handler
4. WHEN peer connection state changes, THE CallContext SHALL invoke the onConnectionStateChange handler
5. WHEN network quality changes, THE CallContext SHALL invoke the onNetworkQualityChange handler

### Requirement 7: Backward Compatibility with Existing Parent Hooks

**User Story:** As a developer, I want the refactoring to maintain existing parent hook APIs, so that consuming components require minimal changes

#### Acceptance Criteria

1. THE Parent_Hook SHALL continue to expose initiateCall, answerCall, endCall, and rejectCall methods
2. THE Parent_Hook SHALL continue to expose localStream, remoteStream, connectionState, and networkQuality properties
3. THE Parent_Hook SHALL continue to expose toggleMute and toggleVideo methods
4. WHEN a consuming component invokes these methods, THE behavior SHALL match the previous implementation
5. THE Parent_Hook SHALL delegate to CallContext WebRTC_Instance instead of local useWebRTC instance

### Requirement 8: State Synchronization

**User Story:** As a developer, I want CallContext to synchronize WebRTC state changes with its React state, so that components re-render when streams change

#### Acceptance Criteria

1. WHEN localStream is set in WebRTC_Instance, THE CallContext SHALL update its state to trigger re-renders
2. WHEN remoteStream is set in WebRTC_Instance, THE CallContext SHALL update its state to trigger re-renders
3. WHEN connectionState changes in WebRTC_Instance, THE CallContext SHALL update its state
4. WHEN networkQuality changes in WebRTC_Instance, THE CallContext SHALL update its state
5. THE CallContext SHALL provide a streamVersion counter that increments when streams change

### Requirement 9: Error Handling Preservation

**User Story:** As a user, I want error handling to work the same way after refactoring, so that call failures are properly reported

#### Acceptance Criteria

1. WHEN initializePeerConnection fails, THE CallContext SHALL propagate the error to the calling Parent_Hook
2. WHEN createOffer fails, THE CallContext SHALL propagate the error to the calling Parent_Hook
3. WHEN createAnswer fails, THE CallContext SHALL propagate the error to the calling Parent_Hook
4. WHEN setRemoteAnswer fails, THE CallContext SHALL propagate the error to the calling Parent_Hook
5. THE Parent_Hook SHALL handle errors and update callStatus to failed as in the previous implementation

### Requirement 10: Multi-Call Prevention

**User Story:** As a user, I want the system to prevent overlapping calls, so that a new call cannot be initiated while one is active

#### Acceptance Criteria

1. WHEN a call is active, THE CallContext SHALL track the active state via activeCallId
2. WHEN initiateCall is invoked while activeCallId is not null, THE CallContext SHALL reject the new call
3. WHEN answerCall is invoked while activeCallId is not null, THE CallContext SHALL reject the new call
4. WHEN a call ends and cleanup completes, THE CallContext SHALL clear activeCallId
5. WHEN activeCallId is null, THE CallContext SHALL permit new call initiation
