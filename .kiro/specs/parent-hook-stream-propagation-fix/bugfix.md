# Bugfix Requirements Document

## Introduction

The video call feature in the application successfully creates WebRTC streams (confirmed by logs showing "Local stream obtained" and "Remote track received: video"), but the camera feeds do not display in VideoCallScreen. The root cause is that parent hooks (useOutgoingCall and useIncomingCallAnswer) capture the initial `null` stream values when they first render and do not re-render to propagate updated stream references from useWebRTC, even though useWebRTC correctly updates its internal refs and triggers state changes via `streamVersion`.

This bugfix ensures that when useWebRTC obtains media streams and updates its internal state, the parent hooks automatically re-render and return the updated stream references to VideoCallScreen, enabling the camera feeds to display correctly.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN useWebRTC obtains local and remote streams and updates its internal refs THEN the parent hooks (useOutgoingCall and useIncomingCallAnswer) do not re-render to capture the updated stream values

1.2 WHEN VideoCallScreen mounts and reads stream values from parent hooks THEN it receives `null` for both localStream and remoteStream despite useWebRTC having successfully created the streams

1.3 WHEN useWebRTC increments `streamVersion` to trigger re-renders THEN the parent hooks' return statements still provide the initially captured `null` stream values instead of the updated refs

### Expected Behavior (Correct)

2.1 WHEN useWebRTC obtains local and remote streams and updates its internal refs THEN the parent hooks SHALL re-render and return the updated stream references

2.2 WHEN VideoCallScreen mounts and reads stream values from parent hooks THEN it SHALL receive the current non-null stream references from useWebRTC

2.3 WHEN useWebRTC increments `streamVersion` to signal stream updates THEN the parent hooks SHALL react to this change and return the latest stream values from useWebRTC's refs

### Unchanged Behavior (Regression Prevention)

3.1 WHEN useWebRTC has not yet obtained streams (initial state) THEN the parent hooks SHALL CONTINUE TO return `null` for localStream and remoteStream

3.2 WHEN other useWebRTC state updates occur (connection state, peer state, etc.) THEN the parent hooks SHALL CONTINUE TO propagate these updates correctly

3.3 WHEN VideoCallScreen updates based on stream changes THEN the existing video rendering logic SHALL CONTINUE TO work as designed

3.4 WHEN multiple components use the same parent hook instance THEN they SHALL CONTINUE TO receive consistent stream references

3.5 WHEN useWebRTC's cleanup logic runs (component unmount, call end) THEN the parent hooks SHALL CONTINUE TO handle cleanup correctly without memory leaks
