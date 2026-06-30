// ─── useVoiceRecorder Hook (Web Implementation) ──────────────────────────────
// Web implementation using MediaRecorder API

import { useState, useRef, useCallback, useEffect } from 'react';

export interface RecordingResult {
  uri: string;
  duration: number;
  size: number;
}

export interface UseVoiceRecorderReturn {
  isRecording: boolean;
  duration: number;
  isWarning: boolean;
  error: string | null;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<RecordingResult | null>;
}

const MAX_DURATION_MS = 120000; // 120 seconds
const WARNING_DURATION_MS = 110000; // 110 seconds

export function useVoiceRecorder(): UseVoiceRecorderReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [isWarning, setIsWarning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startRecording = useCallback(async () => {
    try {
      console.log('[useVoiceRecorder-Web] Starting recording...');
      setError(null);

      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Create MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm',
      });

      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;

      startTimeRef.current = Date.now();
      setIsRecording(true);
      setDuration(0);
      setIsWarning(false);

      // Start duration timer
      intervalRef.current = setInterval(() => {
        const elapsed = Date.now() - startTimeRef.current;
        setDuration(Math.floor(elapsed / 1000));

        // Show warning near max duration
        if (elapsed >= WARNING_DURATION_MS) {
          setIsWarning(true);
        }

        // Auto-stop at max duration
        if (elapsed >= MAX_DURATION_MS) {
          console.log('[useVoiceRecorder-Web] Max duration reached, auto-stopping');
          stopRecording();
        }
      }, 100);

      console.log('[useVoiceRecorder-Web] Recording started');
    } catch (err: any) {
      console.error('[useVoiceRecorder-Web] Failed to start recording:', err);
      setError(err.message || 'Failed to start recording');
      setIsRecording(false);
    }
  }, []);

  const stopRecording = useCallback(async (): Promise<RecordingResult | null> => {
    try {
      console.log('[useVoiceRecorder-Web] Stopping recording...');

      // Clear interval
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }

      if (!mediaRecorderRef.current) {
        console.warn('[useVoiceRecorder-Web] No active recorder');
        return null;
      }

      // Stop recording
      return new Promise<RecordingResult>((resolve) => {
        const recorder = mediaRecorderRef.current!;

        recorder.onstop = () => {
          // Create blob from chunks
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          
          // Create object URL
          const uri = URL.createObjectURL(audioBlob);
          
          const durationSec = Math.floor((Date.now() - startTimeRef.current) / 1000);
          const size = audioBlob.size;

          console.log('[useVoiceRecorder-Web] Recording stopped:', { uri, duration: durationSec, size });

          setIsRecording(false);
          setDuration(0);
          setIsWarning(false);

          resolve({
            uri,
            duration: durationSec,
            size,
          });
        };

        recorder.stop();
        mediaRecorderRef.current = null;
      });
    } catch (err: any) {
      console.error('[useVoiceRecorder-Web] Failed to stop recording:', err);
      setError(err.message || 'Failed to stop recording');
      setIsRecording(false);
      return null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  return {
    isRecording,
    duration,
    isWarning,
    error,
    startRecording,
    stopRecording,
  };
}
