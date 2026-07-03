# Web Platform Implementation Guide

This document explains how the Chit-Chat app handles platform-specific code for web compatibility.

## Overview

The app uses React Native's platform-specific extensions to provide web-compatible implementations of native-only components. This allows the same codebase to run on iOS, Android, and Web.

## Platform-Specific Files

### File Extension Priority

Metro bundler and Webpack resolve files in this order:
1. `.web.tsx` / `.web.ts` - Web-specific implementation
2. `.tsx` / `.ts` - Default implementation (native)

### Key Web Implementations

#### 1. WebRTC Hook (`useWebRTC.web.ts`)
- **Native**: Uses `react-native-webrtc` package
- **Web**: Uses browser's native WebRTC APIs (`RTCPeerConnection`, `getUserMedia`)
- **Location**: `src/hooks/useWebRTC.web.ts`

#### 2. Audio Routing Hook (`useAudioRouting.web.ts`)
- **Native**: Controls speaker/earpiece on mobile devices
- **Web**: No-op implementation (browser handles audio routing)
- **Location**: `src/hooks/useAudioRouting.web.ts`

#### 3. RTCView Component (`RTCView.tsx`)
- **Native**: Uses `RTCView` from `react-native-webrtc`
- **Web**: Uses native HTML5 `<video>` element with `srcObject`
- **Location**: `src/components/RTCView.tsx`
- **Usage**: 
  ```tsx
  import RTCView from '../components/RTCView';
  
  // Native: pass streamURL
  <RTCView 
    streamURL={stream.toURL()} 
    style={styles.video}
  />
  
  // Web: pass stream directly
  <RTCView 
    stream={stream} 
    style={styles.video}
  />
  
  // Platform-agnostic (recommended)
  <RTCView 
    streamURL={Platform.OS !== 'web' ? stream.toURL?.() : undefined}
    stream={Platform.OS === 'web' ? stream : undefined}
    style={styles.video}
  />
  ```

#### 4. WebView Component (`WebView.tsx`)
- **Native**: Uses `react-native-webview` package
- **Web**: Uses HTML5 `<iframe>` element
- **Location**: `src/components/WebView.tsx`

## Configuration Files

### 1. Metro Config (`metro.config.js`)
Configures Metro bundler to recognize `.web.ts` and `.web.tsx` extensions:
```javascript
config.resolver.sourceExts = [
  'web.tsx',
  'web.ts',
  'web.jsx',
  'web.js',
  ...config.resolver.sourceExts,
];
```

### 2. Webpack Config (`webpack.config.js`)
Configures web bundling with:
- Platform-specific file resolution
- Aliases to prevent native packages from loading on web
- Transpilation settings for compatibility

## Blocked Native Packages

These packages are aliased to `false` on web (won't be bundled):
- `react-native-webrtc` → Browser WebRTC APIs
- `react-native-webview` → HTML iframe
- `@react-native-firebase/app` → Firebase Web SDK
- `@react-native-firebase/auth` → Firebase Web SDK

## Stream Handling

### Native Platform
```typescript
const stream = await mediaDevices.getUserMedia({ video: true });
const streamURL = stream.toURL(); // Convert to URL string
<RTCView streamURL={streamURL} />
```

### Web Platform
```typescript
const stream = await navigator.mediaDevices.getUserMedia({ video: true });
// Pass stream directly to video element
<video ref={ref} srcObject={stream} />
```

### Platform-Agnostic Pattern
```typescript
import { Platform } from 'react-native';
import RTCView from '../components/RTCView';

// In component:
<RTCView 
  streamURL={Platform.OS !== 'web' ? stream.toURL?.() : undefined}
  stream={Platform.OS === 'web' ? stream : undefined}
  objectFit="cover"
  mirror={true}
/>
```

## Running the App

### Web Development
```bash
npm run web
```
Starts Expo development server with web support at http://localhost:8081

### Native Development
```bash
npm run android  # Android
npm run ios      # iOS
```

## Testing Platform-Specific Code

### Check Current Platform
```typescript
import { Platform } from 'react-native';

if (Platform.OS === 'web') {
  // Web-specific code
} else {
  // Native-specific code
}
```

### Conditional Imports
```typescript
// Dynamic import for native-only packages
let NativeComponent = null;
if (Platform.OS !== 'web') {
  try {
    const pkg = require('native-package');
    NativeComponent = pkg.Component;
  } catch (err) {
    console.warn('Native package not available');
  }
}
```

## Common Issues

### 1. "requireNativeComponent is not a function"
**Cause**: Native component being imported on web
**Solution**: Use platform-specific wrapper or conditional import

### 2. "Cannot find module 'react-native-webrtc'"
**Cause**: Direct import of native package in web bundle
**Solution**: Use `.web.ts` file or dynamic import with Platform check

### 3. Video not displaying on web
**Cause**: Using `streamURL` prop on web instead of `stream`
**Solution**: Pass `stream` directly to RTCView on web platform

## Best Practices

1. **Use Platform-Specific Files**: Create `.web.ts` files for significant platform differences
2. **Lazy Load Native Packages**: Use dynamic imports for native-only packages
3. **Test on All Platforms**: Verify functionality on web, iOS, and Android
4. **Type Safety**: Use platform-agnostic types or conditional types
5. **Graceful Degradation**: Provide fallbacks for unavailable features

## Adding New Platform-Specific Features

1. Create base implementation: `src/features/MyFeature.ts`
2. Create web implementation: `src/features/MyFeature.web.ts`
3. Export same interface from both files
4. Import normally - bundler will use correct file per platform
5. Test on all target platforms

## Resources

- [React Native Platform-Specific Code](https://reactnative.dev/docs/platform-specific-code)
- [Expo Web Support](https://docs.expo.dev/workflow/web/)
- [WebRTC Browser APIs](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API)
