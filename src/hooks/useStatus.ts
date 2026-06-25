// ΓöÇΓöÇΓöÇ Hook: useStatus ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
// Manages WhatsApp-style status updates with 24-hour expiry, view tracking,
// and real-time sync with Firestore.

import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  where,
  Timestamp,
  arrayUnion,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from '../config/firebase';
import type { FireStatus } from '../types';
import { Platform } from 'react-native';

// ΓöÇΓöÇΓöÇ Interfaces ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

export interface StatusGroup {
  userId: string;
  displayName: string;
  userPhone: string | null;
  photoURL: string | null;
  statuses: FireStatus[];
  hasUnviewed: boolean;
  latestTimestamp: Date;
}

// ΓöÇΓöÇΓöÇ Helper Functions ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

/** Convert Firestore timestamp to Date */
function toDate(timestamp: any): Date {
  if (!timestamp) return new Date();
  if (timestamp.toDate) return timestamp.toDate();
  if (timestamp.seconds) return new Date(timestamp.seconds * 1000);
  return new Date(timestamp);
}

/** Check if status is expired (24 hours) */
function isExpired(expiresAt: Date): boolean {
  return new Date() > expiresAt;
}

// ΓöÇΓöÇΓöÇ Hook ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

export function useStatus(currentUserId: string | null) {
  const [myStatuses, setMyStatuses] = useState<FireStatus[]>([]);
  const [contactStatuses, setContactStatuses] = useState<StatusGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ΓöÇΓöÇ Fetch all statuses ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
  useEffect(() => {
    if (!currentUserId) {
      setLoading(false);
      return;
    }

    const statusesRef = collection(db, 'statuses');
    // Simple query — no composite index needed. We filter expired client-side.
    const q = query(statusesRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        try {
          const allStatuses: FireStatus[] = [];

          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const status: FireStatus = {
              statusId: docSnap.id,
              userId: data.userId,
              displayName: data.displayName,
              userPhone: data.userPhone ?? null,
              photoURL: data.photoURL || null,
              mediaUrl: data.mediaUrl || null,
              mediaType: data.mediaType,
              thumbnailUrl: data.thumbnailUrl || null,
              caption: data.caption || null,
              backgroundColor: data.backgroundColor || null,
              textColor: data.textColor || null,
              createdAt: toDate(data.createdAt),
              expiresAt: toDate(data.expiresAt),
              viewedBy: data.viewedBy || [],
              visibility: data.visibility || 'everyone',
              excludedUsers: data.excludedUsers || [],
              selectedUsers: data.selectedUsers || [],
            };

            // Skip expired statuses
            if (!isExpired(status.expiresAt)) {
              allStatuses.push(status);
            }
          });

          // Separate my statuses and contact statuses.
          // Guard against malformed docs (empty userId) and always exclude self.
          const mine = allStatuses.filter(
            (s) => s.userId && s.userId === currentUserId
          );
          const others = allStatuses.filter(
            (s) => s.userId && s.userId !== currentUserId
          );

          setMyStatuses(mine);

          // Group contact statuses by userId
          const grouped = new Map<string, StatusGroup>();
          for (const status of others) {
            if (!grouped.has(status.userId)) {
              grouped.set(status.userId, {
                userId: status.userId,
                displayName: status.displayName,
                userPhone: status.userPhone ?? null,
                photoURL: status.photoURL,
                statuses: [],
                hasUnviewed: false,
                latestTimestamp: status.createdAt,
              });
            }
            const group = grouped.get(status.userId)!;
            group.statuses.push(status);
            if (!status.viewedBy.includes(currentUserId)) {
              group.hasUnviewed = true;
            }
            if (status.createdAt > group.latestTimestamp) {
              group.latestTimestamp = status.createdAt;
            }
          }

          // Sort groups by latest timestamp
          const groupArray = Array.from(grouped.values()).sort(
            (a, b) => b.latestTimestamp.getTime() - a.latestTimestamp.getTime()
          );

          setContactStatuses(groupArray);
          setLoading(false);
        } catch (err) {
          console.error('[useStatus] Error processing statuses:', err);
          setError('Failed to load statuses');
          setLoading(false);
        }
      },
      (err) => {
        console.error('[useStatus] Snapshot error:', err);
        setError('Failed to sync statuses');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [currentUserId]);

  // ΓöÇΓöÇ Create status ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
  const createStatus = useCallback(
    async (
      displayName: string,
      photoURL: string | null,
      mediaType: 'image' | 'video' | 'text',
      mediaUri: string | null,
      caption: string | null,
      backgroundColor: string | null,
      textColor: string | null,
      userPhone: string | null = null
    ): Promise<string> => {
      if (!currentUserId) throw new Error('User not authenticated');

      try {
        let mediaUrl: string | null = null;
        let thumbnailUrl: string | null = null;

        // Upload media to Firebase Storage if provided
        if (mediaUri && mediaType !== 'text') {
          const timestamp = Date.now();
          const ext = mediaUri.split('.').pop()?.split('?')[0] ?? (mediaType === 'video' ? 'mp4' : 'jpg');
          const fileName = `status_${currentUserId}_${timestamp}.${ext}`;
          const storageRef = ref(storage, `statuses/${currentUserId}/${fileName}`);

          // Use XMLHttpRequest blob — works on React Native where fetch() blobs
          // are not available for local file:// URIs.
          const blob: Blob = await new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.onload = () => resolve(xhr.response as Blob);
            xhr.onerror = () => reject(new Error('Failed to read media file'));
            xhr.responseType = 'blob';
            xhr.open('GET', mediaUri);
            xhr.send();
          });

          await uploadBytes(storageRef, blob);
          mediaUrl = await getDownloadURL(storageRef);
          console.log('[useStatus] Media uploaded:', mediaUrl);
        }

        const now = new Date();
        const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours

        const statusData = {
          userId: currentUserId,
          displayName,
          userPhone,
          photoURL,
          mediaUrl,
          mediaType,
          thumbnailUrl,
          caption,
          backgroundColor,
          textColor,
          createdAt: Timestamp.fromDate(now),
          expiresAt: Timestamp.fromDate(expiresAt),
          viewedBy: [],
          visibility: 'everyone',
        };

        const statusRef = await addDoc(collection(db, 'statuses'), statusData);
        console.log('[useStatus] Status created:', statusRef.id);
        return statusRef.id;
      } catch (err) {
        console.error('[useStatus] Create status error:', err);
        throw new Error('Failed to create status');
      }
    },
    [currentUserId]
  );

  // ΓöÇΓöÇ Mark status as viewed ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
  const markAsViewed = useCallback(
    async (statusId: string) => {
      if (!currentUserId) return;

      try {
        const statusRef = doc(db, 'statuses', statusId);
        await updateDoc(statusRef, {
          viewedBy: arrayUnion(currentUserId),
        });
        console.log('[useStatus] Marked as viewed:', statusId);
      } catch (err) {
        console.error('[useStatus] Mark viewed error:', err);
      }
    },
    [currentUserId]
  );

  // ΓöÇΓöÇ Delete status ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
  const deleteStatus = useCallback(async (statusId: string, mediaUrl: string | null) => {
    try {
      // Delete media from Storage if exists
      if (mediaUrl) {
        try {
          const mediaRef = ref(storage, mediaUrl);
          await deleteObject(mediaRef);
          console.log('[useStatus] Media deleted:', mediaUrl);
        } catch (storageErr) {
          console.warn('[useStatus] Storage delete warning:', storageErr);
        }
      }

      // Delete status document from Firestore
      await deleteDoc(doc(db, 'statuses', statusId));
      console.log('[useStatus] Status deleted:', statusId);
    } catch (err) {
      console.error('[useStatus] Delete status error:', err);
      throw new Error('Failed to delete status');
    }
  }, []);

  // ΓöÇΓöÇ Delete expired statuses (cleanup) ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
  const deleteExpiredStatuses = useCallback(async () => {
    try {
      const statusesRef = collection(db, 'statuses');
      const q = query(statusesRef, where('expiresAt', '<=', new Date()));
      const snapshot = await getDocs(q);

      console.log(`[useStatus] Found ${snapshot.size} expired statuses`);

      const deletePromises = snapshot.docs.map(async (docSnap) => {
        const data = docSnap.data();
        await deleteStatus(docSnap.id, data.mediaUrl || null);
      });

      await Promise.all(deletePromises);
      console.log('[useStatus] Expired statuses cleaned up');
    } catch (err) {
      console.error('[useStatus] Cleanup error:', err);
    }
  }, [deleteStatus]);

  return {
    myStatuses,
    contactStatuses,
    loading,
    error,
    createStatus,
    markAsViewed,
    deleteStatus,
    deleteExpiredStatuses,
  };
}
