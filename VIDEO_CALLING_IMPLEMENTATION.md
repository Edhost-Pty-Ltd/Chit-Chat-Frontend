# Video Calling Implementation

## ✅ What was implemented:

### 1. Updated `useWebRTC.ts` Hook
- Added `isVideo` parameter to `initializePeerConnection()` to support video streams
- Added `isVideo` parameter to `createOffer()` to configure offer constraints
- Added `toggleVideo()` method to enable/disable video tracks
- Updated `getUserMedia` to request camera permission and video stream when `isVideo === true`
- Video configuration: 1280x720 @ 30fps, front-facing camera

### 2. Updated `useOutgoingCall.ts` Hook
- Added `callType` parameter (`'audio' | 'video'`) to `initiateCall()`
- Passes `isVideo` flag to WebRTC methods based on callType
- Exports `toggleVideo` method for video control

### 3. Updated `useIncomingCallAnswer.ts` Hook
- Added `callType` parameter to `answerCall()`
- Passes `isVideo` flag to WebRTC methods
- Exports `toggleVideo` method for video control

### 4. Created `VideoCallScreen.tsx` ⭐ NEW
- Full-screen video call UI with remote video as background
- Picture-in-picture local video in top-right corner (120x160px, rounded, mirrored)
- Top overlay: call status, timer, network quality indicator, caller name
- Bottom controls:
  - Mute/Unmute microphone
  - Enable/Disable camera
  - Switch camera (front/back) - placeholder for now
  - Hang up button
- Handles all call states (ringing, connecting, connected, ended, rejected, missed, failed)
- Uses RTCView from react-native-webrtc for video rendering

### 5. Updated Navigation
- Added `VideoCall` route to `RootStackParamList` in `src/types/index.ts`
- Route params: `callId`, `isOutgoing`, `otherParty` (userId, displayName, photoUrl)
- VideoCallScreen already imported in AppNavigator.tsx

### 6. Updated `ChatScreen.tsx` ✅
- **Video call button was already in place** - just needed wiring
- Added `handleVideoCall()` function to initiate video calls
- Fetches user profile from Firestore before initiating call
- Calls `outgoingCall.initiateCall()` with `callType: 'video'`
- Navigates to `VideoCall` screen on successful call initiation
- Video call button disabled for group chats

### 7. Updated `CallsScreen.tsx` ✅ NEW
- **Added video call button to contact picker sheet**
- Contact cards now have TWO buttons side-by-side:
  - 🎵 Audio call button (call icon)
  - 📹 Video call button (videocam icon)
- Renamed `handleSelectContact` → `handleSelectAudioContact`
- Added new `handleSelectVideoContact` function
- Updated `ContactPickerSheet` to accept both `onSelectAudio` and `onSelectVideo` callbacks
- Updated `handleCallBack` to use the same call type as the original call (audio/video)
- Call history now properly calls back with video if original was video

## 📋 TODO - Incoming Call Handling

Need to update IncomingCallOverlay:

1. Detect if incoming call is video or audio (check `call.type`)
2. Show video call UI with camera preview option
3. Answer with video when call type is 'video'
4. Request camera permission before answering video call
5. Pass `callType` to `answerCall()` method

## 📋 TODO - Permissions

Add camera permission handling:

1. Request camera permission before initiating video call
2. Show permission dialog if denied
3. Gracefully handle permission rejection
4. Show settings link if permission permanently denied

## 🎯 How to Use:

### From ChatScreen:
1. Open a chat with a contact
2. Tap the video camera icon (📹) in the top right
3. Video call will be initiated automatically
4. You'll see your own camera in the small PIP view
5. Once answered, remote video fills the screen
6. Use bottom controls to mute, disable camera, or hang up

### From CallsScreen:
1. Tap the + button to open contact picker
2. Each contact has TWO call buttons:
   - Left button (🎵) = Audio call
   - Right button (📹) = Video call
3. Tap the video button to start a video call
4. Or tap a contact in call history to call back with the same type

## 📁 Files Modified:

- ✏️ `src/hooks/useWebRTC.ts` - Video stream support
- ✏️ `src/hooks/useOutgoingCall.ts` - Video call type parameter
- ✏️ `src/hooks/useIncomingCallAnswer.ts` - Video call type parameter
- ⭐ `src/screens/VideoCallScreen.tsx` - NEW VIDEO CALL UI
- ✏️ `src/screens/ChatScreen.tsx` - Wired up existing video call button
- ✏️ `src/screens/CallsScreen.tsx` - **Added video call button to contact picker**
- ✏️ `src/types/index.ts` - Navigation types

## 🧪 Testing Checklist:

- [ ] Camera permission requested correctly
- [ ] Video call initiates from ChatScreen video button
- [ ] Video call initiates from CallsScreen contact picker video button
- [ ] Audio call still works from CallsScreen contact picker audio button
- [ ] Local video shows in PIP view
- [ ] Remote video shows full screen when connected
- [ ] Mute button works
- [ ] Camera toggle works
- [ ] Hang up works and cleans up properly
- [ ] Call ends properly on both devices
- [ ] Video call shows in call history
- [ ] Call back from history uses correct type (audio/video)
- [ ] Can answer incoming video call

## 🚀 Build & Test:

```bash
npm run android:emulator  # Emulator
npm run android:phone      # Physical device
```

Note: Video calling requires camera access. Emulators have limited camera support. Test on physical devices for best results.

