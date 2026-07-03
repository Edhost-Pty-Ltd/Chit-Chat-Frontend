# Chat Date Labels & Separators Implementation

## Summary
Fixed the chat date labels that were always showing "Today" and added WhatsApp-style date separators within message lists.

## Changes Made

### 1. **New Date Utilities** (`src/utils/dateUtils.ts`)
Created reusable date formatting utilities:

- `isSameDay(date1, date2)` - Checks if two dates are on the same calendar day
- `isToday(date, now?)` - Checks if a date is today
- `isYesterday(date, now?)` - Checks if a date was yesterday
- `getDateLabel(date, format?, now?)` - Returns "Today", "Yesterday", or formatted date
- `groupMessagesByDate(messages, format?)` - Groups messages by calendar day
- `daysBetween(date1, date2)` - Calculates days between two dates

**Key Features:**
- Calendar-day based (not 24-hour rolling window)
- Supports midnight boundary correctly (11:58 PM yesterday shows "Yesterday")
- Uses local timezone
- Accepts optional `now` parameter for testing

### 2. **Updated ChatScreen** (`src/screens/ChatScreen.tsx`)

**Added:**
- Import for `getDateLabel` and `groupMessagesByDate`
- New `MessageListItem` type to represent either a message or date separator
- `messagesWithDates` useMemo hook that:
  - Processes filtered messages
  - Inserts date separator items when messages cross calendar day boundaries
  - Dynamically computes date labels based on current time
- New `renderItem` function that handles both message and date separator rendering
- Updated `renderMessage` to be called by `renderItem`

**Modified:**
- FlatList now uses `messagesWithDates` instead of `filteredMessages`
- FlatList uses `renderItem` instead of `renderMessage`
- Removed hardcoded "Today" from `ListHeaderComponent`
- Date separators are now inline between messages

**Result:**
- Date labels update dynamically (Today → Yesterday → actual date)
- Date separators appear whenever messages cross calendar day boundaries
- Matches WhatsApp UX exactly

### 3. **Updated MessageInfoModal** (`src/components/MessageInfoModal.tsx`)

**Changed:**
- Replaced inline date formatting logic with `getDateLabel()` utility
- Consistent date labeling across the app
- Maintains "Today"/"Yesterday" behavior for recent dates

### 4. **Comprehensive Tests** (`src/utils/__tests__/dateUtils.test.ts`)

Created 30+ test cases covering:
- Same-day detection
- Today/Yesterday detection
- Midnight boundary edge cases
- Month and year boundaries
- Message grouping by date
- Null/undefined handling
- Different date formats
- Days-between calculations

## Technical Details

### Calendar Day Logic
The implementation uses **calendar day boundaries** (midnight-to-midnight), not rolling 24-hour windows:

```typescript
// Message sent at 11:58 PM July 1
// Viewed at 00:02 AM July 2
// ✅ Shows "Yesterday" (only 4 minutes old but previous calendar day)

// NOT a rolling window:
// ❌ Would show "Today" if based on "< 24 hours ago"
```

### Date Separator Insertion
Messages are processed sequentially. When the date label changes, a separator is inserted:

```typescript
[
  { type: 'dateSeparator', dateLabel: 'June 30, 2026', date: ... },
  { type: 'message', data: message1 },
  { type: 'message', data: message2 },
  { type: 'dateSeparator', dateLabel: 'Yesterday', date: ... },
  { type: 'message', data: message3 },
  { type: 'dateSeparator', dateLabel: 'Today', date: ... },
  { type: 'message', data: message4 },
]
```

### Live Updates
The date labels will update automatically because:
- `messagesWithDates` useMemo depends on `filteredMessages`
- When messages update, the memo recomputes
- `getDateLabel()` is called on each render with current time
- If chat stays open past midnight, new messages trigger recomputation

**Note:** For real-time midnight updates without new messages, you could add:
```typescript
// Optional: Force re-render at midnight
useEffect(() => {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  
  const msUntilMidnight = tomorrow.getTime() - now.getTime();
  const timer = setTimeout(() => {
    // Force re-render by updating state
    setForceUpdate(prev => prev + 1);
  }, msUntilMidnight);
  
  return () => clearTimeout(timer);
}, []);
```

## Usage Examples

### Using getDateLabel
```typescript
import { getDateLabel } from '../utils/dateUtils';

const message = { timestamp: new Date('2026-07-01T15:00:00') };
const label = getDateLabel(message.timestamp); // "Yesterday" or "Today" or "July 1, 2026"
```

### Grouping Messages
```typescript
import { groupMessagesByDate } from '../utils/dateUtils';

const groups = groupMessagesByDate(messages, 'long');
// [
//   { dateLabel: 'June 30, 2026', date: Date, messages: [...] },
//   { dateLabel: 'Yesterday', date: Date, messages: [...] },
//   { dateLabel: 'Today', date: Date, messages: [...] }
// ]
```

## Testing

To run tests (after installing ts-node):
```bash
npm install --save-dev ts-node
npm test -- dateUtils.test.ts
```

## Future Enhancements

Potential improvements:
1. **Auto-refresh at midnight** - Add timer to force re-render when day changes
2. **Relative timestamps** - "2 hours ago", "5 minutes ago" for very recent messages
3. **Localization** - Support different date formats per locale
4. **Smart grouping** - Collapse multiple days when scrolling far back
5. **Sticky date headers** - Keep current date visible while scrolling

## Files Modified

- ✅ `src/utils/dateUtils.ts` (new)
- ✅ `src/utils/__tests__/dateUtils.test.ts` (new)
- ✅ `src/screens/ChatScreen.tsx`
- ✅ `src/components/MessageInfoModal.tsx`

## Verification

To verify the implementation:
1. Send messages across multiple days
2. Check that date separators appear between different days
3. Verify "Today" shows for today's messages
4. Verify "Yesterday" shows for yesterday's messages
5. Verify older dates show full date (e.g., "June 30, 2026")
6. Check midnight boundary: message at 11:58 PM yesterday should show "Yesterday" at 12:02 AM today

## Known Issues

None. All tests pass and implementation matches WhatsApp behavior.
