// ─── Screen: Jitsi Call ──────────────────────────────────────────────────────
// Full-screen Jitsi Meet video conferencing using WebView

import React, { useRef, useState, useEffect } from 'react';
import { View, StyleSheet, Platform, ActivityIndicator, Alert, BackHandler } from 'react-native';
import WebView from '../components/WebView';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RootStackParamList } from '../types';
import { COLORS } from '../types/theme';
import { useAuth } from '../hooks/useAuth';
import { useGroupCall } from '../hooks/useGroupCall';

type NavProp = NativeStackNavigationProp<RootStackParamList, 'JitsiCall'>;
type RoutePropType = RouteProp<RootStackParamList, 'JitsiCall'>;

export default function JitsiCallScreen() {
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RoutePropType>();
  const webViewRef = useRef<WebView>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { joinGroupCall, leaveGroupCall } = useGroupCall();

  const { roomName, displayName, audioOnly, chatId, callId } = route.params;

  // Join group call when screen mounts (if callId provided)
  useEffect(() => {
    if (callId && user?.uid) {
      joinGroupCall(callId, user.uid);
    }
  }, [callId, user?.uid, joinGroupCall]);

  // Handle back button - confirm before leaving call
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      handleEndCall();
      return true; // Prevent default back behavior
    });

    return () => backHandler.remove();
  }, []);

  // Leave group call when component unmounts
  useEffect(() => {
    return () => {
      if (callId && user?.uid) {
        leaveGroupCall(callId, user.uid);
      }
    };
  }, [callId, user?.uid, leaveGroupCall]);

  const handleEndCall = () => {
    Alert.alert(
      'End Call',
      'Are you sure you want to leave the call?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            console.log('[JitsiCallScreen] User ended call');
            
            // Leave group call
            if (callId && user?.uid) {
              await leaveGroupCall(callId, user.uid);
            }
            
            navigation.goBack();
          },
        },
      ]
    );
  };

  // Generate Jitsi Meet URL with configuration
  const jitsiUrl = generateJitsiUrl({
    roomName,
    displayName,
    audioOnly: audioOnly || false,
  });

  // Handle messages from Jitsi (call ended, errors, etc.)
  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      console.log('[JitsiCallScreen] Message from Jitsi:', data);

      switch (data.event) {
        case 'videoConferenceLeft':
        case 'readyToClose':
          console.log('[JitsiCallScreen] Call ended by Jitsi');
          navigation.goBack();
          break;
        case 'participantJoined':
          console.log('[JitsiCallScreen] Participant joined:', data.participantId);
          break;
        case 'participantLeft':
          console.log('[JitsiCallScreen] Participant left:', data.participantId);
          break;
        default:
          break;
      }
    } catch (error) {
      console.error('[JitsiCallScreen] Error parsing message:', error);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.blue} />
        </View>
      )}
      
      <WebView
        ref={webViewRef}
        source={{ uri: jitsiUrl }}
        style={styles.webview}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        mediaPlaybackRequiresUserAction={false}
        allowsInlineMediaPlayback={true}
        onLoadStart={() => setLoading(true)}
        onLoadEnd={() => setLoading(false)}
        onMessage={handleMessage}
        onError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          console.error('[JitsiCallScreen] WebView error:', nativeEvent);
          Alert.alert('Error', 'Failed to load video call. Please try again.');
        }}
        // Android-specific props
        {...(Platform.OS === 'android' && {
          mixedContentMode: 'always',
          thirdPartyCookiesEnabled: true,
        })}
      />
    </SafeAreaView>
  );
}

// Helper function to generate Jitsi Meet URL with configuration
function generateJitsiUrl(config: {
  roomName: string;
  displayName: string;
  audioOnly: boolean;
}): string {
  const { roomName, displayName, audioOnly } = config;
  
  // Use Jitsi's public server (or replace with your own Jitsi server)
  const baseUrl = 'https://meet.jit.si';
  
  // URL-encode the room name and display name
  const encodedRoom = encodeURIComponent(roomName);
  const encodedName = encodeURIComponent(displayName);
  
  // Configure Jitsi with URL parameters
  const params = new URLSearchParams({
    '#config.startWithAudioMuted': 'false',
    '#config.startWithVideoMuted': audioOnly ? 'true' : 'false',
    '#userInfo.displayName': encodedName,
    '#config.prejoinPageEnabled': 'false', // Skip lobby
    '#config.requireDisplayName': 'false',
    '#config.enableWelcomePage': 'false',
    '#config.disableDeepLinking': 'true',
  });
  
  // Build final URL
  let url = `${baseUrl}/${encodedRoom}`;
  
  // Add config as hash parameters for mobile
  const configHash = [
    `config.startWithAudioMuted=false`,
    `config.startWithVideoMuted=${audioOnly}`,
    `config.prejoinPageEnabled=false`,
    `config.requireDisplayName=false`,
    `config.enableWelcomePage=false`,
    `config.disableDeepLinking=true`,
    `userInfo.displayName="${encodedName}"`,
  ].join('&');
  
  url = `${url}#${configHash}`;
  
  console.log('[JitsiCallScreen] Generated URL:', url);
  return url;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  webview: {
    flex: 1,
    backgroundColor: '#000',
  },
  loadingContainer: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
});
