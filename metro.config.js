// ─── Metro Configuration ─────────────────────────────────────────────────────
// Learn more: https://docs.expo.dev/guides/customizing-metro

const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Platform-specific file extensions
// Web extensions should be LAST so they only load on actual web platform
// Metro will use them when Platform.OS === 'web', otherwise use the non-web versions

module.exports = config;
