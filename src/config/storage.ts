// ─── Firebase Storage Utilities ───────────────────────────────────────────────
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage as firebaseStorage } from './firebase';

export type UploadType = 'avatar' | 'chatMedia' | 'voice' | 'groupIcon' | 'status';

// Build the correct Storage path for each media type
function buildPath(type: UploadType, params: {
  userId?:  string;
  chatId?:  string;
  fileName: string;
}): string {
  const { userId, chatId, fileName } = params;
  switch (type) {
    case 'avatar':    return `avatars/${userId}/${fileName}`;
    case 'chatMedia': return `chats/${chatId}/media/${fileName}`;
    case 'voice':     return `chats/${chatId}/voice/${fileName}`;
    case 'groupIcon': return `groups/${chatId}/${fileName}`;
    case 'status':    return `status/${userId}/${fileName}`;
    default:          return `misc/${fileName}`;
  }
}

// ── Upload any file and return download URL ───────────────────────────────────
// React Native's XMLHttpRequest can create a Blob directly from a local URI
// (file:// or content://) through the native layer without copying the entire
// file into a JS string — so large videos won't cause an OOM error.
// We then hand the Blob to Firebase Storage SDK's uploadBytesResumable which
// supports progress reporting and automatic retries.
export async function uploadFile(
  localUri:  string,
  type:      UploadType,
  params:    { userId?: string; chatId?: string; fileName: string },
  onProgress?: (pct: number) => void,
): Promise<string> {
  const path = buildPath(type, params);
  console.log('[Storage] Uploading file:', localUri, '→', path);

  // Step 1: Obtain a Blob from the local URI without reading it as a string.
  // The React Native XHR bridge handles this natively, keeping memory usage low.
  const blob: Blob = await new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.onload  = () => resolve(xhr.response as Blob);
    xhr.onerror = () => reject(new Error('Failed to read local file as blob'));
    xhr.responseType = 'blob';
    xhr.open('GET', localUri);
    xhr.send();
  });

  // Step 2: Upload the Blob to Firebase Storage with progress reporting.
  const storageRef = ref(firebaseStorage, path);
  return new Promise((resolve, reject) => {
    const task = uploadBytesResumable(storageRef, blob, {
      contentType: getMimeType(localUri),
    });

    task.on(
      'state_changed',
      (snapshot) => {
        if (onProgress && snapshot.totalBytes > 0) {
          onProgress(Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100));
        }
      },
      (error) => reject(error),
      async () => {
        try {
          const url = await getDownloadURL(task.snapshot.ref);
          console.log('[Storage] Upload complete:', url);
          resolve(url);
        } catch (e) {
          reject(e);
        }
      },
    );
  });
}

// ── Delete a file from Storage ────────────────────────────────────────────────
export async function deleteFile(downloadUrl: string): Promise<void> {
  const fileRef = ref(firebaseStorage, downloadUrl);
  await deleteObject(fileRef);
}

// ── Generate a unique filename with timestamp ─────────────────────────────────
export function generateFileName(extension: string): string {
  const timestamp = Date.now();
  const random    = Math.random().toString(36).slice(2, 8);
  return `${timestamp}_${random}.${extension}`;
}

// ── Get file extension from URI ───────────────────────────────────────────────
export function getFileExtension(uri: string): string {
  return uri.split('.').pop()?.toLowerCase() || 'jpg';
}

// ── Detect MIME type from file extension ──────────────────────────────────────
export function getMimeType(uri: string): string {
  const extension = getFileExtension(uri);

  const mimeTypes: Record<string, string> = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'mp4': 'video/mp4',
    'mov': 'video/quicktime',
    'avi': 'video/x-msvideo',
    'm4a': 'audio/mp4',
    'mp3': 'audio/mpeg',
    'wav': 'audio/wav',
    'pdf': 'application/pdf',
    'txt': 'text/plain',
  };

  return mimeTypes[extension] || 'application/octet-stream';
}
