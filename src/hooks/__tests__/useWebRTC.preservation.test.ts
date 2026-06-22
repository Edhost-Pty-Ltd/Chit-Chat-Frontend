/**
 * Preservation Property Tests - WebRTC Functionality Unchanged
 * 
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7**
 * 
 * CRITICAL: These tests MUST PASS on both unfixed and fixed code
 * 
 * This test suite captures the baseline behavior of all WebRTC operations
 * that should remain unchanged after the fix. We observe behavior on UNFIXED
 * code first, then write tests capturing that exact behavior to ensure the
 * fix doesn't break existing functionality.
 * 
 * Expected outcome: Tests PASS on unfixed code, continue PASSING on fixed code
 */

import React from 'react';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { useWebRTC, WebRTCHandlers, NetworkQuality } from '../useWebRTC';
import { MediaStream, mediaDevices, RTCPeerConnection, RTCSessionDescription, RTCIceCandidate } from 'react-native-webrtc';
import * as fc from 'fast-check';

// Mock react-native-webrtc
jest.mock('react-native-webrtc', () => ({
  RTCPeerConnection: jest.fn(),
  RTCSessionDescription: jest.fn((desc) => desc),
  RTCIceCandidate: jest.fn((candidate) => candidate),
  mediaDevices: {
    getUserMedia: jest.fn(),
  },
  MediaStream: jest.fn(),
}));

// Mock React Native Platform
jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
  },
}));

// ─── Minimal renderHook for node environment ──────────────────────────────────

function renderHook<T>(hookFn: () => T): { result: { current: T } } {
  const result: { current: T } = {} as any;

  function TestComponent() {
    result.current = hookFn();
    return null;
  }

  let renderer: ReactTestRenderer;
  act(() => {
    renderer = create(React.createElement(TestComponent));
  });

  return { result };
}

// ─── Helper: wait for async updates ──────────────────────────────────────────

async function waitFor(callback: () => void, timeout = 5000) {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    try {
      callback();
      return;
    } catch (error) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }
  callback(); // Final attempt that will throw if still failing
}

describe('Property 2: Preservation - WebRTC Functionality Unchanged', () => {
  let mockPeerConnection: any;
  let mockLocalStream: any;
  let mockRemoteStream: any;
  let mockVideoTrack: any;
  let mockAudioTrack: any;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Create mock video track
    mockVideoTrack = {
      kind: 'video',
      enabled: true,
      readyState: 'live',
      stop: jest.fn(),
    };

    // Create mock audio track
    mockAudioTrack = {
      kind: 'audio',
      enabled: true,
      readyState: 'live',
      stop: jest.fn(),
    };

    // Create mock local stream
    mockLocalStream = {
      getTracks: jest.fn(() => [mockVideoTrack, mockAudioTrack]),
      getVideoTracks: jest.fn(() => [mockVideoTrack]),
      getAudioTracks: jest.fn(() => [mockAudioTrack]),
      addTrack: jest.fn(),
      removeTrack: jest.fn(),
    };

    // Create mock remote stream
    mockRemoteStream = {
      getTracks: jest.fn(() => [{ ...mockVideoTrack }, { ...mockAudioTrack }]),
      getVideoTracks: jest.fn(() => [{ ...mockVideoTrack }]),
      getAudioTracks: jest.fn(() => [{ ...mockAudioTrack }]),
    };

    (mediaDevices.getUserMedia as jest.Mock).mockResolvedValue(mockLocalStream);

    // Create mock peer connection
    mockPeerConnection = {
      addTrack: jest.fn(),
      createOffer: jest.fn().mockResolvedValue({ type: 'offer', sdp: 'mock-offer-sdp' }),
      createAnswer: jest.fn().mockResolvedValue({ type: 'answer', sdp: 'mock-answer-sdp' }),
      setLocalDescription: jest.fn().mockResolvedValue(undefined),
      setRemoteDescription: jest.fn().mockResolvedValue(undefined),
      addIceCandidate: jest.fn().mockResolvedValue(undefined),
      close: jest.fn(),
      getStats: jest.fn().mockResolvedValue(new Map()),
      connectionState: 'new',
      signalingState: 'stable',
      iceConnectionState: 'new',
      ontrack: null,
      onicecandidate: null,
      onconnectionstatechange: null,
      oniceconnectionstatechange: null,
      remoteDescription: null,
    };

    (RTCPeerConnection as jest.Mock).mockImplementation(() => mockPeerConnection);
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  describe('Test 1: Connection Establishment Preservation', () => {
    test('should create peer connection with correct ICE servers', async () => {
      const { result } = renderHook(() => useWebRTC());

      await act(async () => {
        await result.current.initializePeerConnection(true);
      });

      // Verify RTCPeerConnection was called with ICE servers
      expect(RTCPeerConnection).toHaveBeenCalledWith({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
        ],
      });
    });

    test('should get user media with video constraints when isVideo=true', async () => {
      const { result } = renderHook(() => useWebRTC());

      await act(async () => {
        await result.current.initializePeerConnection(true);
      });

      expect(mediaDevices.getUserMedia).toHaveBeenCalledWith({
        audio: true,
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 },
          facingMode: 'user',
        },
      });
    });

    test('should get user media with audio only when isVideo=false', async () => {
      const { result } = renderHook(() => useWebRTC());

      await act(async () => {
        await result.current.initializePeerConnection(false);
      });

      expect(mediaDevices.getUserMedia).toHaveBeenCalledWith({
        audio: true,
        video: false,
      });
    });

    test('should add local stream tracks to peer connection', async () => {
      const { result } = renderHook(() => useWebRTC());

      await act(async () => {
        await result.current.initializePeerConnection(true);
      });

      // Verify all tracks were added
      expect(mockPeerConnection.addTrack).toHaveBeenCalledTimes(2);
      expect(mockPeerConnection.addTrack).toHaveBeenCalledWith(mockVideoTrack, mockLocalStream);
      expect(mockPeerConnection.addTrack).toHaveBeenCalledWith(mockAudioTrack, mockLocalStream);
    });

    test('should set up event handlers (ontrack, onicecandidate, onconnectionstatechange)', async () => {
      const { result } = renderHook(() => useWebRTC());

      await act(async () => {
        await result.current.initializePeerConnection(true);
      });

      // Verify event handlers are set up
      expect(mockPeerConnection.ontrack).toBeDefined();
      expect(mockPeerConnection.onicecandidate).toBeDefined();
      expect(mockPeerConnection.onconnectionstatechange).toBeDefined();
      expect(mockPeerConnection.oniceconnectionstatechange).toBeDefined();
    });

    test('should call onLocalStream handler when local stream obtained', async () => {
      const onLocalStream = jest.fn();
      const handlers: WebRTCHandlers = { onLocalStream };
      
      const { result } = renderHook(() => useWebRTC(handlers));

      await act(async () => {
        await result.current.initializePeerConnection(true);
      });

      expect(onLocalStream).toHaveBeenCalledWith(mockLocalStream);
    });
  });

  describe('Test 2: Offer/Answer Exchange Preservation', () => {
    test('should create offer with correct options for video call', async () => {
      const { result } = renderHook(() => useWebRTC());

      await act(async () => {
        await result.current.initializePeerConnection(true);
      });

      let offer;
      await act(async () => {
        offer = await result.current.createOffer(true);
      });

      expect(mockPeerConnection.createOffer).toHaveBeenCalledWith({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });
      expect(offer).toEqual({ type: 'offer', sdp: 'mock-offer-sdp' });
    });

    test('should create offer with correct options for audio-only call', async () => {
      const { result } = renderHook(() => useWebRTC());

      await act(async () => {
        await result.current.initializePeerConnection(false);
      });

      let offer;
      await act(async () => {
        offer = await result.current.createOffer(false);
      });

      expect(mockPeerConnection.createOffer).toHaveBeenCalledWith({
        offerToReceiveAudio: true,
        offerToReceiveVideo: false,
      });
    });

    test('should set local description when creating offer', async () => {
      const { result } = renderHook(() => useWebRTC());

      await act(async () => {
        await result.current.initializePeerConnection(true);
      });

      await act(async () => {
        await result.current.createOffer(true);
      });

      expect(mockPeerConnection.setLocalDescription).toHaveBeenCalledWith({
        type: 'offer',
        sdp: 'mock-offer-sdp',
      });
    });

    test('should create answer after setting remote description', async () => {
      const { result } = renderHook(() => useWebRTC());

      await act(async () => {
        await result.current.initializePeerConnection(true);
      });

      const offer = { type: 'offer' as RTCSdpType, sdp: 'remote-offer-sdp' };
      
      let answer;
      await act(async () => {
        answer = await result.current.createAnswer(offer);
      });

      expect(mockPeerConnection.setRemoteDescription).toHaveBeenCalled();
      expect(mockPeerConnection.createAnswer).toHaveBeenCalled();
      expect(mockPeerConnection.setLocalDescription).toHaveBeenCalledWith({
        type: 'answer',
        sdp: 'mock-answer-sdp',
      });
      expect(answer).toEqual({ type: 'answer', sdp: 'mock-answer-sdp' });
    });

    test('should set remote answer correctly', async () => {
      const { result } = renderHook(() => useWebRTC());

      await act(async () => {
        await result.current.initializePeerConnection(true);
        await result.current.createOffer(true);
      });

      // Set signaling state to have-local-offer
      mockPeerConnection.signalingState = 'have-local-offer';

      const answer = { type: 'answer' as RTCSdpType, sdp: 'remote-answer-sdp' };

      await act(async () => {
        await result.current.setRemoteAnswer(answer);
      });

      expect(mockPeerConnection.setRemoteDescription).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'answer', sdp: 'remote-answer-sdp' })
      );
    });
  });

  describe('Test 3: ICE Candidate Handling Preservation', () => {
    test('should generate ICE candidates through onicecandidate handler', async () => {
      const onIceCandidate = jest.fn();
      const handlers: WebRTCHandlers = { onIceCandidate };

      const { result } = renderHook(() => useWebRTC(handlers));

      await act(async () => {
        await result.current.initializePeerConnection(true);
      });

      // Simulate ICE candidate generation
      const mockCandidate = {
        candidate: 'candidate:1 1 udp 2122260223 192.168.1.1 54321 typ host',
        sdpMLineIndex: 0,
        sdpMid: '0',
      };

      act(() => {
        mockPeerConnection.onicecandidate({ candidate: mockCandidate });
      });

      expect(onIceCandidate).toHaveBeenCalledWith(mockCandidate);
    });

    test('should add ICE candidates to peer connection when remote description is set', async () => {
      const { result } = renderHook(() => useWebRTC());

      await act(async () => {
        await result.current.initializePeerConnection(true);
      });

      // Set remote description
      mockPeerConnection.remoteDescription = { type: 'offer', sdp: 'mock-sdp' };

      const candidate = {
        candidate: 'candidate:1 1 udp 2122260223 192.168.1.1 54321 typ host',
        sdpMLineIndex: 0,
        sdpMid: '0',
      };

      await act(async () => {
        await result.current.addIceCandidate(candidate);
      });

      expect(mockPeerConnection.addIceCandidate).toHaveBeenCalled();
    });

    test('should queue ICE candidates when remote description not yet set', async () => {
      const { result } = renderHook(() => useWebRTC());

      await act(async () => {
        await result.current.initializePeerConnection(true);
      });

      // Remote description NOT set
      mockPeerConnection.remoteDescription = null;

      const candidate = {
        candidate: 'candidate:1 1 udp 2122260223 192.168.1.1 54321 typ host',
        sdpMLineIndex: 0,
        sdpMid: '0',
      };

      await act(async () => {
        await result.current.addIceCandidate(candidate);
      });

      // Should not throw, but also not add candidate yet
      expect(mockPeerConnection.addIceCandidate).not.toHaveBeenCalled();
    });
  });

  describe('Test 4: Connection State Changes Preservation', () => {
    test('should update connection state when peer connection state changes', async () => {
      const onConnectionStateChange = jest.fn();
      const handlers: WebRTCHandlers = { onConnectionStateChange };

      const { result } = renderHook(() => useWebRTC(handlers));

      await act(async () => {
        await result.current.initializePeerConnection(true);
      });

      // Simulate connection state change
      mockPeerConnection.connectionState = 'connected';
      act(() => {
        mockPeerConnection.onconnectionstatechange();
      });

      expect(result.current.connectionState).toBe('connected');
      expect(onConnectionStateChange).toHaveBeenCalledWith('connected');
    });

    test('should handle multiple state transitions correctly', async () => {
      const onConnectionStateChange = jest.fn();
      const handlers: WebRTCHandlers = { onConnectionStateChange };

      const { result } = renderHook(() => useWebRTC(handlers));

      await act(async () => {
        await result.current.initializePeerConnection(true);
      });

      // Simulate state transitions: new -> connecting -> connected
      const states = ['connecting', 'connected'];
      
      states.forEach((state) => {
        mockPeerConnection.connectionState = state;
        act(() => {
          mockPeerConnection.onconnectionstatechange();
        });
      });

      expect(onConnectionStateChange).toHaveBeenCalledTimes(2);
      expect(result.current.connectionState).toBe('connected');
    });
  });

  describe('Test 5: Cleanup Preservation', () => {
    test('should stop all local stream tracks on cleanup', async () => {
      const { result } = renderHook(() => useWebRTC());

      await act(async () => {
        await result.current.initializePeerConnection(true);
      });

      act(() => {
        result.current.cleanup();
      });

      expect(mockVideoTrack.stop).toHaveBeenCalled();
      expect(mockAudioTrack.stop).toHaveBeenCalled();
    });

    test('should close peer connection on cleanup', async () => {
      const { result } = renderHook(() => useWebRTC());

      await act(async () => {
        await result.current.initializePeerConnection(true);
      });

      act(() => {
        result.current.cleanup();
      });

      expect(mockPeerConnection.close).toHaveBeenCalled();
    });

    test('should reset connection state to closed on cleanup', async () => {
      const { result } = renderHook(() => useWebRTC());

      await act(async () => {
        await result.current.initializePeerConnection(true);
      });

      act(() => {
        result.current.cleanup();
      });

      expect(result.current.connectionState).toBe('closed');
    });

    test('should reset network quality to unknown on cleanup', async () => {
      const { result } = renderHook(() => useWebRTC());

      await act(async () => {
        await result.current.initializePeerConnection(true);
      });

      act(() => {
        result.current.cleanup();
      });

      expect(result.current.networkQuality).toBe('unknown');
    });
  });

  describe('Test 6: Toggle Functions Preservation', () => {
    test('should disable audio tracks when toggleMute(true) is called', async () => {
      const { result } = renderHook(() => useWebRTC());

      await act(async () => {
        await result.current.initializePeerConnection(true);
      });

      act(() => {
        result.current.toggleMute(true);
      });

      expect(mockAudioTrack.enabled).toBe(false);
    });

    test('should enable audio tracks when toggleMute(false) is called', async () => {
      const { result } = renderHook(() => useWebRTC());

      await act(async () => {
        await result.current.initializePeerConnection(true);
      });

      // First mute
      act(() => {
        result.current.toggleMute(true);
      });

      // Then unmute
      act(() => {
        result.current.toggleMute(false);
      });

      expect(mockAudioTrack.enabled).toBe(true);
    });

    test('should enable video tracks when toggleVideo(true) is called', async () => {
      const { result } = renderHook(() => useWebRTC());

      await act(async () => {
        await result.current.initializePeerConnection(true);
      });

      // First disable
      mockVideoTrack.enabled = false;

      act(() => {
        result.current.toggleVideo(true);
      });

      expect(mockVideoTrack.enabled).toBe(true);
    });

    test('should disable video tracks when toggleVideo(false) is called', async () => {
      const { result } = renderHook(() => useWebRTC());

      await act(async () => {
        await result.current.initializePeerConnection(true);
      });

      act(() => {
        result.current.toggleVideo(false);
      });

      expect(mockVideoTrack.enabled).toBe(false);
    });
  });

  describe('Test 7: Network Monitoring Preservation', () => {
    test('should start network monitoring and check stats periodically', async () => {
      const onNetworkQualityChange = jest.fn();
      const handlers: WebRTCHandlers = { onNetworkQualityChange };

      const { result } = renderHook(() => useWebRTC(handlers));

      await act(async () => {
        await result.current.initializePeerConnection(true);
      });

      // Set connection to connected state
      mockPeerConnection.connectionState = 'connected';
      act(() => {
        mockPeerConnection.onconnectionstatechange();
      });

      // Mock getStats to return quality metrics
      const mockStats = new Map([
        ['inbound-rtp-audio', {
          type: 'inbound-rtp',
          kind: 'audio',
          packetsLost: 0,
          packetsReceived: 1000,
          jitter: 0.01,
        }],
        ['candidate-pair', {
          type: 'candidate-pair',
          state: 'succeeded',
          currentRoundTripTime: 0.05,
        }],
      ]);
      mockPeerConnection.getStats.mockResolvedValue(mockStats);

      act(() => {
        result.current.startNetworkMonitoring();
      });

      // Fast-forward time to trigger stats check
      await act(async () => {
        jest.advanceTimersByTime(2000);
      });

      await waitFor(() => {
        expect(mockPeerConnection.getStats).toHaveBeenCalled();
      });
    });

    test('should calculate network quality correctly based on metrics', async () => {
      const onNetworkQualityChange = jest.fn();
      const handlers: WebRTCHandlers = { onNetworkQualityChange };

      const { result } = renderHook(() => useWebRTC(handlers));

      await act(async () => {
        await result.current.initializePeerConnection(true);
      });

      mockPeerConnection.connectionState = 'connected';
      act(() => {
        mockPeerConnection.onconnectionstatechange();
      });

      // Excellent quality: low packet loss, low jitter, low RTT
      const excellentStats = new Map([
        ['inbound-rtp-audio', {
          type: 'inbound-rtp',
          kind: 'audio',
          packetsLost: 5,
          packetsReceived: 1000,
          jitter: 0.01,
        }],
        ['candidate-pair', {
          type: 'candidate-pair',
          state: 'succeeded',
          currentRoundTripTime: 0.05,
        }],
      ]);
      mockPeerConnection.getStats.mockResolvedValue(excellentStats);

      act(() => {
        result.current.startNetworkMonitoring();
      });

      await act(async () => {
        jest.advanceTimersByTime(2000);
      });

      await waitFor(() => {
        expect(result.current.networkQuality).toBe('excellent');
      });
    });

    test('should stop network monitoring correctly', async () => {
      const { result } = renderHook(() => useWebRTC());

      await act(async () => {
        await result.current.initializePeerConnection(true);
      });

      act(() => {
        result.current.startNetworkMonitoring();
      });

      act(() => {
        result.current.stopNetworkMonitoring();
      });

      // Verify interval was cleared - no stats calls after stopping
      const callCountBeforeStop = mockPeerConnection.getStats.mock.calls.length;
      
      await act(async () => {
        jest.advanceTimersByTime(5000);
      });

      expect(mockPeerConnection.getStats).toHaveBeenCalledTimes(callCountBeforeStop);
    });
  });

  describe('Property-Based Tests: WebRTC Operations Invariants', () => {
    test('PROPERTY: Connection establishment works for any valid media configuration', () => {
      fc.assert(
        fc.property(
          fc.boolean(), // isVideo
          async (isVideo) => {
            const { result } = renderHook(() => useWebRTC());

            await act(async () => {
              await result.current.initializePeerConnection(isVideo);
            });

            // Invariants that must hold:
            // 1. RTCPeerConnection was created
            expect(RTCPeerConnection).toHaveBeenCalled();
            
            // 2. getUserMedia was called with correct constraints
            expect(mediaDevices.getUserMedia).toHaveBeenCalledWith({
              audio: true,
              video: isVideo ? expect.any(Object) : false,
            });

            // 3. Tracks were added to peer connection
            expect(mockPeerConnection.addTrack).toHaveBeenCalled();

            // 4. Event handlers are set up
            expect(mockPeerConnection.ontrack).toBeDefined();
            expect(mockPeerConnection.onicecandidate).toBeDefined();

            // Cleanup for next iteration
            jest.clearAllMocks();
            return true;
          }
        ),
        { numRuns: 5 }
      );
    });

    test('PROPERTY: Offer/Answer exchange produces valid SDP for any call type', () => {
      fc.assert(
        fc.property(
          fc.boolean(), // isVideo
          async (isVideo) => {
            const { result } = renderHook(() => useWebRTC());

            await act(async () => {
              await result.current.initializePeerConnection(isVideo);
            });

            let offer;
            await act(async () => {
              offer = await result.current.createOffer(isVideo);
            });

            // Invariants:
            // 1. Offer has correct structure
            expect(offer).toHaveProperty('type', 'offer');
            expect(offer).toHaveProperty('sdp');

            // 2. setLocalDescription was called
            expect(mockPeerConnection.setLocalDescription).toHaveBeenCalled();

            jest.clearAllMocks();
            return true;
          }
        ),
        { numRuns: 5 }
      );
    });

    test('PROPERTY: ICE candidates can be added in any order after remote description is set', () => {
      fc.assert(
        fc.property(
          fc.array(fc.integer({ min: 0, max: 10 }), { minLength: 1, maxLength: 5 }), // Array of candidate indices
          async (candidateIndices) => {
            const { result } = renderHook(() => useWebRTC());

            await act(async () => {
              await result.current.initializePeerConnection(true);
            });

            // Set remote description first
            mockPeerConnection.remoteDescription = { type: 'offer', sdp: 'mock-sdp' };

            // Add candidates in the order specified
            for (const index of candidateIndices) {
              const candidate = {
                candidate: `candidate:${index} 1 udp 2122260223 192.168.1.${index} 54321 typ host`,
                sdpMLineIndex: 0,
                sdpMid: '0',
              };

              await act(async () => {
                await result.current.addIceCandidate(candidate);
              });
            }

            // Invariant: All candidates were added successfully
            expect(mockPeerConnection.addIceCandidate).toHaveBeenCalledTimes(candidateIndices.length);

            jest.clearAllMocks();
            return true;
          }
        ),
        { numRuns: 5 }
      );
    });

    test('PROPERTY: Cleanup always stops all tracks and closes peer connection', () => {
      fc.assert(
        fc.property(
          fc.boolean(), // isVideo
          async (isVideo) => {
            const { result } = renderHook(() => useWebRTC());

            await act(async () => {
              await result.current.initializePeerConnection(isVideo);
            });

            act(() => {
              result.current.cleanup();
            });

            // Invariants:
            // 1. All tracks were stopped
            expect(mockVideoTrack.stop).toHaveBeenCalled();
            expect(mockAudioTrack.stop).toHaveBeenCalled();

            // 2. Peer connection was closed
            expect(mockPeerConnection.close).toHaveBeenCalled();

            // 3. State is reset
            expect(result.current.connectionState).toBe('closed');
            expect(result.current.networkQuality).toBe('unknown');

            jest.clearAllMocks();
            return true;
          }
        ),
        { numRuns: 5 }
      );
    });

    test('PROPERTY: Toggle functions work correctly regardless of current track state', () => {
      fc.assert(
        fc.property(
          fc.boolean(), // initial mute state
          fc.boolean(), // target mute state
          async (initialMuted, targetMuted) => {
            const { result } = renderHook(() => useWebRTC());

            await act(async () => {
              await result.current.initializePeerConnection(true);
            });

            // Set initial state
            act(() => {
              result.current.toggleMute(initialMuted);
            });

            // Change to target state
            act(() => {
              result.current.toggleMute(targetMuted);
            });

            // Invariant: Final state matches target
            expect(mockAudioTrack.enabled).toBe(!targetMuted);

            jest.clearAllMocks();
            return true;
          }
        ),
        { numRuns: 5 }
      );
    });

    test('PROPERTY: Network quality calculation is consistent across different metric values', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 100 }),  // packetsLost
          fc.integer({ min: 100, max: 10000 }), // packetsReceived
          fc.double({ min: 0, max: 0.2 }),   // jitter
          fc.double({ min: 0, max: 0.5 }),   // rtt
          async (packetsLost, packetsReceived, jitter, rtt) => {
            const onNetworkQualityChange = jest.fn();
            const handlers: WebRTCHandlers = { onNetworkQualityChange };

            const { result } = renderHook(() => useWebRTC(handlers));

            await act(async () => {
              await result.current.initializePeerConnection(true);
            });

            mockPeerConnection.connectionState = 'connected';
            act(() => {
              mockPeerConnection.onconnectionstatechange();
            });

            const mockStats = new Map([
              ['inbound-rtp-audio', {
                type: 'inbound-rtp',
                kind: 'audio',
                packetsLost,
                packetsReceived,
                jitter,
              }],
              ['candidate-pair', {
                type: 'candidate-pair',
                state: 'succeeded',
                currentRoundTripTime: rtt,
              }],
            ]);
            mockPeerConnection.getStats.mockResolvedValue(mockStats);

            act(() => {
              result.current.startNetworkMonitoring();
            });

            await act(async () => {
              jest.advanceTimersByTime(2000);
            });

            await waitFor(() => {
              // Invariant: Quality is one of the valid values
              const validQualities: NetworkQuality[] = ['excellent', 'good', 'fair', 'poor', 'unknown'];
              expect(validQualities).toContain(result.current.networkQuality);
            });

            jest.clearAllMocks();
            return true;
          }
        ),
        { numRuns: 5 }
      );
    });
  });
});

