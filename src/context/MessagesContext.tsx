// ─── Messages Context ─────────────────────────────────────────────────────────
import React, { createContext, useContext, useState, useCallback } from 'react';
import { Message } from '../types';
import { MESSAGES } from '../data/mockData';

interface NumberChangePayload {
  oldNumber: string;
  newNumber: string;
  displayName: string;
}

interface MessagesContextValue {
  getMessages: (contactId: number) => Message[];
  appendMessages: (contactId: number, msgs: Message[]) => void;
  /** Plain text system message injected into every thread */
  injectSystemMessage: (text: string) => void;
  /** Rich number-change message injected into every thread */
  injectNumberChangeMessage: (payload: NumberChangePayload) => void;
}

const MessagesContext = createContext<MessagesContextValue>({
  getMessages:               () => MESSAGES,
  appendMessages:            () => {},
  injectSystemMessage:       () => {},
  injectNumberChangeMessage: () => {},
});

export function MessagesProvider({ children }: { children: React.ReactNode }) {
  const [threads, setThreads] = useState<Record<number, Message[]>>({});

  const getMessages = useCallback((contactId: number): Message[] => {
    return threads[contactId] ?? MESSAGES;
  }, [threads]);

  const appendMessages = useCallback((contactId: number, msgs: Message[]) => {
    setThreads((prev) => {
      const existing = prev[contactId] ?? MESSAGES;
      const maxId = existing.reduce((m, msg) => Math.max(m, msg.id), 0);
      const numbered = msgs.map((m, i) => ({ ...m, id: maxId + i + 1 }));
      return { ...prev, [contactId]: [...existing, ...numbered] };
    });
  }, []);

  const injectSystemMessage = useCallback((text: string) => {
    const { CONTACTS } = require('../data/mockData');
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setThreads((prev) => {
      const next = { ...prev };
      for (const contact of CONTACTS) {
        const existing = next[contact.id] ?? MESSAGES;
        const maxId = existing.reduce((m: number, msg: Message) => Math.max(m, msg.id), 0);
        next[contact.id] = [...existing, {
          id: maxId + 1, from: 'system', text, time: now, type: 'in',
        }];
      }
      return next;
    });
  }, []);

  const injectNumberChangeMessage = useCallback((payload: NumberChangePayload) => {
    const { CONTACTS } = require('../data/mockData');
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setThreads((prev) => {
      const next = { ...prev };
      for (const contact of CONTACTS) {
        const existing = next[contact.id] ?? MESSAGES;
        const maxId = existing.reduce((m: number, msg: Message) => Math.max(m, msg.id), 0);
        next[contact.id] = [...existing, {
          id:           maxId + 1,
          from:         'system',
          time:         now,
          type:         'in' as const,
          numberChange: payload,
        }];
      }
      return next;
    });
  }, []);

  return (
    <MessagesContext.Provider value={{
      getMessages, appendMessages,
      injectSystemMessage, injectNumberChangeMessage,
    }}>
      {children}
    </MessagesContext.Provider>
  );
}

export function useMessages() {
  return useContext(MessagesContext);
}
