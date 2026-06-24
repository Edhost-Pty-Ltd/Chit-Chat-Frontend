// ─── useStatus Hook ──────────────────────────────────────────────────────────
// Real-time status (story) updates: post images (7s each) and videos (<=30s),
// view others' statuses, and auto-expire after 24h.

import { useState, useEffect, useCallback } from 'react';
import {
  collection, query, onSnapshot, doc, setDoc, getDoc, updateDoc,
  deleteDoc, serverTimestamp, arrayUnion,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { uploadFile, generateFileName, getFileExtension } from '../config/storage';

/** Each image status is shown for this long. */
export const IMAGE_STATUS_DURATION_MS = 7000;
/** Videos longer than this are rejected / trimmed. */
export const MAX_VIDEO_STATUS_MS = 30000;
/** Statuses disappear after this many hours. */
const STATUS_TTL_HOURS = 24;

export interface StatusItem {
  statusId: string;
  userId: string;
  userPhone: string;
  userPhotoURL: string | null;
  type: 'image' | 'video';
  mediaUrl: string;
  durationMs: number;
  createdAt: Date | null;
  viewedBy: string[];
}

export function useStatus(userId: string | null, userPhone: string | null) {
  const [statuses, setStatuses] = useState<StatusItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);

  // ── Real-time listener (filter expired client-side) ──────────────
  useEffect(() => {
    const q = query(collection(db, 'statuses'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const now = Date.now();
        const items: StatusItem[] = [];
        snap.forEach((d) => {
          const data = d.data();
          const expiresAt = data.expiresAt?.toDate
            ? data.expiresAt.toDate()
            : data.expiresAt
            ? new Date(data.expiresAt)
            : null;
          if (expiresAt && expiresAt.getTime() < now) return; // skip expired
          items.push({
            statusId: d.id,
            userId: data.userId,
            userPhone: data.userPhone ?? '',
            userPhotoURL: data.userPhotoURL ?? null,
            type: data.type,
            mediaUrl: data.mediaUrl,
            durationMs: data.durationMs ?? IMAGE_STATUS_DURATION_MS,
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : null,
            viewedBy: data.viewedBy ?? [],
          });
        });
        items.sort(
          (a, b) => (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0)
        );
        setStatuses(items);
        setLoading(false);
      },
      (err) => {
        console.error('[useStatus] listener error:', err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  // Resolve the poster's profile photo once per posting batch.
  const fetchPhotoURL = useCallback(async (): Promise<string | null> => {
    if (!userId) return null;
    try {
      const snap = await getDoc(doc(db, 'users', userId));
      return snap.exists() ? snap.data().photoURL ?? null : null;
    } catch {
      return null;
    }
  }, [userId]);

  const createStatusDoc = useCallback(
    async (params: {
      type: 'image' | 'video';
      mediaUrl: string;
      durationMs: number;
      photoURL: string | null;
    }) => {
      if (!userId) return;
      const ref = doc(collection(db, 'statuses'));
      await setDoc(ref, {
        statusId: ref.id,
        userId,
        userPhone: userPhone ?? '',
        userPhotoURL: params.photoURL,
        type: params.type,
        mediaUrl: params.mediaUrl,
        durationMs: params.durationMs,
        createdAt: serverTimestamp(),
        expiresAt: new Date(Date.now() + STATUS_TTL_HOURS * 60 * 60 * 1000),
        viewedBy: [],
      });
    },
    [userId, userPhone]
  );

  // ── Post one or more image statuses ──────────────────────────────
  const postImageStatuses = useCallback(
    async (uris: string[]): Promise<boolean> => {
      if (!userId || uris.length === 0) return false;
      setPosting(true);
      try {
        const photoURL = await fetchPhotoURL();
        for (const uri of uris) {
          const fileName = generateFileName(getFileExtension(uri));
          const url = await uploadFile(uri, 'status', { userId, fileName });
          await createStatusDoc({
            type: 'image',
            mediaUrl: url,
            durationMs: IMAGE_STATUS_DURATION_MS,
            photoURL,
          });
        }
        return true;
      } catch (err) {
        console.error('[useStatus] postImageStatuses error:', err);
        return false;
      } finally {
        setPosting(false);
      }
    },
    [userId, fetchPhotoURL, createStatusDoc]
  );

  // ── Post a video status (clamped to 30s) ─────────────────────────
  const postVideoStatus = useCallback(
    async (uri: string, durationMs: number): Promise<boolean> => {
      if (!userId) return false;
      setPosting(true);
      try {
        const photoURL = await fetchPhotoURL();
        const fileName = generateFileName(getFileExtension(uri));
        const url = await uploadFile(uri, 'status', { userId, fileName });
        await createStatusDoc({
          type: 'video',
          mediaUrl: url,
          durationMs: Math.min(durationMs || MAX_VIDEO_STATUS_MS, MAX_VIDEO_STATUS_MS),
          photoURL,
        });
        return true;
      } catch (err) {
        console.error('[useStatus] postVideoStatus error:', err);
        return false;
      } finally {
        setPosting(false);
      }
    },
    [userId, fetchPhotoURL, createStatusDoc]
  );

  // ── Mark a status as viewed by the current user ──────────────────
  const markViewed = useCallback(
    async (statusId: string) => {
      if (!userId) return;
      try {
        await updateDoc(doc(db, 'statuses', statusId), {
          viewedBy: arrayUnion(userId),
        });
      } catch {
        // non-critical
      }
    },
    [userId]
  );

  // ── Delete one of the current user's statuses ────────────────────
  const deleteStatus = useCallback(async (statusId: string) => {
    try {
      await deleteDoc(doc(db, 'statuses', statusId));
    } catch (err) {
      console.error('[useStatus] deleteStatus error:', err);
    }
  }, []);

  return {
    statuses,
    loading,
    posting,
    postImageStatuses,
    postVideoStatus,
    markViewed,
    deleteStatus,
  };
}
