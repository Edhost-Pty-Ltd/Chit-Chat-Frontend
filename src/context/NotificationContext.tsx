// ─── Notification Context ────────────────────────────────────────────────────
// Pure in-app push notification system — no expo-notifications needed.
// Provides:
//   • pushNotification()  — add a notification (shows toast + stores in inbox)
//   • notifications       — full inbox list
//   • unreadCount         — badge count
//   • markAllRead()       — clear badge
//   • clearAll()          — clear inbox
//   • toast               — currently showing toast (consumed by ToastOverlay)
//   • dismissToast()      — hide the current toast
import React, {
  createContext, useContext, useState, useCallback, useRef,
} from 'react';

export type NotifType = 'message' | 'call' | 'number_change' | 'system';

export interface AppNotification {
  id:        string;
  type:      NotifType;
  title:     string;
  body:      string;
  time:      string;
  read:      boolean;
  /** Optional — navigate to Chat with this contact id when tapped */
  contactId?: number;
}

interface NotificationContextValue {
  notifications:  AppNotification[];
  unreadCount:    number;
  toast:          AppNotification | null;
  pushNotification: (n: Omit<AppNotification, 'id' | 'time' | 'read'>) => void;
  dismissToast:   () => void;
  markAllRead:    () => void;
  markRead:       (id: string) => void;
  clearAll:       () => void;
}

const NotificationContext = createContext<NotificationContextValue>({
  notifications:    [],
  unreadCount:      0,
  toast:            null,
  pushNotification: () => {},
  dismissToast:     () => {},
  markAllRead:      () => {},
  markRead:         () => {},
  clearAll:         () => {},
});

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [toast, setToast]                 = useState<AppNotification | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pushNotification = useCallback(
    (n: Omit<AppNotification, 'id' | 'time' | 'read'>) => {
      const notif: AppNotification = {
        ...n,
        id:   `${Date.now()}-${Math.random()}`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        read: false,
      };

      // Add to inbox
      setNotifications((prev) => [notif, ...prev]);

      // Show toast — auto-dismiss after 4 s
      setToast(notif);
      if (toastTimer.current) clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setToast(null), 4000);
    },
    [],
  );

  const dismissToast = useCallback(() => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(null);
  }, []);

  const markRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => n.id === id ? { ...n, read: true } : n),
    );
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const clearAll = useCallback(() => setNotifications([]), []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <NotificationContext.Provider value={{
      notifications, unreadCount, toast,
      pushNotification, dismissToast,
      markRead, markAllRead, clearAll,
    }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationContext);
}
