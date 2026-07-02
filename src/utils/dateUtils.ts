// ─── Date Utilities ──────────────────────────────────────────────────────────
// Utilities for formatting dates in chat contexts (Today/Yesterday/actual dates)

/**
 * Checks if two dates are on the same calendar day (ignores time).
 * Uses local timezone.
 */
export function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

/**
 * Checks if a date is yesterday relative to today's calendar day.
 */
export function isYesterday(date: Date, now: Date = new Date()): boolean {
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  return isSameDay(date, yesterday);
}

/**
 * Checks if a date is today.
 */
export function isToday(date: Date, now: Date = new Date()): boolean {
  return isSameDay(date, now);
}

/**
 * Returns a human-readable date label for chat contexts.
 * - "Today" if the date is today
 * - "Yesterday" if the date was yesterday
 * - Formatted date string otherwise (e.g., "July 1, 2026" or "01/07/2026")
 * 
 * @param date - The date to format
 * @param format - 'short' for MM/DD/YYYY, 'long' for full month name (default: 'long')
 * @param now - Current date (for testing purposes, defaults to new Date())
 */
export function getDateLabel(
  date: Date | null | undefined,
  format: 'short' | 'long' = 'long',
  now: Date = new Date()
): string {
  if (!date) return '';

  // Ensure we're working with a Date object
  const dateObj = date instanceof Date ? date : new Date(date);

  if (isNaN(dateObj.getTime())) {
    return '';
  }

  // Check for today
  if (isToday(dateObj, now)) {
    return 'Today';
  }

  // Check for yesterday
  if (isYesterday(dateObj, now)) {
    return 'Yesterday';
  }

  // Format older dates
  if (format === 'short') {
    // MM/DD/YYYY format
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    const year = dateObj.getFullYear();
    return `${month}/${day}/${year}`;
  } else {
    // Long format: "July 1, 2026"
    return dateObj.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }
}

/**
 * Groups messages by calendar day, returning an array of message groups.
 * Each group contains the date label and the messages for that day.
 * 
 * @param messages - Array of messages sorted by timestamp (oldest first)
 * @param format - Date format for labels ('short' or 'long')
 */
export function groupMessagesByDate<T extends { timestamp: Date | null }>(
  messages: T[],
  format: 'short' | 'long' = 'long'
): Array<{ dateLabel: string; date: Date; messages: T[] }> {
  const groups: Array<{ dateLabel: string; date: Date; messages: T[] }> = [];
  const now = new Date();

  messages.forEach((message) => {
    if (!message.timestamp) return;

    const messageDate = message.timestamp instanceof Date 
      ? message.timestamp 
      : new Date(message.timestamp);

    if (isNaN(messageDate.getTime())) return;

    // Check if we already have a group for this date
    const existingGroup = groups.find(group => isSameDay(group.date, messageDate));

    if (existingGroup) {
      existingGroup.messages.push(message);
    } else {
      // Create new group
      groups.push({
        dateLabel: getDateLabel(messageDate, format, now),
        date: messageDate,
        messages: [message],
      });
    }
  });

  return groups;
}

/**
 * Returns the date at the start of the day (00:00:00) for a given date.
 */
export function getStartOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

/**
 * Returns the date at the end of the day (23:59:59.999) for a given date.
 */
export function getEndOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
}

/**
 * Calculates the number of calendar days between two dates.
 * Ignores time, only considers calendar dates.
 */
export function daysBetween(date1: Date, date2: Date): number {
  const start = getStartOfDay(date1);
  const end = getStartOfDay(date2);
  const diffMs = end.getTime() - start.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}
