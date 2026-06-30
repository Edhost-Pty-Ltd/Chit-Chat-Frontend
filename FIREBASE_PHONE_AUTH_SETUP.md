# Firebase Phone Authentication Setup for Development

## Problem
Firebase free tier (Spark Plan) has limitations on phone authentication:
- Limited SMS quota
- SMS may not work in all regions
- Real phone verification can be expensive during development

## Solution: Test Phone Numbers

Firebase allows you to set up test phone numbers that bypass SMS sending and use predefined verification codes.

---

## Step 1: Configure Test Phone Numbers in Firebase Console

1. **Go to Firebase Console**: https://console.firebase.google.com
2. **Select your project**: `chit-chat-67a7f`
3. **Navigate to Authentication**:
   - Click "Authentication" in the left sidebar
   - Click the "Sign-in method" tab
   - Scroll down to "Phone" provider
4. **Add Test Phone Numbers**:
   - Click "Phone" to expand settings
   - Scroll to "Phone numbers for testing" section
   - Click "Add phone number"
   - Add test numbers with their verification codes:

   ```
   Phone Number         | Verification Code
   ---------------------|------------------
   +27610000001        | 123456
   +27610000002        | 123456
   +27610000003        | 123456
   +27831111111        | 111111
   +27832222222        | 222222
   ```

5. **Save changes**

---

## Step 2: Using Test Numbers

### During Development

When creating an account or signing in:
1. Use one of the test phone numbers (e.g., `+27610000001`)
2. Enter the corresponding verification code (e.g., `123456`)
3. No SMS will be sent - Firebase will accept the predefined code instantly

### Benefits
- ✅ No SMS costs
- ✅ Instant verification (no waiting for SMS)
- ✅ Works offline/without mobile network
- ✅ Can test multiple accounts easily
- ✅ Repeatable and reliable for testing

---

## Step 3: Production Setup (When Ready)

When you're ready to deploy to production with real users:

### Option 1: Upgrade to Blaze Plan (Pay-as-you-go)
- SMS costs: ~$0.01-0.05 per message depending on region
- Only pay for what you use
- Required for production apps

### Option 2: Use Alternative Authentication
Consider these alternatives:
- Email/Password authentication
- Google Sign-In
- Facebook Login
- Apple Sign-In (required for iOS apps)

---

## Debugging Profile Creation Issues

If you see "Profile Creation Failed" even with test numbers, check:

### 1. **Check the error logs**
Look at the Metro/Expo console for the actual error message.

### 2. **Common Issues**:

**Firestore Rules:**
Ensure your Firestore security rules allow writes:
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read: if true;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    match /chats/{chatId} {
      allow read, write: if request.auth != null;
    }
    match /messages/{messageId} {
      allow read, write: if request.auth != null;
    }
  }
}
```

**Storage Rules:**
Ensure Firebase Storage rules allow uploads:
```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /profile-pictures/{userId}.jpg {
      allow read: if true;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    match /voice-notes/{allPaths=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

**Network Issues:**
- Check internet connection
- Verify Firebase config in `src/config/firebase.ts`
- Ensure all Firebase services are enabled in console

---

## Quick Test Instructions

1. **Start your app**: `npm start` or `npx expo start`
2. **Open Create Account screen**
3. **Enter test details**:
   - Name: `Test User`
   - Phone: `+27610000001` (or any test number you configured)
4. **Tap "Send Verification Code"**
5. **Enter the test OTP**: `123456`
6. **Complete biometric verification** (or skip if not enrolled)
7. **Profile should be created successfully**

---

## Current Test Numbers in Your Project

Based on your logs, you're already using test users:
- `testUser2` with phone `+27610000001`
- Another user with phone `+27831111111`

Make sure these are configured in Firebase Console as test numbers!

---

## Need Help?

If you're still experiencing issues:
1. Check the exact error message in the console
2. Verify Firebase rules (Firestore and Storage)
3. Ensure Firebase project is properly configured
4. Check that all required Firebase services are enabled

---

## Additional Resources

- [Firebase Phone Auth Documentation](https://firebase.google.com/docs/auth/web/phone-auth)
- [Firebase Auth Test Phone Numbers](https://firebase.google.com/docs/auth/web/phone-auth#test-with-fictional-phone-numbers)
- [Firebase Pricing](https://firebase.google.com/pricing)
