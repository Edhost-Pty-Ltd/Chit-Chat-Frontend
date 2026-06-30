# Requirements Document

## Introduction

Voice Notes enables users to record, send, receive, and play back audio messages within existing chat conversations in the Chit-Chat app. The feature integrates with the existing messaging infrastructure (Firestore message subcollections) and adds audio recording via Expo AV, file upload via Firebase Storage, and audio playback with visual waveform feedback.

## Glossary

- **Voice_Note**: An audio message recorded by a user and sent within a chat conversation, stored as an audio file in Firebase Storage with metadata in Firestore.
- **Recorder**: The component responsible for capturing audio input from the device microphone using Expo AV.
- **Player**: The component responsible for loading and playing back a Voice_Note audio file with playback controls and progress indication.
- **Chat_Screen**: The existing screen where users view and send messages within a conversation.
- **Firebase_Storage**: The Firebase Cloud Storage service used to store Voice_Note audio files.
- **Message_Document**: A Firestore document in the `chats/{chatId}/messages` subcollection representing a single message.
- **Recording_Indicator**: A UI element displayed during active audio recording showing elapsed duration and a visual animation.
- **Waveform_Display**: A visual representation of audio amplitude shown during playback to indicate audio content and progress.

## Requirements

### Requirement 1: Record a Voice Note

**User Story:** As a user, I want to record a voice note by pressing and holding the microphone button, so that I can send audio messages to my contacts without typing.

#### Acceptance Criteria

1. WHEN the user presses and holds the microphone button, THE Recorder SHALL begin capturing audio from the device microphone.
2. WHILE the Recorder is actively recording, THE Chat_Screen SHALL display the Recording_Indicator showing elapsed time in MM:SS format, updated every 1 second.
3. WHEN the user releases the microphone button after recording for at least 1 second, THE Recorder SHALL stop recording and produce an audio file.
4. IF the user releases the microphone button before 1 second has elapsed, THEN THE Recorder SHALL discard the recording and return the Chat_Screen to its pre-recording state with no message sent.
5. WHEN the user slides their finger at least 50 device-independent pixels away from the center of the microphone button while recording, THE Recorder SHALL cancel the recording, discard the audio data, and return the Chat_Screen to its pre-recording state.
6. WHILE the Recorder is actively recording, THE Chat_Screen SHALL display a cancel hint indicating the user can slide to cancel.
7. IF the Recorder is already actively recording when the user presses the microphone button, THEN THE Recorder SHALL ignore the new press and continue the current recording.

### Requirement 2: Request Microphone Permission

**User Story:** As a user, I want the app to request microphone access before recording, so that I am aware of and can control the app's access to my microphone.

#### Acceptance Criteria

1. WHEN the user attempts to record a Voice_Note and microphone permission has not yet been determined, THE Recorder SHALL request microphone permission from the operating system before recording begins.
2. WHEN the user grants microphone permission, THE Recorder SHALL proceed to begin recording within 1 second of permission being granted.
3. IF the user denies microphone permission at the system prompt, THEN THE Chat_Screen SHALL display a non-blocking informational message explaining that microphone access is required for voice notes, visible for at least 3 seconds.
4. IF the user attempts to record a Voice_Note and microphone permission was previously denied, THEN THE Chat_Screen SHALL display a message with an actionable button that opens the device application settings where the user can enable microphone permission.
5. IF microphone permission is already granted when the user attempts to record a Voice_Note, THEN THE Recorder SHALL begin recording without displaying a permission prompt.

### Requirement 3: Upload Voice Note to Storage

**User Story:** As a user, I want my recorded voice notes to be uploaded to cloud storage, so that recipients can download and listen to them.

#### Acceptance Criteria

1. WHEN a recording is completed successfully, THE Recorder SHALL upload the audio file to Firebase_Storage at the path `voiceNotes/{chatId}/{messageId}.m4a`.
2. WHILE the audio file is uploading, THE Chat_Screen SHALL display the Voice_Note message bubble in a visually distinct pending state with a progress indicator showing upload percentage from 0% to 100%.
3. WHEN the upload completes successfully, THE Recorder SHALL store the download URL in the Message_Document `voiceUrl` field.
4. IF the upload fails due to a network error or exceeds 30 seconds without completing, THEN THE Chat_Screen SHALL display a retry option on the failed Voice_Note message and allow the user to retry up to 3 times.
5. THE Recorder SHALL encode audio in AAC format and reject recordings that exceed 10 MB by discarding the file and displaying an error message indicating the recording is too long.
6. IF the upload fails due to a non-network error (such as storage quota exceeded or authentication expiry), THEN THE Chat_Screen SHALL display an error message indicating the upload could not be completed and shall not offer a retry option.

### Requirement 4: Send a Voice Note Message

**User Story:** As a user, I want my voice note to appear in the chat as a sent message, so that my contact can see and play it.

#### Acceptance Criteria

1. WHEN a Voice_Note is recorded and uploaded successfully, THE Chat_Screen SHALL create a Message_Document with type set to "voice", voiceUrl set to the download URL, duration stored in milliseconds (range: 1000 to 120000), text set to null, and imageUrl set to null.
2. THE Message_Document SHALL include senderId set to the current user's ID, timestamp set to the server-generated timestamp, and readBy initialized as an array containing only the sender's ID.
3. WHEN a Voice_Note message is sent, THE Chat_Screen SHALL update the parent chat document lastMessage field with text "[Voice Note]", senderId set to the current user's ID, the current server timestamp, and SHALL increment the unreadCounts value for each other chat member by 1.
4. WHEN a Voice_Note message is sent, THE Chat_Screen SHALL display the message in the sent bubble style with a Waveform_Display and a duration label formatted as MM:SS.
5. IF the Message_Document creation or chat document update fails, THEN THE Chat_Screen SHALL display an error indication on the Voice_Note message and SHALL not discard the recorded audio.

### Requirement 5: Play Back a Voice Note

**User Story:** As a user, I want to tap a play button on a received voice note to listen to it, so that I can hear audio messages sent by my contacts.

#### Acceptance Criteria

1. WHEN the user taps the play button on a Voice_Note message, THE Player SHALL display a loading indicator while the audio file is being fetched from the voiceUrl, and begin audio playback once loading completes.
2. WHILE the Player is playing a Voice_Note, THE Waveform_Display SHALL animate to show playback progress from left to right, with the filled portion representing the elapsed audio position.
3. WHILE the Player is playing a Voice_Note, THE Player SHALL display the remaining duration in MM:SS format, updating every second.
4. WHEN the user taps the pause button during playback, THE Player SHALL pause audio playback, retain the current position, and display a play button to allow resumption from that position.
5. WHEN audio playback reaches the end of the Voice_Note, THE Player SHALL stop playback, reset the playback position to the beginning, replace the pause button with a play button, and display the total duration in MM:SS format.
6. IF the audio file fails to load from the voiceUrl within 15 seconds, THEN THE Player SHALL display an error state with a retry button and a message indicating the voice note is unavailable.
7. WHILE the Player is idle and no playback is active, THE Player SHALL display a play button alongside the Waveform_Display in its default unfilled state and the total duration in MM:SS format.

### Requirement 6: Playback Controls and Audio Session

**User Story:** As a user, I want voice note playback to behave correctly with other audio on my device, so that my listening experience is predictable.

#### Acceptance Criteria

1. WHEN a Voice_Note begins playback, THE Player SHALL configure the audio session to mix with other audio apps and duck background audio volume.
2. WHEN a new Voice_Note is played while another is already playing, THE Player SHALL stop the previously playing Voice_Note, reset it to the beginning showing its total duration, and begin playback of the new Voice_Note.
3. WHEN the user navigates away from the Chat_Screen via back navigation, switches to another screen, or the app moves to the background during playback, THE Player SHALL stop playback and release the audio session.
4. THE Player SHALL route audio output to the currently active device output (device speaker, wired headphones, or Bluetooth audio device) as determined by the operating system.
5. IF the audio session is interrupted by an external event such as an incoming phone call or another app taking audio focus, THEN THE Player SHALL pause playback and retain the current position until the user resumes manually.

### Requirement 7: Voice Note Display in Chat List

**User Story:** As a user, I want to see a preview indicator when the last message in a chat is a voice note, so that I can identify voice messages from the chat list.

#### Acceptance Criteria

1. WHEN the most recent message in a chat is a Voice_Note, THE Chats_Screen SHALL display a microphone icon immediately followed by the text "Voice Note" as the last message preview in the same line where text message previews appear.
2. THE Chats_Screen SHALL display the timestamp of the Voice_Note message in the same position and format as text message timestamps (today: HH:MM, yesterday: "Yesterday", within 7 days: weekday name, older: DD/MM).
3. WHEN the most recent message in a group chat is a Voice_Note sent by another member, THE Chats_Screen SHALL display the sender's name followed by the microphone icon and "Voice Note" text in the last message preview.
4. IF the current user sent the most recent Voice_Note in a chat, THEN THE Chats_Screen SHALL display "You:" followed by the microphone icon and "Voice Note" text in the last message preview.

### Requirement 8: Voice Note Duration Limit

**User Story:** As a user, I want voice note recording to stop automatically at a maximum duration, so that excessively long recordings are prevented.

#### Acceptance Criteria

1. WHEN the recording duration reaches 120 seconds, THE Recorder SHALL automatically stop recording, produce the audio file, and initiate the upload process as defined in Requirement 3.
2. WHEN the recording duration reaches 110 seconds, THE Recording_Indicator SHALL change its visual appearance to a warning state that remains visible until recording stops, distinguishable from the normal recording state.
3. WHEN the Recorder automatically stops recording due to reaching the 120-second limit, THE Chat_Screen SHALL display a brief notification indicating that the maximum recording duration was reached.
