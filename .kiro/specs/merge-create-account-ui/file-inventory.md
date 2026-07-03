# File Inventory and Categorization

## Overview

This document provides a comprehensive inventory of all files from both branches and categorizes them according to merge strategy requirements (1.1, 1.9, 1.7).

**Branches Analyzed:**
- Frontend-FeaturesMJ: 137 files
- create-account: 56 files

---

## Category Definitions

### 1. PRESERVE-ENTIRELY
Files that exist in Frontend-FeaturesMJ but NOT in create-account, OR files that contain critical functionality that must not be touched during the merge.

**Rationale:** These files contain Firebase implementation, hooks, validation utilities, WebRTC functionality, test files, and spec documentation that must be preserved completely (Requirements 1.1, 1.7).

### 2. UPDATE-STYLING
Files that exist in both branches and need visual styling updates while preserving all functional code.

**Rationale:** These are screen components and UI files that need blue-tinted glassmorphism styling applied while maintaining Firebase integration and business logic (Requirements 1.1, 1.2, 1.9).

### 3. TAKE-NEW
Files that exist ONLY in create-account branch and should be integrated into Frontend-FeaturesMJ.

**Rationale:** These are new settings screens and components that add functionality without conflicting with existing features (Requirement 1.8).

### 4. MERGE-CONFIG
Configuration files that require careful manual merging to preserve dependencies and settings.

**Rationale:** Package.json and app.json need dependency preservation and careful configuration merging (Requirement 1.11).

---

## 1. PRESERVE-ENTIRELY (65 files)

### Firebase Configuration (2 files)
- `src/config/firebase.ts` - Firebase initialization and configuration
- `src/config/storage.ts` - Firebase Storage configuration

### Custom Hooks (18 files)
- `src/hooks/useAudioRouting.ts` - Audio routing for calls
- `src/hooks/useAuth.ts` - Firebase authentication hook
- `src/hooks/useCallHistory.ts` - Call history management
- `src/hooks/useChatActions.ts` - Chat operations (delete, archive, etc.)
- `src/hooks/useChats.ts` - Chat list and real-time updates
- `src/hooks/useContacts.ts` - Contact management
- `src/hooks/useIncomingCallAnswer.ts` - Incoming call handling
- `src/hooks/useIncomingCalls.ts` - Incoming call detection
- `src/hooks/useMessages.ts` - Message sending/receiving
- `src/hooks/useOutgoingCall.ts` - Outgoing call management
- `src/hooks/useRegistration.ts` - User registration flow
- `src/hooks/useVoicePlayer.ts` - Voice note playback
- `src/hooks/useVoiceRecorder.ts` - Voice note recording
- `src/hooks/useWebRTC.ts` - WebRTC peer connections
- `src/hooks/__tests__/parentHooks.preservation.test.ts`
- `src/hooks/__tests__/useChatActions.test.ts`
- `src/hooks/__tests__/useRegistration.test.ts`
- `src/hooks/__tests__/useVoicePlayer.test.ts`
- `src/hooks/__tests__/useVoiceRecorder.test.ts`
- `src/hooks/__tests__/useWebRTC.bugCondition.test.ts`
- `src/hooks/__tests__/useWebRTC.preservation.test.ts`
- `src/hooks/__tests__/webrtcSharedContext.bugExploration.test.ts`

### Utilities (9 files)
- `src/utils/avatarUtils.ts` - Avatar validation and processing
- `src/utils/phoneUtils.ts` - Phone number utilities
- `src/utils/resolveDisplayName.ts` - Display name resolution
- `src/utils/validationUtils.ts` - Username, phone, image validation
- `src/utils/voiceNoteStorage.ts` - Voice note storage management
- `src/utils/__tests__/avatarUtils.property.test.ts`
- `src/utils/__tests__/avatarUtils.test.ts`
- `src/utils/__tests__/validationUtils.property.test.ts`
- `src/utils/__tests__/voiceNoteStorage.test.ts`

### Components (7 files)
- `src/components/AvatarPreview.tsx` - Avatar preview with validation
- `src/components/FileMessageBubble.tsx` - File message display
- `src/components/IncomingCallManager.tsx` - Incoming call management
- `src/components/IncomingCallOverlay.tsx` - Incoming call UI overlay
- `src/components/VoiceMessageBubble.tsx` - Voice message display
- `src/components/VoiceRecordingOverlay.tsx` - Voice recording UI
- `src/components/__tests__/AvatarPreview.test.tsx`

### Services (1 file)
- `src/services/signalingService.ts` - WebRTC signaling

### Context Providers (1 file)
- `src/context/CallContext.tsx` - Call state management

### Types (1 file)
- `src/types/call.ts` - Call-related TypeScript types

### Navigation Tests (1 file)
- `src/navigation/__tests__/AppNavigator.test.tsx`

### Spec Files (.kiro/specs/) (24 files)
- `.kiro/specs/move-webrtc-to-callcontext/.config.kiro`
- `.kiro/specs/move-webrtc-to-callcontext/requirements.md`
- `.kiro/specs/parent-hook-stream-propagation-fix/.config.kiro`
- `.kiro/specs/parent-hook-stream-propagation-fix/TASK_3.4_VERIFICATION.md`
- `.kiro/specs/parent-hook-stream-propagation-fix/bugfix.md`
- `.kiro/specs/parent-hook-stream-propagation-fix/design.md`
- `.kiro/specs/parent-hook-stream-propagation-fix/tasks.md`
- `.kiro/specs/phone-otp-auth-contacts-messaging/.config.kiro`
- `.kiro/specs/phone-otp-auth-contacts-messaging/design.md`
- `.kiro/specs/phone-otp-auth-contacts-messaging/requirements.md`
- `.kiro/specs/phone-otp-auth-contacts-messaging/tasks.md`
- `.kiro/specs/video-call-camera-feed-fix/.config.kiro`
- `.kiro/specs/video-call-camera-feed-fix/bugfix.md`
- `.kiro/specs/video-call-camera-feed-fix/design.md`
- `.kiro/specs/video-call-camera-feed-fix/tasks.md`
- `.kiro/specs/voice-notes/.config.kiro`
- `.kiro/specs/voice-notes/design.md`
- `.kiro/specs/voice-notes/requirements.md`
- `.kiro/specs/voice-notes/tasks.md`
- `.kiro/specs/webrtc-shared-context-fix/.config.kiro`
- `.kiro/specs/webrtc-shared-context-fix/bug-condition-test-results.md`
- `.kiro/specs/webrtc-shared-context-fix/bugfix.md`
- `.kiro/specs/webrtc-shared-context-fix/design.md`
- `.kiro/specs/webrtc-shared-context-fix/tasks.md`

### Documentation Files (7 files)
- `FIREBASE_PHONE_AUTH_SETUP.md`
- `MEDIA_SHARING_IMPLEMENTATION.md`
- `ROOT_CAUSE_DIAGNOSIS.md`
- `VIDEO_CALLING_IMPLEMENTATION.md`
- `VIDEO_CALL_FIX_REQUIRED.md`
- `VOICE_CALL_IMPLEMENTATION_PLAN.md`
- `jest.config.ts`

### Firebase & Build Config (3 files)
- `.firebaserc` - Firebase project configuration
- `firebase.json` - Firebase hosting/functions config
- `eas.json` - Expo Application Services config
- `GoogleService-Info.plist` - iOS Firebase config
- `google-services.json` - Android Firebase config

### Additional Screen (1 file)
- `src/screens/CloudBackupScreen.tsx` - Only in Frontend-FeaturesMJ

---

## 2. UPDATE-STYLING (15 files)

These files exist in both branches and require UI styling updates while preserving functional code.

### Authentication Screens (2 files)
**Requirement 1.3, 1.4**
- `src/screens/SignInScreen.tsx`
  - **Preserve:** Firebase authentication, OTP verification, biometric auth
  - **Update:** Card styling, input fields, button styling, blue-tinted glassmorphism
  
- `src/screens/CreateAccountScreen.tsx`
  - **Preserve:** useRegistration hook, validation (validateUsername, validatePhone, validateImage), profile creation, error handling
  - **Update:** Card styling, input styling, avatar styling, icon tiles, OTP boxes

### Chat Screens (2 files)
**Requirement 1.5**
- `src/screens/ChatsScreen.tsx`
  - **Preserve:** useChats hook, real-time chat updates, navigation
  - **Update:** Chat list card styling, search bar styling, glassmorphism effects
  
- `src/screens/ChatScreen.tsx`
  - **Preserve:** useMessages hook, useChatActions hook, message sending/receiving, voice note functionality
  - **Update:** Message bubble styling, input field styling, attachment buttons

### Call Screens (3 files)
**Requirement 1.6**
- `src/screens/CallsScreen.tsx`
  - **Preserve:** Call history hook, navigation to call screens
  - **Update:** Call list styling, tab styling, glassmorphism effects
  
- `src/screens/AudioCallScreen.tsx`
  - **Preserve:** useWebRTC hook, signaling, audio stream handling
  - **Update:** Control button styling, user info card styling
  
- `src/screens/VideoCallScreen.tsx`
  - **Preserve:** useWebRTC hook, camera/mic streams, video rendering
  - **Update:** Video container styling, control buttons, overlay styling

### Profile & Social Screens (2 files)
**Requirement 1.7**
- `src/screens/ContactsScreen.tsx`
  - **Preserve:** useContacts hook, contact fetching
  - **Update:** Contact list styling, search bar, glassmorphism
  
- `src/screens/ProfileScreen.tsx`
  - **Preserve:** Profile editing functionality, Firebase storage integration
  - **Update:** Profile card styling, button styling, input fields

### Settings & Utility Screens (4 files)
**Requirement 1.7**
- `src/screens/SettingsScreen.tsx`
  - **Preserve:** Navigation to settings screens, existing settings options
  - **Update:** Settings list styling, cards, glassmorphism, add navigation to new settings screens
  
- `src/screens/AppearanceScreen.tsx`
  - **Preserve:** Theme switching functionality
  - **Update:** Option cards, radio buttons, glassmorphism
  
- `src/screens/CalendarScreen.tsx`
  - **Update:** Calendar UI styling, glassmorphism
  
- `src/screens/NotesScreen.tsx`
  - **Update:** Notes list styling, glassmorphism

### Status & Splash Screens (2 files)
- `src/screens/StatusScreen.tsx`
  - **Update:** Status list styling, glassmorphism
  
- `src/screens/SplashScreen.tsx`
  - **Update:** Splash screen styling (if needed)

---

## 3. TAKE-NEW (6 files)

These files exist ONLY in create-account and should be integrated.

### New Settings Screens (6 files)
**Requirement 1.8**
- `src/screens/AccountSettingsScreen.tsx` - Account management UI
- `src/screens/ChangeNumberScreen.tsx` - Phone number change flow
- `src/screens/LinkedDevicesScreen.tsx` - Multi-device management
- `src/screens/NotificationSettingsScreen.tsx` - Notification preferences
- `src/screens/NotificationsScreen.tsx` - Notification list view
- `src/screens/PrivacySettingsScreen.tsx` - Privacy controls

**Action Required:**
1. Copy these files from create-account branch
2. Add navigation routes in AppNavigator.tsx
3. Update RootStackParamList types
4. Connect to Firebase if functionality requires it
5. Ensure blue-tinted glassmorphism styling is applied

### New Component (1 file)
**Requirement 1.9**
- `src/components/ToastNotification.tsx` - Toast notification component

**Action Required:**
1. Copy from create-account branch
2. Verify styling matches glassmorphism design
3. Make available for use across all screens

### New Context Providers (4 files - EVALUATE)
**Requirement 1.10**
- `src/context/BlockedContext.tsx`
- `src/context/ContactsContext.tsx`
- `src/context/MessagesContext.tsx`
- `src/context/NotificationContext.tsx`

**Action Required:**
1. Evaluate each context provider
2. Check for conflicts with existing hooks (useContacts, useMessages, etc.)
3. If non-conflicting and needed for new settings screens, integrate
4. If conflicting with existing hooks, PRESERVE existing hooks
5. Connect to Firebase if functionality requires it

### New Utilities (1 file - EVALUATE)
- `src/utils/notifications.ts`

**Action Required:**
1. Review functionality
2. Integrate if it adds value and doesn't conflict

---

## 4. MERGE-CONFIG (2 files)

**Requirement 1.11**

### Configuration Files
- `package.json`
  - **Preserve:** Firebase dependencies, WebRTC dependencies, Expo dependencies
  - **Add:** New UI-related dependencies from create-account if beneficial
  - **Action:** Manual review and merge
  
- `app.json`
  - **Preserve:** Firebase configuration, native modules configuration
  - **Adopt:** UI-related config changes if they improve UX
  - **Action:** Manual review and merge

---

## 5. SHARED FILES (Identical or Minor Differences)

These files exist in both branches and likely have minimal or no differences:

### Root Files
- `.gitignore`
- `.claude/settings.json`
- `.vscode/settings.json`
- `AGENTS.md`
- `CLAUDE.md`
- `LICENSE`
- `index.ts`
- `tsconfig.json`
- `App.tsx`

### Assets
- `assets/android-icon-background.png`
- `assets/android-icon-foreground.png`
- `assets/android-icon-monochrome.png`
- `assets/chitchat-logo.png`
- `assets/favicon.png`
- `assets/icon.png`
- `assets/splash-icon.png`

### Data Files
- `src/data/countryCodes.ts`
- `src/data/mockData.ts`

### Context (Evaluate)
- `src/context/AuthContext.tsx` - Compare implementations
- `src/context/ThemeContext.tsx` - Compare implementations

### Navigation
- `src/navigation/AppNavigator.tsx`
  - **Preserve:** All existing routes
  - **Add:** Routes for new settings screens
  - **Update:** RootStackParamList type definitions

### Types
- `src/types/index.ts` - Merge type definitions
- `src/types/theme.ts` - Review theme constants

### Components Index
- `src/components/index.tsx` - Merge exports

---

## Screens Requiring UI Updates

### Authentication Screens (Priority: High)
1. **SignInScreen.tsx** - Phone auth, OTP, biometric
2. **CreateAccountScreen.tsx** - Registration flow with validation

### Main Navigation Screens (Priority: High)
3. **ChatsScreen.tsx** - Chat list with real-time updates
4. **ChatScreen.tsx** - Conversation view with messages
5. **CallsScreen.tsx** - Call history and tabs
6. **StatusScreen.tsx** - Status updates view

### Call Screens (Priority: High)
7. **AudioCallScreen.tsx** - Voice call interface
8. **VideoCallScreen.tsx** - Video call interface

### Secondary Screens (Priority: Medium)
9. **ContactsScreen.tsx** - Contact list
10. **ProfileScreen.tsx** - User profile editing
11. **SettingsScreen.tsx** - Settings menu
12. **AppearanceScreen.tsx** - Theme settings

### Utility Screens (Priority: Low)
13. **CalendarScreen.tsx** - Calendar view
14. **NotesScreen.tsx** - Notes view
15. **SplashScreen.tsx** - App splash screen
16. **CloudBackupScreen.tsx** - Cloud backup (Frontend-FeaturesMJ only)

---

## Files to Preserve (Critical)

### Hooks (Must NOT be modified)
All 14 custom hooks in `src/hooks/` directory:
- useAuth, useRegistration, useChats, useMessages, useChatActions
- useContacts, useWebRTC, useVoiceRecorder, useVoicePlayer
- useCallHistory, useIncomingCalls, useIncomingCallAnswer, useOutgoingCall
- useAudioRouting

### Validation (Must NOT be modified)
- `src/utils/validationUtils.ts`
- `src/utils/avatarUtils.ts`

### Firebase Config (Must NOT be modified)
- `src/config/firebase.ts`
- `src/config/storage.ts`
- `.firebaserc`
- `firebase.json`
- `GoogleService-Info.plist`
- `google-services.json`

### Spec Files (Must NOT be modified)
All 24 files in `.kiro/specs/` directories

### WebRTC Implementation (Must NOT be modified)
- `src/hooks/useWebRTC.ts`
- `src/services/signalingService.ts`
- `src/context/CallContext.tsx`
- All call-related hooks

---

## Summary Statistics

| Category | File Count | Action |
|----------|-----------|---------|
| PRESERVE-ENTIRELY | 65 | Keep as-is from Frontend-FeaturesMJ |
| UPDATE-STYLING | 15 | Apply styling, preserve functionality |
| TAKE-NEW | 11 | Copy from create-account |
| MERGE-CONFIG | 2 | Manual merge |
| SHARED FILES | 20+ | Compare and handle appropriately |
| **Total Unique Files** | **~113** | - |

---

## Next Steps

1. **Phase 1:** Backup current Frontend-FeaturesMJ branch
2. **Phase 2:** Begin systematic screen updates (15 screens)
3. **Phase 3:** Integrate new settings screens (6 screens)
4. **Phase 4:** Integrate ToastNotification component
5. **Phase 5:** Evaluate and integrate context providers (if needed)
6. **Phase 6:** Merge configuration files (package.json, app.json)
7. **Phase 7:** Update navigation for new screens
8. **Phase 8:** Verification (TypeScript, builds, functionality)
9. **Phase 9:** Testing (all critical flows)
10. **Phase 10:** Final review and completion

---

## Validation Requirements

- **Requirement 1.1:** All 65 PRESERVE-ENTIRELY files remain unchanged ✓
- **Requirement 1.7:** All hooks, validation utilities, Firebase config preserved ✓
- **Requirement 1.9:** 15 screens identified for styling updates ✓
- **Requirement 1.8:** 6 new settings screens identified for integration ✓
- **Requirement 1.11:** Configuration files identified for manual merge ✓

---

*Document Generated: Task 2 - File inventory and categorization*
*Spec: merge-create-account-ui*
*Requirements Validated: 1.1, 1.9, 1.7*
