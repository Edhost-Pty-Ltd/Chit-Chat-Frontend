// ─── React Native Firebase (Native Module) Initialization ────────────────────
// React Native Firebase auto-initializes from google-services.json (Android)
// and GoogleService-Info.plist (iOS).
// Uses the v24 modular API.
import { Platform } from 'react-native';
import firebase from '@react-native-firebase/app';
import { getAuth } from '@react-native-firebase/auth';

console.log('[Firebase Native] Initializing React Native Firebase...');
console.log('[Firebase Native] Platform:', Platform.OS);

// Check if Firebase app is initialized
try {
  const apps = firebase.apps;
  console.log('[Firebase Native] Firebase apps found:', apps.length);

  if (apps.length === 0) {
    console.error('[Firebase Native] NO FIREBASE APPS INITIALIZED!');
    
    if (Platform.OS === 'ios') {
      console.error('[Firebase Native] iOS: GoogleService-Info.plist not being processed.');
      console.error('[Firebase Native] Please check:');
      console.error('[Firebase Native]   1. GoogleService-Info.plist exists in project root');
      console.error('[Firebase Native]   2. app.json has: "ios": { "googleServicesFile": "./GoogleService-Info.plist" }');
      console.error('[Firebase Native]   3. Rebuild with: eas build --platform ios --clear-cache');
      
      // Manual initialization for iOS as fallback
      console.log('[Firebase Native] Attempting manual initialization...');
      try {
        firebase.initializeApp({
          apiKey: 'AIzaSyDkgWtY5T513N6orCBKdEyO0nG5YCEieDM',
          authDomain: 'chit-chat-67a7f.firebaseapp.com',
          databaseURL: 'https://chit-chat-67a7f-default-rtdb.firebaseio.com',
          projectId: 'chit-chat-67a7f',
          storageBucket: 'chit-chat-67a7f.firebasestorage.app',
          messagingSenderId: '825582316169',
          appId: '1:825582316169:ios:1d6ef113064fa33f77f458',
        });
        console.log('[Firebase Native] ✅ Manual initialization successful');
      } catch (initError: any) {
        console.error('[Firebase Native] ❌ Manual initialization failed:', initError.message);
      }
    } else {
      console.error('[Firebase Native] Android: google-services.json not being processed.');
      console.error('[Firebase Native]   1. android/app/google-services.json exists');
      console.error('[Firebase Native]   2. android/app/build.gradle has: apply plugin: "com.google.gms.google-services"');
    }
  } else {
    const defaultApp = firebase.app();
    console.log('[Firebase Native] Default Firebase app name:', defaultApp.name);
    console.log('[Firebase Native] Firebase app options:', JSON.stringify(defaultApp.options, null, 2));

    // Test auth initialization
    const authInstance = getAuth();
    console.log('[Firebase Native] ✅ Auth instance created successfully');
    console.log('[Firebase Native] Auth app name:', authInstance.app.name);
  }
} catch (error: any) {
  console.error('[Firebase Native] ❌ Critical error during Firebase initialization:', error);
  console.error('[Firebase Native] Error code:', error.code);
  console.error('[Firebase Native] Error message:', error.message);
  if (error.stack) {
    console.error('[Firebase Native] Stack:', error.stack);
  }
}
