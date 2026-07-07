# Bugfix Requirements Document

## Introduction

The video call feature successfully establishes WebRTC connections (connected status, completed ICE negotiation, excellent network quality) but camera feeds are not visible to users - both local and remote video areas display black screens instead of the expected camera feed. This issue affects both outgoing and incoming video calls.

The root cause is that the `useWebRTC` hook stores streams in React state (`localStream`, `remoteStream`), but when parent hooks (`useOutgoingCall`, `useIncomingCallAnswer`) re-render, they create new instances of `useWebRTC`, causing the stream state to be lost. While streams ARE being created successfully (evidenced by logs showing stream acquisition and track addition), they don't persist in the hook instances that `VideoCallScreen` reads from, resulting in the VideoCallScreen always receiving `null` for both streams.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a video call is initiated or answered THEN the system creates local and remote MediaStream objects successfully but they are stored in React state within useWebRTC instances that get lost on parent hook re-renders

1.2 WHEN VideoCallScreen reads localStream and remoteStream from useOutgoingCall or useIncomingCallAnswer hooks THEN the system returns null values because the hook instances don't maintain the stream references across re-renders

1.3 WHEN WebRTC tracks are added and remote tracks are received THEN the system logs show successful stream creation ("Local stream obtained", "Remote track received: video") but the streams are not accessible to the VideoCallScreen component

1.4 WHEN parent hooks (useOutgoingCall, useIncomingCallAnswer) re-render THEN the system creates new useWebRTC hook instances, discarding the previous instances that contained the stream state

### Expected Behavior (Correct)

2.1 WHEN a video call is initiated or answered THEN the system SHALL persist localStream and remoteStream references in a way that survives parent hook re-renders

2.2 WHEN VideoCallScreen reads localStream and remoteStream from useOutgoingCall or useIncomingCallAnswer hooks THEN the system SHALL return the valid MediaStream objects that contain the active video tracks

2.3 WHEN WebRTC streams are created THEN the system SHALL maintain these stream references in a stable location (such as refs or context) that persists across component re-renders

2.4 WHEN RTCView components receive stream URLs via streamURL prop THEN the system SHALL display the camera feed video content instead of black screens

### Unchanged Behavior (Regression Prevention)

3.1 WHEN WebRTC connections establish successfully THEN the system SHALL CONTINUE TO log connection state changes, ICE candidate exchanges, and track additions as currently implemented

3.2 WHEN audio-only calls are made THEN the system SHALL CONTINUE TO work correctly with audio streams only

3.3 WHEN call cleanup occurs (hang up, call ended) THEN the system SHALL CONTINUE TO properly stop tracks, close peer connections, and clean up resources

3.4 WHEN network quality monitoring is active THEN the system SHALL CONTINUE TO calculate and report network quality metrics based on WebRTC statistics

3.5 WHEN mute/unmute or camera enable/disable toggles are used THEN the system SHALL CONTINUE TO enable/disable the appropriate tracks on the MediaStream objects

3.6 WHEN ICE candidates are exchanged between peers THEN the system SHALL CONTINUE TO add them to the peer connection and sync via Firestore

3.7 WHEN call status changes occur (ringing, connected, ended, rejected, etc.) THEN the system SHALL CONTINUE TO update the CallContext state and trigger appropriate UI updates
