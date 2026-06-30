# Root Cause Diagnosis: Video Call Camera Feed Issue

## The Real Problem

The fix we implemented (adding `streamVersion` to hook returns) was based on an incorrect root cause analysis. The actual issue is **different hook instances**, not reactive dependencies.

## What's Really Happening

### Call Flow:
1. **ChatScreen** initiates video call → creates `useOutgoingCall()` instance #1 → creates `useWebRTC()` instance #1
2. Instance #1 obtains local stream successfully ✅
3. User navigates to **VideoCallScreen**
4. **VideoCallScreen** mounts → creates `useOutgoingCall()` instance #2 → creates `useWebRTC()` instance #2
5. Instance #2 is BRAND NEW - it hasn't obtained any streams yet ❌
6. VideoCallScreen reads streams from instance #2 → gets `null` ❌

### Evidence from Logs:
```
LOG  [useWebRTC] Local stream obtained  ← Instance #1 (ChatScreen)
LOG  [VideoCallScreen] Component mounted - initializing  ← New mount
LOG  [VideoCallScreen] outgoingCall.localStream: false  ← Instance #2 (no streams)
LOG  [VideoCallScreen] incomingCallAnswer.localStream: false
```

## Why Our Fix Didn't Work

Adding `streamVersion` to the return object creates reactive dependencies WITHIN a single hook instance. But VideoCallScreen and ChatScreen have **separate instances** - they don't share state.

Each call to `useOutgoingCall()` creates:
- A new `useWebRTC()` instance with fresh state
- A new peer connection
- New stream refs (initially null)

## The Real Solutions

### Option 1: Shared WebRTC Context (Recommended)
Create a WebRTCContext that provides a single shared instance across all components.

```typescript
// WebRTCContext.tsx
const WebRTCContext = createContext<WebRTCState | null>(null);

export function WebRTCProvider({ children }) {
  const webrtc = useWebRTC(/* handlers */);
  return <WebRTCContext.Provider value={webrtc}>{children}</WebRTCContext.Provider>;
}

export function useSharedWebRTC() {
  const context = useContext(WebRTCContext);
  if (!context) throw new Error('useSharedWebRTC must be used within WebRTCProvider');
  return context;
}
```

Then parent hooks would use `useSharedWebRTC()` instead of creating new instances.

### Option 2: Pass WebRTC Instance Through Navigation
Pass the webrtc instance as a navigation param when navigating to VideoCallScreen.

### Option 3: CallContext Should Own WebRTC
Move WebRTC instance creation to CallContext (which is already shared globally) instead of creating it in individual hooks.

## Why This Was Missed

The bugfix spec's root cause analysis stated:
> "parent hooks (useOutgoingCall and useIncomingCallAnswer) capture the initial `null` stream values when they first render and do not re-render to propagate updated stream references from useWebRTC"

This was technically true BUT incomplete. The issue isn't just about re-rendering - it's about **which instance** of useWebRTC we're reading from.

## Recommendation

Implement **Option 3**: Move WebRTC to CallContext. This is the cleanest solution because:
- CallContext is already global
- It already tracks activeCallId and callStatus
- Components already have access to it
- Minimal refactoring needed

This way, when ChatScreen initiates a call, the WebRTC instance is created in CallContext. When VideoCallScreen mounts, it reads from the SAME instance in CallContext.
