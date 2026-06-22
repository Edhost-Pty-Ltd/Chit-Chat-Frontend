# Voice Call Implementation Plan

## Overview
Implement real-time voice calling using WebRTC for peer-to-peer audio communication with Firebase Firestore for signaling.

---

## Architecture

### Technology Stack
- **WebRTC** - Peer-to-peer audio streaming
- **Firebase Firestore** - Signaling server (ICE candidates, offers, answers)
- **react-native-webrtc** - WebRTC wrapper for React Native
- **Firebase Cloud Messaging (optional)** - Call notifications when app is backgrounded

### Components
1. **Call Manager** - Handles WebRTC peer connections
2. **Signaling Service** - Firestore-based offer/answer/ICE exchange
3. **Call State Manager** - Track active calls, incoming calls
4. **Audio Manager** - Handle audio routing (speaker/earpiece)
5. **Call History** - Store call logs in Firestore

---

## Database Structure

### Firestore Schema

#### `/calls/{callId}`
```typescript
{
  callId: string,
  caller: {
    userId: string,
    displayName: string,
    photoUrl: string | null
  },
  callee: {
    userId: string,
    displayName: string,
    photoUrl: string | null
  },
  status: 'ringing' | 'accepted' | 'rejected' | 'ended' | 'missed' | 'busy',
  type: 'audio' | 'video',
  startTime: Timestamp,
  endTime: Timestamp | null,
  duration: number | null, // seconds
  
  // WebRTC signaling data
  offer: RTCSessionDescription | null,
  answer: RTCSessionDescription | null,
  callerIceCandidates: Array<RTCIceCandidate>,
  calleeIceCandidates: Array<RTCIceCandidate>,
  
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

#### `/users/{userId}/callHistory/{callId}`
```typescript
{
  callId: string,
  otherParty: {
    userId: string,
    displayName: string,
    photoUrl: string | null
  },
  type: 'audio' | 'video',
  direction: 'incoming' | 'outgoing',
  status: 'completed' | 'missed' | 'rejected' | 'busy',
  duration: number | null, // seconds
  timestamp: Timestamp
}
```

---

## Implementation Phases

### Phase 1: Setup & Infrastructure ✅ COMPLETED
**Goal:** Install dependencies and create basic structure

**Tasks:**
1. ✅ Install `react-native-webrtc`
2. ✅ Configure Android permissions
3. ✅ Create WebRTC utility hooks
4. ✅ Create signaling service
5. ✅ Create call state context

**Files Created:**
- ✅ `src/hooks/useWebRTC.ts` - WebRTC peer connection management
- ✅ `src/services/signalingService.ts` - Firestore signaling
- ✅ `src/context/CallContext.tsx` - Global call state
- ✅ `src/hooks/useCallHistory.ts` - Fetch call history
- ✅ `src/hooks/useIncomingCalls.ts` - Listen for incoming calls
- ✅ `src/types/call.ts` - Call-related types
- ✅ `App.tsx` - Added CallProvider to context tree

**Next Steps:**
- Run `npx expo prebuild --clean --platform android` to regenerate manifest with WebRTC
- Continue with Phase 2 (Outgoing calls implementation)

---

### Phase 2: Outgoing Calls
**Goal:** User can initiate calls

**Tasks:**
1. Add call button to ChatScreen header
2. Create call initiation flow
3. Implement WebRTC offer creation
4. Send call invitation via Firestore
5. Show calling UI while ringing

**Flow:**
```
User clicks call button
      ↓
Create call document in Firestore
  status: 'ringing'
      ↓
Create WebRTC peer connection
      ↓
Create offer (SDP)
      ↓
Save offer to Firestore
      ↓
Navigate to AudioCallScreen
      ↓
Listen for answer from callee
      ↓
When answer received → connect call
```

---

### Phase 3: Incoming Calls
**Goal:** User receives calls

**Tasks:**
1. Listen for incoming calls (Firestore listener)
2. Show incoming call UI (full-screen overlay)
3. Play ringtone
4. Accept/Reject actions
5. Create WebRTC answer

**Flow:**
```
Firestore listener detects new call
  where callee.userId == currentUserId
  and status == 'ringing'
      ↓
Show incoming call overlay
      ↓
Play ringtone (expo-av)
      ↓
User taps Accept
      ↓
Create peer connection
      ↓
Set remote description (offer)
      ↓
Create answer (SDP)
      ↓
Save answer to Firestore
      ↓
Navigate to AudioCallScreen
      ↓
Listen for ICE candidates
      ↓
Connection established → audio flows
```

---

### Phase 4: Active Call Management ✅ COMPLETED
**Goal:** Manage ongoing call

**Tasks:**
1. ✅ Mute/unmute microphone
2. ✅ Speaker/earpiece toggle
3. ✅ Call timer
4. ✅ End call
5. ✅ Handle call ended by other party
6. ✅ Network quality indicators

**Features:**
- ✅ Mute button → Disable local audio track
- ✅ Speaker button → Route audio to speaker/earpiece (framework ready)
- ✅ Timer → Show call duration
- ✅ End call → Close peer connection, update Firestore
- ✅ Network quality monitoring with real-time indicators
- ✅ Color-coded WiFi icon showing connection quality
- ✅ Comprehensive logging for debugging

**Implementation Details:**
- Created `useAudioRouting` hook for speaker control
- Enhanced `useWebRTC` with network quality monitoring
- Added real-time stats tracking (packet loss, jitter, RTT)
- Updated AudioCallScreen with network indicator UI
- Integrated audio routing lifecycle management
- Quality levels: excellent, good, fair, poor

**Files Created:**
- ✅ `src/hooks/useAudioRouting.ts` - Audio routing management
- ✅ `PHASE_4_IMPLEMENTATION.md` - Complete documentation
- ✅ `PHASE_4_QUICK_START.md` - Developer quick reference

**Files Modified:**
- ✅ `src/hooks/useWebRTC.ts` - Network monitoring
- ✅ `src/hooks/useOutgoingCall.ts` - Network quality integration
- ✅ `src/hooks/useIncomingCallAnswer.ts` - Network quality integration
- ✅ `src/screens/AudioCallScreen.tsx` - UI enhancements

**Next Steps:**
- Ready for Phase 5 (Call History implementation)

---

### Phase 5: Call History ✅ COMPLETED
**Goal:** Show real call data in CallsScreen

**Tasks:**
1. ✅ Create `useCallHistory` hook
2. ✅ Fetch user's call history from Firestore
3. ✅ Update CallsScreen to use real data
4. ✅ Show call direction (incoming/outgoing)
5. ✅ Show call status (completed/missed)
6. ✅ Show call duration
7. ✅ Click to call back

**Display:**
- ✅ Green arrow = Outgoing completed
- ✅ Blue arrow = Incoming completed
- ✅ Red phone = Missed call
- ✅ Duration or "Missed" text

**Implementation Details:**
- Replaced all mock data with real Firestore call history
- Real-time updates via onSnapshot listener
- Smart timestamp formatting (Today/Yesterday/Day/Date)
- Duration display in MM:SS format
- Tap any call to call back immediately
- Info button shows detailed call information
- Filter tabs for "All" and "Missed" calls
- Loading and error states
- Empty state with helpful hints
- Automatic history saving when calls end
- Saved for both participants

**Features:**
- ✅ Real-time call history updates
- ✅ Call-back functionality with one tap
- ✅ Call info dialog with details
- ✅ New call from contacts
- ✅ Smart filtering by status
- ✅ Direction indicators (arrows + colors)
- ✅ Status labels (completed/missed/rejected/busy/failed)

**Files Modified:**
- ✅ `src/screens/CallsScreen.tsx` - Complete rewrite with real data
- ✅ `src/hooks/useOutgoingCall.ts` - Added history saving
- ✅ `src/hooks/useIncomingCallAnswer.ts` - Added history saving
- ✅ `PHASE_5_IMPLEMENTATION.md` - Complete documentation

**Files Already Existed (from Phase 1):**
- ✅ `src/hooks/useCallHistory.ts` - Firestore listener
- ✅ `src/services/signalingService.ts` - saveToCallHistory()
- ✅ `src/types/call.ts` - CallHistoryItem type

**Next Steps:**
- Ready for Phase 6 (Contact calling from ContactsScreen)

---

### Phase 6: Contact Calling ✅ COMPLETED
**Goal:** Call from contacts list

**Tasks:**
1. ✅ Add call button to ContactsScreen
2. ✅ Implement call from ContactsScreen
3. ✅ Look up user by phone number
4. ✅ Check if user exists in app
5. ✅ Initiate call if exists

**Implementation Details:**
- Integrated with real contacts from `useContacts` hook
- Shows which contacts are on Chit-Chat ("On Chit-Chat" vs "Not on Chit-Chat")
- Call button enabled only for registered users
- Disabled call button for non-registered contacts
- Shows contact count header (e.g., "15 of 23 on Chit-Chat")
- Real-time call initiation with loading states
- Seamless navigation to AudioCallScreen
- Uses phone contact photos and Firebase profile photos
- Automatic avatar color generation based on userId

**Features:**
- ✅ Call button on each contact card
- ✅ Visual indication of app availability
- ✅ Loading indicator during call initiation
- ✅ Error handling for failed calls
- ✅ Permission handling for contacts access
- ✅ Search functionality for contacts
- ✅ Empty states for no contacts/no results
- ✅ Loading state while fetching contacts

**Files Modified:**
- ✅ `src/screens/ContactsScreen.tsx` - Complete rewrite with calling
- ✅ `PHASE_6_IMPLEMENTATION.md` - Complete documentation

**Files Used (Already Existed):**
- ✅ `src/hooks/useContacts.ts` - Fetches real contacts
- ✅ `src/hooks/useOutgoingCall.ts` - Initiates calls
- ✅ `src/hooks/useAuth.ts` - User authentication

**User Experience:**
- See all phone contacts
- Know who's on the app
- Call with one tap
- Clear visual feedback
- Helpful error messages

**Next Steps:**
- All 6 phases complete!
- Voice calling system fully functional
- Ready for production testing

---

## WebRTC Flow Diagram

```
Caller (Device A)                    Firestore                    Callee (Device B)
      |                                  |                                |
      | 1. Create call doc               |                                |
      |--------------------------------->|                                |
      |    status: 'ringing'             |                                |
      |                                  |                                |
      | 2. Create peer connection        |                                |
      | 3. Create offer (SDP)            |                                |
      |                                  |                                |
      | 4. Save offer                    |                                |
      |--------------------------------->|                                |
      |                                  |                                |
      |                                  | 5. Listen for calls            |
      |                                  |------------------------------->|
      |                                  |                                |
      |                                  |                 6. Show incoming call UI
      |                                  |                 7. Create peer connection
      |                                  |                 8. Set remote offer
      |                                  |                 9. Create answer
      |                                  |                                |
      |                                  | 10. Save answer                |
      |                                  |<-------------------------------|
      |                                  |                                |
      | 11. Get answer                   |                                |
      |<---------------------------------|                                |
      |                                  |                                |
      | 12. Set remote answer            |                                |
      |                                  |                                |
      | 13. Exchange ICE candidates      |                                |
      |<-------------------------------->|<------------------------------>|
      |                                  |                                |
      |                        14. AUDIO CONNECTED                        |
      |<=============================================================>|
      |                                  |                                |
```

---

## Code Structure

### useWebRTC Hook
```typescript
function useWebRTC() {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [peerConnection, setPeerConnection] = useState<RTCPeerConnection | null>(null);
  
  const initializePeerConnection = () => {
    // Create RTCPeerConnection with STUN/TURN servers
    // Set up event handlers
  };
  
  const createOffer = async () => {
    // Create and return SDP offer
  };
  
  const createAnswer = async (offer: RTCSessionDescription) => {
    // Create and return SDP answer
  };
  
  const addIceCandidate = async (candidate: RTCIceCandidate) => {
    // Add ICE candidate to peer connection
  };
  
  const endCall = () => {
    // Close streams and peer connection
  };
  
  return {
    localStream,
    remoteStream,
    peerConnection,
    initializePeerConnection,
    createOffer,
    createAnswer,
    addIceCandidate,
    endCall,
  };
}
```

### Signaling Service
```typescript
class SignalingService {
  // Create call invitation
  async createCall(callerId: string, calleeId: string): Promise<string>;
  
  // Listen for call answer
  onAnswerReceived(callId: string, callback: (answer: RTCSessionDescription) => void);
  
  // Listen for ICE candidates
  onIceCandidateReceived(callId: string, isCallee: boolean, callback: (candidate: RTCIceCandidate) => void);
  
  // Update call status
  async updateCallStatus(callId: string, status: CallStatus);
  
  // End call
  async endCall(callId: string, duration: number);
}
```

---

## Installation Steps

### 1. Install Dependencies
```bash
npm install react-native-webrtc
npm install @react-native-community/netinfo
```

### 2. Android Configuration

**android/app/src/main/AndroidManifest.xml:**
```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
```

**android/app/build.gradle:**
```gradle
dependencies {
    implementation "com.facebook.react:react-native-webrtc:+"
}
```

### 3. app.json
```json
{
  "expo": {
    "plugins": [
      [
        "react-native-webrtc",
        {
          "cameraPermission": "Allow Chit-Chat to access your camera for video calls.",
          "microphonePermission": "Allow Chit-Chat to access your microphone for calls."
        }
      ]
    ]
  }
}
```

---

## Testing Strategy

### Unit Tests
- WebRTC connection creation
- Offer/answer generation
- ICE candidate handling
- Call state transitions

### Integration Tests
- Full call flow (ringing → accepted → connected → ended)
- Multiple calls handling
- Call rejection flow
- Network interruption handling

### Manual Testing
- Call between two devices
- Accept/reject incoming call
- Mute/unmute during call
- Speaker toggle
- End call from both sides
- Background/foreground transitions

---

## Known Limitations & Considerations

1. **STUN/TURN Servers**
   - Need reliable STUN/TURN servers for NAT traversal
   - Free STUN servers: Google's public STUN servers
   - TURN servers: May need paid service for production

2. **Network Issues**
   - Handle poor network conditions
   - Implement reconnection logic
   - Show network quality indicator

3. **Battery Usage**
   - WebRTC can drain battery
   - Optimize by closing unnecessary resources

4. **Background Calls**
   - iOS requires VoIP certificate for background calls
   - Android needs foreground service

5. **Call Notifications**
   - Need FCM for push notifications when app is closed
   - Implement CallKit (iOS) / ConnectionService (Android) for native call UI

---

## Success Criteria

- [ ] User can call another user from chat screen
- [ ] User receives incoming call notification
- [ ] User can accept/reject incoming calls
- [ ] Audio quality is clear and stable
- [ ] Mute/speaker controls work correctly
- [ ] Call timer displays accurate duration
- [ ] Call history shows all calls with correct status
- [ ] Network issues handled gracefully
- [ ] UI matches existing design system

---

## Next Steps

1. **Review and approve** this plan
2. **Install react-native-webrtc** and configure
3. **Create basic WebRTC hooks** and test connection
4. **Implement signaling** with Firestore
5. **Build outgoing call** flow first
6. **Build incoming call** flow second
7. **Add call history** integration
8. **Test thoroughly** between two devices

---

## Estimated Timeline

- Phase 1 (Setup): 2-3 hours
- Phase 2 (Outgoing): 3-4 hours
- Phase 3 (Incoming): 3-4 hours
- Phase 4 (Management): 2-3 hours
- Phase 5 (History): 2-3 hours
- Phase 6 (Contacts): 1-2 hours

**Total: 13-19 hours** of development time

---

## Alternative: Simpler Approach

If full WebRTC is too complex, consider:

1. **Agora SDK** - Managed voice/video calling service
2. **Twilio Programmable Voice** - Simple API for voice calls
3. **100ms SDK** - Easy-to-integrate video calling

These provide WebRTC functionality without managing the complexity.

---

**Do you want to proceed with full WebRTC implementation, or would you prefer one of the managed services?**
