// ─── Context: Call ───────────────────────────────────────────────────────────
// Global call state management for WebRTC calls

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import type { CallState, IncomingCallData, CallStatus } from '../types/call';

interface CallContextValue extends CallState {
  setActiveCallId: (callId: string | null) => void;
  setIncomingCall: (call: IncomingCallData | null) => void;
  setCallStatus: (status: CallStatus | null) => void;
  setMuted: (muted: boolean) => void;
  setSpeakerOn: (speakerOn: boolean) => void;
  setCallDuration: (duration: number) => void;
  incrementCallDuration: () => void;
  resetCallState: () => void;
}

const CallContext = createContext<CallContextValue | undefined>(undefined);

const INITIAL_STATE: CallState = {
  activeCallId: null,
  incomingCall: null,
  callStatus: null,
  isMuted: false,
  isSpeakerOn: false,
  callDuration: 0,
};

export function CallProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<CallState>(INITIAL_STATE);

  const setActiveCallId = useCallback((callId: string | null) => {
    setState((prev) => ({ ...prev, activeCallId: callId }));
  }, []);

  const setIncomingCall = useCallback((call: IncomingCallData | null) => {
    setState((prev) => ({ ...prev, incomingCall: call }));
  }, []);

  const setCallStatus = useCallback((status: CallStatus | null) => {
    setState((prev) => ({ ...prev, callStatus: status }));
  }, []);

  const setMuted = useCallback((muted: boolean) => {
    setState((prev) => ({ ...prev, isMuted: muted }));
  }, []);

  const setSpeakerOn = useCallback((speakerOn: boolean) => {
    setState((prev) => ({ ...prev, isSpeakerOn: speakerOn }));
  }, []);

  const setCallDuration = useCallback((duration: number) => {
    setState((prev) => ({ ...prev, callDuration: duration }));
  }, []);

  const incrementCallDuration = useCallback(() => {
    setState((prev) => ({ ...prev, callDuration: prev.callDuration + 1 }));
  }, []);

  const resetCallState = useCallback(() => {
    console.log('[CallContext] Resetting call state');
    setState(INITIAL_STATE);
  }, []);

  const value: CallContextValue = {
    ...state,
    setActiveCallId,
    setIncomingCall,
    setCallStatus,
    setMuted,
    setSpeakerOn,
    setCallDuration,
    incrementCallDuration,
    resetCallState,
  };

  return <CallContext.Provider value={value}>{children}</CallContext.Provider>;
}

export function useCallContext() {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error('useCallContext must be used within CallProvider');
  }
  return context;
}
