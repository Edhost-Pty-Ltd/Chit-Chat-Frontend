# Group Calls - Quick Testing Guide

## Setup Requirements
- 2 or more physical devices (or 1 device + 1 emulator)
- Each device logged in with different phone numbers
- Both users must be registered in the app
- Both users must have each other in contacts

## Test 1: Create a Group Chat

### Steps
1. Open the app on Device A
2. Tap the blue **+** (FAB) button in the bottom-right
3. Select **"New group"**
4. Enter a group name (e.g., "Team Chat")
5. Select at least one contact
6. Tap **"Create"** button

### Expected Result
✅ Modal closes
✅ Automatically navigates to the new group chat
✅ Group name appears in header
✅ Shows "Group chat" under the name
✅ Call buttons (🎤 📹) are enabled in header

### Troubleshooting
❌ If "Create" button doesn't work:
- Check console logs for errors
- Verify Firestore rules allow chat creation
- Ensure selected user IDs are valid

## Test 2: Start an Audio Call

### Steps (Device A)
1. Open the group chat created above
2. Tap the **audio call** button (🎤) in the header
3. Wait for Jitsi Meet to load in WebView

### Expected Result
✅ Navigation to full-screen call interface
✅ Jitsi Meet loads (may take 3-5 seconds)
✅ Camera permission prompt appears (if first time)
✅ Microphone permission prompt appears (if first time)
✅ You see your display name in the call
✅ Audio is NOT muted by default

### Steps (Device B)
1. Open the same group chat
2. Tap the **audio call** button (🎤)
3. Wait for Jitsi Meet to load

### Expected Result
✅ Device B joins the same room as Device A
✅ Both users can see each other's names
✅ Both users can hear each other speaking
✅ Participant count shows "2" in Jitsi interface

### Troubleshooting
❌ If WebView doesn't load:
- Check internet connection
- Look for errors in console
- Verify WebView permissions in AndroidManifest.xml

❌ If users can't hear each other:
- Check microphone permissions
- Tap unmute button in Jitsi interface (if muted)
- Test device microphone in other apps

## Test 3: Start a Video Call

### Steps (Device A)
1. Open the group chat
2. Tap the **video call** button (📹) in header
3. Grant camera permission if prompted
4. Wait for video feed to appear

### Expected Result
✅ Video call screen loads
✅ You see your own video feed
✅ Camera is enabled by default

### Steps (Device B)
1. Open the same group chat
2. Tap the **video call** button (📹)
3. Join the call

### Expected Result
✅ Device B sees Device A's video
✅ Device A sees Device B's video
✅ Both can hear each other's audio
✅ Both video feeds are smooth (depends on network)

### Troubleshooting
❌ If video doesn't show:
- Check camera permissions
- Tap camera icon in Jitsi to enable
- Try switching cameras (front/back)

❌ If video is laggy:
- Check network connection (Jitsi requires good bandwidth)
- Close other apps using camera
- Try audio-only call instead

## Test 4: Leave Call

### Steps
1. While in a call, press the device **back button**
2. Read the confirmation dialog

### Expected Result
✅ Alert shows: "End Call" / "Are you sure you want to leave the call?"
✅ Two options: "Cancel" and "Leave"

### Steps
1. Tap "Leave"

### Expected Result
✅ Returns to group chat screen
✅ Call continues for other participants (they don't get disconnected)

### Alternative Method
1. In the Jitsi interface, tap the red **hang up** button

### Expected Result
✅ Returns to group chat screen immediately

## Test 5: Multiple Participants

### Setup
- Need 3+ devices or use 2 devices + 1 emulator

### Steps
1. Device A starts a video call in the group
2. Device B joins the call
3. Device C joins the call

### Expected Result
✅ All three participants see each other
✅ All three can hear each other
✅ Participant count shows "3"
✅ Video tiles arrange automatically (Jitsi's grid layout)

### Steps
1. Device A leaves the call

### Expected Result
✅ Device B and C remain in the call
✅ They can still communicate
✅ Participant count updates to "2"

## Test 6: Edge Cases

### Test 6a: No Internet
1. Disable WiFi and mobile data on device
2. Try starting a call

**Expected**: Error message "Failed to load video call"

### Test 6b: Permission Denied
1. Go to device Settings → Apps → Chit-Chat → Permissions
2. Revoke camera and microphone permissions
3. Try starting a video call

**Expected**: 
- Permission prompts appear again
- If denied, Jitsi loads but shows "Camera blocked" message

### Test 6c: Interrupted Call
1. Start a call between 2 devices
2. On Device A, receive an incoming phone call (use another phone to call Device A)

**Expected**:
- Video call pauses automatically
- After phone call ends, can resume Jitsi call
- Other participant sees "paused" indicator

## Common Issues & Solutions

### Issue: "Cannot make call - User information not available"
**Cause**: userId is null or undefined
**Solution**: 
- Ensure user is logged in
- Check auth state in console logs
- Restart the app

### Issue: WebView shows blank white screen
**Cause**: Jitsi server unreachable or URL malformed
**Solution**:
- Check console for URL being generated
- Verify internet connection
- Try on different network (WiFi vs mobile data)

### Issue: One-way audio (User A hears B, but B doesn't hear A)
**Cause**: Microphone permission or WebRTC issue
**Solution**:
- Check microphone permissions
- Tap unmute in Jitsi interface
- Leave and rejoin the call

### Issue: "Room not found" or participants in different rooms
**Cause**: Room name mismatch
**Solution**:
- Check console logs for room name: `chitchat-{chatId}`
- Ensure both users are in the SAME group chat (same chatId)
- Verify chatId is correct in navigation params

### Issue: Call buttons disabled (greyed out)
**Cause**: `outgoingCall.isInitiating` is true
**Solution**:
- Wait a few seconds for previous call attempt to timeout
- Restart the app if stuck

## Performance Tips

### For Best Call Quality
1. Use WiFi instead of mobile data (especially for video)
2. Close background apps to free up resources
3. Keep devices charged (video calls drain battery)
4. Use headphones to prevent echo
5. Ensure good lighting for video calls

### For Testing with Limited Devices
- Use 1 physical device + 1 Android emulator (on same machine)
- Or use 1 physical device + Chrome browser (Jitsi works in browsers too)
- Or test with a friend/colleague remotely

## Success Checklist

After completing all tests above, verify:

- [ ] Groups can be created successfully
- [ ] Audio calls work between 2+ users
- [ ] Video calls work between 2+ users
- [ ] Calls can be left gracefully
- [ ] Multiple people can join same call
- [ ] Call quality is acceptable
- [ ] No crashes or freezes
- [ ] Permissions are requested properly
- [ ] Error messages are user-friendly

## Next Steps After Testing

If all tests pass:
1. ✅ Group calling feature is production-ready
2. Consider adding call notifications (see GROUP_CALLS_COMPLETE.md)
3. Monitor Jitsi server performance
4. Gather user feedback on call quality

If issues found:
1. Document the exact steps to reproduce
2. Check console logs for errors
3. Verify Firestore rules and data structure
4. Test on different devices/networks
5. File issue with error details

## Support Resources

- **Jitsi Meet Docs**: https://jitsi.github.io/handbook/
- **React Native WebView**: https://github.com/react-native-webview/react-native-webview
- **Expo WebView**: https://docs.expo.dev/versions/latest/sdk/webview/
- **Firestore Docs**: https://firebase.google.com/docs/firestore

---

**Happy Testing! 🎉**
