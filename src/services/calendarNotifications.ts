import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

// NOTE: setNotificationHandler is configured in usePushNotifications.ts
// Calendar notifications use data.type === 'calendar-event' to show alerts in foreground

export interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  notes?: string;
}

const NOTIF_MAP_KEY = '@calendar_notif_map';

// --- Notification-Event Mapping (persisted) ---

async function getMapping(): Promise<Record<string, string>> {
  try {
    const raw = await AsyncStorage.getItem(NOTIF_MAP_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

async function setMapping(map: Record<string, string>): Promise<void> {
  try {
    await AsyncStorage.setItem(NOTIF_MAP_KEY, JSON.stringify(map));
  } catch (e) {
    console.error('[CalendarNotif] persist error', e);
  }
}

/**
 * Schedule a local notification for a calendar event.
 * Fires at event start time (or immediately if < 5 seconds away).
 */
export async function scheduleEventNotification(event: CalendarEvent): Promise<string | null> {
  try {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') {
      console.warn('[CalendarNotif] Permission not granted');
      return null;
    }

    const now = Date.now();
    const eventTime = new Date(event.start).getTime();
    const secondsUntil = Math.floor((eventTime - now) / 1000);

    if (secondsUntil < 5) {
      console.log('[CalendarNotif] Event is in the past or too soon, skipping');
      return null;
    }

    // Cancel existing notification for this event if rescheduling
    await cancelEventNotification(event.id);

    // Schedule the notification
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: event.title,
        body: event.notes || 'Your event is starting now',
        sound: true,
        data: { eventId: event.id, type: 'calendar-event' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: secondsUntil,
      },
    });

    // Persist mapping
    const map = await getMapping();
    map[event.id] = notificationId;
    await setMapping(map);

    console.log('[CalendarNotif] Scheduled:', {
      notificationId,
      event: event.title,
      firesIn: `${secondsUntil}s`,
    });

    return notificationId;
  } catch (error) {
    console.error('[CalendarNotif] Schedule error:', error);
    return null;
  }
}

/**
 * Cancel a scheduled notification by event ID.
 */
export async function cancelEventNotification(eventId: string): Promise<void> {
  try {
    const map = await getMapping();
    const notifId = map[eventId];
    if (notifId) {
      await Notifications.cancelScheduledNotificationAsync(notifId);
      delete map[eventId];
      await setMapping(map);
      console.log('[CalendarNotif] Cancelled for event:', eventId);
    }
  } catch (error) {
    console.error('[CalendarNotif] Cancel error:', error);
  }
}

/**
 * Cancel all calendar notifications.
 */
export async function cancelAllEventNotifications(): Promise<void> {
  try {
    const all = await Notifications.getAllScheduledNotificationsAsync();
    for (const n of all) {
      if (n.content.data?.type === 'calendar-event') {
        await Notifications.cancelScheduledNotificationAsync(n.identifier);
      }
    }
    await AsyncStorage.removeItem(NOTIF_MAP_KEY);
    console.log('[CalendarNotif] Cancelled all');
  } catch (error) {
    console.error('[CalendarNotif] Cancel all error:', error);
  }
}

/**
 * Get count of scheduled calendar notifications (debug helper).
 */
export async function getScheduledNotifications(): Promise<any[]> {
  try {
    const all = await Notifications.getAllScheduledNotificationsAsync();
    return all.filter((n: any) => n.content.data?.type === 'calendar-event');
  } catch {
    return [];
  }
}
