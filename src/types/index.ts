// ─── App-wide TypeScript Types ───────────────────────────────────────────────

export type ContactStatus = 'online' | 'away' | 'offline';

export type CallType = 'Outgoing' | 'Incoming' | 'Missed';

export type MessageType = 'in' | 'out';

export interface Contact {
  id: number;
  name: string;
  avatar: string;       // initials, e.g. "AM"
  color: string;        // hex accent colour for avatar
  status: ContactStatus;
  lastMsg: string;
  time: string;
  unread: number;
  pinned?: boolean;
  members?: Contact[];  // group members (only set for group contacts)
}

export interface Message {
  id: number;
  from: string;
  text?: string;
  image?: boolean;
  voice?: boolean;
  time: string;
  type: MessageType;
  // Number-change system message fields
  numberChange?: {
    oldNumber: string;
    newNumber: string;
    displayName: string;
  };
  // Group-left system message
  groupLeft?: {
    groupName: string;
    displayName: string;
  };
}

export interface Call {
  id: number;
  name: string;
  avatar: string;
  color: string;
  type: CallType;
  time: string;
  missed: boolean;
}

export interface StatusUpdate {
  id: number;
  name: string;
  avatar: string;
  color: string;
  time: string;
}

// ─── Calendar ─────────────────────────────────────────────────────────────
export interface CalendarEvent {
  id: number;
  title: string;
  date: string;       // "YYYY-MM-DD"
  startTime: string;
  endTime: string;
  color: string;
}

// ─── Notes ────────────────────────────────────────────────────────────────
export interface NoteAttachment {
  uri:  string;
  name: string;
  type: 'image' | 'document';
}

export interface DrawStroke {
  points: { x: number; y: number }[];
  color:  string;
  width:  number;
}

export interface Note {
  id: number;
  title: string;
  preview: string;
  date: string;
  checked?: boolean;
  attachments?: NoteAttachment[];
  strokes?: DrawStroke[];
}

// ─── Navigation param list ─────────────────────────────────────────────────
export type RootStackParamList = {
  Splash: undefined;
  SignIn: undefined;
  Chats: undefined;
  Chat: { contact: Contact };
  Calls: undefined;
  Status: undefined;
  Contacts: undefined;
  Calendar: undefined;
  Notes: undefined;
  Settings: undefined;
  Appearance: undefined;
  Profile: undefined;
  CreateAccount: undefined;
  VideoCall: { contact: Contact; duration?: number; participants?: Contact[] };
  AudioCall: { contact: Contact; duration?: number; participants?: Contact[] };
  AccountSettings: undefined;
  PrivacySettings: undefined;
  NotificationSettings: undefined;
  ChangeNumber: undefined;
  Notifications: undefined;
  LinkedDevices: undefined;
};
