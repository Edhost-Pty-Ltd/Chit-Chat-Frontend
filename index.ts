import 'expo-dev-client';
import { registerRootComponent } from 'expo';
import { registerGlobals } from '@livekit/react-native';
import App from './App';
import { registerCallBackgroundHandlers } from './src/services/callBackground';

// Register LiveKit WebRTC globals (required for group calls)
registerGlobals();

// Register background/killed-state call handlers (Android-only, idempotent).
// Also registered in index.android.ts; kept here so coverage is guaranteed
// regardless of which entry file Metro resolves for the platform.
registerCallBackgroundHandlers();

// Web-specific entry point
registerRootComponent(App);
