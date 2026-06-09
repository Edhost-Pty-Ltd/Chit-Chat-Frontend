# Implementation Plan: Phone OTP Auth + Contacts Integration + Real-time Messaging

## Overview

Wire the existing ChitChat React Native app from mock/static data to the live Firebase backend. The hooks (`useAuth`, `useChats`, `useMessages`, `useContacts`, `useChatActions`) are already implemented — this plan focuses on updating the UI screens and navigation to consume them, plus extracting testable utility functions.

## Tasks

- [x] 1. Update types and navigation foundation
  - [x] 1.1 Update `src/types/index.ts` — change `Chat` param from `{ contact: Contact }` to `{ chatId: string; displayName: string; isGroup: boolean }`
    - Remove the old Contact-based param
    - Keep the `Contact` interface for now (other screens may still reference it)
    - _Requirements: 2.1, 2.2_
  - [x] 1.2 Update `src/navigation/AppNavigator.tsx` — add auth-guarded conditional rendering
    - Import and call `useAuth()` at the top of AppNavigator
    - Show a loading spinner while `loading` is true
    - Conditionally render `SignIn` screen (unauthenticated) vs main stack (authenticated)
    - Use `Stack.Group` or conditional `Stack.Screen` entries
    - Remove the hardcoded `initialRouteName="SignIn"`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 2. Rewrite SignInScreen with phone OTP flow
  - [x] 2.1 Replace `src/screens/SignInScreen.tsx` with two-step phone OTP UI
    - Remove email/password fields, social login buttons, sign-out card
    - Step 1: Phone number TextInput with "+27" prefix, "Send OTP" button
    - Step 2: 6-digit OTP TextInput, "Verify" button, "Resend OTP" link
    - Wire to `useAuth()` hook — `sendOTP(phone)` and `verifyOTP(code)`
    - Display loading state while `step === 'sending'` or `step === 'verifying'`
    - Display `error` message from the hook when present
    - Add basic client-side validation: phone must be 10+ digits after stripping
    - Keep the existing gradient/glass design language
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8_

- [x] 3. Checkpoint
  - Ensure the app compiles and auth flow works end-to-end (send OTP → verify → lands on Chats). Ask the user if questions arise.

- [x] 4. Wire ChatsScreen to live data
  - [x] 4.1 Extract `resolveDisplayName` utility function to `src/utils/resolveDisplayName.ts`
    - Create new file with the pure display name resolution function
    - Accepts: chat, currentUserId, contactsMap (phone→name), firestoreUsersMap (uid→{displayName, phone})
    - Returns: resolved display name string following priority chain (contact > Firestore > phone)
    - _Requirements: 6.1, 6.2, 6.3, 6.4_
  - [x] 4.2 Extract `normalizePhone` and `chunkArray` to `src/utils/phoneUtils.ts`
    - Move `normalizePhone` and `chunkArray` from `useContacts.ts` to a shared utility file
    - Update `useContacts.ts` to import from the new utility file
    - Keeps the functions testable in isolation
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 3.5_
  - [x] 4.3 Rewrite `src/screens/ChatsScreen.tsx` — replace mock data with hooks
    - Import `useAuth`, `useChats`, `useContacts`
    - Get `userId` from `useAuth().user?.uid`
    - Feed `userId` to `useChats(userId)` for real-time chat list
    - Replace `CONTACTS`/`GROUPS` arrays with `chats` from `useChats`
    - Use `resolveDisplayName` for each chat row's title
    - Show unread badge from `chat.unreadCount`
    - Show timestamp from `chat.timestamp`
    - Show last message preview from `chat.lastMessage`
    - Navigate to Chat with `{ chatId, displayName, isGroup }` params
    - _Requirements: 4.1, 4.2, 4.3, 4.5, 6.1, 6.2, 6.3, 6.4_
  - [x] 4.4 Wire new-chat bottom sheet to `useContacts` and `useChatActions`
    - Replace mock contacts list with `useContacts().contacts` (only registered users)
    - On contact tap: call `getOrCreateDirectChat(currentUserId, contact.userId)`
    - Navigate to Chat screen with returned chatId and contact's displayName
    - _Requirements: 3.6, 7.1, 7.2, 7.3_

- [x] 5. Wire ChatScreen to live messaging
  - [x] 5.1 Rewrite `src/screens/ChatScreen.tsx` — replace mock messages with hooks
    - Update route params to use `{ chatId, displayName, isGroup }` instead of `{ contact }`
    - Get `userId` from `useAuth().user?.uid`
    - Use `useMessages(chatId, userId)` for real-time message stream
    - Map `FireMessage` to the bubble UI (senderId === userId → "out", else "in")
    - Wire send button to `useMessages().sendMessage(text)`
    - Empty/whitespace input check before calling sendMessage
    - Clear input field on successful send
    - Auto-scroll to bottom when new messages arrive
    - Show displayName in top bar header (from route params)
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

- [x] 6. Checkpoint
  - Ensure all screens work end-to-end: sign in → see chat list → open chat → send/receive messages. Ask the user if questions arise.

- [x] 7. Handle cleanup and sign-out
  - [x] 7.1 Add sign-out functionality accessible from the app
    - Add a sign-out button in SettingsScreen (or ChatsScreen header menu)
    - Wire to `useAuth().signOut()`
    - Navigation guard automatically returns to SignIn on sign-out
    - _Requirements: 2.6_
  - [x] 7.2 Ensure Firestore listener cleanup on navigation
    - Verify `useChats` unsubscribes when ChatsScreen unmounts
    - Verify `useMessages` unsubscribes when ChatScreen unmounts
    - Both hooks already return cleanup functions in useEffect — confirm they're invoked
    - _Requirements: 4.4, 5.6_

- [x] 8. Final checkpoint
  - Ensure all tests pass, ask the user if questions arise.

- [ ]* 9. Property-based tests
  - [ ]* 9.1 Set up testing infrastructure
    - Install `jest`, `@testing-library/react-native`, `fast-check` as dev dependencies
    - Create `jest.config.ts` with React Native preset
    - Create `__tests__/properties/` directory
  - [ ]* 9.2 Write property test for phone normalization (valid E.164 output)
    - **Property 1: Phone number normalization produces valid E.164**
    - **Validates: Requirements 8.1, 8.2, 8.3, 8.4**
    - Generate random phone strings (leading 0, leading +, bare 9 digits, with spaces/dashes)
    - Assert output always matches /^\+\d+$/
  - [ ]* 9.3 Write property test for phone normalization idempotence
    - **Property 2: Phone number normalization is idempotent**
    - **Validates: Requirements 8.5**
    - Generate random phone strings, assert normalizePhone(normalizePhone(x)) === normalizePhone(x)
  - [ ]* 9.4 Write property test for chunkArray
    - **Property 3: Array chunking preserves all elements with bounded chunk size**
    - **Validates: Requirements 3.5**
    - Generate random arrays (0 to 200 items), chunk with size 30
    - Assert: flat(chunks) === original, every chunk.length ≤ 30, non-last chunks have length exactly 30
  - [ ]* 9.5 Write property test for whitespace message rejection
    - **Property 4: Whitespace-only messages are rejected**
    - **Validates: Requirements 5.3**
    - Generate random whitespace-only strings (spaces, tabs, newlines, empty)
    - Mock Firestore, call sendMessage, assert returns false and no Firestore write
  - [ ]* 9.6 Write property test for display name resolution
    - **Property 5: Display name resolution follows priority chain**
    - **Validates: Requirements 6.1, 6.2, 6.3**
    - Generate random chat data, contacts maps, and Firestore user data
    - Assert resolution follows: contacts map hit → contact name, miss but displayName → displayName, else → phone

## Task Dependency Graph

```json
{
  "waves": [
    { "tasks": ["1"] },
    { "tasks": ["2"] },
    { "tasks": ["3"] },
    { "tasks": ["4"] },
    { "tasks": ["5"] },
    { "tasks": ["6"] },
    { "tasks": ["7"] },
    { "tasks": ["8"] },
    { "tasks": ["9"] }
  ]
}
```

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- The hooks layer is already complete — this plan focuses purely on wiring UI screens
- All property tests use `fast-check` with minimum 100 iterations
- The `Contact` type from mock data can be deprecated after ChatsScreen/ChatScreen rewrites
- Mock data imports (`CONTACTS`, `MESSAGES`, `STATUSES`) will no longer be needed in Chats/Chat screens after wiring
