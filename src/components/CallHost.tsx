// ─── Component: Call Host ────────────────────────────────────────────────────
// App-level host for the single active LiveKit call. Because it lives above
// navigation, the call (and its <LiveKitRoom> connection) keeps running while
// the user navigates the rest of the app with the call minimized.

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useActiveCall } from '../context/ActiveCallContext';
import { GroupCallContent } from '../screens/GroupCallScreen';

export function CallHost() {
  const { call, minimized, endCall, minimize, maximize } = useActiveCall();

  if (!call) return null;

  return (
    // When minimized, the host must not block touches to the app underneath —
    // only the floating widget itself is interactive. When full-screen, it
    // covers everything.
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents={minimized ? 'box-none' : 'auto'}
    >
      <GroupCallContent
        params={call}
        minimized={minimized}
        onMinimize={minimize}
        onMaximize={maximize}
        onEnded={endCall}
      />
    </View>
  );
}
