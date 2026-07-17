// ─── Config Plugin: FCM notification color merge fix ────────────────────────
// expo-notifications (color: "#0A2463") injects a meta-data
//   com.google.firebase.messaging.default_notification_color = @color/notification_icon_color
// while @react-native-firebase/messaging's library manifest declares the same
// meta-data = @color/white. The Android manifest merger fails on the conflict:
//   "Attribute meta-data#...default_notification_color@resource ... is also
//    present at [:react-native-firebase_messaging] ... value=(@color/white)."
//
// This plugin adds tools:replace="android:resource" to the app's meta-data so
// our color wins the merge. It runs during `expo prebuild`, so the fix survives
// `expo prebuild --clean` (the generated android/ folder is gitignored).

const { withAndroidManifest } = require('@expo/config-plugins');

const META_NAME = 'com.google.firebase.messaging.default_notification_color';
const COLOR_REF = '@color/notification_icon_color';
const TOOLS_NS = 'http://schemas.android.com/tools';

module.exports = function withFcmNotificationColorFix(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;

    // Ensure the tools namespace is declared on <manifest>.
    manifest.$ = manifest.$ || {};
    if (!manifest.$['xmlns:tools']) {
      manifest.$['xmlns:tools'] = TOOLS_NS;
    }

    const application = manifest.application && manifest.application[0];
    if (!application) return cfg;

    application['meta-data'] = application['meta-data'] || [];

    let entry = application['meta-data'].find(
      (m) => m.$ && m.$['android:name'] === META_NAME
    );

    if (!entry) {
      // Create it if a prior plugin didn't (defensive).
      entry = { $: { 'android:name': META_NAME, 'android:resource': COLOR_REF } };
      application['meta-data'].push(entry);
    }

    // Force our value to win the manifest merge against the library default.
    entry.$['tools:replace'] = 'android:resource';

    return cfg;
  });
};
