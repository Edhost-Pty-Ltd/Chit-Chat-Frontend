// ─── sendVoiceMessage Unit Tests ──────────────────────────────────────────────
// Tests: message document fields, lastMessage text, unread count increments.
// Requirements: 4.1, 4.2, 4.3

// ─── Mock firebase/firestore ──────────────────────────────────────────────────

const mockBatchSet = jest.fn();
const mockBatchUpdate = jest.fn();
const mockBatchCommit = jest.fn().mockResolvedValue(undefined);

const mockWriteBatch = jest.fn(() => ({
  set: mockBatchSet,
  update: mockBatchUpdate,
  commit: mockBatchCommit,
}));

const mockMsgRef = { id: 'generated-msg-id' };
const mockChatRef = { id: 'chat-123', path: 'chats/chat-123' };

const mockGetDoc = jest.fn();
const mockDoc = jest.fn();
const mockCollection = jest.fn();
const mockServerTimestamp = jest.fn(() => 'SERVER_TIMESTAMP');
const mockIncrement = jest.fn((n: number) => `INCREMENT(${n})`);

jest.mock('firebase/firestore', () => ({
  writeBatch: (...args: any[]) => mockWriteBatch(...args),
  doc: (...args: any[]) => mockDoc(...args),
  collection: (...args: any[]) => mockCollection(...args),
  getDoc: (...args: any[]) => mockGetDoc(...args),
  serverTimestamp: () => mockServerTimestamp(),
  increment: (n: number) => mockIncrement(n),
}));

// ─── Mock firebase config ─────────────────────────────────────────────────────

jest.mock('../../config/firebase', () => ({
  db: { type: 'mock-firestore-db' },
}));

// ─── Import after mocks ──────────────────────────────────────────────────────

import { sendVoiceMessage } from '../useChatActions';

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('sendVoiceMessage', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default: doc() returns mockChatRef for chat, mockMsgRef for message
    mockDoc.mockImplementation((...args: any[]) => {
      // When called with (db, 'chats', chatId) → chat ref
      if (args.length === 3 && args[1] === 'chats') {
        return mockChatRef;
      }
      // When called with (collectionRef) → message ref (for new doc in subcollection)
      return mockMsgRef;
    });

    mockCollection.mockReturnValue('messages-collection-ref');

    // Default chat with two members
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({
        members: ['sender-1', 'user-2', 'user-3'],
      }),
    });
  });

  // ── Requirement 4.1: Message document is created with correct voice fields ──
  describe('message document fields (Req 4.1)', () => {
    it('creates message document with correct voice fields via batch.set', async () => {
      const result = await sendVoiceMessage('chat-123', 'sender-1', 'https://storage.example.com/voice.m4a', 5000);

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('generated-msg-id');

      // Verify batch.set was called with the message ref and correct fields
      expect(mockBatchSet).toHaveBeenCalledTimes(1);
      const [setRef, setData] = mockBatchSet.mock.calls[0];
      expect(setRef).toBe(mockMsgRef);
      expect(setData).toEqual({
        messageId: 'generated-msg-id',
        senderId: 'sender-1',
        text: null,
        imageUrl: null,
        voiceUrl: 'https://storage.example.com/voice.m4a',
        type: 'voice',
        duration: 5000,
        timestamp: 'SERVER_TIMESTAMP',
        readBy: ['sender-1'],
      });
    });

    it('sets type to "voice" and includes duration in milliseconds', async () => {
      await sendVoiceMessage('chat-123', 'sender-1', 'https://example.com/audio.m4a', 12345);

      const [, setData] = mockBatchSet.mock.calls[0];
      expect(setData.type).toBe('voice');
      expect(setData.duration).toBe(12345);
      expect(setData.voiceUrl).toBe('https://example.com/audio.m4a');
    });
  });

  // ── Requirement 4.2: lastMessage text is set to "[Voice Note]" ──
  describe('lastMessage preview (Req 4.2)', () => {
    it('updates chat lastMessage with text "[Voice Note]"', async () => {
      await sendVoiceMessage('chat-123', 'sender-1', 'https://example.com/voice.m4a', 3000);

      expect(mockBatchUpdate).toHaveBeenCalledTimes(1);
      const [updateRef, updateData] = mockBatchUpdate.mock.calls[0];
      expect(updateRef).toBe(mockChatRef);
      expect(updateData['lastMessage.text']).toBe('[Voice Note]');
      expect(updateData['lastMessage.senderId']).toBe('sender-1');
      expect(updateData['lastMessage.timestamp']).toBe('SERVER_TIMESTAMP');
    });
  });

  // ── Requirement 4.3: Unread counts are incremented for other members ──
  describe('unread count increments (Req 4.3)', () => {
    it('increments unreadCounts for all members except sender', async () => {
      await sendVoiceMessage('chat-123', 'sender-1', 'https://example.com/voice.m4a', 3000);

      const [, updateData] = mockBatchUpdate.mock.calls[0];
      // Should increment for user-2 and user-3 but NOT sender-1
      expect(updateData['unreadCounts.user-2']).toBe('INCREMENT(1)');
      expect(updateData['unreadCounts.user-3']).toBe('INCREMENT(1)');
      expect(updateData['unreadCounts.sender-1']).toBeUndefined();
    });

    it('calls increment(1) for each other member', async () => {
      await sendVoiceMessage('chat-123', 'sender-1', 'https://example.com/voice.m4a', 3000);

      // increment should be called once per other member
      expect(mockIncrement).toHaveBeenCalledWith(1);
      expect(mockIncrement).toHaveBeenCalledTimes(2);
    });
  });

  // ── Edge case: chat does not exist ──
  describe('error handling', () => {
    it('returns failure when chat does not exist', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => false,
        data: () => null,
      });

      const result = await sendVoiceMessage('nonexistent-chat', 'sender-1', 'https://example.com/voice.m4a', 3000);

      expect(result.success).toBe(false);
      expect(result.messageId).toBe('');
      expect(mockBatchSet).not.toHaveBeenCalled();
      expect(mockBatchCommit).not.toHaveBeenCalled();
    });
  });
});
