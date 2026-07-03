# Ringtone Implementation - Complete ✅

## Summary
Successfully integrated ringtone playback for incoming calls using the existing `useRingtone` hook and your custom `ringtone.mp3` file.

## Changes Made

### 1. Integrated Ringtone Hook in IncomingCallManager
**File**: `src/components/IncomingCallManager.tsx`

Added:
```typescript
import { useRingtone } from '../hooks/useRingtone';

export function IncomingCallManager() {
  // ... existing code ...
  const ringtone = useRingtone();
  
  // Play/stop ringtone when incoming call state changes
  useEffect(() => {
    if (incomingCall) {
      console.log('[IncomingCallManager] Incoming call detected, playing ringtone');
      ringtone.play();
    } else {
      console.log('[IncomingCallManager] No incoming call, stopping ringtone');
      ringtone.stop();
    }

    return () => {
      ringtone.stop();
    };
  }, [incomingCall]);
}
```

### 2. Fixed Audio Player Asset Loading
**File**: `src/hooks/useRingtone.ts`

Fixed the `replace()` call to use direct asset reference instead of object wrapper:

**Before** (incorrect for SDK 56):
```typescript
player.replace({
  uri: require('../../assets/ringtone.mp3'),
});
```

**After** (correct for SDK 56):
```typescript
const ringtoneAsset = require('../../assets/ringtone.mp3');
player.replace(ringtoneAsset);
```

## How It Works

### Ringtone Flow
1. **Call Arrives**: `useIncomingCalls` detects a new ringing call in Firestore
2. **Context Updates**: Sets `incomingCall` in CallContext
3. **Ringtone Starts**: `IncomingCallManager` useEffect detects the change and calls `ringtone.play()`
4. **Audio Configuration**: Uses expo-audio with:
   - `playsInSilentModeIOS: true` - Plays even when phone is on silent
   - `staysActiveInBackground: true` - Continues in background
   - `loop: true` - Repeats until answered/rejected
   - `volume: 1.0` - Full volume
5. **Ringtone Stops**: When call is answered/rejected or times out, `incomingCall` becomes null and ringtone stops

### Fallback Behavior
If the custom ringtone fails to load:
- Falls back to system beep pattern (logs "Beep pattern tick" every 1.5 seconds)
- This is a silent fallback but demonstrates the pattern is working

## Ringtone File
- **Location**: `assets/ringtone.mp3`
- **Size**: 810,230 bytes (~810 KB)
- **Format**: MP3
- **Added**: June 26, 2026

## Testing Instructions

### Test Incoming Call with Ringtone
1. Ensure the app is running on a physical device (emulator audio can be unreliable)
2. Have another user call you
3. **Expected behavior**:
   - Incoming call overlay appears
   - Ringtone starts playing immediately
   - Ringtone loops continuously
   - Ringtone plays even if phone is on silent mode
4. **Stopping ringtone**:
   - Answer call → ringtone stops immediately
   - Reject call → ringtone stops immediately
   - Call times out → ringtone stops automatically

### Check Console Logs
Look for these log messages to verify ringtone is working:

```
[IncomingCallManager] Incoming call detected, playing ringtone
[useRingtone] Starting ringtone...
[useRingtone] Loading ringtone asset
[useRingtone] Custom ringtone started
```

When call ends:
```
[IncomingCallManager] No incoming call, stopping ringtone
[useRingtone] Stopping ringtone...
[useRingtone] Ringtone stopped
```

## Troubleshooting

### Ringtone doesn't play at all

**Check audio mode configuration**:
The `useRingtone` hook already configures audio mode on mount:
```typescript
await AudioModule.setAudioModeAsync({
  playsInSilentModeIOS: true,
  allowsRecordingIOS: false,
  staysActiveInBackground: true,
});
```

**Check permissions**:
- No special permissions needed for audio playback
- Only recording needs microphone permission

**Check device volume**:
- Ensure device media volume is not muted
- Test with headphones if device speaker is quiet

**Check console for errors**:
```
[useRingtone] Error playing ringtone: [error message]
```

### Ringtone plays but then stops immediately

**Possible cause**: Component unmounting
- Ringtone is tied to `IncomingCallManager` component lifecycle
- If component unmounts, ringtone stops
- Check that `IncomingCallManager` is mounted in your app navigation

**Solution**: Verify in `App.tsx`:
```typescript
<IncomingCallManager />
```

### Ringtone doesn't loop

**Check loop property**:
The hook sets `player.loop = true` before playing. If it's not looping:
- Check console for any errors during playback
- The audio file might be corrupted
- Try with a different MP3 file

### Ringtone is too quiet

**Adjust volume**:
In `useRingtone.ts`, change:
```typescript
player.volume = 1.0; // Already at maximum
```

**System volume**:
- Ringtone uses the device's media volume
- Adjust media volume slider on device

### "Custom ringtone not found" or fallback to beep pattern

This means the asset couldn't be loaded. Causes:
1. **Asset path incorrect**: Verify `../../assets/ringtone.mp3` is correct
2. **Metro bundler not restarted**: Stop and restart dev server
3. **File not included in bundle**: Check `app.json` asset configuration
4. **Unsupported format**: Ensure MP3 is standard format (not corrupted)

**Fix**:
```bash
# Stop Metro bundler
# Restart dev server
npx expo start -c
```

### Android-Specific Issues

**Ringtone doesn't play on Android**:
- Android requires notification permission for sustained audio in some cases
- Check if you need to request `POST_NOTIFICATIONS` permission

**Audio focus issues**:
- Other apps might take audio focus
- The hook uses default audio mode - may need adjustment for Android

### iOS-Specific Issues

**Ringtone doesn't play when app is in background**:
- Check `enableBackgroundPlayback` in app.json config plugin
- Ensure audio background mode is enabled

**Silent mode**:
- The hook sets `playsInSilentModeIOS: true`
- Should play even in silent mode
- If not working, check iOS sound settings

## Advanced: Customizing Ringtone Behavior

### Use Different Ringtone File
Replace `assets/ringtone.mp3` with your preferred audio file:
```bash
# Add your custom ringtone
cp /path/to/your/ringtone.mp3 assets/ringtone.mp3

# Restart bundler to pick up new asset
npx expo start -c
```

### Adjust Volume Programmatically
Modify `useRingtone.ts`:
```typescript
player.volume = 0.7; // 70% volume instead of 100%
```

### Change Audio Mode Settings
Modify the audio configuration in `useRingtone.ts`:
```typescript
await AudioModule.setAudioModeAsync({
  playsInSilentModeIOS: false, // Don't play in silent mode
  allowsRecordingIOS: false,
  staysActiveInBackground: false, // Stop when app backgrounds
});
```

### Stop Looping After X Seconds
Add timeout in `IncomingCallManager.tsx`:
```typescript
useEffect(() => {
  if (incomingCall) {
    ringtone.play();
    
    // Stop after 30 seconds
    const timeout = setTimeout(() => {
      ringtone.stop();
    }, 30000);
    
    return () => {
      clearTimeout(timeout);
      ringtone.stop();
    };
  } else {
    ringtone.stop();
  }
}, [incomingCall]);
```

### Add Vibration Pattern
Combine with Expo Haptics:
```typescript
import * as Haptics from 'expo-haptics';

useEffect(() => {
  if (incomingCall) {
    ringtone.play();
    
    // Vibrate pattern
    const vibrateInterval = setInterval(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }, 1000);
    
    return () => {
      clearInterval(vibrateInterval);
      ringtone.stop();
    };
  }
}, [incomingCall]);
```

## Files Modified
- ✅ `src/components/IncomingCallManager.tsx` - Integrated ringtone hook
- ✅ `src/hooks/useRingtone.ts` - Fixed audio player asset loading for SDK 56

## Files Already Existing (No Changes)
- ✅ `assets/ringtone.mp3` - Your custom ringtone file
- ✅ `src/hooks/useIncomingCalls.ts` - Detects incoming calls
- ✅ `src/context/CallContext.tsx` - Manages call state

## Next Steps
1. Test incoming calls on a physical device
2. Verify ringtone plays and loops correctly
3. Test answer/reject to ensure ringtone stops
4. Adjust volume or audio settings if needed

## SDK 56 Compatibility Note
This implementation uses expo-audio SDK 56 APIs:
- `useAudioPlayer()` hook for player creation
- Direct asset passing to `player.replace()`
- `AudioModule.setAudioModeAsync()` for audio configuration

These APIs differ from older expo-av versions, so this implementation is specifically for Expo SDK 56.
