// ─── LiveKit Configuration (client-safe) ───────────────────────────────────
//
// Only non-sensitive values live here. The API secret stays on the backend
// (the `generateLiveKitToken` Firebase Function) and is NEVER shipped in the
// client bundle.
// ─────────────────────────────────────────────────────────────────────────────

export const LIVEKIT_CONFIG = {
  /** WebSocket URL of your LiveKit Cloud server */
  url: 'wss://chit-chat-rs2syk5n.livekit.cloud',

  /** Maximum participants allowed in a single group call */
  maxParticipants: 8,
};
