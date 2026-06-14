// ─── Firebase Storage Utilities ───────────────────────────────────────────────
import { ref, getDownloadURL, deleteObject } from 'firebase/storage';
import { readAsStringAsync, EncodingType } from 'expo-file-system/legacy';
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
export async function uploadFile(
  localUri:  string,
  type:      UploadType,
  params:    { userId?: string; chatId?: string; fileName: string },
  onProgress?: (pct: number) => void,
): Promise<string> {
  const path = buildPath(type, params);
  
  try {
    console.log('[Storage] Reading file from:', localUri);
    
    // Read file as base64
    const base64 = await readAsStringAsync(localUri, {
      encoding: EncodingType.Base64,
    });
    
    console.log('[Storage] File read successfully, getting auth token...');
    
    // Get authentication token from Firebase Auth
    const { getAuth } = await import('@react-native-firebase/auth');
    const auth = getAuth();
    const currentUser = auth.currentUser;
    
    if (!currentUser) {
      throw new Error('User not authenticated');
    }
    
    const idToken = await currentUser.getIdToken();
    console.log('[Storage] Got auth token, uploading via XMLHttpRequest...');
    
    // Use XMLHttpRequest to upload directly to Firebase Storage
    // This avoids blob creation issues
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      
      // Get upload URL from Firebase Storage
      const storageRef = ref(firebaseStorage, path);
      
      // Convert base64 to Uint8Array (no blob needed!)
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      // Upload progress
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && onProgress) {
          const pct = (event.loaded / event.total) * 100;
          onProgress(Math.round(pct));
        }
      };
      
      xhr.onload = async () => {
        if (xhr.status === 200) {
          try {
            // Get download URL after successful upload
            const downloadURL = await getDownloadURL(storageRef);
            console.log('[Storage] Upload complete:', downloadURL);
            resolve(downloadURL);
          } catch (error) {
            reject(error);
          }
        } else {
          console.error('[Storage] Upload failed. Status:', xhr.status, 'Response:', xhr.responseText);
          reject(new Error(`Upload failed with status ${xhr.status}`));
        }
      };
      
      xhr.onerror = () => {
        reject(new Error('Network error during upload'));
      };
      
      // Use Firebase REST API for upload with authentication
      const uploadUrl = `https://firebasestorage.googleapis.com/v0/b/${firebaseStorage.app.options.storageBucket}/o?name=${encodeURIComponent(path)}`;
      
      xhr.open('POST', uploadUrl, true);
      const mimeType = getMimeType(localUri);
      xhr.setRequestHeader('Content-Type', mimeType);
      xhr.setRequestHeader('Authorization', `Bearer ${idToken}`);
      
      // Send the binary data
      xhr.send(bytes);
    });
  } catch (error) {
    console.error('[Storage] Upload preparation error:', error);
    throw error;
  }
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
    // Images
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    
    // Videos
    'mp4': 'video/mp4',
    'mov': 'video/quicktime',
    'avi': 'video/x-msvideo',
    
    // Audio
    'm4a': 'audio/mp4',
    'mp3': 'audio/mpeg',
    'wav': 'audio/wav',
    
    // Documents
    'pdf': 'application/pdf',
    'txt': 'text/plain',
  };
  
  return mimeTypes[extension] || 'application/octet-stream';
}