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

// ─── Real-time Chat Message (Firestore) ───────────────────────────────────────
export interface ChatMessage {
  messageId: string;
  senderId: string;
  text: string | null;
  type: 'text' | 'image' | 'video' | 'voice' | 'audio' | 'file';
  
  // Media URLs
  imageUrl?: string | null;
  videoUrl?: string | null;
  voiceUrl?: string | null;
  audioUrl?: string | null;
  fileUrl?: string | null;
  
  // Media metadata
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  duration?: number;
  thumbnailUrl?: string;
  
  timestamp: Date;
  readBy: string[];
  editedAt?: Date | null;
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
  Splash: undefined;
  SignIn: undefined;
  Chats: undefined;
  Chat: { chatId: string; displayName: string; isGroup: boolean; otherUserId?: string; otherUserPhoto?: string | null };
  Calls: undefined;
  Status: undefined;
  Contacts: undefined;
  Calendar: undefined;
  Notes: undefined;
  CloudBackup: undefined;
  Settings: undefined;
  Appearance: undefined;
  Profile: undefined;
  CreateAccount: undefined;
  VideoCall: { contact: Contact };
  AudioCall: { 
    callId: string;
    isOutgoing: boolean;
    otherParty: {
      userId: string;
      displayName: string;
      photoUrl: string | null;
    };
  };
};
