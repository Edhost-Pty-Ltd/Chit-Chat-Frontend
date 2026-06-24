// ─── React Native Firebase (Native Module) Initialization ────────────────────
// React Native Firebase auto-initializes from google-services.json
import firebase from '@react-native-firebase/app';
import auth from '@react-native-firebase/auth';

console.log('[Firebase Native] Initializing React Native Firebase...');

// Check if Firebase app is initialized
try {
  const apps = firebase.apps;
  console.log('[Firebase Native] Firebase apps found:', apps.length);
  
  if (apps.length === 0) {
    console.error('[Firebase Native] NO FIREBASE APPS INITIALIZED!');
    console.error('[Firebase Native] This means google-services.json is not being processed.');
    console.error('[Firebase Native] Please check:');
    console.error('[Firebase Native]   1. android/app/google-services.json exists');
    console.error('[Firebase Native]   2. android/app/build.gradle has: apply plugin: "com.google.gms.google-services"');
    console.error('[Firebase Native]   3. android/build.gradle has: classpath "com.google.gms:google-services:4.x.x"');
  } else {
    console.log('[Firebase Native] Default Firebase app name:', apps[0].name);
    console.log('[Firebase Native] Firebase app options:', apps[0].options);
    
    // Test auth initialization
    const authInstance = auth();
    console.log('[Firebase Native] ✅ Auth instance created successfully');
    console.log('[Firebase Native] Auth app name:', authInstance.app.name);
  }
} catch (error: any) {
  console.error('[Firebase Native] ❌ Critical error during Firebase initialization:', error);
  console.error('[Firebase Native] Error code:', error.code);
  console.error('[Firebase Native] Error message:', error.message);
  console.error('[Firebase Native] Stack:', error.stack);
}

export { auth, firebase };
