// ─── Local Data Export ────────────────────────────────────────────────────────
// Exports ALL locally-cached chat messages (from useLocalMessages) into a single
// encrypted file the user can save/share however they choose — AirDrop, email,
// USB, cloud drive, etc. Nothing is ever uploaded to our backend.
//
// File format (before encryption):
// {
//   version: 1,
//   exportedAt: "2026-07-14T10:00:00.000Z",
//   deviceName: "Junior's Phone" (optional, informational only),
//   chats: [
//     { chatId: "abc123", messages: [ ...FireMessage as serialised JSON... ] },
//     ...
//   ]
// }
//
// Encryption: AES-256-CBC via crypto-js, key derived from user passphrase
// using PBKDF2 (100,000 iterations) with a random salt stored alongside the
// ciphertext. This means brute-forcing the passphrase is expensive even if
// the exported file is intercepted.

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as CryptoJS from 'crypto-js';

const LOCAL_MSG_PREFIX = 'local_msgs_';
const EXPORT_FILE_VERSION = 1;
const PBKDF2_ITERATIONS = 100_000;

export interface ExportResult {
  success: boolean;
  fileUri?: string;
  chatCount?: number;
  messageCount?: number;
  error?: string;
}

export interface ExportProgress {
  stage: 'reading' | 'encrypting' | 'writing' | 'done';
  chatsProcessed?: number;
  totalChats?: number;
}

// ── Step 1: Discover every chat that has local data ──────────────────────────
async function getAllLocalChatIds(): Promise<string[]> {
  const allKeys = await AsyncStorage.getAllKeys();
  return allKeys
    .filter((k) => k.startsWith(LOCAL_MSG_PREFIX))
    .map((k) => k.slice(LOCAL_MSG_PREFIX.length));
}

// ── Step 2: Read raw local message data for every chat ───────────────────────
// We read the raw AsyncStorage strings directly (already-serialised JSON)
// rather than going through loadLocalMessages/deserialise, since we're just
// repackaging the data, not rendering it — this avoids an unnecessary
// deserialise → reserialise round trip.
async function readAllLocalChats(): Promise<{ chatId: string; rawMessages: any[] }[]> {
  const chatIds = await getAllLocalChatIds();
  const results: { chatId: string; rawMessages: any[] }[] = [];

  for (const chatId of chatIds) {
    try {
      const raw = await AsyncStorage.getItem(`${LOCAL_MSG_PREFIX}${chatId}`);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        results.push({ chatId, rawMessages: parsed });
      }
    } catch (err) {
      console.warn(`[exportLocalData] Failed to read chat ${chatId}:`, err);
      // Skip corrupted entries rather than failing the whole export
    }
  }

  return results;
}

// ── Step 3: Encrypt the export payload with a user-supplied passphrase ───────
function encryptPayload(payload: object, passphrase: string): string {
  const salt = CryptoJS.lib.WordArray.random(128 / 8);
  const key = CryptoJS.PBKDF2(passphrase, salt, {
    keySize: 256 / 32,
    iterations: PBKDF2_ITERATIONS,
  });

  const iv = CryptoJS.lib.WordArray.random(128 / 8);
  const plaintext = JSON.stringify(payload);

  const encrypted = CryptoJS.AES.encrypt(plaintext, key, {
    iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });

  // Bundle salt + iv + ciphertext together so import can reconstruct the key.
  // All hex-encoded for safe JSON/text storage.
  const bundle = {
    salt: salt.toString(CryptoJS.enc.Hex),
    iv: iv.toString(CryptoJS.enc.Hex),
    ciphertext: encrypted.toString(), // base64 by default
  };

  return JSON.stringify(bundle);
}

// ── Main export function ──────────────────────────────────────────────────────
export async function exportLocalData(
  passphrase: string,
  onProgress?: (progress: ExportProgress) => void,
): Promise<ExportResult> {
  try {
    if (!passphrase || passphrase.length < 6) {
      return { success: false, error: 'Passphrase must be at least 6 characters.' };
    }

    onProgress?.({ stage: 'reading' });
    const localChats = await readAllLocalChats();

    if (localChats.length === 0) {
      return { success: false, error: 'No local messages found to export.' };
    }

    const totalMessages = localChats.reduce((sum, c) => sum + c.rawMessages.length, 0);

    const payload = {
      version: EXPORT_FILE_VERSION,
      exportedAt: new Date().toISOString(),
      chats: localChats.map((c) => ({
        chatId: c.chatId,
        messages: c.rawMessages,
      })),
    };

    onProgress?.({
      stage: 'encrypting',
      chatsProcessed: localChats.length,
      totalChats: localChats.length,
    });

    const encrypted = encryptPayload(payload, passphrase);

    onProgress?.({ stage: 'writing' });

    const fileName = `chitchat-export-${Date.now()}.chitchat`;
    const fileUri = `${FileSystem.documentDirectory}${fileName}`;

    await FileSystem.writeAsStringAsync(fileUri, encrypted, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    onProgress?.({ stage: 'done' });

    return {
      success: true,
      fileUri,
      chatCount: localChats.length,
      messageCount: totalMessages,
    };
  } catch (err: any) {
    console.error('[exportLocalData] Export failed:', err);
    return { success: false, error: err.message ?? 'Export failed unexpectedly.' };
  }
}

// ── Trigger the native share sheet so the user picks where the file goes ─────
// (AirDrop, email, Drive, WhatsApp, USB via Files app, etc.)
export async function shareExportedFile(fileUri: string): Promise<boolean> {
  try {
    const canShare = await Sharing.isAvailableAsync();
    if (!canShare) {
      console.warn('[exportLocalData] Sharing is not available on this device.');
      return false;
    }

    await Sharing.shareAsync(fileUri, {
      mimeType: 'application/octet-stream',
      dialogTitle: 'Save or send your Chit-Chat data export',
      UTI: 'public.data', // iOS
    });

    return true;
  } catch (err) {
    console.error('[exportLocalData] Share failed:', err);
    return false;
  }
}

// ── Clean up the temp export file after sharing completes ────────────────────
export async function deleteExportedFile(fileUri: string): Promise<void> {
  try {
    await FileSystem.deleteAsync(fileUri, { idempotent: true });
  } catch (err) {
    console.warn('[exportLocalData] Failed to delete temp export file:', err);
  }
}
