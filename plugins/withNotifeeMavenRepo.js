// ─── Config Plugin: notifee local Maven repo ────────────────────────────────
// @notifee/react-native ships its native artifact (app.notifee:core) from a
// local Maven repo bundled inside the npm package, not from a public registry.
// Expo autolinking doesn't register it for the :app runtime classpath, so the
// build fails with "Could not find any matches for app.notifee:core:+".
//
// This adds that local repo to allprojects.repositories in android/build.gradle
// during prebuild, so it survives `expo prebuild --clean` (android/ is gitignored).

const { withProjectBuildGradle } = require('@expo/config-plugins');

const MARKER = '@notifee/react-native/android/libs';
const REPO_LINE =
  '        maven { url "$rootDir/../node_modules/@notifee/react-native/android/libs" }';

module.exports = function withNotifeeMavenRepo(config) {
  return withProjectBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== 'groovy') return cfg;
    let contents = cfg.modResults.contents;
    if (contents.includes(MARKER)) return cfg;

    // Insert into the first `allprojects { repositories {` block.
    const replaced = contents.replace(
      /(allprojects\s*\{\s*repositories\s*\{)/,
      `$1\n${REPO_LINE}`,
    );

    if (replaced === contents) {
      throw new Error(
        '[withNotifeeMavenRepo] Could not find allprojects.repositories in build.gradle',
      );
    }

    cfg.modResults.contents = replaced;
    return cfg;
  });
};
