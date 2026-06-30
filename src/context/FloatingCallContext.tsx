// ─── Context: Floating Call ──────────────────────────────────────────────────
// Manages the floating call overlay state when user minimizes a call

import React, { createContext, useContext, useState, useCallback } from 'react';

interface FloatingCallData {
  callId: string;
  displayName: string;
  avatar: string;
  color: string;
  duration: string;
  isVideo: boolean;
  isOutgoing: boolean;
  localStream?: any;
  remoteStream?: any;
  localIsMain?: boolean; // Track if local camera is in main view
  otherParty: {
    userId: string;
    displayName: string;
    photoUrl: string | null;
  };
}

interface FloatingCallContextValue {
  floatingCall: FloatingCallData | null;
  minimizeCall: (data: FloatingCallData) => void;
  maximizeCall: () => FloatingCallData | null;
  endFloatingCall: () => void;
  updateDuration: (duration: string) => void;
}

const FloatingCallContext = createContext<FloatingCallContextValue>({
  floatingCall: null,
  minimizeCall: () => {},
  maximizeCall: () => null,
  endFloatingCall: () => {},
  updateDuration: () => {},
});

export function FloatingCallProvider({ children }: { children: React.ReactNode }) {
  const [floatingCall, setFloatingCall] = useState<FloatingCallData | null>(null);

  const minimizeCall = useCallback((data: FloatingCallData) => {
    console.log('[FloatingCallContext] Minimizing call:', data.callId);
    setFloatingCall(data);
  }, []);

  const maximizeCall = useCallback(() => {
    console.log('[FloatingCallContext] Maximizing call');
    const call = floatingCall;
    setFloatingCall(null);
    return call;
  }, [floatingCall]);

  const endFloatingCall = useCallback(() => {
    console.log('[FloatingCallContext] Ending floating call');
    setFloatingCall(null);
  }, []);

  const updateDuration = useCallback((duration: string) => {
    setFloatingCall((prev) => prev ? { ...prev, duration } : null);
  }, []);

  return (
    <FloatingCallContext.Provider
      value={{
        floatingCall,
        minimizeCall,
        maximizeCall,
        endFloatingCall,
        updateDuration,
      }}
    >
      {children}
    </FloatingCallContext.Provider>
  );
}

export function useFloatingCall() {
  const context = useContext(FloatingCallContext);
  if (!context) {
    throw new Error('useFloatingCall must be used within FloatingCallProvider');
  }
  return context;
}
