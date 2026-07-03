# ChatsScreen Merge Plan

## Summary
Merging enhanced UI from create-account branch with your existing Firebase backend functionality.

## Changes to Make

### 1. ChatAvatar Component Enhancement
**Add status ring** (for future stories feature):
```typescript
// Wrap avatar in gradient ring if user has status
if (hasStatus) {
  return (
    <LinearGradient colors={[color, COLORS.blue]} style={styles.ring}>
      <View style={styles.ringInner}>
        <Image/> or <Initials/>
      </View>
    </LinearGradient>
  );
}
```

###2. SelectContactSheet Enhancement
**Add dropdown menu with 3-dot button**:
```typescript
const [menuOpen, setMenuOpen] = useState(false);

// In header, add ellipsis button
<TouchableOpacity onPress={() => setMenuOpen(v => !v)}>
  <AppIcon name="ellipsis-vertical" />
</TouchableOpacity>

// Below header, show dropdown when open
{menuOpen && (
  <View style={styles.sheetDropdown}>
    <TouchableOpacity onPress={refreshContacts}>
      <AppIcon name="refresh-outline" />
      <AppText>Refresh contacts</AppText>
    </TouchableOpacity>
  </View>
)}
```

### 3. NewGroupSheet Enhancement
**Add selected avatars row**:
```typescript
{selected.length > 0 && (
  <View style={styles.selectedAvatarsRow}>
    {selected.map((userId) => {
      const c = contacts.find(x => x.userId === userId);
      return (
        <TouchableOpacity key={userId} onPress={() => toggle(userId)}>
          <ChatAvatar displayName={c.displayName} ... />
          <View style={styles.removeBadge}>
            <AppIcon name="close" size={10} />
          </View>
        </TouchableOpacity>
      );
    })}
  </View>
)}
```

### 4. Contact Row Enhancement
**Add selected state styling and checkmark-circle**:
```typescript
<TouchableOpacity 
  style={[styles.contactRow, sel && styles.contactRowSelected]}
  onPress={() => toggle(c.userId)}
>
  ...
  {sel && (
    <View style={styles.selectedIndicator}>
      <AppIcon name="checkmark-circle" size={22} color={COLORS.blue} fixedColor />
    </View>
  )}
</TouchableOpacity>
```

### 5. Phone Number Formatting
**Add formatting function**:
```typescript
function formatSAPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
  return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 9)}`;
}
```

### 6. Animation Improvements
**Better timing for search**:
```typescript
Animated.spring(searchAnim, {
  toValue: 1,
  useNativeDriver: false,
  friction: 7,  // Smoother
  tension: 60,  // More responsive
}).start(() => searchRef.current?.focus());
```

## What to Keep (100%)

### Firebase Integration ✅
- `useAuth()` for user state
- `useChats(userId)` for real-time chats
- `useContacts()` for device contacts + Firebase sync
- `getOrCreateDirectChat()` for chat creation
- Firestore member info fetching
- Display name resolution with priority logic
- Contact photo syncing (device → Firebase)

### Navigation ✅
- Complete params: `{ chatId, displayName, isGroup, otherUserId, otherUserPhoto }`
- Proper navigation to Chat screen
- Group/direct chat handling

### Chat Preview Logic ✅
- Last message with sender prefix ("You:", "FirstName:")
- Voice note detection `[Voice Note]`
- Unread count badges
- Timestamp formatting (`formatTime`)

### Loading States ✅
- Chat loading spinner
- Contact loading spinner
- Contact permission errors
- Retry button functionality

## Styles to Add

```typescript
// Status ring
ring: {
  width: 54, height: 54, borderRadius: 27,
  padding: 2, alignItems: 'center', justifyContent: 'center',
},
ringInner: {
  width: 50, height: 50, borderRadius: 25,
  backgroundColor: '#fff',
  overflow: 'hidden',
},

// Dropdown menu
sheetDropdown: {
  marginHorizontal: 14,
  marginTop: 4,
  marginBottom: 10,
  borderRadius: RADIUS.lg,
  borderWidth: 1,
  overflow: 'hidden',
},
sheetDropdownItem: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 12,
  paddingHorizontal: 14,
  paddingVertical: 12,
},
sheetDropdownTxt: {
  fontSize: 14,
  fontWeight: '600',
},

// Selected avatars row
selectedAvatarsRow: {
  flexDirection: 'row',
  paddingHorizontal: 14,
  paddingBottom: 10,
  gap: 12,
},
selectedAvatarWrap: {
  position: 'relative',
},
removeBadge: {
  position: 'absolute',
  top: -2,
  right: -2,
  width: 18,
  height: 18,
  borderRadius: 9,
  backgroundColor: COLORS.missed,
  alignItems: 'center',
  justifyContent: 'center',
},

// Selected contact indicator
contactRowSelected: {
  backgroundColor: 'rgba(30,156,240,0.12)',
  borderColor: 'rgba(30,156,240,0.30)',
},
selectedIndicator: {
  marginLeft: 8,
},
```

## Testing Checklist

After merge:
- [ ] Firebase chats load correctly
- [ ] Device contacts load with photos
- [ ] Direct chat creation works
- [ ] Group chat creation works
- [ ] Search functionality works
- [ ] Tab switching works
- [ ] Navigation to Chat screen works
- [ ] Status rings display (when feature enabled)
- [ ] Dropdown menu works
- [ ] Selected avatars show in group creation
- [ ] Phone numbers format correctly
- [ ] Animations are smooth

## Implementation Steps

1. Create backup of current ChatsScreen.tsx
2. Add new styles to bottom of file
3. Add dropdown menu state and UI to SelectContactSheet
4. Add selected avatars row to NewGroupSheet
5. Add status ring logic to ChatAvatar (conditional on hasStatus prop)
6. Update animation timing
7. Add phone formatting to contact display
8. Test thoroughly
9. Commit with message: "feat(ChatsScreen): Enhanced UI with dropdown menu, selected avatars, and status rings"

## Risk Assessment

**LOW RISK** ✅
- All changes are additive (no removal of functionality)
- Firebase hooks remain unchanged
- Navigation logic preserved
- Data models unchanged
- Backend queries unchanged

**Testing Required** ⚠️
- Manual testing of all features
- Verify no regressions in chat loading
- Verify contact loading still works
- Verify group creation works
