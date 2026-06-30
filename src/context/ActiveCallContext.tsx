// ─── Context: Active Call ────────────────────────────────────────────────────
// Holds the single active LiveKit call so it can be hosted at the app level
// (above navigation). This lets a call be minimized into a floating overlay and
// keep running while the user navigates the rest of the app.

import React, { createContext, useContext, useState, useCallback } from 'react';

export interface ActiveCallParams {
  /** LiveKit room name */
  roomName: string;
  /** Local participant's LiveKit display name (their phone number) */
  displayName: string;
  /** Whether the call started as audio-only */
  audioOnly: boolean;
  /** Header title: group name, or the other person's name/phone for 1-on-1 */
  groupName: string;
  /** Initial participant count */
  memberCount: number;
  /** Chat document id (for the in-call chat button + invites) */
  chatId?: string;
  /** Group call id (for Firestore call/notification bookkeeping) */
  callId?: string;
}

interface ActiveCallContextValue {
  call: ActiveCallParams | null;
  minimized: boolean;
  startCall: (params: ActiveCallParams) => void;
  endCall: () => void;
  minimize: () => void;
  maximize: () => void;
}

const ActiveCallContext = createContext<ActiveCallContextValue>({
  call: null,
  minimized: false,
  startCall: () => {},
  endCall: () => {},
  minimize: () => {},
  maximize: () => {},
});

export function ActiveCallProvider({ children }: { children: React.ReactNode }) {
  const [call, setCall] = useState<ActiveCallParams | null>(null);
  const [minimized, setMinimized] = useState(false);

  const startCall = useCallback((params: ActiveCallParams) => {
    console.log('[ActiveCall] startCall:', params.roomName);
    setMinimized(false);
    setCall(params);
  }, []);

  const endCall = useCallback(() => {
    console.log('[ActiveCall] endCall');
    setCall(null);
    setMinimized(false);
  }, []);

  const minimize = useCallback(() => {
    console.log('[ActiveCall] minimize');
    setMinimized(true);
  }, []);

  const maximize = useCallback(() => {
    console.log('[ActiveCall] maximize');
    setMinimized(false);
  }, []);

  return (
    <ActiveCallContext.Provider value={{ call, minimized, startCall, endCall, minimize, maximize }}>
      {children}
    </ActiveCallContext.Provider>
  );
}

export function useActiveCall() {
  return useContext(ActiveCallContext);
}
