# Web Native Modules - Fixed Issues

## Problem
Several Expo native modules were blocking web deployment:
- `expo-media-library`
- `expo-camera`
- `expo-local-authentication`
- `expo-location`
- `expo-audio`

## Solution Summary

### Approach 1: Conditional Imports (Screens)
For modules used directly in screens, we use conditional imports with fallbacks:

```typescript
// Native-only module with web fallback
let LocalAuthentication: any = null;
if (Platform.OS !== 'web') {
  LocalAuthentication = require('expo-local-authentication');
} else {
  LocalAuthentication = {
    authenticateAsync: () => Promise.resolve({ success: false }),
  };
}
```

### Approach 2: Platform-Specific Files (Hooks)
For hooks with significant logic, we create separate `.web.ts` implementations:

- `useLocationSharing.web.ts` - Uses browser Geolocation API
- `useVoiceRecorder.web.ts` - Uses MediaRecorder API
- `useVoicePlayer.web.ts` - Uses HTML5 Audio
- `useRingtone.web.ts` - Uses HTML5 Audio

## Fixed Files

### Screens with Conditional Imports

**src/screens/ChatScreen.tsx**
- ❌ Before: Direct import of `expo-camera` and `expo-media-library`
- ✅ After: Conditional imports with web fallbacks
```typescript
let CameraView: any = null;
let useCameraPermissions: any = null;
if (Platform.OS !== 'web') {
  const camera = require('expo-camera');
  CameraView = camera.CameraView;
  useCameraPermissions = camera.useCameraPermissions;
} else {
  useCameraPermissions = () => [null, () => Promise.resolve({ status: 'denied' })];
}
```

**src/screens/CreateAccountScreen.tsx**
- ❌ Before: Direct import of `expo-local-authentication`
- ✅ After: Conditional import with web fallback
```typescript
let LocalAuthentication: any = null;
if (Platform.OS !== 'web') {
  LocalAuthentication = require('expo-local-authentication');
} else {
  LocalAuthentication = {
    authenticateAsync: () => Promise.resolve({ success: false }),
    hasHardwareAsync: () => Promise.resolve(false),
    isEnrolledAsync: () => Promise.resolve(false),
  };
}
```

### Hooks with Web Implementations

#### 1. useLocationSharing Hook

**Native (`useLocationSharing.ts`)**
- Uses `expo-location` package
- Accesses device GPS
- Provides location updates

**Web (`useLocationSharing.web.ts`)**
- Uses browser `navigator.geolocation` API
- Requests permission through browser
- Provides same interface as native

Key features:
- Share current location
- Live location tracking
- Automatic cleanup

#### 2. useVoiceRecorder Hook

**Native (`useVoiceRecorder.ts`)**
- Uses `expo-audio` package
- Records audio with device microphone
- Saves to file system

**Web (`useVoiceRecorder.web.ts`)**
- Uses `MediaRecorder` API
- Records audio to Blob
- Creates object URL for playback

Key features:
- Start/stop recording
- Duration tracking
- Auto-stop at 120 seconds
- Warning at 110 seconds

#### 3. useVoicePlayer Hook

**Native (`useVoicePlayer.ts`)**
- Uses `expo-audio` package
- Native audio playback
- Progress tracking

**Web (`useVoicePlayer.web.ts`)**
- Uses HTML5 `Audio` element
- Browser audio playback
- Same interface as native

Key features:
- Play/pause/stop controls
- Seek functionality
- Progress tracking
- Duration display

#### 4. useRingtone Hook

**Native (`useRingtone.ts`)**
- Uses `expo-audio` package
- Plays ringtone sound
- Loops for incoming calls

**Web (`useRingtone.web.ts`)**
- Uses HTML5 `Audio` element
- Browser audio playback with loop
- Same interface as native

## API Mappings

### Location API

| Feature | Native (expo-location) | Web (Geolocation API) |
|---------|----------------------|----------------------|
| Get current location | `Location.getCurrentPositionAsync()` | `navigator.geolocation.getCurrentPosition()` |
| Watch location | `Location.watchPositionAsync()` | `navigator.geolocation.watchPosition()` |
| Request permission | `Location.requestForegroundPermissionsAsync()` | Browser prompt |
| Accuracy | High accuracy mode | `enableHighAccuracy: true` |

### Audio Recording API

| Feature | Native (expo-audio) | Web (MediaRecorder) |
|---------|-------------------|-------------------|
| Start recording | `recorder.record()` | `mediaRecorder.start()` |
| Stop recording | `recorder.stop()` | `mediaRecorder.stop()` |
| Get audio data | File URI | Blob + Object URL |
| Format | Platform-specific | WebM audio |
| Duration limit | Manual timer | Manual timer |

### Audio Playback API

| Feature | Native (expo-audio) | Web (HTML5 Audio) |
|---------|-------------------|------------------|
| Play | `player.play()` | `audio.play()` |
| Pause | `player.pause()` | `audio.pause()` |
| Stop | `player.stop()` | `audio.pause()` + reset |
| Seek | `player.seekTo()` | `audio.currentTime = x` |
| Progress | `useAudioPlayerStatus()` | `ontimeupdate` event |

## Browser Compatibility

### Geolocation API
- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+
- ⚠️ Requires HTTPS or localhost

### MediaRecorder API
- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14.1+
- ✅ Edge 90+
- ⚠️ Requires microphone permission

### HTML5 Audio API
- ✅ All modern browsers
- ✅ Universal support

## Security & Permissions

### Web Permission Prompts

**Location Access:**
- Browser shows permission prompt automatically
- User must click "Allow" to grant access
- HTTPS required (except localhost)

**Microphone Access:**
- Browser shows permission prompt automatically
- User must click "Allow" to grant access
- Can be revoked in browser settings

### Native Permissions

**Location Access:**
- App requests permission through Expo API
- OS-level permission dialog
- Can be managed in device settings

**Microphone Access:**
- App requests permission through Expo API
- OS-level permission dialog
- Can be managed in device settings

## Known Limitations on Web

### Camera Features
- ❌ CameraView component not available
- ✅ Can use `<input type="file" accept="image/*" capture="camera">` as alternative
- ✅ Image picker still works through file input

### Media Library
- ❌ No direct access to device photo library
- ✅ File picker allows selecting from computer
- ✅ Can save downloads through browser

### Local Authentication
- ❌ Biometric authentication not available
- ✅ Can use WebAuthn API as alternative
- ✅ Password authentication works normally

## Testing

### Test Location Features
```bash
# Start web server
npm run web

# Open browser at http://localhost:8081
# Click location share button
# Browser will prompt for permission
# Click "Allow" to test location sharing
```

### Test Audio Recording
```bash
# Same as above
# Click voice message button
# Browser will prompt for microphone
# Click "Allow" to test recording
```

### Test Audio Playback
```bash
# Same as above
# Send or receive voice message
# Click play button
# Audio should play in browser
```

## Fallback Behavior

When native features aren't available on web:

1. **Camera**: Falls back to file picker
2. **Media Library**: Falls back to file download
3. **Biometric Auth**: Falls back to password only
4. **Location**: Browser geolocation API
5. **Audio**: Browser MediaRecorder/Audio APIs

## Future Enhancements

Potential improvements for web platform:

1. **WebRTC Video** for camera access
2. **WebAuthn** for biometric authentication
3. **File System Access API** for better file handling
4. **PWA features** for offline support
5. **Service Worker** for background tasks

## Summary

✅ **11 Files Created:**
- 4 web-specific hooks
- 3 cross-platform components
- 4 documentation files

✅ **2 Files Modified:**
- ChatScreen.tsx (conditional imports)
- CreateAccountScreen.tsx (conditional imports)

✅ **Zero Breaking Changes:**
- Native apps work exactly as before
- Web apps now functional
- Same API across platforms

## Quick Reference

| Module | Native | Web Alternative |
|--------|--------|----------------|
| expo-camera | CameraView | File input |
| expo-media-library | Media library access | File picker |
| expo-local-authentication | Biometric auth | Password only |
| expo-location | GPS API | Geolocation API |
| expo-audio (recording) | Native recorder | MediaRecorder |
| expo-audio (playback) | Native player | HTML5 Audio |

---

**Status**: ✅ All native module issues resolved  
**Platforms**: iOS, Android, Web  
**Updated**: June 22, 2026
