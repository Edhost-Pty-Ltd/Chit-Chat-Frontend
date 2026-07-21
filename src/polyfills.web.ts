// Web polyfills — intentionally empty. Browsers already provide a global
// `crypto.getRandomValues`, and `react-native-get-random-values` has no web
// implementation, so we must NOT import it here. Metro resolves this file for
// the web platform in place of polyfills.native.ts.
export {};
