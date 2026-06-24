import 'expo-dev-client';
import { registerRootComponent } from 'expo';
import { registerGlobals } from '@livekit/react-native';
import App from './App';

// Register LiveKit WebRTC globals (required for group calls)
registerGlobals();

// Web-specific entry point
registerRootComponent(App);
