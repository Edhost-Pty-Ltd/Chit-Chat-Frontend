// ─── Feature Flags ───────────────────────────────────────────────────────────
// Toggle features on/off for deployment without deleting code.
// Set to `true` to enable a feature, `false` to hide it.

export const FEATURE_FLAGS = {
  // Settings screen features
  helpSupport: false,
  about: false,

  // Status/Story features
  statusVideoTrimmer: true,

  // Chat list features
  chatSearch: false,
} as const;
