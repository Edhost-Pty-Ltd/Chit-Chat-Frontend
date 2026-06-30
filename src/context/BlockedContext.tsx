// ─── Blocked Contacts Context ─────────────────────────────────────────────────
// Persists a list of blocked contact IDs in AsyncStorage.
// • Blocker:  sees an inline "You've blocked this person" banner in the chat.
//             Their messages are still visible (they sent them before blocking).
//             New outgoing messages are allowed (one-sided block).
// • Blocked:  their incoming messages are silently dropped from the UI.
//             They see no indication — messages appear to send normally on their end.
import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'blocked_contact_ids';

interface BlockedContextValue {
  blockedIds: number[];
  blockContact:   (id: number) => Promise<void>;
  unblockContact: (id: number) => Promise<void>;
  isBlocked:      (id: number) => boolean;
}

const BlockedContext = createContext<BlockedContextValue>({
  blockedIds:     [],
  blockContact:   async () => {},
  unblockContact: async () => {},
  isBlocked:      () => false,
});

export function BlockedProvider({ children }: { children: React.ReactNode }) {
  const [blockedIds, setBlockedIds] = useState<number[]>([]);

  // Hydrate from storage on mount
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw) {
        try { setBlockedIds(JSON.parse(raw)); } catch {}
      }
    });
  }, []);

  const persist = async (ids: number[]) => {
    setBlockedIds(ids);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  };

  const blockContact = async (id: number) => {
    const next = blockedIds.includes(id) ? blockedIds : [...blockedIds, id];
    await persist(next);
  };

  const unblockContact = async (id: number) => {
    await persist(blockedIds.filter((b) => b !== id));
  };

  const isBlocked = (id: number) => blockedIds.includes(id);

  return (
    <BlockedContext.Provider value={{ blockedIds, blockContact, unblockContact, isBlocked }}>
      {children}
    </BlockedContext.Provider>
  );
}

export function useBlocked() {
  return useContext(BlockedContext);
}
