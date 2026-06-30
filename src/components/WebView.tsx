// ─── Component: WebView (Cross-Platform) ─────────────────────────────────────
// Platform-specific WebView wrapper

import React from 'react';
import { Platform, View, StyleSheet } from 'react-native';

interface WebViewProps {
  source: { uri: string };
  style?: any;
  onMessage?: (event: any) => void;
  onLoadStart?: () => void;
  onLoadEnd?: () => void;
  onError?: (error: any) => void;
  javaScriptEnabled?: boolean;
  domStorageEnabled?: boolean;
  mediaPlaybackRequiresUserAction?: boolean;
  allowsInlineMediaPlayback?: boolean;
  injectedJavaScript?: string;
}

// Web implementation using iframe
function WebViewWeb({ source, style, onMessage, onLoadStart, onLoadEnd, onError }: WebViewProps) {
  const iframeRef = React.useRef<HTMLIFrameElement>(null);

  React.useEffect(() => {
    // Listen for messages from iframe
    if (onMessage) {
      const handleMessage = (event: MessageEvent) => {
        // Only accept messages from the iframe's origin
        try {
          const url = new URL(source.uri);
          if (event.origin === url.origin) {
            onMessage({ nativeEvent: { data: event.data } });
          }
        } catch (err) {
          console.warn('[WebView-Web] Invalid source URI:', err);
        }
      };

      window.addEventListener('message', handleMessage);
      return () => window.removeEventListener('message', handleMessage);
    }
  }, [source.uri, onMessage]);

  const handleLoad = () => {
    onLoadEnd?.();
  };

  const handleError = () => {
    onError?.({ nativeEvent: { description: 'Failed to load' } });
  };

  return (
    <iframe
      ref={iframeRef}
      src={source.uri}
      style={{
        width: '100%',
        height: '100%',
        border: 'none',
        ...(style as any),
      }}
      onLoad={handleLoad}
      onError={handleError}
      allow="camera; microphone; fullscreen; display-capture"
    />
  );
}

// Native implementation (lazy loaded)
let WebViewNative: any = null;

if (Platform.OS !== 'web') {
  try {
    const webview = require('react-native-webview');
    WebViewNative = webview.WebView;
  } catch (err) {
    console.warn('[WebView] Failed to load react-native-webview:', err);
  }
}

// Cross-platform component
export default function WebView(props: WebViewProps) {
  if (Platform.OS === 'web') {
    return <WebViewWeb {...props} />;
  }

  if (!WebViewNative) {
    console.error('[WebView] WebView not available on native platform');
    return <View style={[styles.fallback, props.style]} />;
  }

  return <WebViewNative {...props} />;
}

const styles = StyleSheet.create({
  fallback: {
    backgroundColor: '#000',
    flex: 1,
  },
});
