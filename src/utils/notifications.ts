// ─── Notifications helper ─────────────────────────────────────────────────────
// expo-notifications push API requires a development build (not Expo Go) on
// SDK 53+. We use in-app system Alerts instead — they work everywhere.
// When a real backend exists, replace this with server-side push notifications.
import { Alert } from 'react-native';
import { Contact } from '../types';

/**
 * Simulates notifying all contacts that the user changed their phone number.
 * In a real app this would send server-side push notifications to each contact.
 * Here we show a single summary Alert that lists who was "notified".
 */
export async function notifyContactsOfNumberChange(
  displayName: string,
  newNumber: string,
  contacts: Contact[],
  onMessageContact?: (contact: Contact) => void,
): Promise<void> {
  if (contacts.length === 0) return;

  const name = displayName || 'You';
  const count = contacts.length;

  // Show one alert with the option to message the first contact as a demo
  const first = contacts[0];
  Alert.alert(
    '📱 Contacts notified',
    `${count} contact${count > 1 ? 's have' : ' has'} been notified that ${name} is now on ${newNumber}.\n\nTap "Message ${first.name}" to start a chat with them using the new number.`,
    [
      { text: 'Later', style: 'cancel' },
      {
        text: `Message ${first.name}`,
        onPress: () => onMessageContact?.(first),
      },
    ],
  );
}
