// ─── Contacts Context ─────────────────────────────────────────────────────────
// Provides a dynamic list of contacts that can be added to at runtime.
// Starts with the mock data; new contacts created from the "New Contact"
// sheet are prepended to the list and immediately visible everywhere.
import React, { createContext, useContext, useState } from 'react';
import { Contact } from '../types';
import { CONTACTS as INITIAL } from '../data/mockData';

interface ContactsContextValue {
  contacts: Contact[];
  addContact: (c: Contact) => void;
}

const ContactsContext = createContext<ContactsContextValue>({
  contacts:   INITIAL,
  addContact: () => {},
});

export function ContactsProvider({ children }: { children: React.ReactNode }) {
  const [contacts, setContacts] = useState<Contact[]>(INITIAL);

  const addContact = (c: Contact) => {
    setContacts((prev) => {
      // Avoid duplicates by name
      if (prev.some((p) => p.name.toLowerCase() === c.name.toLowerCase())) return prev;
      return [c, ...prev];
    });
  };

  return (
    <ContactsContext.Provider value={{ contacts, addContact }}>
      {children}
    </ContactsContext.Provider>
  );
}

export function useContacts() {
  return useContext(ContactsContext);
}
