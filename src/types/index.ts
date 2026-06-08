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
}

export interface Message {
  id: number;
  from: string;
  text?: string;
  image?: boolean;
  voice?: boolean;
  time: string;
  type: MessageType;
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
export interface Note {
  id: number;
  title: string;
  preview: string;
  date: string;
  checked?: boolean;
}

// ─── Navigation param list ─────────────────────────────────────────────────
export type RootStackParamList = {
  SignIn: undefined;
  Chats: undefined;
  Chat: { contact: Contact };
  Calls: undefined;
  Status: undefined;
  Contacts: undefined;
  Calendar: undefined;
  Notes: undefined;
  CloudBackup: undefined;
  Settings: undefined;
};
