import { uploadVoiceNote } from '../voiceNoteStorage';

// Mock firebase/storage
const mockOn = jest.fn();
const mockCancel = jest.fn();
const mockUploadTask = {
  on: mockOn,
  cancel: mockCancel,
  snapshot: { ref: { fullPath: 'voiceNotes/chat1/msg1.m4a' } },
};

jest.mock('firebase/storage', () => ({
  ref: jest.fn(() => ({ fullPath: 'voiceNotes/chat1/msg1.m4a' })),
  uploadBytesResumable: jest.fn(() => mockUploadTask),
  getDownloadURL: jest.fn(() => Promise.resolve('https://storage.example.com/voice.m4a')),
}));

jest.mock('../../config/firebase', () => ({
  storage: {},
}));

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

beforeEach(() => {
  jest.clearAllMocks();
  jest.useRealTimers();
});

describe('uploadVoiceNote', () => {
  describe('file size validation', () => {
    it('rejects files over 10 MB with RECORDING_TOO_LARGE error', async () => {
      // Mock fetch to return a blob larger than 10 MB
      const oversizedBlob = { size: 10 * 1024 * 1024 + 1 };
      mockFetch.mockResolvedValue({
        blob: () => Promise.resolve(oversizedBlob),
      });

      await expect(
        uploadVoiceNote('file://recording.m4a', 'chat1', 'msg1', jest.fn()),
      ).rejects.toThrow('RECORDING_TOO_LARGE');
    });

    it('allows files exactly 10 MB', async () => {
      const exactBlob = { size: 10 * 1024 * 1024 };
      mockFetch.mockResolvedValue({
        blob: () => Promise.resolve(exactBlob),
      });

      // Simulate successful upload
      mockOn.mockImplementation((_event, _progress, _error, complete) => {
        complete();
      });

      const result = await uploadVoiceNote(
        'file://recording.m4a',
        'chat1',
        'msg1',
        jest.fn(),
      );

      expect(result).toEqual({
        downloadUrl: 'https://storage.example.com/voice.m4a',
        storagePath: 'voiceNotes/chat1/msg1.m4a',
      });
    });
  });

  describe('timeout handling', () => {
    it('rejects with UPLOAD_TIMEOUT after 30 seconds', async () => {
      jest.useFakeTimers();

      const smallBlob = { size: 1024 };
      mockFetch.mockResolvedValue({
        blob: () => Promise.resolve(smallBlob),
      });

      // Mock uploadTask.on to never call complete — simulates a stalled upload
      mockOn.mockImplementation(() => {
        // Intentionally do nothing — upload never completes
      });

      const promise = uploadVoiceNote(
        'file://recording.m4a',
        'chat1',
        'msg1',
        jest.fn(),
      );

      // Advance time by 30 seconds
      jest.advanceTimersByTime(30000);

      await expect(promise).rejects.toThrow('UPLOAD_TIMEOUT');
      expect(mockCancel).toHaveBeenCalled();
    });
  });

  describe('progress callback', () => {
    it('invokes onProgress with correct percentage values', async () => {
      const smallBlob = { size: 5000 };
      mockFetch.mockResolvedValue({
        blob: () => Promise.resolve(smallBlob),
      });

      const onProgress = jest.fn();

      // Simulate state_changed events followed by completion
      mockOn.mockImplementation((_event, progressCb, _errorCb, completeCb) => {
        // Simulate progress at 50%
        progressCb({ bytesTransferred: 2500, totalBytes: 5000 });
        // Simulate progress at 100%
        progressCb({ bytesTransferred: 5000, totalBytes: 5000 });
        // Complete the upload
        completeCb();
      });

      await uploadVoiceNote('file://recording.m4a', 'chat1', 'msg1', onProgress);

      expect(onProgress).toHaveBeenCalledTimes(2);
      expect(onProgress).toHaveBeenNthCalledWith(1, {
        bytesTransferred: 2500,
        totalBytes: 5000,
        percentage: 50,
      });
      expect(onProgress).toHaveBeenNthCalledWith(2, {
        bytesTransferred: 5000,
        totalBytes: 5000,
        percentage: 100,
      });
    });

    it('rounds percentage values correctly', async () => {
      const smallBlob = { size: 3000 };
      mockFetch.mockResolvedValue({
        blob: () => Promise.resolve(smallBlob),
      });

      const onProgress = jest.fn();

      mockOn.mockImplementation((_event, progressCb, _errorCb, completeCb) => {
        // 1000/3000 = 33.33... should round to 33
        progressCb({ bytesTransferred: 1000, totalBytes: 3000 });
        completeCb();
      });

      await uploadVoiceNote('file://recording.m4a', 'chat1', 'msg1', onProgress);

      expect(onProgress).toHaveBeenCalledWith({
        bytesTransferred: 1000,
        totalBytes: 3000,
        percentage: 33,
      });
    });
  });
});
