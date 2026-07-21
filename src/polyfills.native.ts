// Native (iOS/Android) polyfills — evaluated as the very first import in the
// app entry so its side effects run BEFORE any other module is loaded.
//
// crypto-js captures a reference to `global.crypto` at the moment IT is first
// imported. Our export/import utilities import crypto-js transitively through
// the navigator, so the secure-random polyfill MUST be installed before that
// happens — otherwise crypto-js caches an undefined crypto and permanently
// throws "Native crypto module could not be used to get secure random number."
import 'react-native-get-random-values';
