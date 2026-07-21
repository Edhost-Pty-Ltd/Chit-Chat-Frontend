// MUST be the first import. Installs the secure-random polyfill (native) that
// crypto-js needs, before App — and therefore crypto-js — is evaluated. Metro
// resolves polyfills.native.ts on iOS/Android and the empty polyfills.web.ts on
// web. See src/polyfills.native.ts for why ordering matters.
import './src/polyfills';
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
