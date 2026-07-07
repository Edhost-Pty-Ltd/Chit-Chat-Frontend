// ─── Signaling Service ───────────────────────────────────────────────────────
// Uses Firestore for WebRTC signaling (offer/answer/ICE candidates exchange)

import {
  doc, setDoc, updateDoc, onSnapshot, arrayUnion,
  serverTimestamp, getDoc, Timestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import type { Call, CallStatus, CallParticipant, CallType } from '../types/call';

export class SignalingService {
  // ── Create a new call document ─────────────────────────────────────────────
  static async createCall(
    callerId: string,
    calleeId: string,
    callerInfo: CallParticipant,
    calleeInfo: CallParticipant,
    type: CallType = 'audio',
  ): Promise<string> {
    const callRef = doc(db, 'calls', `${callerId}_${calleeId}_${Date.now()}`);
    
    await setDoc(callRef, {
      callId: callRef.id,
      caller: callerInfo,
      callee: calleeInfo,
      status: 'ringing',
      type,
      startTime: null,
      endTime: null,
      duration: null,
      offer: null,
      answer: null,
      callerIceCandidates: [],
      calleeIceCandidates: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    
    console.log('[SignalingService] Call created:', callRef.id);
    return callRef.id;
  }
  
  // ── Save WebRTC offer ───────────────────────────────────────────────────────
  static async saveOffer(
    callId: string,
    offer: RTCSessionDescriptionInit,
  ): Promise<void> {
    const callRef = doc(db, 'calls', callId);
    await updateDoc(callRef, {
      offer,
      updatedAt: serverTimestamp(),
    });
    console.log('[SignalingService] Offer saved for call:', callId);
  }
  
  // ── Save WebRTC answer ──────────────────────────────────────────────────────
  static async saveAnswer(
    callId: string,
    answer: RTCSessionDescriptionInit,
  ): Promise<void> {
    const callRef = doc(db, 'calls', callId);
    await updateDoc(callRef, {
      answer,
      status: 'accepted',
      startTime: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    console.log('[SignalingService] Answer saved for call:', callId);
  }
  
  // ── Add ICE candidate ───────────────────────────────────────────────────────
  static async addIceCandidate(
    callId: string,
    candidate: RTCIceCandidateInit,
    isCallee: boolean,
  ): Promise<void> {
    const callRef = doc(db, 'calls', callId);
    const field = isCallee ? 'calleeIceCandidates' : 'callerIceCandidates';
    
    await updateDoc(callRef, {
      [field]: arrayUnion(candidate),
      updatedAt: serverTimestamp(),
    });
    console.log('[SignalingService] ICE candidate added:', { callId, isCallee });
  }
  
  // ── Update call status ──────────────────────────────────────────────────────
  static async updateCallStatus(
    callId: string,
    status: CallStatus,
    duration?: number,
  ): Promise<void> {
    const callRef = doc(db, 'calls', callId);
    const updates: any = {
      status,
      updatedAt: serverTimestamp(),
    };
    
    if (status === 'ended' || status === 'rejected' || status === 'missed') {
      updates.endTime = serverTimestamp();
      if (duration !== undefined) {
        updates.duration = duration;
      }
    }
    
    if (status === 'connected') {
      updates.startTime = serverTimestamp();
    }
    
    await updateDoc(callRef, updates);
    console.log('[SignalingService] Call status updated:', { callId, status });
  }
  
  // ── Listen for call updates ─────────────────────────────────────────────────
  static onCallUpdated(
    callId: string,
    callback: (call: Call | null) => void,
  ): () => void {
    const callRef = doc(db, 'calls', callId);
    
    return onSnapshot(callRef, (snap) => {
      if (!snap.exists()) {
        callback(null);
        return;
      }
      
      const data = snap.data();
      const call: Call = {
        callId: snap.id,
        caller: data.caller,
        callee: data.callee,
        status: data.status,
        type: data.type,
        startTime: data.startTime ? (data.startTime as Timestamp).toDate() : null,
        endTime: data.endTime ? (data.endTime as Timestamp).toDate() : null,
        duration: data.duration ?? null,
        offer: data.offer ?? null,
        answer: data.answer ?? null,
        callerIceCandidates: data.callerIceCandidates ?? [],
        calleeIceCandidates: data.calleeIceCandidates ?? [],
        createdAt: data.createdAt ? (data.createdAt as Timestamp).toDate() : new Date(),
        updatedAt: data.updatedAt ? (data.updatedAt as Timestamp).toDate() : new Date(),
      };
      
      callback(call);
    });
  }
  
  // ── Get call document ───────────────────────────────────────────────────────
  static async getCall(callId: string): Promise<Call | null> {
    const callRef = doc(db, 'calls', callId);
    const snap = await getDoc(callRef);
    
    if (!snap.exists()) {
      return null;
    }
    
    const data = snap.data();
    return {
      callId: snap.id,
      caller: data.caller,
      callee: data.callee,
      status: data.status,
      type: data.type,
      startTime: data.startTime ? (data.startTime as Timestamp).toDate() : null,
      endTime: data.endTime ? (data.endTime as Timestamp).toDate() : null,
      duration: data.duration ?? null,
      offer: data.offer ?? null,
      answer: data.answer ?? null,
      callerIceCandidates: data.callerIceCandidates ?? [],
      calleeIceCandidates: data.calleeIceCandidates ?? [],
      createdAt: data.createdAt ? (data.createdAt as Timestamp).toDate() : new Date(),
      updatedAt: data.updatedAt ? (data.updatedAt as Timestamp).toDate() : new Date(),
    };
  }
  
  // ── Save call to history ────────────────────────────────────────────────────
    static async saveToCallHistory(
    userId: string,
    callId: string,
    otherParty: CallParticipant,
    type: CallType,
    direction: 'incoming' | 'outgoing',
    status: 'completed' | 'missed' | 'rejected' | 'busy' | 'failed',
    duration: number | null,
    chatId?: string,  // ADD THIS LINE
  ): Promise<void> {

    const historyRef = doc(db, 'users', userId, 'callHistory', callId);
    
    await setDoc(historyRef, {
      callId,
      otherParty,
      type,
      direction,
      status,
      duration,
      timestamp: serverTimestamp(),
    });
    
        console.log('[SignalingService] Call saved to history:', { userId, callId });

    // Also send call message to chat if chatId is provided
        console.log('[SignalingService] Call saved to history:', { userId, callId, duration, chatId, direction });

    // Also send call message to chat if chatId is provided
    console.log('[SignalingService] Checking if should send chat message:', {
      hasChatId: !!chatId,
      direction,
      willSend: !!(chatId && direction === 'outgoing')
    });

    if (chatId && direction === 'outgoing') {
      try {
        console.log('[SignalingService] Sending call message to chat:', { chatId, userId, type, duration, status });
        const { sendCallMessage } = await import('../hooks/useChatActions');
        await sendCallMessage(chatId, userId, type, duration, status);
        console.log('[SignalingService] ✅ Call message sent successfully to chat:', chatId);
      } catch (error) {
        console.error('[SignalingService] ❌ Failed to send call message:', error);
      }
    } else {
      console.log('[SignalingService] ⚠️ Skipping chat message - chatId:', chatId, 'direction:', direction);
    }

  }
}

  

