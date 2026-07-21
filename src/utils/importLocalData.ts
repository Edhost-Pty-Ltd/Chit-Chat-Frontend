// ─── Local Data Import ────────────────────────────────────────────────────────
// Imports a .chitchat export file created by exportLocalData.ts, decrypts it
// with the user-supplied passphrase, validates the structure, and merges the
// messages into each chat's local AsyncStorage cache — reusing the existing
// mergeLocalMessages dedup logic so re-importing the same file is always safe.

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as DocumentPicker from 'expo-document-picker';
import * as CryptoJS from 'crypto-js';
import { mergeLocalMessages } from '../hooks/useLocalMessages';
import type { FireMessage } from '../hooks/useMessages';

const PBKDF2_ITERATIONS = 100_000;
const SUPPORTED_VERSIONS = [1];

export interface ImportResult {
  success: boolean;
  chatCount?: number;
  messageCount?: number;
  chatsSummary?: { chatId: string; messageCount: number }[];
  error?: string;
}

export interface ImportProgress {
  stage: 'picking' | 'decrypting' | 'validating' | 'merging' | 'done';
  chatsProcessed?: number;
  totalChats?: number;
}

// ── Step 1: Let the user pick the exported file ───────────────────────────────
export async function pickExportFile(): Promise<string | null> {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: '*/*', // .chitchat has no standard MIME type — accept any, validate content instead
      copyToCacheDirectory: true,
    });

    if (result.canceled || !result.assets?.[0]) return null;
    return result.assets[0].uri;
  } catch (err) {
    console.warn('[importLocalData] File picker error:', err);
    return null;
  }
}

// ── Step 2: Decrypt the file content with the user's passphrase ──────────────
function decryptPayload(fileContent: string, passphrase: string): object | null {
  try {
    const bundle = JSON.parse(fileContent);
    if (!bundle.salt || !bundle.iv || !bundle.ciphertext) {
      throw new Error('File is not a valid Chit-Chat export.');
    }

    const salt = CryptoJS.enc.Hex.parse(bundle.salt);
    const iv = CryptoJS.enc.Hex.parse(bundle.iv);

    const key = CryptoJS.PBKDF2(passphrase, salt, {
      keySize: 256 / 32,
      iterations: PBKDF2_ITERATIONS,
    });

    const decrypted = CryptoJS.AES.decrypt(bundle.ciphertext, key, {
      iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    });

    const plaintext = decrypted.toString(CryptoJS.enc.Utf8);
    if (!plaintext) {
      // Wrong passphrase produces empty/garbage output rather than an exception
      throw new Error('Incorrect passphrase or corrupted file.');
    }

    return JSON.parse(plaintext);
  } catch (err) {
    console.warn('[importLocalData] Decryption failed:', err);
    return null;
  }
}

// ── Step 3: Validate the decrypted payload structure ─────────────────────────
function validatePayload(payload: any): payload is {
  version: number;
  exportedAt: string;
  chats: { chatId: string; messages: any[] }[];
} {
  if (!payload || typeof payload !== 'object') return false;
  if (!SUPPORTED_VERSIONS.includes(payload.version)) return false;
  if (!Array.isArray(payload.chats)) return false;

  return payload.chats.every(
    (c: any) =>
      typeof c.chatId === 'string' &&
      Array.isArray(c.messages),
  );
}

// ── Step 4: Deserialise raw stored messages back into FireMessage shape ──────
// Mirrors the deserialise() logic in useLocalMessages.ts — kept separate here
// since that function isn't exported, and duplicating this small mapping is
// safer than changing useLocalMessages' public API for import's sake.
function deserialiseForImport(raw: any): FireMessage {
  return {
    ...raw,
    timestamp: raw.timestamp ? new Date(raw.timestamp) : null,
    expiresAt: raw.expiresAt ? new Date(raw.expiresAt) : null,
    liveLocationExpiry: raw.liveLocationExpiry ? new Date(raw.liveLocationExpiry) : null,
  } as FireMessage;
}

// ── Main import function ──────────────────────────────────────────────────────
export async function importLocalData(
  fileUri: string,
  passphrase: string,
  onProgress?: (progress: ImportProgress) => void,
): Promise<ImportResult> {
  try {
    if (!passphrase) {
      return { success: false, error: 'Please enter the passphrase used during export.' };
    }

    onProgress?.({ stage: 'decrypting' });
    const fileContent = await FileSystem.readAsStringAsync(fileUri, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    const decrypted = decryptPayload(fileContent, passphrase);
    if (!decrypted) {
      return {
        success: false,
        error: 'Could not decrypt this file. Check your passphrase and try again.',
      };
    }

    onProgress?.({ stage: 'validating' });
    if (!validatePayload(decrypted)) {
      return {
        success: false,
        error: 'This file is not a valid or supported Chit-Chat export.',
      };
    }

    onProgress?.({ stage: 'merging', totalChats: decrypted.chats.length, chatsProcessed: 0 });

    const summary: { chatId: string; messageCount: number }[] = [];
    let totalMessages = 0;

    for (let i = 0; i < decrypted.chats.length; i++) {
      const chat = decrypted.chats[i];

      try {
        const incomingMessages = chat.messages.map(deserialiseForImport);

        // Reuse the existing merge logic — dedupes by messageId, sorts by
        // timestamp, and writes back to AsyncStorage. Safe to re-run on the
        // same file multiple times without creating duplicates.
        const merged = await mergeLocalMessages(chat.chatId, incomingMessages);

        summary.push({ chatId: chat.chatId, messageCount: incomingMessages.length });
        totalMessages += incomingMessages.length;
      } catch (err) {
        console.warn(`[importLocalData] Failed to merge chat ${chat.chatId}:`, err);
        // Continue with remaining chats rather than aborting the whole import
      }

      onProgress?.({
        stage: 'merging',
        chatsProcessed: i + 1,
        totalChats: decrypted.chats.length,
      });
    }

    onProgress?.({ stage: 'done' });

    return {
      success: true,
      chatCount: summary.length,
      messageCount: totalMessages,
      chatsSummary: summary,
    };
  } catch (err: any) {
    console.error('[importLocalData] Import failed:', err);
    return { success: false, error: err.message ?? 'Import failed unexpectedly.' };
  }
}
