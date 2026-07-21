import { registerRootComponent } from 'expo';
import App from './App';
import { registerCallBackgroundHandlers } from './src/services/callBackground';

registerCallBackgroundHandlers();

registerRootComponent(App);
