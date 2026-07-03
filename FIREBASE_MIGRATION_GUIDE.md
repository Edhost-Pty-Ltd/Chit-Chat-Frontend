# Firebase Migration Guide
**Chit-Chat — chit-chat-67a7f → new project**

Current project: `chit-chat-67a7f` (Blaze)  
Target project: your new account (currently on Spark — must be upgraded before starting)

---

## Before you start — upgrade the new account to Blaze

Cloud Functions, Phone Authentication SMS quotas, and some Storage rules all require the Blaze (pay-as-you-go) plan. You cannot deploy the functions without it.

1. Sign into the new Google account at [console.firebase.google.com](https://console.firebase.google.com)
2. Open the new Firebase project
3. In the left sidebar click **Upgrade** (the flame icon near the bottom)
4. Select **Blaze (pay as you go)**
5. Link a billing account (you won't be charged unless you exceed the free tier — limits are generous for development)
6. Confirm the upgrade

Only continue once the project shows **Blaze** in the sidebar.

---

## Part 1 — Console setup (Firebase website)

### Step 1 — Enable Phone Authentication
1. Left sidebar → **Build → Authentication → Get started**
2. Click the **Sign-in method** tab
3. Click **Phone** → toggle **Enable** → **Save**

### Step 2 — Create Firestore database
1. Left sidebar → **Build → Firestore Database → Create database**
2. Choose **Production mode**
3. Pick a region close to your users (e.g. `europe-west1` for South Africa) → **Enable**

### Step 3 — Enable Firebase Storage
1. Left sidebar → **Build → Storage → Get started**
2. Click through the prompts → choose the **same region** you chose for Firestore → **Done**

### Step 4 — Register the Android app
1. On the project overview page click the **Android** icon
2. **Android package name:** `com.edhost.chitchat`  
   ⚠️ This must match exactly — do not change it
3. **App nickname:** Chit-Chat Android (optional)
4. **Debug signing certificate SHA-1:** see note below — needed for Phone Auth on physical devices
5. Click **Register app**
6. **Download `google-services.json`** → save it somewhere you can find it
7. Click through the remaining screens (skip the SDK installation steps)

**Getting your SHA-1 (run this once in PowerShell inside the project):**
```powershell
cd android
.\gradlew signingReport
```
Copy the `SHA1` value under `Variant: debug` and paste it into the Firebase SHA-1 field.  
You can also add it later via **Project settings (gear icon) → Your apps → Add fingerprint**.

### Step 5 — Register the iOS app (only if you target iOS)
1. Project overview → **Add app → iOS**
2. **Bundle ID:** `com.edhost.chitchat.app`
3. Register → Download **GoogleService-Info.plist** → save it
4. Skip the SDK steps

### Step 6 — Get the web app config
1. Project overview → **Add app → Web** (or click the existing web app if one was auto-created)
2. Give it a nickname, **do not** enable Firebase Hosting
3. Register → copy the `firebaseConfig` block — it looks like:

```js
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "your-new-project.firebaseapp.com",
  projectId: "your-new-project",
  storageBucket: "your-new-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};
```

Save this somewhere — you'll paste it into the code in Part 2.

### Step 7 — Set Firestore security rules
1. Left sidebar → **Firestore Database → Rules**
2. Replace all content with:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

3. Click **Publish**

### Step 8 — Set Storage security rules
1. Left sidebar → **Storage → Rules**
2. Replace all content with:

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

3. Click **Publish**

---

## Part 2 — Update the codebase (5 files)

You need the `google-services.json` you downloaded in Step 4 and the `firebaseConfig` values from Step 6.

### File 1 — `android/app/google-services.json`
Replace the entire file with the `google-services.json` you downloaded.

```powershell
# PowerShell — replace <path-to-download> with the actual download location
Copy-Item "<path-to-download>\google-services.json" "android\app\google-services.json"
```

### File 2 — `google-services.json` (root copy)
The root-level file is a duplicate used by some build tools. Replace it with the same file:

```powershell
Copy-Item "<path-to-download>\google-services.json" "google-services.json"
```

### File 3 — `GoogleService-Info.plist` (iOS only)
Replace the root-level file with the one downloaded in Step 5:

```powershell
Copy-Item "<path-to-download>\GoogleService-Info.plist" "GoogleService-Info.plist"
```

### File 4 — `src/config/firebase.ts`
Open the file and replace the `firebaseConfig` object with your new values:

```ts
const firebaseConfig = {
  apiKey:            'PASTE_NEW_API_KEY',
  authDomain:        'your-new-project.firebaseapp.com',
  projectId:         'your-new-project',
  storageBucket:     'your-new-project.appspot.com',
  messagingSenderId: 'PASTE_NEW_SENDER_ID',
  appId:             '1:PASTE_NEW_SENDER_ID:web:PASTE_NEW_APP_ID',
};
```

Leave everything else in the file exactly as it is.

### File 5 — `.firebaserc`
Open the file and replace the project ID:

```json
{
  "projects": {
    "default": "your-new-project-id"
  }
}
```

---

## Part 3 — Deploy Cloud Functions

Run these commands from a terminal inside the project root.

### Step 9 — Log in and switch to the new project
```powershell
firebase login
firebase use your-new-project-id
```

If you have multiple Google accounts, `firebase login` will open a browser. Make sure you log in with the account that owns the new Firebase project.

### Step 10 — Set the LiveKit secrets
The functions need two secrets. You'll be prompted to type the values — they are not stored in any file.

```powershell
firebase functions:secrets:set LIVEKIT_API_KEY
```
Enter your LiveKit API key when prompted.

```powershell
firebase functions:secrets:set LIVEKIT_API_SECRET
```
Enter your LiveKit API secret when prompted.

If you have rotated the secrets since the last deployment (recommended because the old secret was shared in chat), use the new values here.

### Step 11 — Build and deploy
```powershell
cd functions
npm run build
cd ..
firebase deploy --only functions
```

Expected output at the end:
```
✔  functions: Finished running predeploy script.
✔  functions[generateLiveKitToken]: function deployed.
✔  functions[cleanupExpiredStatuses]: function deployed.
✔  functions[cleanupExpiredMessages]: function deployed.
✔  functions[cleanupStaleCalls]: function deployed.
```

---

## Part 4 — Test before committing

### Step 12 — Clear Metro cache and rebuild
```powershell
npx expo start --clear
```

Rebuild and install the app on a physical device. Test:
- [ ] Sign up with a phone number — you should receive an SMS OTP
- [ ] Send a message
- [ ] Post a status update
- [ ] Start a group call (tests the LiveKit token function)
- [ ] Check that the privacy settings screen saves and loads correctly

### Step 13 — Commit the config changes
Once everything works, commit only the five config files:

```powershell
git add src/config/firebase.ts .firebaserc android/app/google-services.json google-services.json GoogleService-Info.plist
git commit -m "Migrate to new Firebase project"
git push origin Frontend-FeaturesMJ
```

---

## What does NOT change

- No TypeScript files other than `src/config/firebase.ts`
- No collection names, field names, or data logic
- No Firestore data needs to be migrated — all test accounts will sign up fresh
- No package.json or npm packages
- No LiveKit configuration (same URL and credentials, unless you rotated them)

---

## Quick reference

| # | What | Where |
|---|------|-------|
| 1 | Upgrade new account to Blaze | Firebase console |
| 2 | Enable Phone Auth | Firebase console → Authentication |
| 3 | Create Firestore (production mode) | Firebase console → Firestore |
| 4 | Enable Storage | Firebase console → Storage |
| 5 | Register Android app, download `google-services.json` | Firebase console |
| 6 | Register iOS app, download `GoogleService-Info.plist` | Firebase console (iOS only) |
| 7 | Get web app `firebaseConfig` | Firebase console |
| 8 | Set Firestore + Storage security rules | Firebase console |
| 9 | Replace `android/app/google-services.json` | File in repo |
| 10 | Replace root `google-services.json` | File in repo |
| 11 | Replace `GoogleService-Info.plist` | File in repo (iOS only) |
| 12 | Update `src/config/firebase.ts` | File in repo |
| 13 | Update `.firebaserc` | File in repo |
| 14 | `firebase use <new-project-id>` | Terminal |
| 15 | Set `LIVEKIT_API_KEY` + `LIVEKIT_API_SECRET` secrets | Terminal |
| 16 | `firebase deploy --only functions` | Terminal |
| 17 | Test on device | Physical device |
| 18 | Commit the 5 config files | Terminal |
