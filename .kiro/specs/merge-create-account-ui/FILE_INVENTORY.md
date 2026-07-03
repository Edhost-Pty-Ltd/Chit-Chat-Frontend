# File Inventory and Categorization

**Date Created:** 2025-01-XX
**Branches Analyzed:**
- Frontend-FeaturesMJ (base branch with full functionality)
- origin/create-account (source branch with UI styling)

---

## Executive Summary

**Total Files in Frontend-FeaturesMJ:** 119 files
**Total Files in create-account:** 52 files

### Category Distribution

1. **Preserve-Entirely:** 67 files (exist only in Frontend-FeaturesMJ or are functional code to keep)
2. **Update-Styling:** 17 files (screens/components requiring UI updates)
3. **Take-New:** 7 files (new components/screens from create-account)
4. **Merge-Config:** 3 files (configuration files requiring careful merging)
5. **Review-Context:** 4 files (new context providers to evaluate)

---

## 1. PRESERVE-ENTIRELY (67 files)

These files exist only in Frontend-FeaturesMJ or contain critical functionality that must be preserved completely.

### 1.1 Spec Files (.kiro/specs/) - 23 files
**Reason:** Documentation and feature specifications must be preserved

```
.kiro/specs/move-webrtc-to-callcontext/.config.kiro
.kiro/specs/move-webrtc-to-callcontext/requirements.md
.kiro/specs/parent-hook-stream-propagation-fix/.config.kiro
.kiro/specs/parent-hook-stream-propagation-fix/TASK_3.4_VERIFICATION.md
.kiro/specs/parent-hook-stream-propagation-fix/bugfix.md
.kiro/specs/parent-hook-stream-propagation-fix/design.md
.kiro/specs/parent-hook-stream-propagation-fix/tasks.md
.kiro/specs/phone-otp-auth-contacts-messaging/.config.kiro
.kiro/specs/phone-otp-auth-contacts-messaging/design.md
.kiro/specs/phone-otp-auth-contacts-messaging/requirements.md
.kiro/specs/phone-otp-auth-contacts-messaging/tasks.md
.kiro/specs/video-call-camera-feed-fix/.config.kiro
.kiro/specs/video-call-camera-feed-fix/bugfix.md
.kiro/specs/video-call-camera-feed-fix/design.md
.kiro/specs/video-call-camera-feed-fix/tasks.md
.kiro/specs/voice-notes/.config.kiro
.kiro/specs/voice-notes/design.md
.kiro/specs/voice-notes/requirements.md
.kiro/specs/voice-notes/tasks.md
.kiro/specs/webrtc-shared-context-fix/.config.kiro
.kiro/specs/webrtc-shared-context-fix/bug-condition-test-results.md
.kiro/specs/webrtc-shared-context-fix/bugfix.md
.kiro/specs/webrtc-shared-context-fix/design.md
.kiro/specs/webrtc-shared-context-fix/tasks.md
```

### 1.2 Firebase Configuration Files - 4 files
**Reason:** Critical Firebase integration must be preserved

```
.firebaserc
firebase.json
google-services.json
GoogleService-Info.plist
```

### 1.3 Custom Hooks - 16 files
**Reason:** Business logic for Firebase, WebRTC, messaging, contacts, authentication

```
src/hooks/useAudioRouting.ts
src/hooks/useAuth.ts
src/hooks/useCallHistory.ts
src/hooks/useChatActions.ts
src/hooks/useChats.ts
src/hooks/useContacts.ts
src/hooks/useIncomingCallAnswer.ts
src/hooks/useIncomingCalls.ts
src/hooks/useMessages.ts
src/hooks/useOutgoingCall.ts
src/hooks/useRegistration.ts
src/hooks/useVoicePlayer.ts
src/hooks/useVoiceRecorder.ts
src/hooks/useWebRTC.ts
src/hooks/__tests__/parentHooks.preservation.test.ts
src/hooks/__tests__/webrtcSharedContext.bugExploration.test.ts
```

### 1.4 Validation & Utilities - 5 files
**Reason:** Critical validation and utility functions

```
src/utils/validationUtils.ts
src/utils/avatarUtils.ts
src/utils/phoneUtils.ts
src/utils/resolveDisplayName.ts
src/utils/voiceNoteStorage.ts
```

### 1.5 Firebase Config - 2 files
**Reason:** Firebase initialization and storage configuration

```
src/config/firebase.ts
src/config/storage.ts
```

### 1.6 Call & WebRTC Components - 4 files
**Reason:** WebRTC functionality components

```
src/components/IncomingCallManager.tsx
src/components/IncomingCallOverlay.tsx
src/components/VoiceMessageBubble.tsx
src/components/VoiceRecordingOverlay.tsx
```

### 1.7 Context Providers (Existing) - 2 files
**Reason:** Essential context providers with Firebase integration

```
src/context/CallContext.tsx
```

### 1.8 Services - 1 file
**Reason:** WebRTC signaling service

```
src/services/signalingService.ts
```

### 1.9 Type Definitions - 1 file
**Reason:** Call-related types not in create-account

```
src/types/call.ts
```

### 1.10 Documentation Files - 8 files
**Reason:** Project documentation and implementation plans

```
FIREBASE_PHONE_AUTH_SETUP.md
MEDIA_SHARING_IMPLEMENTATION.md
ROOT_CAUSE_DIAGNOSIS.md
VIDEO_CALLING_IMPLEMENTATION.md
VIDEO_CALL_FIX_REQUIRED.md
VOICE_CALL_IMPLEMENTATION_PLAN.md
CLAUDE.md
AGENTS.md
```

### 1.11 Test Files - 14 files
**Reason:** Existing test suites must be preserved

```
src/components/__tests__/AvatarPreview.test.tsx
src/hooks/__tests__/useChatActions.test.ts
src/hooks/__tests__/useRegistration.test.ts
src/hooks/__tests__/useVoicePlayer.test.ts
src/hooks/__tests__/useVoiceRecorder.test.ts
src/hooks/__tests__/useWebRTC.bugCondition.test.ts
src/hooks/__tests__/useWebRTC.preservation.test.ts
src/navigation/__tests__/AppNavigator.test.tsx
src/utils/__tests__/avatarUtils.property.test.ts
src/utils/__tests__/avatarUtils.test.ts
src/utils/__tests__/validationUtils.property.test.ts
src/utils/__tests__/voiceNoteStorage.test.ts
jest.config.ts
```

### 1.12 Other Components - 2 files
**Reason:** Existing components with functionality

```
src/components/AvatarPreview.tsx
src/components/FileMessageBubble.tsx
```

### 1.13 EAS Configuration - 1 file
**Reason:** Build configuration

```
eas.json
```

---

## 2. UPDATE-STYLING (17 files)

These files exist in both branches. Apply blue-tinted glassmorphism styling from create-account while preserving all functionality from Frontend-FeaturesMJ.

### 2.1 Authentication Screens - 2 files
**Files:**
- `src/screens/CreateAccountScreen.tsx`
- `src/screens/SignInScreen.tsx`

**Styling Changes:**
- Card backgrounds: transparent with blue borders
- Input fields: `rgba(30,156,240,0.06)` backgrounds
- OTP boxes: blue tint when filled
- Avatar tiles: blue gradient instead of white
- Enhanced shadows with blue tint

**Preserve:**
- useRegistration hook integration
- useAuth hook integration
- Firebase authentication logic
- OTP verification
- Validation utilities (validateUsername, validatePhone, validateImage)
- Biometric authentication
- Error handling and retry logic

### 2.2 Chat Screens - 2 files
**Files:**
- `src/screens/ChatsScreen.tsx`
- `src/screens/ChatScreen.tsx`

**Styling Changes:**
- Chat item cards: blue-tinted glassmorphism
- Input fields: blue-tinted backgrounds
- Message bubbles: enhanced styling
- Avatar containers: blue gradients

**Preserve:**
- useChats hook integration
- useMessages hook integration
- useChatActions hook integration
- Real-time message listening
- Voice note recording and playback
- Message sending/receiving
- File attachment functionality

### 2.3 Call Screens - 3 files
**Files:**
- `src/screens/CallsScreen.tsx`
- `src/screens/AudioCallScreen.tsx`
- `src/screens/VideoCallScreen.tsx`

**Styling Changes:**
- Call item cards: blue-tinted glassmorphism
- Control buttons: enhanced shadows and blue tint
- Status indicators: blue theme

**Preserve:**
- useWebRTC hook integration
- WebRTC peer connections
- Call signaling
- Camera/microphone stream handling
- IncomingCallManager integration
- Call history functionality

### 2.4 Contact & Profile Screens - 2 files
**Files:**
- `src/screens/ContactsScreen.tsx`
- `src/screens/ProfileScreen.tsx`

**Styling Changes:**
- Contact item cards: blue-tinted glassmorphism
- Profile sections: blue-tinted styling
- Avatar displays: blue gradients

**Preserve:**
- useContacts hook integration
- Contact fetching and display
- Profile editing functionality
- Firebase integration

### 2.5 Settings & Utility Screens - 5 files
**Files:**
- `src/screens/SettingsScreen.tsx`
- `src/screens/AppearanceScreen.tsx`
- `src/screens/CalendarScreen.tsx`
- `src/screens/NotesScreen.tsx`
- `src/screens/StatusScreen.tsx`

**Styling Changes:**
- Settings item cards: blue-tinted glassmorphism
- Option tiles: enhanced blue tint
- Container styling: blue theme

**Preserve:**
- Navigation to settings screens
- Theme context integration
- Existing functionality

### 2.6 Core Files - 3 files
**Files:**
- `src/screens/SplashScreen.tsx`
- `App.tsx`
- `index.ts`

**Styling Changes:**
- Splash screen: blue-tinted styling
- App container: consistent theme application

**Preserve:**
- Context provider wrapping
- Navigation initialization
- Firebase initialization
- Entry point logic

---

## 3. TAKE-NEW (7 files)

These files exist only in create-account and should be integrated as new additions.

### 3.1 New Settings Screens - 6 files
**Files:**
```
src/screens/AccountSettingsScreen.tsx
src/screens/ChangeNumberScreen.tsx
src/screens/LinkedDevicesScreen.tsx
src/screens/NotificationSettingsScreen.tsx
src/screens/NotificationsScreen.tsx
src/screens/PrivacySettingsScreen.tsx
```

**Integration Steps:**
1. Copy files from create-account
2. Connect to Firebase if needed (especially ChangeNumberScreen)
3. Add navigation routes in AppNavigator
4. Update RootStackParamList type definitions
5. Test navigation to/from these screens

### 3.2 New UI Component - 1 file
**File:**
```
src/components/ToastNotification.tsx
```

**Integration Steps:**
1. Copy file from create-account
2. Verify blue-tinted styling consistency
3. Make available for use across screens

---

## 4. MERGE-CONFIG (3 files)

These configuration files exist in both branches and require careful manual merging.

### 4.1 Package Configuration
**File:** `package.json`

**Strategy:**
- Keep ALL dependencies from Frontend-FeaturesMJ (Firebase, WebRTC, testing libraries)
- Add any new UI-related dependencies from create-account if beneficial
- Resolve version conflicts (prefer Frontend-FeaturesMJ versions unless create-account has critical updates)
- Preserve scripts from Frontend-FeaturesMJ

**Critical Dependencies to Preserve:**
- All Firebase packages (@react-native-firebase/*)
- WebRTC packages
- Voice recording packages (@react-native-community/audio-toolkit or similar)
- Testing packages (jest, @testing-library/react-native, fast-check)

### 4.2 App Configuration
**File:** `app.json`

**Strategy:**
- Preserve Firebase configuration
- Adopt UI-related config changes if they improve UX
- Keep Android/iOS native module configurations
- Preserve permissions and capabilities

### 4.3 TypeScript Configuration
**File:** `tsconfig.json`

**Strategy:**
- Compare both versions
- Keep Frontend-FeaturesMJ if significantly different
- Adopt create-account if it has better type strictness (unlikely to differ)

---

## 5. REVIEW-CONTEXT (4 files)

New context providers from create-account that need evaluation against existing functionality.

### 5.1 New Context Providers
**Files:**
```
src/context/BlockedContext.tsx
src/context/ContactsContext.tsx
src/context/MessagesContext.tsx
src/context/NotificationContext.tsx
```

**Evaluation Criteria:**

#### BlockedContext
- **Decision:** INTEGRATE if it adds blocked users functionality
- **Action:** Connect to Firebase Firestore for blocked users collection
- **Conflicts:** None expected

#### ContactsContext
- **Decision:** EVALUATE against useContacts hook
- **Existing:** `src/hooks/useContacts.ts` provides contact functionality
- **Action:** If ContactsContext provides state management across screens, integrate alongside hook. If it duplicates, keep hook.

#### MessagesContext
- **Decision:** EVALUATE against useMessages/useChats hooks
- **Existing:** `src/hooks/useMessages.ts` and `src/hooks/useChats.ts` provide messaging
- **Action:** If MessagesContext provides global message state management, consider integration. Priority: preserve existing hook functionality.

#### NotificationContext
- **Decision:** INTEGRATE if it manages in-app notifications/toasts
- **Action:** Connect to Firebase Cloud Messaging if needed
- **Use Case:** Likely for ToastNotification component integration

---

## 6. COMMON FILES (No Action Needed)

These files exist in both branches with no expected meaningful differences or can be kept as-is:

```
.gitignore
.vscode/settings.json
.claude/settings.json
LICENSE
src/data/countryCodes.ts
src/data/mockData.ts
src/types/index.ts (may need merge if new types added)
src/types/theme.ts
All asset files (icons, splash screens)
```

**Action:** Keep Frontend-FeaturesMJ versions unless create-account has obvious improvements

---

## 7. NAVIGATION UPDATE

**File:** `src/navigation/AppNavigator.tsx`

**Category:** UPDATE-STYLING + ROUTING

**Changes Required:**
1. Apply blue-tinted styling to navigation components
2. Add routes for 6 new settings screens
3. Update RootStackParamList type with new screen params
4. Preserve all existing navigation logic
5. Test navigation flow to all screens

---

## 8. SCREENS REQUIRING UI UPDATES - Detailed List

### Priority 1: Authentication (High User Impact)
1. ✅ CreateAccountScreen
2. ✅ SignInScreen

### Priority 2: Main App Screens (High Usage)
3. ✅ ChatsScreen
4. ✅ ChatScreen
5. ✅ CallsScreen
6. ✅ ContactsScreen

### Priority 3: Call Screens (WebRTC Critical)
7. ✅ AudioCallScreen
8. ✅ VideoCallScreen

### Priority 4: Profile & Settings
9. ✅ ProfileScreen
10. ✅ SettingsScreen
11. ✅ AppearanceScreen

### Priority 5: Utility Screens
12. ✅ StatusScreen
13. ✅ CalendarScreen
14. ✅ NotesScreen

### Priority 6: Entry Points
15. ✅ SplashScreen
16. ✅ App.tsx

---

## 9. FILES DELETED IN CREATE-ACCOUNT (Must Preserve)

These files exist in Frontend-FeaturesMJ but are deleted in create-account. They MUST be preserved:

### Critical Functionality Files
- All hooks (16 files)
- All validation utilities (5 files)
- Firebase config (2 files)
- Call components (4 files)
- CallContext
- Signaling service
- All test files (14 files)
- All spec files (23 files)
- Documentation files (8 files)
- Firebase config files (4 files)

**Total:** 67 files to preserve entirely

---

## 10. MERGE EXECUTION CHECKLIST

### Phase 1: Preparation ✅
- [x] List all files in Frontend-FeaturesMJ
- [x] List all files in create-account
- [x] Categorize into preserve/update/take-new/merge
- [ ] Create backup branch

### Phase 2: File Preservation
- [ ] Verify all 67 preserve-entirely files are untouched

### Phase 3: Screen Updates (17 files)
- [ ] Update CreateAccountScreen
- [ ] Update SignInScreen
- [ ] Update ChatsScreen
- [ ] Update ChatScreen
- [ ] Update CallsScreen
- [ ] Update AudioCallScreen
- [ ] Update VideoCallScreen
- [ ] Update ContactsScreen
- [ ] Update ProfileScreen
- [ ] Update SettingsScreen
- [ ] Update AppearanceScreen
- [ ] Update StatusScreen
- [ ] Update CalendarScreen
- [ ] Update NotesScreen
- [ ] Update SplashScreen
- [ ] Update App.tsx
- [ ] Update index.ts

### Phase 4: New File Integration (7 files)
- [ ] Add AccountSettingsScreen
- [ ] Add ChangeNumberScreen
- [ ] Add LinkedDevicesScreen
- [ ] Add NotificationSettingsScreen
- [ ] Add NotificationsScreen
- [ ] Add PrivacySettingsScreen
- [ ] Add ToastNotification component

### Phase 5: Context Evaluation (4 files)
- [ ] Evaluate BlockedContext → Integrate
- [ ] Evaluate ContactsContext → Compare with useContacts
- [ ] Evaluate MessagesContext → Compare with useMessages/useChats
- [ ] Evaluate NotificationContext → Integrate for toasts

### Phase 6: Navigation Update
- [ ] Add routes for 6 new settings screens
- [ ] Update RootStackParamList types
- [ ] Test navigation flow

### Phase 7: Configuration Merge (3 files)
- [ ] Merge package.json
- [ ] Merge app.json
- [ ] Review tsconfig.json

### Phase 8: Verification
- [ ] TypeScript compilation passes
- [ ] Build succeeds
- [ ] All navigation works
- [ ] Authentication flow works
- [ ] Messaging works
- [ ] Calls work (if WebRTC configured)
- [ ] Visual styling is consistent

---

## 11. RISK ASSESSMENT

### High Risk Files (Require Careful Handling)
1. **AppNavigator.tsx** - Both routing changes and styling updates
2. **CreateAccountScreen.tsx** - Complex form with validation
3. **ChatScreen.tsx** - Real-time messaging with voice notes
4. **AudioCallScreen.tsx / VideoCallScreen.tsx** - WebRTC integration
5. **package.json** - Dependency conflicts

### Medium Risk Files
6. **ChatsScreen.tsx** - Real-time listeners
7. **ContactsScreen.tsx** - Contact permissions
8. **Context providers** - Potential state management conflicts

### Low Risk Files
- Utility screens (Calendar, Notes, Status)
- Settings screens
- Appearance screen
- Splash screen

---

## 12. VALIDATION CHECKLIST

After merge completion, verify:

- [ ] All 67 preserve-entirely files still exist
- [ ] All 17 screens have blue-tinted styling
- [ ] All 7 new files integrated successfully
- [ ] Navigation to all screens works
- [ ] Authentication flow complete (sign in, create account, OTP)
- [ ] Messaging works (send, receive, voice notes)
- [ ] Calls work (audio, video) if WebRTC configured
- [ ] Contacts display correctly
- [ ] New settings screens accessible
- [ ] Toast notifications work
- [ ] TypeScript compiles with zero errors
- [ ] App builds successfully
- [ ] No console errors at runtime

---

## SUMMARY

This inventory provides a comprehensive categorization of all files in both branches, aligned with Requirements 1.1, 1.9, and 1.7:

- **67 files to preserve entirely** (functionality must not be lost)
- **17 files to update with styling** (apply glassmorphism while preserving logic)
- **7 new files to integrate** (settings screens + toast component)
- **3 config files to merge carefully** (package.json, app.json, tsconfig.json)
- **4 context providers to evaluate** (determine if they add value or conflict)

The categorization ensures a systematic merge that preserves all Firebase, WebRTC, validation, and hook functionality while successfully integrating the blue-tinted glassmorphism UI design.
