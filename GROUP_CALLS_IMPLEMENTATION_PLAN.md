# Group Calls Implementation Plan

## Overview
Implementing group voice and video calling functionality for Chit-Chat app.

## Current Status
- ✅ Group chat creation modal exists
- ✅ 1-on-1 audio calls work
- ✅ 1-on-1 video calls work
- ❌ Group calls disabled ("Group calls are not supported yet")
- ❌ Group call UI needs implementation

## Architecture Decision: Mesh vs SFU

### Option 1: Mesh (P2P) - CHOSEN for simplicity
Each participant connects directly to every other participant.

**Pros:**
- No server infrastructure needed
- Lower latency
- Simpler to implement
- Works with existing WebRTC setup

**Cons:**
- Limited to ~4-6 participants (bandwidth/CPU)
- Bandwidth increases with O(n²)

### Option 2: SFU (Selective Forwarding Unit)
Media server forwards streams between participants.

**Pros:**
- Scales to 10+ participants
- Lower client bandwidth

**Cons:**
- Requires media server (Jitsi, Janus, LiveKit)
- More complex setup
- Infrastructure costs

**Decision**: Start with Mesh for MVP (max 6 participants)

## Implementation Phases

### Phase 1: Group Creation (Already Exists)
- ✅ UI modal for creating groups
- 🔨 Connect to Firestore to actually create groups

### Phase 2: Group Call Signaling
- Create group call document structure
- Handle multiple participant signaling
- ICE candidate exchange for all participants

### Phase 3: Group Call UI
- Grid layout for video participants
- Audio-only participant indicators
- Mute controls per participant
- Add/remove participants

### Phase 4: WebRTC Mesh Connections
- Create peer connections for each participant pair
- Handle media stream distribution
- Manage connection states

## Data Structures

### Firestore: Group Calls Collection
```
groupCalls/{callId}/
  - callId: string
  - groupId: string
  - type: 'audio' | 'video'
  - initiatorId: string
  - status: 'ringing' | 'active' | 'ended'
  - participants: {
      [userId]: {
        status: 'ringing' | 'joined' | 'declined' | 'left'
        joinedAt: Timestamp
        leftAt: Timestamp
      }
    }
  - offers: {
      [fromUserId_toUserId]: RTCSessionDescription
    }
  - answers: {
      [fromUserId_toUserId]: RTCSessionDescription
    }
  - iceCandidates: {
      [fromUserId_toUserId]: RTCIceCandidate[]
    }
  - createdAt: Timestamp
  - endedAt: Timestamp
```

### Group Call Grid Layout
```
2 participants: 1x2 (vertical split)
3 participants: 2x2 (1 empty)
4 participants: 2x2
5-6 participants: 2x3
```

## Components to Create

### 1. GroupAudioCallScreen
- Grid of participant cards (name + audio wave)
- Mute/unmute controls
- Speaker/earpiece toggle
- End call button
- Add participant button

### 2. GroupVideoCallScreen
- Video grid layout
- Self video preview
- Mute camera/mic buttons
- Switch camera button
- End call button
- Add participant button

### 3. useGroupCall Hook
- Manage multiple peer connections
- Handle signaling for all pairs
- Track participant states
- Media stream management

### 4. Group Call Initiation
- From ChatScreen (group chat)
- Select participants
- Send call notifications

## Implementation Steps

### Step 1: Connect Group Creation ✅
Already done in ChatsScreen, just needs Firestore connection.

### Step 2: Enable Group Calls in ChatScreen
Remove the disabled state for group voice/video buttons.

### Step 3: Create Group Call Signaling
New collection: `groupCalls` with mesh signaling.

### Step 4: Create Group Call Screens
- GroupAudioCallScreen.tsx
- GroupVideoCallScreen.tsx

### Step 5: Create useGroupCall Hook
Handle mesh WebRTC connections.

### Step 6: Update Navigation
Add GroupAudioCall and GroupVideoCall routes.

## Technical Challenges

### 1. Bandwidth Management
- Limit to 6 participants max
- Warn users about network usage
- Adaptive bitrate based on participants

### 2. Connection Management
- Handle participants joining mid-call
- Handle participants leaving
- Reconnection logic

### 3. UI/UX
- Responsive grid layout
- Active speaker highlighting
- Network quality indicators

## Limitations (MVP)

1. **Max 6 participants** (due to mesh architecture)
2. **No screen sharing** (can add later)
3. **No recording** (can add later)
4. **No call transfer** (can add later)
5. **No background blur** (can add later)

## Future Enhancements

1. **SFU Migration** (for >6 participants)
2. **Screen Sharing**
3. **Call Recording**
4. **Virtual Backgrounds**
5. **Reactions/Emojis**
6. **Noise Cancellation**
7. **Beauty Filters**

## Testing Strategy

### Unit Tests
- Group creation logic
- Signaling state management
- Connection handling

### Integration Tests
- 2-participant group call
- 3-participant group call
- Participant joins mid-call
- Participant leaves mid-call

### Manual Testing
- Audio quality with 4+ participants
- Video quality with 4+ participants
- Network interruption handling
- Battery usage monitoring

## Timeline Estimate

- Phase 1: Group Creation Connection - 2 hours ✅
- Phase 2: Group Call Signaling - 4 hours
- Phase 3: Group Call UI - 6 hours
- Phase 4: WebRTC Mesh - 8 hours
- Testing & Polish - 4 hours

**Total: ~24 hours** for full implementation

## Priority: MVP Features

For immediate implementation:
1. ✅ Group creation (connect existing UI)
2. 🔨 Group audio calls (max 4 participants)
3. 🔨 Group video calls (max 4 participants)
4. 🔨 Basic grid layout
5. 🔨 Mute controls

## Notes

- WebRTC mesh topology is suitable for small groups
- For production with >6 participants, consider SFU (media server)
- Current 1-on-1 call infrastructure can be extended
- Need to handle ICE candidates for N*(N-1) connections

## References

- WebRTC Mesh: https://webrtchacks.com/mesh-perf/
- Group Calling Best Practices: https://bloggeek.me/webrtc-multiparty-video-alternatives/
