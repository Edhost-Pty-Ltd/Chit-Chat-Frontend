// ─── Hook: WebRTC (Web Implementation) ───────────────────────────────────────
// Web-native implementation using browser WebRTC APIs

import { useState, useRef, useCallback, useEffect } from 'react';

// Web uses native browser APIs
const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

export interface WebRTCHandlers {
  onLocalStream?: (stream: MediaStream) => void;
  onRemoteStream?: (stream: MediaStream) => void;
  onIceCandidate?: (candidate: RTCIceCandidateInit) => void;
  onConnectionStateChange?: (state: string) => void;
  onNetworkQualityChange?: (quality: NetworkQuality) => void;
}

export type NetworkQuality = 'excellent' | 'good' | 'fair' | 'poor' | 'unknown';

export function useWebRTC(handlers?: WebRTCHandlers) {
  // Use refs for stream storage to persist across parent hook re-renders
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  
  // State trigger for UI updates when streams change
  const [streamVersion, setStreamVersion] = useState(0);
  
  const [connectionState, setConnectionState] = useState<string>('new');
  const [networkQuality, setNetworkQuality] = useState<NetworkQuality>('unknown');
  
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const statsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Initialize peer connection ────────────────────────────────────────────
  const initializePeerConnection = useCallback(async (isVideo: boolean = false) => {
    try {
      console.log('[useWebRTC-Web] Initializing peer connection... Video:', isVideo);
      
      // Create peer connection using browser API
      const pc = new RTCPeerConnection(ICE_SERVERS);
      peerConnectionRef.current = pc;

      // Get local stream using browser getUserMedia
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: isVideo ? {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 },
          facingMode: 'user',
        } : false,
      });
      
      console.log('[useWebRTC-Web] Local stream obtained');
      handlers?.onLocalStream?.(stream);

      // Add local stream tracks to peer connection
      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
        console.log('[useWebRTC-Web] Added track:', track.kind);
      });

      // Assign local stream to ref and trigger UI update
      localStreamRef.current = stream;
      setStreamVersion(v => v + 1);

      // Handle remote stream
      pc.ontrack = (event) => {
        console.log('[useWebRTC-Web] Remote track received:', event.track.kind);
        if (event.streams && event.streams[0]) {
          // Assign remote stream to ref and trigger UI update
          remoteStreamRef.current = event.streams[0];
          setStreamVersion(v => v + 1);
          handlers?.onRemoteStream?.(event.streams[0]);
        }
      };

      // Handle ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          console.log('[useWebRTC-Web] ICE candidate generated');
          const candidateInit: RTCIceCandidateInit = {
            candidate: event.candidate.candidate,
            sdpMLineIndex: event.candidate.sdpMLineIndex,
            sdpMid: event.candidate.sdpMid,
          };
          handlers?.onIceCandidate?.(candidateInit);
        }
      };

      // Handle connection state changes
      pc.onconnectionstatechange = () => {
        const state = pc.connectionState;
        console.log('[useWebRTC-Web] Connection state:', state);
        setConnectionState(state);
        handlers?.onConnectionStateChange?.(state);
      };

      // Handle ICE connection state
      pc.oniceconnectionstatechange = () => {
        console.log('[useWebRTC-Web] ICE connection state:', pc.iceConnectionState);
      };

      console.log('[useWebRTC-Web] Peer connection initialized');
      return pc;
    } catch (error) {
      console.error('[useWebRTC-Web] Failed to initialize:', error);
      throw error;
    }
  }, [handlers]);

  // ── Create offer ───────────────────────────────────────────────────────────
  const createOffer = useCallback(async (isVideo: boolean = false): Promise<RTCSessionDescriptionInit> => {
    try {
      const pc = peerConnectionRef.current;
      if (!pc) throw new Error('Peer connection not initialized');

      console.log('[useWebRTC-Web] Creating offer... Video:', isVideo);
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: isVideo,
      });

      await pc.setLocalDescription(offer);
      console.log('[useWebRTC-Web] Offer created and set as local description');
      
      return {
        type: offer.type!,
        sdp: offer.sdp!,
      } as RTCSessionDescriptionInit;
    } catch (error) {
      console.error('[useWebRTC-Web] Failed to create offer:', error);
      throw error;
    }
  }, []);

  // ── Create answer ──────────────────────────────────────────────────────────
  const createAnswer = useCallback(
    async (offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> => {
      try {
        const pc = peerConnectionRef.current;
        if (!pc) throw new Error('Peer connection not initialized');

        console.log('[useWebRTC-Web] Setting remote description (offer)...');
        await pc.setRemoteDescription(new RTCSessionDescription(offer));

        console.log('[useWebRTC-Web] Creating answer...');
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        
        console.log('[useWebRTC-Web] Answer created and set as local description');
        
        return {
          type: answer.type!,
          sdp: answer.sdp!,
        } as RTCSessionDescriptionInit;
      } catch (error) {
        console.error('[useWebRTC-Web] Failed to create answer:', error);
        throw error;
      }
    },
    []
  );

  // ── Set remote answer ──────────────────────────────────────────────────────
  const setRemoteAnswer = useCallback(
    async (answer: RTCSessionDescriptionInit): Promise<void> => {
      try {
        const pc = peerConnectionRef.current;
        if (!pc) throw new Error('Peer connection not initialized');

        if (pc.signalingState !== 'have-local-offer') {
          console.warn('[useWebRTC-Web] Cannot set remote answer. Current state:', pc.signalingState);
          throw new Error(`Cannot set remote answer in state: ${pc.signalingState}`);
        }

        console.log('[useWebRTC-Web] Setting remote description (answer)...');
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
        console.log('[useWebRTC-Web] Remote answer set successfully');
      } catch (error) {
        console.error('[useWebRTC-Web] Failed to set remote answer:', error);
        throw error;
      }
    },
    []
  );

  // ── Add ICE candidate ──────────────────────────────────────────────────────
  const addIceCandidate = useCallback(
    async (candidate: RTCIceCandidateInit): Promise<void> => {
      try {
        const pc = peerConnectionRef.current;
        if (!pc) {
          console.warn('[useWebRTC-Web] Cannot add ICE candidate: peer connection not initialized');
          return;
        }

        if (!pc.remoteDescription) {
          console.warn('[useWebRTC-Web] Remote description not set yet, queuing ICE candidate');
          return;
        }

        await pc.addIceCandidate(new RTCIceCandidate(candidate));
        console.log('[useWebRTC-Web] ICE candidate added');
      } catch (error) {
        console.error('[useWebRTC-Web] Failed to add ICE candidate:', error);
      }
    },
    []
  );

  // ── Toggle mute ────────────────────────────────────────────────────────────
  const toggleMute = useCallback((muted: boolean) => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !muted;
      });
      console.log('[useWebRTC-Web] Microphone muted:', muted);
    }
  }, []);

  // ── Toggle video ───────────────────────────────────────────────────────────
  const toggleVideo = useCallback((enabled: boolean) => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach((track) => {
        track.enabled = enabled;
      });
      console.log('[useWebRTC-Web] Camera enabled:', enabled);
    }
  }, []);

  // ── Monitor network quality ────────────────────────────────────────────────
  const startNetworkMonitoring = useCallback(() => {
    if (!peerConnectionRef.current) return;

    if (statsIntervalRef.current) {
      clearInterval(statsIntervalRef.current);
    }

    statsIntervalRef.current = setInterval(async () => {
      const pc = peerConnectionRef.current;
      if (!pc || pc.connectionState !== 'connected') return;

      try {
        const stats = await pc.getStats();
        let packetsLost = 0;
        let packetsReceived = 0;
        let jitter = 0;
        let rtt = 0;

        stats.forEach((report: any) => {
          if (report.type === 'inbound-rtp' && report.kind === 'audio') {
            packetsLost = report.packetsLost || 0;
            packetsReceived = report.packetsReceived || 0;
            jitter = report.jitter || 0;
          }
          if (report.type === 'candidate-pair' && report.state === 'succeeded') {
            rtt = report.currentRoundTripTime || 0;
          }
        });

        const quality = calculateNetworkQuality(packetsLost, packetsReceived, jitter, rtt);
        
        if (quality !== networkQuality) {
          setNetworkQuality(quality);
          handlers?.onNetworkQualityChange?.(quality);
          console.log('[useWebRTC-Web] Network quality:', quality, {
            packetsLost,
            packetsReceived,
            jitter: jitter.toFixed(3),
            rtt: rtt.toFixed(3),
          });
        }
      } catch (error) {
        console.error('[useWebRTC-Web] Failed to get stats:', error);
      }
    }, 2000);

    console.log('[useWebRTC-Web] Network monitoring started');
  }, [networkQuality, handlers]);

  const stopNetworkMonitoring = useCallback(() => {
    if (statsIntervalRef.current) {
      clearInterval(statsIntervalRef.current);
      statsIntervalRef.current = null;
      console.log('[useWebRTC-Web] Network monitoring stopped');
    }
  }, []);

  // ── Cleanup ────────────────────────────────────────────────────────────────
  const cleanup = useCallback(() => {
    console.log('[useWebRTC-Web] Cleaning up...');

    if (statsIntervalRef.current) {
      clearInterval(statsIntervalRef.current);
      statsIntervalRef.current = null;
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        track.stop();
        console.log('[useWebRTC-Web] Stopped local track:', track.kind);
      });
      localStreamRef.current = null;
      setStreamVersion(v => v + 1);
    }

    if (remoteStreamRef.current) {
      remoteStreamRef.current.getTracks().forEach((track) => {
        track.stop();
        console.log('[useWebRTC-Web] Stopped remote track:', track.kind);
      });
      remoteStreamRef.current = null;
      setStreamVersion(v => v + 1);
    }

    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
      console.log('[useWebRTC-Web] Peer connection closed');
    }

    setConnectionState('closed');
    setNetworkQuality('unknown');
  }, []);

  useEffect(() => {
    return () => {
      console.log('[useWebRTC-Web] Component unmounting, cleaning up...');
      
      if (statsIntervalRef.current) {
        clearInterval(statsIntervalRef.current);
        statsIntervalRef.current = null;
      }

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => {
          track.stop();
        });
      }

      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }
    };
  }, []);

  return {
    localStream: localStreamRef.current,
    remoteStream: remoteStreamRef.current,
    streamVersion,
    connectionState,
    networkQuality,
    initializePeerConnection,
    createOffer,
    createAnswer,
    setRemoteAnswer,
    addIceCandidate,
    toggleMute,
    toggleVideo,
    startNetworkMonitoring,
    stopNetworkMonitoring,
    cleanup,
  };
}

// ── Helper: Calculate network quality ──────────────────────────────────────
function calculateNetworkQuality(
  packetsLost: number,
  packetsReceived: number,
  jitter: number,
  rtt: number
): NetworkQuality {
  const totalPackets = packetsLost + packetsReceived;
  const lossPercentage = totalPackets > 0 ? (packetsLost / totalPackets) * 100 : 0;

  if (lossPercentage >= 5 || jitter >= 0.1 || rtt >= 0.3) {
    return 'poor';
  } else if (lossPercentage >= 3 || jitter >= 0.05 || rtt >= 0.2) {
    return 'fair';
  } else if (lossPercentage >= 1 || jitter >= 0.03 || rtt >= 0.1) {
    return 'good';
  } else {
    return 'excellent';
  }
}
