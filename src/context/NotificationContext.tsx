// ─── Notification Context ────────────────────────────────────────────────────
// Push notification system with native device notifications support.
// Provides:
//   • pushNotification()  — add a notification (shows toast + stores in inbox + device notification)
//   • notifications       — full inbox list
//   • unreadCount         — badge count
//   • messageCount        — unread message count
//   • callCount           — missed call count
//   • markAllRead()       — clear badge
//   • clearAll()          — clear inbox
//   • toast               — currently showing toast (consumed by ToastOverlay)
//   • dismissToast()      — hide the current toast
import React, {
  createContext, useContext, useState, useCallback, useRef, useEffect,
} from 'react';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Configure how notifications are handled when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

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
  messageCount:   number;
  callCount:      number;
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
  messageCount:     0,
  callCount:        0,
  toast:            null,
  pushNotification: () => {},
  dismissToast:     () => {},
  markAllRead:      () => {},
  markRead:         () => {},
  clearAll:         () => {},
});

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  // ── Mock notifications for development ───────────────────────────
  const mockNotifications: AppNotification[] = [
    {
      id: 'mock-1',
      type: 'message',
      title: 'Sarah Wilson',
      body: 'Hey! Are we still meeting up tomorrow at the cafe?',
      time: '2m ago',
      read: false,
      contactId: 1,
    },
    {
      id: 'mock-2',
      type: 'call',
      title: 'Missed Call',
      body: 'Michael Chen tried to call you',
      time: '15m ago',
      read: false,
      contactId: 2,
    },
    {
      id: 'mock-3',
      type: 'message',
      title: 'Project Team',
      body: 'Alex: The presentation files are ready for review',
      time: '1h ago',
      read: false,
      contactId: 3,
    },
    {
      id: 'mock-4',
      type: 'system',
      title: 'Backup Complete',
      body: 'Your chat history has been backed up successfully',
      time: '2h ago',
      read: true,
    },
    {
      id: 'mock-5',
      type: 'message',
      title: 'Emily Rodriguez',
      body: 'Thanks for sending those photos! They look amazing 📸',
      time: '3h ago',
      read: true,
      contactId: 4,
    },
    {
      id: 'mock-6',
      type: 'call',
      title: 'Missed Video Call',
      body: 'Jessica Thompson tried to video call you',
      time: '5h ago',
      read: true,
      contactId: 5,
    },
    {
      id: 'mock-7',
      type: 'number_change',
      title: 'Contact Updated',
      body: 'David Martinez changed their phone number',
      time: 'Yesterday',
      read: true,
      contactId: 6,
    },
    {
      id: 'mock-8',
      type: 'message',
      title: 'Mom',
      body: "Don't forget to call your grandmother this weekend!",
      time: 'Yesterday',
      read: true,
      contactId: 7,
    },
    {
      id: 'mock-9',
      type: 'system',
      title: 'App Update Available',
      body: 'Version 2.4.0 is available with new features and improvements',
      time: '2 days ago',
      read: true,
    },
    {
      id: 'mock-10',
      type: 'message',
      title: 'Study Group',
      body: 'Lisa: Meeting moved to 3 PM tomorrow',
      time: '2 days ago',
      read: true,
      contactId: 8,
    },
    {
      id: 'mock-11',
      type: 'call',
      title: 'Missed Call',
      body: 'James Anderson tried to call you',
      time: '3 days ago',
      read: true,
      contactId: 9,
    },
    {
      id: 'mock-12',
      type: 'system',
      title: 'Privacy Update',
      body: 'Review the latest privacy policy changes',
      time: '1 week ago',
      read: true,
    },
  ];

  const [notifications, setNotifications] = useState<AppNotification[]>(mockNotifications);
  const [toast, setToast]                 = useState<AppNotification | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Request notification permissions on mount ─────────────────────
  useEffect(() => {
    registerForPushNotificationsAsync();
  }, []);

  async function registerForPushNotificationsAsync() {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#1E9CF0',
      });
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      console.log('[Notifications] Permission not granted');
      return;
    }
  }

  const pushNotification = useCallback(
    async (n: Omit<AppNotification, 'id' | 'time' | 'read'>) => {
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

      // Send native device notification
      try {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: notif.title,
            body: notif.body,
            sound: true,
            data: { 
              contactId: notif.contactId,
              type: notif.type,
            },
          },
          trigger: null, // Show immediately
        });
      } catch (error) {
        console.log('[Notifications] Failed to send native notification:', error);
      }
    },
    [],
  );

  // ── Show welcome toast on mount (demo) ────────────────────────────
  useEffect(() => {
    // Delay slightly so the app UI loads first
    const timeout = setTimeout(() => {
      pushNotification({
        type: 'message',
        title: 'Sarah Wilson',
        body: 'Hey! Are we still meeting up tomorrow at the cafe?',
        contactId: 1,
      });
    }, 2000); // 2 seconds after app loads

    return () => clearTimeout(timeout);
  }, [pushNotification]);

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

  // Calculate counters
  const unreadCount = notifications.filter((n) => !n.read).length;
  const messageCount = notifications.filter((n) => !n.read && n.type === 'message').length;
  const callCount = notifications.filter((n) => !n.read && n.type === 'call').length;

  // Update app badge count
  useEffect(() => {
    Notifications.setBadgeCountAsync(unreadCount).catch((err) => {
      console.log('[Notifications] Failed to set badge count:', err);
    });
  }, [unreadCount]);

  // ── Simulate incoming notifications (for demo purposes) ───────────
  const simulateIncomingNotification = useCallback(() => {
    const randomNotifs = [
      {
        type: 'message' as NotifType,
        title: 'Sarah Wilson',
        body: 'Hey! Just checking if you got my message?',
        contactId: 1,
      },
      {
        type: 'call' as NotifType,
        title: 'Incoming Call',
        body: 'Michael Chen is calling...',
        contactId: 2,
      },
      {
        type: 'message' as NotifType,
        title: 'Project Team',
        body: 'New message: The deadline has been extended!',
        contactId: 3,
      },
      {
        type: 'system' as NotifType,
        title: 'Security Alert',
        body: 'Your account was accessed from a new device',
      },
    ];

    const randomNotif = randomNotifs[Math.floor(Math.random() * randomNotifs.length)];
    pushNotification(randomNotif);
  }, [pushNotification]);

  // ── Auto-simulate notifications every 15 seconds (demo only) ──────
  useEffect(() => {
    const interval = setInterval(() => {
      simulateIncomingNotification();
    }, 15000); // Every 15 seconds

    return () => clearInterval(interval);
  }, [simulateIncomingNotification]);

  return (
    <NotificationContext.Provider value={{
      notifications, unreadCount, messageCount, callCount, toast,
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
