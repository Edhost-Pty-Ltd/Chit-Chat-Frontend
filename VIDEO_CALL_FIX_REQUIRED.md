# Video Call Black Screen - Root Cause & Fix

## Root Cause Identified

From your logs:
```
[VideoCallScreen] Local stream: false
[VideoCallScreen] Remote stream: false
```

**The streams are NEVER being initialized.** 

There are NO logs showing:
- `[useWebRTC] Initializing peer connection... Video: true`
- `[useWebRTC] Local stream obtained`
- `[useOutgoingCall] Initializing peer connection... Video: true`

This means the WebRTC initialization with video is not happening at all.

## Why This Is Happening

The most likely causes:

### 1. ❌ App Not Rebuilt After Code Changes
The new code with video support hasn't been compiled into the app yet.

**Solution**: Full rebuild required
```bash
# Stop the current app
# Then rebuild:
npm run android:phone
```

### 2. ❌ Old Build Cache
Metro bundler or Gradle might be caching old code.

**Solution**: Clear all caches
```bash
# Clear Metro cache
npx react-native start --reset-cache

# In another terminal, rebuild:
npm run android:phone
```

### 3. ❌ TypeScript/JavaScript Not Updated
The `.tsx` files were edited but JavaScript wasn't regenerated.

**Solution**: Clean build
```bash
# Android
cd android
./gradlew clean
cd ..
npm run android:phone
```

## Verification Steps

After rebuilding, you should see these logs when initiating a video call:

### On Caller Device:
```
[ChatScreen] Initiating video call to: [userId]
[useOutgoingCall] Creating call document... Type: video
[useOutgoingCall] Initializing peer connection... Video: true
[useWebRTC] Initializing peer connection... Video: true
[useWebRTC] getUserMedia constraints: { audio: true, video: { width: { ideal: 1280 }, ... } }
[useWebRTC] Local stream obtained
[useWebRTC] Added track: audio
[useWebRTC] Added track: video  <-- THIS IS CRITICAL
[VideoCallScreen] Local stream: true  <-- Should be TRUE
[VideoCallScreen] Local video tracks: 1
```

### On Receiver Device:
```
[IncomingCallManager] Answering call: [callId] Type: video
[useIncomingCallAnswer] Answering call: [callId] Type: video
[useIncomingCallAnswer] Initializing peer connection... Video: true
[useWebRTC] Initializing peer connection... Video: true
[useWebRTC] Local stream obtained
[useWebRTC] Added track: video
[VideoCallScreen] Local stream: true
```

## If Still Black After Rebuild

### Check 1: Camera Permission
```bash
# Check if permission was actually granted
adb shell dumpsys package [your.package.name] | grep -A 1 CAMERA
```

### Check 2: Add Permission Request
If camera permission dialog isn't showing, add explicit request in `ChatScreen.tsx`:

```typescript
import { PermissionsAndroid, Platform } from 'react-native';

const handleVideoCall = useCallback(async () => {
  // ... existing checks ...
  
  // Request camera permission on Android
  if (Platform.OS === 'android') {
    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.CAMERA,
        {
          title: 'Camera Permission',
          message: 'This app needs camera access for video calls',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'OK',
        }
      );
      
      if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
        Alert.alert('Permission Denied', 'Camera access is required for video calls');
        return;
      }
    } catch (err) {
      console.warn('[ChatScreen] Camera permission error:', err);
      return;
    }
  }
  
  // ... rest of function ...
}, [...]);
```

### Check 3: Verify AndroidManifest.xml
Ensure these permissions exist in `android/app/src/main/AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />
<uses-feature android:name="android.hardware.camera" />
<uses-feature android:name="android.hardware.camera.autofocus" />
```

## Expected Behavior After Fix

### Caller:
1. Taps video call button
2. Camera permission requested (if first time)
3. VideoCallScreen opens
4. **Sees own face in small PIP view** (mirrored)
5. Status shows "Calling..."
6. Once answered, **remote video fills screen**

### Receiver:
1. Incoming call notification appears
2. Taps "Answer"
3. Camera permission requested (if first time)
4. VideoCallScreen opens
5. **Sees own face in small PIP view**
6. Status shows "Connecting..."
7. Once connected, **remote video fills screen**

## Quick Test

To verify video is working, check for video tracks:
- Console should show: `[VideoCallScreen] Local video tracks: 1`
- Track details should show: `{ enabled: true, readyState: "live" }`

If you see `tracks: 0` or `readyState: "ended"`, the camera isn't being accessed.

## Most Likely Solution

**90% chance this is a build cache issue.** Do a complete clean rebuild:

```bash
# 1. Stop all running processes
# 2. Clear everything
cd android
./gradlew clean
cd ..
rm -rf node_modules
npm install

# 3. Start fresh
npx react-native start --reset-cache

# 4. In another terminal
npm run android:phone
```

This will force a complete rebuild with all the new video calling code.
