import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from '../config/firebase';

export interface UploadProgress {
  bytesTransferred: number;
  totalBytes: number;
  percentage: number;
}

export interface UploadResult {
  downloadUrl: string;
  storagePath: string;
}

// ─── Dev mode: skip real Firebase Storage upload ──────────────────────────────
// Uses the local file URI directly as the "download URL" so playback works
// on the same device without needing Firebase Storage (Blaze plan).
// Remove this block and set USE_DEV_STORAGE_MOCK = false for production.
const USE_DEV_STORAGE_MOCK = __DEV__;

async function uploadVoiceNoteMock(
  uri: string,
  chatId: string,
  messageId: string,
  onProgress: (progress: UploadProgress) => void,
): Promise<UploadResult> {
  const storagePath = `voiceNotes/${chatId}/${messageId}.m4a`;

  // Simulate upload progress
  for (let i = 0; i <= 100; i += 25) {
    await new Promise((r) => setTimeout(r, 50));
    onProgress({ bytesTransferred: i * 100, totalBytes: 10000, percentage: i });
  }

  // Use the local file URI as the "download URL" — works for same-device playback
  return { downloadUrl: uri, storagePath };
}

// ─── Real Firebase Storage upload ─────────────────────────────────────────────

async function uploadVoiceNoteReal(
  uri: string,
  chatId: string,
  messageId: string,
  onProgress: (progress: UploadProgress) => void,
): Promise<UploadResult> {
  const storagePath = `voiceNotes/${chatId}/${messageId}.m4a`;
  const storageRef = ref(storage, storagePath);

  const response = await fetch(uri);
  const blob = await response.blob();

  if (blob.size > 10 * 1024 * 1024) {
    throw new Error('RECORDING_TOO_LARGE');
  }

  const uploadTask = uploadBytesResumable(storageRef, blob, {
    contentType: 'audio/mp4',
  });

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      uploadTask.cancel();
      reject(new Error('UPLOAD_TIMEOUT'));
    }, 30000);

    uploadTask.on(
      'state_changed',
      (snapshot) => {
        onProgress({
          bytesTransferred: snapshot.bytesTransferred,
          totalBytes: snapshot.totalBytes,
          percentage: Math.round(
            (snapshot.bytesTransferred / snapshot.totalBytes) * 100,
          ),
        });
      },
      (error) => {
        clearTimeout(timeout);
        reject(error);
      },
      async () => {
        clearTimeout(timeout);
        const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
        resolve({ downloadUrl, storagePath });
      },
    );
  });
}

// ─── Export ───────────────────────────────────────────────────────────────────

export const uploadVoiceNote = USE_DEV_STORAGE_MOCK
  ? uploadVoiceNoteMock
  : uploadVoiceNoteReal;
