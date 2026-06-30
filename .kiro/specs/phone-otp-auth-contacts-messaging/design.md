# Design Document: Phone OTP Auth + Contacts Integration + Real-time Messaging

## Overview

This design transforms the ChitChat app from a static mock-data prototype into a live, Firebase-backed messaging application. The scope covers three interconnected pillars:

1. **Phone OTP Authentication** — Replace the email/password sign-in UI with a two-step phone verification flow powered by `@react-native-firebase/auth`.
2. **Contacts Integration** — Use `expo-contacts` to read the device phone book, normalize numbers to E.164, and match them against Firestore registered users.
3. **Real-time Messaging** — Wire the chat list and individual conversations to Firestore real-time listeners, replacing all mock data.

The design leverages the existing hook infrastructure (`useAuth`, `useChats`, `useMessages`, `useContacts`, `useChatActions`) which is already implemented but not yet wired to the UI screens.

## Architecture

```mermaid
graph TD
    subgraph "React Native App"
        A[AppNavigator] -->|auth state| B{Authenticated?}
        B -->|No| C[SignInScreen]
        B -->|Yes| D[Main Stack]
        D --> E[ChatsScreen]
        D --> F[ChatScreen]
        
        C -->|useAuth| G[Auth Hook]
        E -->|useChats + useContacts| H[Data Hooks]
        F -->|useMessages| I[Message Hook]
    end

    subgraph "Firebase Backend"
        G -->|signInWithPhoneNumber| J[@react-native-firebase/auth]
        H -->|onSnapshot| K[Firestore JS SDK]
        I -->|onSnapshot + writeBatch| K
        K --> L[(users collection)]
        K --> M[(chats collection)]
        K --> N[(messages subcollection)]
    end

    subgraph "Device APIs"
        H -->|expo-contacts| O[Phone Book]
    end
```

### Key Architectural Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Auth SDK | `@react-native-firebase/auth` (native) | Required for phone OTP — handles reCAPTCHA natively on both platforms |
| Firestore SDK | `firebase/firestore` (JS SDK) | Already in use, works cross-platform, no migration needed |
| Contacts | `expo-contacts` | First-class Expo support, handles permissions and data access |
| State management | React hooks (no Redux/Zustand) | App is simple enough — hooks + context suffice |
| Navigation guard | Conditional stack rendering in AppNavigator | Clean separation, no manual navigation calls needed |

## Components and Interfaces

### Modified Files

#### 1. `src/types/index.ts` — Navigation Param Update

```typescript
// BEFORE
Chat: { contact: Contact };

// AFTER
Chat: { chatId: string; displayName: string; isGroup: boolean };
```

This decouples the Chat screen from the mock `Contact` type and wires it to Firestore chat IDs.

#### 2. `src/navigation/AppNavigator.tsx` — Auth-Guarded Navigation

```typescript
export default function AppNavigator() {
  const { user, loading } = useAuth();

  if (loading) return <LoadingScreen />;

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {user ? (
        // Authenticated stack
        <>
          <Stack.Screen name="Chats" component={ChatsScreen} />
          <Stack.Screen name="Chat" component={ChatScreen} />
          {/* ... other main screens */}
        </>
      ) : (
        // Unauthenticated stack
        <Stack.Screen name="SignIn" component={SignInScreen} />
      )}
    </Stack.Navigator>
  );
}
```

#### 3. `src/screens/SignInScreen.tsx` — Phone OTP Two-Step Flow

Replaces email/password UI with:
- **Step 1**: Phone number input (prefilled +27) + "Send OTP" button
- **Step 2**: 6-digit OTP input + "Verify" button + "Resend" option

Uses `useAuth()` hook's `sendOTP` and `verifyOTP` functions.

#### 4. `src/screens/ChatsScreen.tsx` — Live Chat List

Replaces mock `CONTACTS` data with:
- `useAuth()` for current user ID
- `useChats(userId)` for real-time chat list
- `useContacts()` for registered contacts display in new-chat sheet
- Display name resolution: contacts map → Firestore name → raw phone

#### 5. `src/screens/ChatScreen.tsx` — Live Messaging

Replaces mock `MESSAGES` with:
- Accepts `{ chatId, displayName, isGroup }` route params
- `useMessages(chatId, userId)` for real-time message stream
- Wires send button to `sendMessage()` from the hook
- Auto-scrolls on new messages

### Display Name Resolution Logic

```typescript
function resolveDisplayName(
  chat: ChatPreview,
  currentUserId: string,
  contactsMap: Map<string, string>, // phone → contact name
  firestoreUsers: Map<string, { displayName: string; phone: string }>
): string {
  if (chat.type === 'group') return chat.groupName ?? 'Group';
  
  const otherMemberId = chat.members.find(id => id !== currentUserId);
  if (!otherMemberId) return 'Unknown';
  
  const otherUser = firestoreUsers.get(otherMemberId);
  if (!otherUser) return 'Unknown';
  
  // Priority: phone book name > Firestore displayName > raw phone
  const contactName = contactsMap.get(otherUser.phone);
  if (contactName) return contactName;
  if (otherUser.displayName && otherUser.displayName !== otherUser.phone) {
    return otherUser.displayName;
  }
  return otherUser.phone;
}
```

### Phone Number Normalization (Already Implemented)

The `normalizePhone` function in `useContacts.ts`:

```typescript
function normalizePhone(raw: string, defaultCountryCode = '27'): string {
  let digits = raw.replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) return digits;
  if (digits.startsWith('0')) return `+${defaultCountryCode}${digits.slice(1)}`;
  if (digits.length === 9) return `+${defaultCountryCode}${digits}`;
  return `+${digits}`;
}
```

Rules:
1. Strip all non-digit characters (except leading `+`)
2. If starts with `+` → already E.164, return as-is
3. If starts with `0` → replace with `+27`
4. If exactly 9 digits → prepend `+27`
5. Otherwise → prepend `+`

## Data Models

### Firestore Schema (Already in Place)

```
users/{uid}
├── uid: string
├── phone: string (E.164)
├── displayName: string
├── photoURL: string | null
├── createdAt: Timestamp
└── lastSeen: Timestamp

chats/{chatId}
├── type: 'direct' | 'group'
├── members: string[] (UIDs)
├── groupName: string | null
├── groupPhoto: string | null
├── createdBy: string (UID)
├── createdAt: Timestamp
├── lastMessage: { text, senderId, timestamp } | null
└── unreadCounts: { [userId]: number }

chats/{chatId}/messages/{msgId}
├── messageId: string
├── senderId: string (UID)
├── text: string | null
├── imageUrl: string | null
├── voiceUrl: string | null
├── type: 'text' | 'image' | 'voice'
├── timestamp: Timestamp
└── readBy: string[] (UIDs)
```

### TypeScript Interfaces (Hook Layer — Already Defined)

| Interface | Source | Purpose |
|-----------|--------|---------|
| `ChatPreview` | `useChats.ts` | Chat list item with last message, timestamp, unread count |
| `FireMessage` | `useMessages.ts` | Individual message in a conversation |
| `AppContact` | `useContacts.ts` | Registered contact with phone book name resolution |
| `AuthStep` | `useAuth.ts` | Auth flow state: idle → sending → verifying → done/error |

### Updated Navigation Types

```typescript
export type RootStackParamList = {
  SignIn: undefined;
  Chats: undefined;
  Chat: { chatId: string; displayName: string; isGroup: boolean };
  Calls: undefined;
  Status: undefined;
  Contacts: undefined;
  Calendar: undefined;
  Notes: undefined;
  CloudBackup: undefined;
  Settings: undefined;
};
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Phone number normalization produces valid E.164

*For any* raw phone string (with leading "0", with leading "+", or as a bare 9-digit number, optionally containing spaces/dashes/parens), `normalizePhone` SHALL produce a string that starts with "+" followed only by digits, matching the E.164 format.

**Validates: Requirements 8.1, 8.2, 8.3, 8.4**

### Property 2: Phone number normalization is idempotent

*For any* phone string, applying `normalizePhone` twice SHALL produce the same result as applying it once: `normalizePhone(normalizePhone(x)) === normalizePhone(x)`.

**Validates: Requirements 8.5**

### Property 3: Array chunking preserves all elements with bounded chunk size

*For any* array of phone numbers and a chunk size of 30, the `chunkArray` function SHALL produce chunks where: (a) concatenating all chunks equals the original array, (b) every chunk has length ≤ 30, and (c) all chunks except possibly the last have length exactly 30.

**Validates: Requirements 3.5**

### Property 4: Whitespace-only messages are rejected

*For any* string composed entirely of whitespace characters (including empty string), calling `sendMessage` with that text SHALL return `false` without writing to Firestore.

**Validates: Requirements 5.3**

### Property 5: Display name resolution follows priority chain

*For any* direct chat, user ID, contacts map, and Firestore user data, the display name resolver SHALL return: (a) the phone book contact name if the user's phone exists in the contacts map, (b) the Firestore displayName if the phone is NOT in contacts but displayName exists and differs from the phone number, or (c) the raw phone number otherwise. The priority order is always contacts > Firestore > phone.

**Validates: Requirements 6.1, 6.2, 6.3**

### Property 6: Invalid phone formats produce error feedback

*For any* string that does not match a recognizable phone number pattern (empty, too short with fewer than 7 digits after stripping, containing only non-digit characters), the Auth_System validation SHALL reject it with an error message.

**Validates: Requirements 1.5**

## Error Handling

| Scenario | Error Source | Handling Strategy |
|----------|-------------|-------------------|
| Invalid phone number | Client-side validation | Display inline error before calling Firebase |
| SMS send failure | Firebase `auth/too-many-requests`, `auth/quota-exceeded` | Show human-readable error, allow retry |
| Invalid OTP | Firebase `auth/invalid-verification-code` | Show error, keep OTP input focused for retry |
| Expired OTP | Firebase `auth/code-expired` | Show expiry message + "Resend OTP" button |
| Contacts permission denied | OS permission dialog | Show explanation message with "Grant access" link to settings |
| Firestore listener error | Network/permissions | Display error banner, auto-retry on reconnection |
| Empty message send | Client-side validation | Reject silently (return false), keep input unchanged |
| Chat creation conflict | Race condition on getOrCreateDirectChat | Query-first approach prevents duplicates |
| Firestore batch write failure | Network error in sendMessage | Return false, log error, message stays in input for retry |

### Error Message Mapping (Already Implemented in `useAuth.ts`)

```typescript
const messages: Record<string, string> = {
  'auth/invalid-phone-number':      'Invalid phone number. Use format +27XXXXXXXXX',
  'auth/too-many-requests':         'Too many attempts. Please wait and try again.',
  'auth/invalid-verification-code': 'Incorrect OTP. Please check and try again.',
  'auth/code-expired':              'OTP has expired. Please request a new one.',
  'auth/missing-phone-number':      'Please enter your phone number.',
  'auth/session-expired':           'Session expired. Please request a new OTP.',
  'auth/quota-exceeded':            'SMS quota exceeded. Try again later.',
};
```

## Testing Strategy

### Property-Based Tests (fast-check)

The project will use `fast-check` as the property-based testing library with `jest` as the test runner.

**Configuration:**
- Minimum 100 iterations per property test
- Each test tagged with: `Feature: phone-otp-auth-contacts-messaging, Property N: {title}`

**Applicable properties:**
1. Phone normalization → valid E.164 output
2. Phone normalization → idempotent
3. chunkArray → preserves elements, bounded chunks
4. sendMessage → rejects whitespace-only
5. Display name resolution → priority chain
6. Phone validation → rejects invalid formats

### Unit Tests (jest)

- SignInScreen renders phone input with +27 default
- SignInScreen transitions between phone step and OTP step
- AppNavigator shows SignIn when unauthenticated
- AppNavigator shows Chats when authenticated
- AppNavigator shows loading spinner during auth check
- ChatsScreen renders chat list from useChats data
- ChatScreen renders messages from useMessages data
- Chat navigation params use chatId (not Contact object)

### Integration Tests

- useAuth: sendOTP → verifyOTP flow with mocked Firebase
- useChats: subscribes and unsubscribes on mount/unmount
- useMessages: subscribes, receives messages, sends messages
- useContacts: permission request → contact read → Firestore match
- getOrCreateDirectChat: creates new vs returns existing

### Test File Structure

```
__tests__/
├── properties/
│   ├── normalizePhone.property.test.ts
│   ├── chunkArray.property.test.ts
│   ├── sendMessage.property.test.ts
│   └── resolveDisplayName.property.test.ts
├── unit/
│   ├── SignInScreen.test.tsx
│   ├── AppNavigator.test.tsx
│   ├── ChatsScreen.test.tsx
│   └── ChatScreen.test.tsx
└── integration/
    ├── useAuth.test.ts
    ├── useChats.test.ts
    └── useContacts.test.ts
```
