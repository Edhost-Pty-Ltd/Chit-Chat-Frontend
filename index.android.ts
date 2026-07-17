import { registerRootComponent } from 'expo';
import App from './App';
import { registerCallBackgroundHandlers } from './src/services/callBackground';

// Register background/killed-state call handlers BEFORE the app renders so
// incoming-call FCM data messages and CallKeep actions work when the app is
// fully closed (Android full killed-state support).
registerCallBackgroundHandlers();

// Android-specific entry point - no web polyfills needed
registerRootComponent(App);
