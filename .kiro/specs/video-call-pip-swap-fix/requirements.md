# Requirements Document

## Introduction

This document specifies the requirements for fixing the Picture-in-Picture (PiP) swap functionality in the VideoCallScreen component. The current implementation executes the tap animation but fails to swap the participant from the PiP tile to the main view. The fix ensures that tapping a PiP tile correctly swaps that participant to the main video view.

## Glossary

- **Video_Call_Screen**: The React component that renders the video call interface with main view and PiP tiles
- **PiP_Tile**: A Picture-in-Picture tile component displaying a participant's video feed or avatar in a thumbnail view
- **Main_View**: The full-screen video display area showing the primary participant
- **Participant**: A user in the video call, identified by a unique ID, contact information, and local/remote status
- **Swap_Operation**: The action of exchanging positions between a PiP tile participant and the main view participant
- **Participant_List**: The state array containing all participants in the video call, where index 0 is the main view participant
- **Tap_Animation**: The scale animation (0.88 → 1.0) that executes when a PiP tile is tapped
- **Swap_Callback**: The onTap callback function passed to PipTile that triggers the swap operation

## Requirements

### Requirement 1: PiP Tile Tap-to-Swap Interaction

**User Story:** As a video call participant, I want to tap any PiP tile to swap that participant to the main view, so that I can focus on specific participants during the call

#### Acceptance Criteria

1. WHEN a user taps a PiP_Tile, THE Video_Call_Screen SHALL execute the Tap_Animation
2. WHEN the Tap_Animation completes, THE Video_Call_Screen SHALL invoke the Swap_Callback with the participant ID
3. WHEN the Swap_Callback is invoked with a valid participant ID, THE Video_Call_Screen SHALL execute the Swap_Operation
4. THE Swap_Operation SHALL exchange the positions of the tapped participant and the Main_View participant in the Participant_List
5. THE Video_Call_Screen SHALL re-render with the swapped participant now displayed in the Main_View
6. THE Video_Call_Screen SHALL re-render with the previously main participant now displayed as a PiP_Tile

### Requirement 2: Swap Operation State Management

**User Story:** As a developer maintaining the codebase, I want the swap operation to correctly update the participants array state, so that the UI reflects the participant position changes

#### Acceptance Criteria

1. WHEN swapToMain function receives a participant ID, THE Video_Call_Screen SHALL locate the participant index in the Participant_List
2. IF the participant index is 0 or less, THEN THE Video_Call_Screen SHALL return the Participant_List unchanged
3. IF the participant index is greater than 0, THEN THE Video_Call_Screen SHALL create a new Participant_List with swapped positions
4. THE Video_Call_Screen SHALL swap the participant at index 0 with the participant at the found index
5. THE Video_Call_Screen SHALL update the participants state with the new Participant_List
6. THE React state update SHALL trigger a re-render of all affected components

### Requirement 3: Animation-Callback Coordination

**User Story:** As a user interacting with PiP tiles, I want the swap to occur after the tap animation completes, so that the interaction feels responsive and intentional

#### Acceptance Criteria

1. WHEN a user taps a PiP_Tile, THE PipTile component SHALL initiate the Tap_Animation sequence
2. THE Tap_Animation SHALL scale the tile to 0.88 within 80 milliseconds
3. THE Tap_Animation SHALL scale the tile back to 1.0 within 80 milliseconds after reaching 0.88
4. WHEN the Tap_Animation sequence completes, THE PipTile component SHALL invoke the Swap_Callback
5. THE Swap_Callback invocation SHALL occur exactly once per tap gesture
6. IF the Tap_Animation is interrupted, THEN THE Swap_Callback SHALL still be invoked when the animation completes or is cancelled

### Requirement 4: Callback Execution Verification

**User Story:** As a developer debugging the swap issue, I want to verify that the callback function is properly connected from PipTile to swapToMain, so that I can identify where the swap chain breaks

#### Acceptance Criteria

1. THE PipTile component SHALL receive an onTap callback function as a prop
2. THE onTap callback SHALL be passed to the Animated.sequence().start() method as the completion callback
3. THE Video_Call_Screen SHALL pass a callback invoking swapToMain(p.id) as the onTap prop to each PipTile
4. THE callback SHALL capture the correct participant ID from the rendering context
5. WHEN the callback executes, THE swapToMain function SHALL be invoked with the captured participant ID
6. THE participant ID passed to swapToMain SHALL match the id property of the tapped PiP_Tile's participant

### Requirement 5: Main View Display Update

**User Story:** As a video call participant, I want the main view to immediately show the newly swapped participant's video or avatar, so that I can confirm the swap was successful

#### Acceptance Criteria

1. WHEN the Participant_List is updated with swapped positions, THE Video_Call_Screen SHALL re-render the Main_View
2. THE Main_View SHALL display the video feed of the new main participant if they are local
3. THE Main_View SHALL display the avatar of the new main participant if they are remote
4. THE Video_Call_Screen SHALL update the main participant name display in the top bar
5. THE Video_Call_Screen SHALL update the camera controls availability based on whether the new main participant is local
6. IF the new main participant is local, THEN THE camera flip button SHALL become active

### Requirement 6: PiP Tiles Display Update

**User Story:** As a video call participant, I want the PiP tiles to update after a swap to show the previously main participant as a tile, so that I maintain awareness of all call participants

#### Acceptance Criteria

1. WHEN the Participant_List is updated with swapped positions, THE Video_Call_Screen SHALL re-render all PiP_Tiles
2. THE previous main participant SHALL appear as a PiP_Tile after the swap
3. THE tapped PiP_Tile SHALL no longer appear in the PiP tiles list
4. THE order of other PiP_Tiles SHALL remain unchanged relative to each other
5. EACH PiP_Tile SHALL display the correct participant avatar, name, and video feed after the swap
6. THE Video_Call_Screen SHALL maintain the correct participant count in the top bar status text

### Requirement 7: Error Handling for Invalid Swap Requests

**User Story:** As a developer, I want the system to handle edge cases gracefully, so that invalid swap requests do not cause crashes or undefined behavior

#### Acceptance Criteria

1. IF swapToMain receives a participant ID that does not exist in the Participant_List, THEN THE Video_Call_Screen SHALL return the Participant_List unchanged
2. IF swapToMain receives the ID of the participant already at index 0, THEN THE Video_Call_Screen SHALL return the Participant_List unchanged
3. IF swapToMain receives an undefined or null ID, THEN THE Video_Call_Screen SHALL return the Participant_List unchanged
4. IF a PiP_Tile is tapped multiple times rapidly, THEN THE Video_Call_Screen SHALL process each tap independently without race conditions
5. THE Video_Call_Screen SHALL not throw errors or warnings during any valid swap operation
6. THE Video_Call_Screen SHALL maintain state consistency even if the Swap_Operation is interrupted
