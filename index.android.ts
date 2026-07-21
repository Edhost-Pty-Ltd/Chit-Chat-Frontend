// MUST be the first import — installs the secure-random polyfill before App
// (and crypto-js) is evaluated. See src/polyfills.native.ts.
import './src/polyfills';
import { registerRootComponent } from 'expo';
import App from './App';
import { registerCallBackgroundHandlers } from './src/services/callBackground';

registerCallBackgroundHandlers();

registerRootComponent(App);
