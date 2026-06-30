# Implementation Plan: Voice Notes

## Overview

This plan implements voice note recording, uploading, sending, and playback in the Chit-Chat app. It follows the existing hook-based architecture, adds two new custom hooks (`useVoiceRecorder`, `useVoicePlayer`), a storage utility, two UI components, and integrates them into the existing `ChatScreen` and `ChatsScreen`. The implementation uses `expo-av` for audio, Firebase Storage for file hosting, and the existing Firestore batch-write pattern for message creation.

## Tasks

- [x] 1. Set up dependencies and configuration
  - [x] 1.1 Install expo-av and configure app.json
    - Add `expo-av` to project dependencies
    - Add `expo-av` plugin to `app.json` plugins array
    - Add `android.permission.RECORD_AUDIO` to Android permissions in `app.json`
    - Add `NSMicrophoneUsageDescription` to iOS infoPlist in `app.json`
    - _Requirements: 2.1, 1.1_

  - [x] 1.2 Export Firebase Storage instance from firebase config
    - Import `getStorage` from `firebase/storage` in `src/config/firebase.ts`
    - Export the storage instance for use in the upload utility
    - _Requirements: 3.1_

  - [x] 1.3 Update FireMessage interface and types
    - Add `duration: number | null` field to `FireMessage` interface in `src/hooks/useMessages.ts`
    - Map `duration` from Firestore document data in the `onSnapshot` callback
    - Ensure existing text/image messages default `duration` to `null`
    - _Requirements: 4.1, 4.2_

- [x] 2. Implement voice note upload utility
  - [x] 2.1 Create `src/utils/voiceNoteStorage.ts`
    - Implement `uploadVoiceNote(uri, chatId, messageId, onProgress)` function
    - Read file as blob using `fetch(uri)` then `response.blob()`
    - Check file size against 10 MB limit, throw `RECORDING_TOO_LARGE` if exceeded
    - Upload using `uploadBytesResumable` to path `voiceNotes/{chatId}/{messageId}.m4a` with `contentType: 'audio/mp4'`
    - Implement 30-second timeout that cancels upload and rejects with `UPLOAD_TIMEOUT`
    - Report progress via `onProgress` callback with `bytesTransferred`, `totalBytes`, `percentage`
    - Return `{ downloadUrl, storagePath }` on success
    - Export `UploadProgress` and `UploadResult` interfaces
    - _Requirements: 3.1, 3.2, 3.4, 3.5_

  - [x] 2.2 Write unit tests for voiceNoteStorage
    - Test file size validation rejects files over 10 MB
    - Test timeout handling after 30 seconds
    - Test progress callback is invoked with correct percentage values
    - _Requirements: 3.4, 3.5_

- [x] 3. Implement voice recorder hook
  - [x] 3.1 Create `src/hooks/useVoiceRecorder.ts`
    - Define `RecordingState` interface with status, durationMs, metering, isWarning, permissionDenied, permissionDeniedPermanently fields
    - Define `RecordingResult` interface with uri, durationMs, fileSize fields
    - Implement `startRecording()`: check/request microphone permission via `Audio.requestPermissionsAsync()`, configure audio mode for recording, create recording with `Audio.Recording.createAsync(RecordingOptionsPresets.HIGH_QUALITY)`
    - Implement `stopRecording()`: stop and unload recording, check minimum 1000ms duration (return null if too short), return RecordingResult with file URI and duration
    - Implement `cancelRecording()`: stop and unload recording, delete local file
    - Set `setProgressUpdateInterval(1000)` for 1-second timer updates
    - Use `onRecordingStatusUpdate` to update durationMs and metering values
    - Auto-stop recording at 120,000ms via duration check in status callback
    - Set `isWarning: true` when duration reaches 110,000ms
    - Handle permission states: not determined, denied, denied permanently (using `canAskAgain`)
    - Ignore new press if already recording (Requirement 1.7)
    - Clean up recording on unmount
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.7, 2.1, 2.2, 2.3, 2.4, 2.5, 8.1, 8.2_

  - [x] 3.2 Write unit tests for useVoiceRecorder
    - Test that recording shorter than 1 second returns null
    - Test permission denied state is set correctly
    - Test auto-stop at 120 seconds
    - Test warning state at 110 seconds
    - _Requirements: 1.4, 2.3, 8.1, 8.2_

- [x] 4. Implement voice player hook
  - [x] 4.1 Create `src/hooks/useVoicePlayer.ts`
    - Define `PlaybackState` interface with activeMessageId, status, positionMs, durationMs, error fields
    - Implement `play(voiceUrl, messageId, durationMs)`: stop any active sound, configure audio mode with ducking, create sound from URL, begin playback
    - Implement `pause()`: pause current sound, retain position
    - Implement `resume()`: resume from paused position
    - Implement `stop()`: stop playback, unload sound, reset state
    - Configure audio mode: `playsInSilentModeIOS: true`, `staysActiveInBackground: false`, `interruptionModeIOS: DuckOthers`, `shouldDuckAndroid: true`
    - Handle `onPlaybackStatusUpdate`: update positionMs for waveform progress, detect `didJustFinish` to reset position and show play button
    - Single-active-player: maintain one `Audio.Sound` ref, stop previous before playing new
    - Handle loading state with 15-second timeout for network errors
    - Handle audio interruption (pause and retain position)
    - Clean up sound on unmount (unload sound, reset audio mode)
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 6.1, 6.2, 6.3, 6.4, 6.5_

  - [x] 4.2 Write unit tests for useVoicePlayer
    - Test single-active-player stops previous when new one starts
    - Test playback reset on didJustFinish
    - Test pause retains position
    - Test cleanup on unmount
    - _Requirements: 6.2, 5.4, 5.5, 6.3_

- [x] 5. Checkpoint - Core hooks complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Implement sendVoiceMessage in useChatActions
  - [x] 6.1 Add `sendVoiceMessage` function to `src/hooks/useChatActions.ts`
    - Accept `chatId`, `senderId`, `voiceUrl`, `durationMs` parameters
    - Fetch chat document to get member list
    - Use `writeBatch` for atomic operation
    - Create message document with: `type: 'voice'`, `voiceUrl`, `duration` (ms), `text: null`, `imageUrl: null`, `senderId`, `timestamp: serverTimestamp()`, `readBy: [senderId]`
    - Update chat document `lastMessage` with `text: '[Voice Note]'`, `senderId`, `timestamp: serverTimestamp()`
    - Increment `unreadCounts` for all other members
    - Return `{ success: boolean, messageId: string }`
    - _Requirements: 4.1, 4.2, 4.3_

  - [x] 6.2 Write unit tests for sendVoiceMessage
    - Test message document is created with correct voice fields
    - Test lastMessage text is set to "[Voice Note]"
    - Test unread counts are incremented for other members
    - _Requirements: 4.1, 4.2, 4.3_

- [x] 7. Implement VoiceRecordingOverlay component
  - [x] 7.1 Create `src/components/VoiceRecordingOverlay.tsx`
    - Accept props: `durationMs`, `isWarning`, `onCancel`
    - Display pulsing red dot animation during recording
    - Display elapsed time formatted as MM:SS, updated via durationMs prop
    - Display "Slide to cancel" hint with animated chevron icon
    - When `isWarning` is true (≥110s): change background/text to warning color (orange/red)
    - When duration reaches 120s: display "Maximum duration reached" brief notification
    - Style to overlay the input bar area during recording
    - Use existing theme constants (COLORS, GLASS, RADIUS) for consistency
    - _Requirements: 1.2, 1.6, 8.2, 8.3_

- [x] 8. Implement VoiceMessageBubble component
  - [x] 8.1 Create `src/components/VoiceMessageBubble.tsx`
    - Accept props: `messageId`, `voiceUrl`, `durationMs`, `isOutgoing`, `playerState`, `onPlay`, `onPause`
    - Render play/pause button (32x32 circular)
    - Render waveform bars (20 bars with deterministic heights seeded from messageId)
    - Animate progress fill left-to-right based on `positionMs / durationMs` ratio
    - Display remaining time (durationMs - positionMs) during playback in MM:SS format
    - Display total duration when idle in MM:SS format
    - Show loading spinner when `playerState.status === 'loading'`
    - Show error state with retry button and "Voice note unavailable" text when `playerState.status === 'error'`
    - Style outgoing bubble with glass/white style, incoming with gradient (matching existing bubble patterns)
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 4.4_

- [x] 9. Integrate recording into ChatScreen
  - [x] 9.1 Add PanResponder and recording flow to `src/screens/ChatScreen.tsx`
    - Import and use `useVoiceRecorder` hook
    - Replace the mic button `TouchableOpacity` with a `PanResponder`-enabled `View`
    - On `onPanResponderGrant` (long-press start): call `startRecording()`
    - On `onPanResponderMove`: check if gesture moved ≥50dp from center, call `cancelRecording()` if threshold exceeded
    - On `onPanResponderRelease`: call `stopRecording()`
    - Show `VoiceRecordingOverlay` when recording state is 'recording'
    - After successful `stopRecording()`: generate messageId via `doc(collection(...)).id`, call `uploadVoiceNote()`, track upload progress in local state, call `sendVoiceMessage()` on upload success
    - Handle upload failure: show retry option, allow up to 3 retries
    - Handle permission denied: show informational message for 3 seconds
    - Handle permanently denied: show button to open device settings via `Linking.openSettings()`
    - Hide text input area and show recording overlay during active recording
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 2.1, 2.2, 2.3, 2.4, 2.5, 3.2, 3.4, 3.6, 4.5_

- [x] 10. Integrate playback into ChatScreen
  - [x] 10.1 Add voice playback to message rendering in `src/screens/ChatScreen.tsx`
    - Import and use `useVoicePlayer` hook
    - Replace the existing placeholder voice rendering in `renderMessage` with `VoiceMessageBubble` component
    - Pass player state and handlers (`onPlay`, `onPause`) to each VoiceMessageBubble
    - Call `player.stop()` in `useEffect` cleanup when component unmounts or navigates away
    - Ensure only one voice note plays at a time across all messages
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.7, 6.2, 6.3_

- [x] 11. Update ChatsScreen voice note preview
  - [x] 11.1 Update last message preview in `src/screens/ChatsScreen.tsx`
    - Detect when `lastMessage.text` is `"[Voice Note]"` in the chat preview
    - Display a microphone icon (`Ionicons` `mic` icon) followed by "Voice Note" text
    - For group chats: prepend sender's name before the mic icon when sent by another member
    - For own messages: prepend "You:" before the mic icon
    - Maintain existing timestamp format logic
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

- [x] 12. Final checkpoint - Full integration complete
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- The design has no Correctness Properties section, so no property-based tests are included
- Unit tests validate specific examples and edge cases
- The implementation uses TypeScript throughout, consistent with the existing codebase
- `expo-av` is used per the design decision (stable in SDK 54+)

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3"] },
    { "id": 1, "tasks": ["2.1", "3.1", "4.1"] },
    { "id": 2, "tasks": ["2.2", "3.2", "4.2", "6.1"] },
    { "id": 3, "tasks": ["6.2", "7.1", "8.1"] },
    { "id": 4, "tasks": ["9.1", "10.1"] },
    { "id": 5, "tasks": ["11.1"] }
  ]
}
```
