# Requirements Document

## Introduction

This feature wires the existing ChitChat React Native app (Expo SDK 54, EAS Build) from mock/static data to a real Firebase backend. It covers phone OTP authentication via `@react-native-firebase/auth`, auth-guarded navigation, phone book contacts integration via `expo-contacts` with Firestore user matching, real-time messaging via Firebase Firestore JS SDK, and display name resolution from the device phone book.

## Glossary

- **Auth_System**: The phone OTP authentication subsystem powered by `@react-native-firebase/auth` that manages user sign-in, session state, and sign-out.
- **Navigation_Guard**: The navigation logic that conditionally renders either the authentication screen or the main app screens based on the user's authentication state.
- **Contacts_Service**: The subsystem that reads phone book contacts via `expo-contacts`, normalizes phone numbers to E.164 format, and cross-references them against Firestore registered users.
- **Chat_List_Listener**: The real-time Firestore listener that streams the current user's chat list with last message previews, timestamps, and unread counts.
- **Message_Listener**: The real-time Firestore listener that streams messages within a specific chat conversation.
- **Message_Sender**: The subsystem that writes new messages to Firestore and updates chat metadata (last message, unread counts) atomically.
- **Display_Name_Resolver**: The logic that maps a user's phone number or UID to a human-readable contact name from the device phone book, falling back to the Firestore displayName or raw phone number.
- **E.164_Format**: The international phone number format starting with `+` followed by country code and subscriber number (e.g., `+27658500320` for South Africa).
- **OTP**: One-Time Password — a 6-digit verification code sent via SMS to confirm phone ownership.
- **Firestore_User**: A document in the `users` collection containing `uid`, `phone`, `displayName`, `photoURL`, `createdAt`, and `lastSeen` fields.
- **Chat_Document**: A document in the `chats` collection containing `type`, `members[]`, `groupName`, `lastMessage`, and `unreadCounts` fields.

## Requirements

### Requirement 1: Phone OTP Authentication Flow

**User Story:** As a user, I want to sign in using my phone number and a one-time SMS code, so that I can authenticate without needing to remember a password.

#### Acceptance Criteria

1. WHEN the user opens the app and is not authenticated, THE Auth_System SHALL display a phone number input field with a country code prefix defaulting to +27.
2. WHEN the user submits a valid E.164 phone number, THE Auth_System SHALL send an OTP via SMS and transition to the OTP verification step.
3. WHILE the OTP is being sent, THE Auth_System SHALL display a loading indicator and disable the submit button.
4. WHEN the user submits a valid 6-digit OTP, THE Auth_System SHALL verify the code and sign the user in.
5. IF the user submits an invalid phone number format, THEN THE Auth_System SHALL display an error message indicating the expected format (+27XXXXXXXXX).
6. IF the user submits an incorrect OTP, THEN THE Auth_System SHALL display an error message and allow the user to retry.
7. IF the OTP has expired, THEN THE Auth_System SHALL display a message and provide an option to resend a new OTP.
8. WHEN the user successfully authenticates, THE Auth_System SHALL create or update the corresponding Firestore_User document with uid, phone, displayName, and lastSeen fields.

### Requirement 2: Auth-Guarded Navigation

**User Story:** As a user, I want the app to automatically show me the correct screen based on my login status, so that I don't have to manually navigate after signing in or out.

#### Acceptance Criteria

1. WHILE the user is not authenticated, THE Navigation_Guard SHALL display only the SignIn screen and prevent access to other app screens.
2. WHILE the user is authenticated, THE Navigation_Guard SHALL display the main app screens and prevent access to the SignIn screen.
3. WHEN the authentication state changes from unauthenticated to authenticated, THE Navigation_Guard SHALL navigate to the Chats screen without user interaction.
4. WHEN the authentication state changes from authenticated to unauthenticated, THE Navigation_Guard SHALL navigate to the SignIn screen without user interaction.
5. WHILE the Auth_System is determining the initial authentication state on app launch, THE Navigation_Guard SHALL display a loading indicator.
6. WHEN the user triggers sign-out, THE Auth_System SHALL clear the session and the Navigation_Guard SHALL return to the SignIn screen.

### Requirement 3: Phone Contacts Integration

**User Story:** As a user, I want the app to find which of my phone contacts are also using ChitChat, so that I can start conversations with people I know.

#### Acceptance Criteria

1. WHEN the Chats screen loads for the first time, THE Contacts_Service SHALL request device contacts permission from the user.
2. IF the user denies contacts permission, THEN THE Contacts_Service SHALL display a message explaining that contacts access is needed to find friends and allow the user to grant permission later.
3. WHEN contacts permission is granted, THE Contacts_Service SHALL read all phone contacts and normalize each phone number to E.164_Format using +27 as the default country code.
4. WHEN phone numbers are normalized, THE Contacts_Service SHALL query the Firestore `users` collection to identify which contacts are registered on ChitChat.
5. THE Contacts_Service SHALL handle phone books with more than 30 contacts by batching Firestore queries into chunks of 30 items.
6. WHEN the user opens the new-chat sheet, THE Contacts_Service SHALL display only contacts that are registered on ChitChat, showing their phone book display name.

### Requirement 4: Real-time Chat List

**User Story:** As a user, I want to see my conversations update in real time, so that I always have the latest messages and unread counts without manually refreshing.

#### Acceptance Criteria

1. WHEN the Chats screen mounts, THE Chat_List_Listener SHALL subscribe to all chats where the current user is a member, ordered by last message timestamp descending.
2. WHEN a new message arrives in any chat, THE Chat_List_Listener SHALL update the chat's last message preview and timestamp in real time.
3. WHEN a new message arrives from another user, THE Chat_List_Listener SHALL increment and display the unread count badge for that chat.
4. WHEN the user navigates away from the Chats screen, THE Chat_List_Listener SHALL unsubscribe from the Firestore listener to prevent memory leaks.
5. WHILE the Chat_List_Listener is loading initial data, THE Chat_List_Listener SHALL display a loading state in the UI.

### Requirement 5: Real-time Messaging

**User Story:** As a user, I want to send and receive messages in real time within a conversation, so that I can have fluid, responsive chats.

#### Acceptance Criteria

1. WHEN the user opens a chat, THE Message_Listener SHALL subscribe to messages in that chat ordered by timestamp ascending and display them in real time.
2. WHEN the user types a message and taps send, THE Message_Sender SHALL write the message to Firestore and update the chat's lastMessage and unread counts for all other members atomically.
3. IF the user submits an empty or whitespace-only message, THEN THE Message_Sender SHALL reject the submission and keep the input field unchanged.
4. WHEN a new message from another user arrives while the chat is open, THE Message_Listener SHALL append the message to the displayed list and auto-scroll to the latest message.
5. WHEN the user opens a chat with unread messages, THE Message_Listener SHALL mark the chat as read by resetting the unread count for the current user to zero.
6. WHEN the user navigates away from the chat, THE Message_Listener SHALL unsubscribe from the Firestore listener.

### Requirement 6: Display Name Resolution

**User Story:** As a user, I want to see my contacts' names from my phone book in the chat list, so that I can easily identify who I'm chatting with.

#### Acceptance Criteria

1. WHEN displaying a chat in the list, THE Display_Name_Resolver SHALL show the other member's phone book contact name if the number exists in the user's device contacts.
2. IF the other member's phone number is not in the user's device contacts, THEN THE Display_Name_Resolver SHALL show the Firestore_User displayName field.
3. IF neither a contact name nor a Firestore displayName is available, THEN THE Display_Name_Resolver SHALL show the raw phone number in E.164_Format.
4. WHEN displaying a group chat in the list, THE Display_Name_Resolver SHALL show the group name from the Chat_Document.

### Requirement 7: New Chat Creation

**User Story:** As a user, I want to start a new conversation with any registered contact, so that I can communicate with people in my phone book who use ChitChat.

#### Acceptance Criteria

1. WHEN the user selects a registered contact from the new-chat sheet, THE Message_Sender SHALL create a new direct chat document or navigate to the existing one if a direct chat already exists between the two users.
2. WHEN a new direct chat is created, THE Message_Sender SHALL initialize the chat with both member UIDs, empty unread counts, and a null last message.
3. WHEN the user selects a registered contact, THE Navigation_Guard SHALL navigate to the Chat screen for that conversation.

### Requirement 8: Phone Number Normalization

**User Story:** As a developer, I want all phone numbers consistently stored and compared in E.164 format, so that contact matching works reliably regardless of how numbers are saved in the phone book.

#### Acceptance Criteria

1. WHEN a phone number starts with "0", THE Contacts_Service SHALL replace the leading zero with "+27" to produce E.164_Format.
2. WHEN a phone number already starts with "+", THE Contacts_Service SHALL treat it as already in E.164_Format and return it unchanged.
3. WHEN a phone number is 9 digits without a prefix, THE Contacts_Service SHALL prepend "+27" to produce E.164_Format.
4. THE Contacts_Service SHALL strip all non-digit characters (except a leading "+") before applying normalization rules.
5. FOR ALL valid phone contacts, parsing a phone number through normalization then comparing against Firestore records SHALL produce consistent matching results regardless of the original format stored in the phone book.
