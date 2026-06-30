# Bugfix Requirements Document

## Introduction

The video call feature suffers from a critical camera feed issue where VideoCallScreen displays black screens instead of showing video streams. This occurs because each component that uses video calling hooks creates separate WebRTC instances, leading to stream isolation. When ChatScreen initiates a call and obtains camera streams, those streams remain tied to its WebRTC instance. When VideoCallScreen mounts and creates a new WebRTC instance, it has no access to the previously obtained streams, resulting in black screens for both local and remote video feeds.

This bugfix will centralize WebRTC instance management by moving it into the existing CallContext, ensuring all components share the same WebRTC instance and streams.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN ChatScreen calls `useOutgoingCall()` and initiates a video call THEN the system creates WebRTC instance #1 and obtains camera/audio streams

1.2 WHEN the user navigates to VideoCallScreen after ChatScreen has obtained streams THEN the system creates a NEW WebRTC instance #2 without any streams

1.3 WHEN VideoCallScreen attempts to render video feeds using the new instance THEN the system displays black screens because instance #2 has no local or remote streams

1.4 WHEN multiple components use `useOutgoingCall()` or `useIncomingCallAnswer()` hooks THEN the system creates multiple independent WebRTC instances instead of sharing one

### Expected Behavior (Correct)

2.1 WHEN ChatScreen calls `useOutgoingCall()` and initiates a video call THEN the system SHALL use a shared WebRTC instance from CallContext and obtain camera/audio streams

2.2 WHEN the user navigates to VideoCallScreen after ChatScreen has obtained streams THEN the system SHALL access the SAME WebRTC instance from CallContext with existing streams preserved

2.3 WHEN VideoCallScreen renders video feeds using the shared instance THEN the system SHALL display the local and remote video streams correctly without black screens

2.4 WHEN multiple components use `useOutgoingCall()` or `useIncomingCallAnswer()` hooks THEN the system SHALL all access the same shared WebRTC instance from CallContext

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a video call is initiated from ChatScreen THEN the system SHALL CONTINUE TO establish WebRTC peer connections successfully

3.2 WHEN WebRTC signaling occurs (offer/answer/ICE candidates) THEN the system SHALL CONTINUE TO exchange signaling messages through Firestore correctly

3.3 WHEN a call is terminated or cleaned up THEN the system SHALL CONTINUE TO properly release camera/audio resources and close peer connections

3.4 WHEN incoming calls are answered using `useIncomingCallAnswer()` THEN the system SHALL CONTINUE TO establish connections and obtain streams correctly

3.5 WHEN CallContext provides call state management (outgoingCall, incomingCall, etc.) THEN the system SHALL CONTINUE TO manage call state correctly for all components
