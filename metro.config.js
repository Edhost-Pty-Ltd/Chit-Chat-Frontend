// ─── Metro Configuration ─────────────────────────────────────────────────────
// Learn more: https://docs.expo.dev/guides/customizing-metro

const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Exclude the functions folder from Metro bundling
// The functions folder contains server-side code (Firebase Cloud Functions)
// that uses Node.js modules not compatible with React Native
config.resolver.blockList = [
  ...(config.resolver.blockList || []),
  /functions\/.*/,
];

// Also exclude from watchFolders to prevent watching server files
config.watchFolders = (config.watchFolders || []).filter(
  folder => !folder.includes('functions')
);

// Platform-specific file extensions
// Web extensions should be LAST so they only load on actual web platform
// Metro will use them when Platform.OS === 'web', otherwise use the non-web versions

module.exports = config;
