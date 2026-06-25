// ─── Service: Status Cleanup ──────────────────────────────────────────────────
// Background service that automatically deletes expired statuses (older than 24 hours)
// from Firestore and Firebase Storage.

import {
  collection,
  query,
  where,
  getDocs,
  deleteDoc,
  doc,
} from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { db, storage } from '../config/firebase';

// ─── Constants ────────────────────────────────────────────────────────────────

const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // Run every hour
const BATCH_SIZE = 50; // Delete in batches to avoid overwhelming Firestore

// ─── Cleanup Function ─────────────────────────────────────────────────────────

/**
 * Delete all statuses that have expired (expiresAt < now)
 * Also deletes associated media from Firebase Storage
 */
async function cleanupExpiredStatuses(): Promise<number> {
  try {
    const now = new Date();
    const statusesRef = collection(db, 'statuses');
    const q = query(statusesRef, where('expiresAt', '<=', now));

    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      console.log('[StatusCleanup] No expired statuses found');
      return 0;
    }

    console.log(`[StatusCleanup] Found ${snapshot.size} expired statuses to delete`);

    let deletedCount = 0;
    const deletePromises: Promise<void>[] = [];

    for (const docSnap of snapshot.docs) {
      const data = docSnap.data();
      const mediaUrl = data.mediaUrl;

      // Delete media from Storage if exists
      if (mediaUrl && typeof mediaUrl === 'string') {
        const deleteMediaPromise = (async () => {
          try {
            const mediaRef = ref(storage, mediaUrl);
            await deleteObject(mediaRef);
            console.log(`[StatusCleanup] Deleted media: ${mediaUrl}`);
          } catch (storageErr: any) {
            // Ignore errors if file doesn't exist
            if (storageErr.code !== 'storage/object-not-found') {
              console.warn('[StatusCleanup] Storage delete warning:', storageErr);
            }
          }
        })();
        deletePromises.push(deleteMediaPromise);
      }

      // Delete status document from Firestore
      const deleteDocPromise = deleteDoc(doc(db, 'statuses', docSnap.id))
        .then(() => {
          console.log(`[StatusCleanup] Deleted status doc: ${docSnap.id}`);
          deletedCount++;
        })
        .catch((err) => {
          console.error(`[StatusCleanup] Failed to delete status ${docSnap.id}:`, err);
        });

      deletePromises.push(deleteDocPromise);

      // Process in batches to avoid overwhelming Firestore
      if (deletePromises.length >= BATCH_SIZE) {
        await Promise.allSettled(deletePromises);
        deletePromises.length = 0;
      }
    }

    // Delete remaining batch
    if (deletePromises.length > 0) {
      await Promise.allSettled(deletePromises);
    }

    console.log(`[StatusCleanup] Cleanup complete. Deleted ${deletedCount} statuses`);
    return deletedCount;
  } catch (err) {
    console.error('[StatusCleanup] Cleanup error:', err);
    return 0;
  }
}

// ─── Service Control ──────────────────────────────────────────────────────────

let cleanupInterval: NodeJS.Timeout | null = null;
let isRunning = false;

/**
 * Start the cleanup service
 * Runs immediately and then every CLEANUP_INTERVAL_MS
 */
export function startStatusCleanupService(): void {
  if (isRunning) {
    console.log('[StatusCleanup] Service already running');
    return;
  }

  console.log('[StatusCleanup] Starting cleanup service');
  isRunning = true;

  // Run immediately on start
  cleanupExpiredStatuses();

  // Then run periodically
  cleanupInterval = setInterval(() => {
    cleanupExpiredStatuses();
  }, CLEANUP_INTERVAL_MS);
}

/**
 * Stop the cleanup service
 */
export function stopStatusCleanupService(): void {
  if (!isRunning) {
    console.log('[StatusCleanup] Service not running');
    return;
  }

  console.log('[StatusCleanup] Stopping cleanup service');
  
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }

  isRunning = false;
}

/**
 * Check if cleanup service is running
 */
export function isCleanupServiceRunning(): boolean {
  return isRunning;
}

/**
 * Manually trigger cleanup (for testing or on-demand cleanup)
 */
export async function triggerManualCleanup(): Promise<number> {
  console.log('[StatusCleanup] Manual cleanup triggered');
  return await cleanupExpiredStatuses();
}
