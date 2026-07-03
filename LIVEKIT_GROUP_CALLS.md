# Group Calls with LiveKit

Group audio/video calls (up to 8 participants) use **LiveKit** (SFU) with a
custom UI that matches the 1-on-1 `AudioCallScreen` / `VideoCallScreen`.

## Architecture

```
ChatScreen ──initiate──> Firestore (groupCalls + notifications)
     │                          │
     │ navigate                 │ onSnapshot
     ▼                          ▼
GroupCallScreen          GroupCallNotificationManager (other members)
     │                          │ join → navigate
     ▼                          ▼
  generateLiveKitToken (Firebase Function: generateLiveKitToken)
     │
     ▼
  <LiveKitRoom>  ──WebRTC──>  LiveKit Cloud SFU  (wss://chit-chat-rs2syk5n.livekit.cloud)
```

## Backend: token generation (secure)

- **Function**: `functions/src/index.ts` → `generateLiveKitToken` (callable v2)
- The LiveKit API key/secret are stored as Firebase **secrets**, never in the client:
  - `LIVEKIT_API_KEY`
  - `LIVEKIT_API_SECRET`
- The caller's Firebase UID is used as the LiveKit participant identity (can't be spoofed).
- Deploy: `npx firebase deploy --only functions`
- Update secrets later: `npx firebase functions:secrets:set LIVEKIT_API_KEY`

## Client pieces

| File | Role |
|------|------|
| `src/config/livekit.ts` | Client-safe config (WS URL, max participants). No secret. |
| `src/utils/livekitToken.ts` | Calls the `generateLiveKitToken` function (native via `@react-native-firebase/functions`, web via JS SDK). |
| `src/screens/GroupCallScreen.tsx` | LiveKit room + custom UI (audio + video layouts). |
| `src/hooks/useGroupCall.ts` | Firestore call doc + member notifications (unchanged logic). |
| `index.ts` | Calls `registerGlobals()` from `@livekit/react-native`. |

## WebRTC library consolidation

The app previously used `react-native-webrtc` for 1-on-1 calls. LiveKit requires
`@livekit/react-native-webrtc` (an API-compatible fork). Both cannot coexist
(duplicate native symbols), so the project now uses **only**
`@livekit/react-native-webrtc`. All imports were migrated; 1-on-1 calls keep
working because the API is identical.

## Native config (Expo)

`app.json` plugins added:
- `@livekit/react-native-expo-plugin`
- `@config-plugins/react-native-webrtc`

## ⚠️ Required: rebuild the dev client

Native modules and config plugins changed, so a JS-only reload is **not** enough.
Rebuild the Android dev client:

```bash
npx expo run:android
```

(This runs prebuild to apply the config plugins, then builds.)

## Security follow-up

The API secret was shared in chat during setup. Rotate it in the LiveKit
dashboard (Settings → Keys), then update the Firebase secret:

```bash
npx firebase functions:secrets:set LIVEKIT_API_SECRET
npx firebase deploy --only functions
```

## Testing checklist

- [ ] Rebuild dev client (`npx expo run:android`)
- [ ] Start a group **audio** call → avatars, mute/speaker/camera/end work
- [ ] Start a group **video** call → video feeds render in main + PiP tiles
- [ ] Second member joins from the call notification
- [ ] Participant count updates as people join/leave
- [ ] Tap a PiP tile to swap the main participant (video)
- [ ] End call disconnects and returns to chat
