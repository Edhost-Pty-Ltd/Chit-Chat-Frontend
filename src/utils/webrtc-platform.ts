// ─── WebRTC Platform Wrapper ─────────────────────────────────────────────────
// Conditionally imports react-native-webrtc only on native platforms
// On web, provides mock implementations to prevent errors

import { Platform } from 'react-native';

let RTCPeerConnection: any;
let RTCSessionDescription: any;
let RTCIceCandidate: any;
let mediaDevices: any;
let MediaStream: any;

if (Platform.OS === 'web') {
  // Mock implementations for web
  console.warn('[WebRTC] Running on web - WebRTC features disabled');
  
  RTCPeerConnection = class MockRTCPeerConnection {
    constructor() {
      console.warn('[WebRTC] Mock RTCPeerConnection created');
    }
    createOffer() { return Promise.resolve({}); }
    createAnswer() { return Promise.resolve({}); }
    setLocalDescription() { return Promise.resolve(); }
    setRemoteDescription() { return Promise.resolve(); }
    addIceCandidate() { return Promise.resolve(); }
    addTrack() { return {}; }
    removeTrack() {}
    close() {}
    addEventListener() {}
    removeEventListener() {}
  };
  
  RTCSessionDescription = class MockRTCSessionDescription {
    constructor(init: any) {
      Object.assign(this, init);
    }
  };
  
  RTCIceCandidate = class MockRTCIceCandidate {
    constructor(init: any) {
      Object.assign(this, init);
    }
  };
  
  mediaDevices = {
    getUserMedia: () => {
      console.warn('[WebRTC] Mock getUserMedia called - returning null');
      return Promise.resolve(null);
    },
    enumerateDevices: () => Promise.resolve([]),
  };
  
  MediaStream = class MockMediaStream {
    constructor() {
      console.warn('[WebRTC] Mock MediaStream created');
    }
    getTracks() { return []; }
    getAudioTracks() { return []; }
    getVideoTracks() { return []; }
    addTrack() {}
    removeTrack() {}
    toURL() { return ''; }
  };
} else {
  // Use real react-native-webrtc on native platforms
  const webrtc = require('react-native-webrtc');
  RTCPeerConnection = webrtc.RTCPeerConnection;
  RTCSessionDescription = webrtc.RTCSessionDescription;
  RTCIceCandidate = webrtc.RTCIceCandidate;
  mediaDevices = webrtc.mediaDevices;
  MediaStream = webrtc.MediaStream;
}

export {
  RTCPeerConnection,
  RTCSessionDescription,
  RTCIceCandidate,
  mediaDevices,
  MediaStream,
};

export type { RTCPeerConnectionType, MediaStreamType };

// TypeScript types
interface RTCPeerConnectionType {
  createOffer(): Promise<RTCSessionDescriptionInit>;
  createAnswer(): Promise<RTCSessionDescriptionInit>;
  setLocalDescription(description: RTCSessionDescriptionInit): Promise<void>;
  setRemoteDescription(description: RTCSessionDescriptionInit): Promise<void>;
  addIceCandidate(candidate: RTCIceCandidateInit): Promise<void>;
  close(): void;
}

interface MediaStreamType {
  getTracks(): any[];
  getAudioTracks(): any[];
  getVideoTracks(): any[];
  toURL(): string;
}
