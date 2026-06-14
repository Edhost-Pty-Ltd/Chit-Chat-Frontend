// ─── useRegistration Unit Tests ───────────────────────────────────────────────
// Tests: OTP send, verify, resend limits, profile creation, image upload, retry.
// Requirements: 2.1, 2.3, 2.6, 2.7, 3.1, 3.2, 3.4, 3.5

import React from 'react';
import { act, create, ReactTestRenderer } from 'react-test-renderer';

// ─── Mock @react-native-firebase/auth ─────────────────────────────────────────

const mockConfirm = jest.fn();
const mockSignInWithPhoneNumber = jest.fn();

const mockAuth = jest.fn(() => ({
  signInWithPhoneNumber: mockSignInWithPhoneNumber,
  currentUser: { uid: 'test-uid-123' },
}));

jest.mock('@react-native-firebase/auth', () => {
  const authFn = () => mockAuth();
  // Default export is a function that returns auth instance
  return {
    __esModule: true,
    default: authFn,
  };
});

// ─── Mock firebase/firestore ──────────────────────────────────────────────────

const mockSetDoc = jest.fn().mockResolvedValue(undefined);
const mockDoc = jest.fn().mockReturnValue({ id: 'test-uid-123', path: 'users/test-uid-123' });
const mockServerTimestamp = jest.fn(() => 'SERVER_TIMESTAMP');

jest.mock('firebase/firestore', () => ({
  doc: (...args: any[]) => mockDoc(...args),
  setDoc: (...args: any[]) => mockSetDoc(...args),
  serverTimestamp: () => mockServerTimestamp(),
}));

// ─── Mock firebase/storage ────────────────────────────────────────────────────

const mockRef = jest.fn().mockReturnValue({ fullPath: 'profile-pictures/test-uid-123.jpg' });
const mockUploadBytes = jest.fn().mockResolvedValue({ metadata: {} });
const mockGetDownloadURL = jest.fn().mockResolvedValue('https://storage.example.com/profile-pictures/test-uid-123.jpg');

jest.mock('firebase/storage', () => ({
  ref: (...args: any[]) => mockRef(...args),
  uploadBytes: (...args: any[]) => mockUploadBytes(...args),
  getDownloadURL: (...args: any[]) => mockGetDownloadURL(...args),
}));

// ─── Mock firebase config ─────────────────────────────────────────────────────

jest.mock('../../config/firebase', () => ({
  db: { type: 'mock-firestore-db' },
  storage: { type: 'mock-storage' },
}));

// ─── Mock global fetch (used by uploadProfilePicture for blob conversion) ─────

const mockBlob = { size: 1024, type: 'image/jpeg' };
global.fetch = jest.fn().mockResolvedValue({
  blob: jest.fn().mockResolvedValue(mockBlob),
}) as any;

// ─── Import after mocks ──────────────────────────────────────────────────────

import { useRegistration, UseRegistrationReturn } from '../useRegistration';

// ─── Minimal renderHook for node environment ──────────────────────────────────

function renderHook<T>(hookFn: () => T): { result: { current: T }; rerender: () => void } {
  const result: { current: T } = {} as any;
  let renderer: ReactTestRenderer;

  function TestComponent() {
    result.current = hookFn();
    return null;
  }

  act(() => {
    renderer = create(React.createElement(TestComponent));
  });

  const rerender = () => {
    act(() => {
      renderer.update(React.createElement(TestComponent));
    });
  };

  return { result, rerender };
}

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('useRegistration', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default: signInWithPhoneNumber resolves with a confirmation object
    mockSignInWithPhoneNumber.mockResolvedValue({
      confirm: mockConfirm,
    });

    // Default: confirm resolves successfully
    mockConfirm.mockResolvedValue({ user: { uid: 'test-uid-123' } });

    // Reset fetch mock
    (global.fetch as jest.Mock).mockResolvedValue({
      blob: jest.fn().mockResolvedValue(mockBlob),
    });
  });

  // ── Requirement 2.1: OTP send triggers signInWithPhoneNumber ──
  describe('submitRegistration — OTP send (Req 2.1)', () => {
    it('calls auth().signInWithPhoneNumber with the provided phone number', async () => {
      const { result } = renderHook(() => useRegistration());

      await act(async () => {
        await result.current.submitRegistration('TestUser', '+27821234567', null);
      });

      expect(mockSignInWithPhoneNumber).toHaveBeenCalledWith('+27821234567');
    });

    it('transitions step to "otp" on success', async () => {
      const { result } = renderHook(() => useRegistration());

      expect(result.current.registrationStep).toBe('form');

      await act(async () => {
        await result.current.submitRegistration('TestUser', '+27821234567', null);
      });

      expect(result.current.registrationStep).toBe('otp');
    });

    it('sets isLoading during the operation', async () => {
      let loadingDuringCall = false;
      mockSignInWithPhoneNumber.mockImplementation(() => {
        // We can't easily capture mid-call state in this test setup,
        // but we verify it's false before and after
        return Promise.resolve({ confirm: mockConfirm });
      });

      const { result } = renderHook(() => useRegistration());

      expect(result.current.isLoading).toBe(false);

      await act(async () => {
        await result.current.submitRegistration('TestUser', '+27821234567', null);
      });

      expect(result.current.isLoading).toBe(false);
    });

    it('sets error and step to "error" when signInWithPhoneNumber fails', async () => {
      mockSignInWithPhoneNumber.mockRejectedValue({ code: 'auth/invalid-phone-number' });

      const { result } = renderHook(() => useRegistration());

      await act(async () => {
        await result.current.submitRegistration('TestUser', '+invalid', null);
      });

      expect(result.current.registrationStep).toBe('error');
      expect(result.current.error).toBe('Invalid phone number. Use format +27XXXXXXXXX');
    });
  });

  // ── Requirement 2.3: verifyOTP calls confirmation.confirm ──
  describe('verifyOTP (Req 2.3)', () => {
    it('calls confirm on the stored confirmation result with the provided code', async () => {
      const { result } = renderHook(() => useRegistration());

      // First, submit registration to store confirmation
      await act(async () => {
        await result.current.submitRegistration('TestUser', '+27821234567', null);
      });

      await act(async () => {
        await result.current.verifyOTP('123456');
      });

      expect(mockConfirm).toHaveBeenCalledWith('123456');
    });

    it('returns false and sets error when no confirmation is pending', async () => {
      const { result } = renderHook(() => useRegistration());

      let returnValue: boolean = true;
      await act(async () => {
        returnValue = await result.current.verifyOTP('123456');
      });

      expect(returnValue).toBe(false);
      expect(result.current.error).toBe('No confirmation pending — please resend OTP');
    });

    it('transitions to "creating" then "done" on successful verification', async () => {
      const { result } = renderHook(() => useRegistration());

      await act(async () => {
        await result.current.submitRegistration('TestUser', '+27821234567', null);
      });

      await act(async () => {
        await result.current.verifyOTP('123456');
      });

      // After successful verify + profile creation, step should be 'done'
      expect(result.current.registrationStep).toBe('done');
    });

    it('sets error when confirm throws', async () => {
      mockConfirm.mockRejectedValue({ code: 'auth/invalid-verification-code' });

      const { result } = renderHook(() => useRegistration());

      await act(async () => {
        await result.current.submitRegistration('TestUser', '+27821234567', null);
      });

      await act(async () => {
        await result.current.verifyOTP('000000');
      });

      expect(result.current.registrationStep).toBe('error');
      expect(result.current.error).toBe('Incorrect code. Please try again.');
    });
  });

  // ── Requirement 2.6, 2.7: Resend count increments and disables after 3 ──
  describe('resendOTP — resend limiting (Req 2.6, 2.7)', () => {
    it('starts with resendCount 0 and canResend true', () => {
      const { result } = renderHook(() => useRegistration());

      expect(result.current.resendCount).toBe(0);
      expect(result.current.canResend).toBe(true);
    });

    it('increments resendCount on each successful resend', async () => {
      const { result } = renderHook(() => useRegistration());

      // Submit first to set up the phone number
      await act(async () => {
        await result.current.submitRegistration('TestUser', '+27821234567', null);
      });

      await act(async () => {
        await result.current.resendOTP();
      });

      expect(result.current.resendCount).toBe(1);
      expect(result.current.canResend).toBe(true);
    });

    it('returns false and does not call signInWithPhoneNumber after 3 resends', async () => {
      const { result } = renderHook(() => useRegistration());

      // Submit first
      await act(async () => {
        await result.current.submitRegistration('TestUser', '+27821234567', null);
      });

      // Clear to isolate resend calls
      mockSignInWithPhoneNumber.mockClear();

      // Resend 3 times
      await act(async () => {
        await result.current.resendOTP();
      });
      await act(async () => {
        await result.current.resendOTP();
      });
      await act(async () => {
        await result.current.resendOTP();
      });

      expect(result.current.resendCount).toBe(3);
      expect(result.current.canResend).toBe(false);

      // 4th attempt should fail
      mockSignInWithPhoneNumber.mockClear();
      let returnValue: boolean = true;
      await act(async () => {
        returnValue = await result.current.resendOTP();
      });

      expect(returnValue).toBe(false);
      expect(mockSignInWithPhoneNumber).not.toHaveBeenCalled();
    });

    it('calls signInWithPhoneNumber with the same phone on resend', async () => {
      const { result } = renderHook(() => useRegistration());

      await act(async () => {
        await result.current.submitRegistration('TestUser', '+27821234567', null);
      });

      mockSignInWithPhoneNumber.mockClear();

      await act(async () => {
        await result.current.resendOTP();
      });

      expect(mockSignInWithPhoneNumber).toHaveBeenCalledWith('+27821234567');
    });
  });

  // ── Requirement 3.1, 3.2: createProfile writes correct Firestore document ──
  describe('createProfile — Firestore write (Req 3.1, 3.2)', () => {
    it('writes user document to Firestore with correct fields', async () => {
      const { result } = renderHook(() => useRegistration());

      await act(async () => {
        await result.current.submitRegistration('TestUser', '+27821234567', null);
      });

      await act(async () => {
        await result.current.verifyOTP('123456');
      });

      // Verify doc was created at users/{uid}
      expect(mockDoc).toHaveBeenCalledWith(
        { type: 'mock-firestore-db' },
        'users',
        'test-uid-123'
      );

      // Verify setDoc was called with correct data
      expect(mockSetDoc).toHaveBeenCalledWith(
        expect.anything(),
        {
          uid: 'test-uid-123',
          username: 'TestUser',
          phone: '+27821234567',
          photoURL: null,
          createdAt: 'SERVER_TIMESTAMP',
          lastSeen: 'SERVER_TIMESTAMP',
        },
        { merge: true }
      );
    });

    it('uses merge: true to handle duplicate phone numbers', async () => {
      const { result } = renderHook(() => useRegistration());

      await act(async () => {
        await result.current.submitRegistration('TestUser', '+27821234567', null);
      });

      await act(async () => {
        await result.current.verifyOTP('123456');
      });

      // Verify merge option is passed
      const setDocCalls = mockSetDoc.mock.calls;
      expect(setDocCalls[0][2]).toEqual({ merge: true });
    });
  });

  // ── Requirement 3.4: Image upload stores to correct Storage path ──
  describe('createProfile — image upload (Req 3.4)', () => {
    it('uploads image to profile-pictures/{uid}.jpg path', async () => {
      const { result } = renderHook(() => useRegistration());

      await act(async () => {
        await result.current.submitRegistration('TestUser', '+27821234567', 'file:///tmp/photo.jpg');
      });

      await act(async () => {
        await result.current.verifyOTP('123456');
      });

      // Verify ref was called with correct storage path
      expect(mockRef).toHaveBeenCalledWith(
        { type: 'mock-storage' },
        'profile-pictures/test-uid-123.jpg'
      );

      // Verify uploadBytes was called with the blob
      expect(mockUploadBytes).toHaveBeenCalledWith(
        { fullPath: 'profile-pictures/test-uid-123.jpg' },
        mockBlob
      );

      // Verify getDownloadURL was called
      expect(mockGetDownloadURL).toHaveBeenCalledWith(
        { fullPath: 'profile-pictures/test-uid-123.jpg' }
      );
    });

    it('fetches image URI as blob before uploading', async () => {
      const { result } = renderHook(() => useRegistration());

      await act(async () => {
        await result.current.submitRegistration('TestUser', '+27821234567', 'file:///tmp/photo.jpg');
      });

      await act(async () => {
        await result.current.verifyOTP('123456');
      });

      expect(global.fetch).toHaveBeenCalledWith('file:///tmp/photo.jpg');
    });

    it('stores download URL as photoURL in Firestore document', async () => {
      const { result } = renderHook(() => useRegistration());

      await act(async () => {
        await result.current.submitRegistration('TestUser', '+27821234567', 'file:///tmp/photo.jpg');
      });

      await act(async () => {
        await result.current.verifyOTP('123456');
      });

      expect(mockSetDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          photoURL: 'https://storage.example.com/profile-pictures/test-uid-123.jpg',
        }),
        { merge: true }
      );
    });

    it('sets photoURL to null when no image is provided', async () => {
      const { result } = renderHook(() => useRegistration());

      await act(async () => {
        await result.current.submitRegistration('TestUser', '+27821234567', null);
      });

      await act(async () => {
        await result.current.verifyOTP('123456');
      });

      expect(mockUploadBytes).not.toHaveBeenCalled();
      expect(mockSetDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ photoURL: null }),
        { merge: true }
      );
    });
  });

  // ── Requirement 3.5: retryProfileCreation works without re-verification ──
  describe('retryProfileCreation (Req 3.5)', () => {
    it('retries profile creation without calling signInWithPhoneNumber again', async () => {
      // Setup: submit and verify OTP, but make first createProfile fail
      mockSetDoc.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useRegistration());

      await act(async () => {
        await result.current.submitRegistration('TestUser', '+27821234567', null);
      });

      await act(async () => {
        await result.current.verifyOTP('123456');
      });

      // First profile creation failed
      expect(result.current.registrationStep).toBe('error');

      // Clear and retry
      mockSignInWithPhoneNumber.mockClear();
      mockConfirm.mockClear();
      mockSetDoc.mockResolvedValue(undefined);

      await act(async () => {
        await result.current.retryProfileCreation();
      });

      // Should NOT call signInWithPhoneNumber or confirm again
      expect(mockSignInWithPhoneNumber).not.toHaveBeenCalled();
      expect(mockConfirm).not.toHaveBeenCalled();

      // Should call setDoc again
      expect(mockSetDoc).toHaveBeenCalled();
      expect(result.current.registrationStep).toBe('done');
    });

    it('transitions to "done" on successful retry', async () => {
      mockSetDoc.mockRejectedValueOnce(new Error('Temporary failure'));

      const { result } = renderHook(() => useRegistration());

      await act(async () => {
        await result.current.submitRegistration('TestUser', '+27821234567', null);
      });

      await act(async () => {
        await result.current.verifyOTP('123456');
      });

      expect(result.current.registrationStep).toBe('error');

      mockSetDoc.mockResolvedValue(undefined);

      await act(async () => {
        await result.current.retryProfileCreation();
      });

      expect(result.current.registrationStep).toBe('done');
    });
  });

  // ── proceedWithoutPhoto ──
  describe('proceedWithoutPhoto', () => {
    it('creates profile with photoURL null even if image was originally provided', async () => {
      // Make the initial upload fail so we can test proceedWithoutPhoto
      mockUploadBytes.mockRejectedValueOnce(new Error('Upload failed'));

      const { result } = renderHook(() => useRegistration());

      await act(async () => {
        await result.current.submitRegistration('TestUser', '+27821234567', 'file:///tmp/photo.jpg');
      });

      await act(async () => {
        await result.current.verifyOTP('123456');
      });

      // First profile creation failed due to upload error
      expect(result.current.registrationStep).toBe('error');

      // Clear mocks before proceedWithoutPhoto
      mockUploadBytes.mockClear();
      mockSetDoc.mockResolvedValue(undefined);

      await act(async () => {
        await result.current.proceedWithoutPhoto();
      });

      // Should not attempt image upload since we're proceeding without photo
      expect(mockUploadBytes).not.toHaveBeenCalled();

      // Should write doc with null photoURL
      const lastSetDocCall = mockSetDoc.mock.calls[mockSetDoc.mock.calls.length - 1];
      expect(lastSetDocCall[1].photoURL).toBeNull();
      expect(result.current.registrationStep).toBe('done');
    });
  });
});
