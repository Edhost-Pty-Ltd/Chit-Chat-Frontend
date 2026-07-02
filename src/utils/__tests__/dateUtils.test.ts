// ─── Tests: Date Utilities ──────────────────────────────────────────────────

import {
  isSameDay,
  isYesterday,
  isToday,
  getDateLabel,
  groupMessagesByDate,
  daysBetween,
} from '../dateUtils';

describe('dateUtils', () => {
  describe('isSameDay', () => {
    it('should return true for dates on the same calendar day', () => {
      const date1 = new Date('2026-07-02T08:00:00');
      const date2 = new Date('2026-07-02T20:00:00');
      expect(isSameDay(date1, date2)).toBe(true);
    });

    it('should return false for dates on different days', () => {
      const date1 = new Date('2026-07-02T23:59:59');
      const date2 = new Date('2026-07-03T00:00:00');
      expect(isSameDay(date1, date2)).toBe(false);
    });

    it('should work across different months', () => {
      const date1 = new Date('2026-06-30T12:00:00');
      const date2 = new Date('2026-07-01T12:00:00');
      expect(isSameDay(date1, date2)).toBe(false);
    });

    it('should work across different years', () => {
      const date1 = new Date('2025-12-31T12:00:00');
      const date2 = new Date('2026-01-01T12:00:00');
      expect(isSameDay(date1, date2)).toBe(false);
    });
  });

  describe('isToday', () => {
    it('should return true when date is today', () => {
      const now = new Date('2026-07-02T15:00:00');
      const date = new Date('2026-07-02T09:00:00');
      expect(isToday(date, now)).toBe(true);
    });

    it('should return false when date is yesterday', () => {
      const now = new Date('2026-07-02T15:00:00');
      const date = new Date('2026-07-01T15:00:00');
      expect(isToday(date, now)).toBe(false);
    });

    it('should return false when date is tomorrow', () => {
      const now = new Date('2026-07-02T15:00:00');
      const date = new Date('2026-07-03T15:00:00');
      expect(isToday(date, now)).toBe(false);
    });

    it('should handle midnight boundary correctly', () => {
      const now = new Date('2026-07-02T00:05:00');
      const date = new Date('2026-07-02T23:58:00');
      expect(isToday(date, now)).toBe(true);
    });
  });

  describe('isYesterday', () => {
    it('should return true when date was yesterday', () => {
      const now = new Date('2026-07-02T15:00:00');
      const date = new Date('2026-07-01T09:00:00');
      expect(isYesterday(date, now)).toBe(true);
    });

    it('should return false when date is today', () => {
      const now = new Date('2026-07-02T15:00:00');
      const date = new Date('2026-07-02T09:00:00');
      expect(isYesterday(date, now)).toBe(false);
    });

    it('should return false when date is 2 days ago', () => {
      const now = new Date('2026-07-02T15:00:00');
      const date = new Date('2026-06-30T15:00:00');
      expect(isYesterday(date, now)).toBe(false);
    });

    it('should handle midnight boundary correctly', () => {
      // Message sent at 11:58 PM yesterday should say "Yesterday"
      const now = new Date('2026-07-02T00:05:00');
      const date = new Date('2026-07-01T23:58:00');
      expect(isYesterday(date, now)).toBe(true);
    });

    it('should handle month boundary', () => {
      const now = new Date('2026-07-01T10:00:00');
      const date = new Date('2026-06-30T10:00:00');
      expect(isYesterday(date, now)).toBe(true);
    });

    it('should handle year boundary', () => {
      const now = new Date('2026-01-01T10:00:00');
      const date = new Date('2025-12-31T10:00:00');
      expect(isYesterday(date, now)).toBe(true);
    });
  });

  describe('getDateLabel', () => {
    const now = new Date('2026-07-02T15:00:00');

    it('should return "Today" for today\'s date', () => {
      const date = new Date('2026-07-02T09:00:00');
      expect(getDateLabel(date, 'long', now)).toBe('Today');
    });

    it('should return "Yesterday" for yesterday\'s date', () => {
      const date = new Date('2026-07-01T09:00:00');
      expect(getDateLabel(date, 'long', now)).toBe('Yesterday');
    });

    it('should return formatted date for older dates (long format)', () => {
      const date = new Date('2026-06-30T09:00:00');
      expect(getDateLabel(date, 'long', now)).toBe('June 30, 2026');
    });

    it('should return formatted date for older dates (short format)', () => {
      const date = new Date('2026-06-30T09:00:00');
      expect(getDateLabel(date, 'short', now)).toBe('06/30/2026');
    });

    it('should return empty string for null date', () => {
      expect(getDateLabel(null)).toBe('');
    });

    it('should return empty string for undefined date', () => {
      expect(getDateLabel(undefined)).toBe('');
    });

    it('should handle midnight boundary for yesterday', () => {
      const nowMidnight = new Date('2026-07-02T00:05:00');
      const date = new Date('2026-07-01T23:58:00');
      expect(getDateLabel(date, 'long', nowMidnight)).toBe('Yesterday');
    });

    it('should handle different month', () => {
      const date = new Date('2026-05-15T09:00:00');
      expect(getDateLabel(date, 'long', now)).toBe('May 15, 2026');
    });

    it('should handle different year', () => {
      const date = new Date('2025-12-25T09:00:00');
      expect(getDateLabel(date, 'long', now)).toBe('December 25, 2025');
    });
  });

  describe('groupMessagesByDate', () => {
    it('should group messages by calendar day', () => {
      const now = new Date('2026-07-02T15:00:00');
      const messages = [
        { id: '1', timestamp: new Date('2026-06-30T10:00:00'), text: 'msg1' },
        { id: '2', timestamp: new Date('2026-06-30T15:00:00'), text: 'msg2' },
        { id: '3', timestamp: new Date('2026-07-01T10:00:00'), text: 'msg3' },
        { id: '4', timestamp: new Date('2026-07-02T10:00:00'), text: 'msg4' },
      ];

      const groups = groupMessagesByDate(messages, 'long');

      expect(groups).toHaveLength(3);
      expect(groups[0].dateLabel).toBe('June 30, 2026');
      expect(groups[0].messages).toHaveLength(2);
      expect(groups[1].dateLabel).toBe('Yesterday');
      expect(groups[1].messages).toHaveLength(1);
      expect(groups[2].dateLabel).toBe('Today');
      expect(groups[2].messages).toHaveLength(1);
    });

    it('should handle messages all on the same day', () => {
      const messages = [
        { id: '1', timestamp: new Date('2026-07-02T08:00:00'), text: 'msg1' },
        { id: '2', timestamp: new Date('2026-07-02T12:00:00'), text: 'msg2' },
        { id: '3', timestamp: new Date('2026-07-02T20:00:00'), text: 'msg3' },
      ];

      const groups = groupMessagesByDate(messages, 'long');

      expect(groups).toHaveLength(1);
      expect(groups[0].dateLabel).toBe('Today');
      expect(groups[0].messages).toHaveLength(3);
    });

    it('should skip messages with null timestamps', () => {
      const messages = [
        { id: '1', timestamp: new Date('2026-07-02T10:00:00'), text: 'msg1' },
        { id: '2', timestamp: null, text: 'msg2' },
        { id: '3', timestamp: new Date('2026-07-02T15:00:00'), text: 'msg3' },
      ];

      const groups = groupMessagesByDate(messages, 'long');

      expect(groups).toHaveLength(1);
      expect(groups[0].messages).toHaveLength(2);
    });

    it('should handle empty message array', () => {
      const groups = groupMessagesByDate([], 'long');
      expect(groups).toHaveLength(0);
    });

    it('should handle midnight boundary correctly', () => {
      const messages = [
        { id: '1', timestamp: new Date('2026-07-01T23:58:00'), text: 'msg1' },
        { id: '2', timestamp: new Date('2026-07-02T00:02:00'), text: 'msg2' },
      ];

      const groups = groupMessagesByDate(messages, 'long');

      expect(groups).toHaveLength(2);
      expect(groups[0].dateLabel).toBe('Yesterday');
      expect(groups[1].dateLabel).toBe('Today');
    });
  });

  describe('daysBetween', () => {
    it('should return 0 for same day', () => {
      const date1 = new Date('2026-07-02T08:00:00');
      const date2 = new Date('2026-07-02T20:00:00');
      expect(daysBetween(date1, date2)).toBe(0);
    });

    it('should return 1 for consecutive days', () => {
      const date1 = new Date('2026-07-01T12:00:00');
      const date2 = new Date('2026-07-02T12:00:00');
      expect(daysBetween(date1, date2)).toBe(1);
    });

    it('should return negative for reverse order', () => {
      const date1 = new Date('2026-07-02T12:00:00');
      const date2 = new Date('2026-07-01T12:00:00');
      expect(daysBetween(date1, date2)).toBe(-1);
    });

    it('should handle month boundaries', () => {
      const date1 = new Date('2026-06-30T12:00:00');
      const date2 = new Date('2026-07-02T12:00:00');
      expect(daysBetween(date1, date2)).toBe(2);
    });

    it('should handle year boundaries', () => {
      const date1 = new Date('2025-12-31T12:00:00');
      const date2 = new Date('2026-01-02T12:00:00');
      expect(daysBetween(date1, date2)).toBe(2);
    });
  });
});
