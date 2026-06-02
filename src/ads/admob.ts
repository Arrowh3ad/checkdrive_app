// ─────────────────────────────────────────────────────────────────────────────
// ads/admob.ts  —  Guarded access to react-native-google-mobile-ads.
//
// The ads library is a custom native module, so it does NOT exist in Expo Go
// (or web). Importing it there throws an Invariant Violation at load and crashes
// the whole app. To let the app still boot everywhere, we:
//   1. detect whether the native module is actually registered, and
//   2. only `require()` the library when it is.
// Every other ads file imports `Admob` / `adsNativeAvailable` from here instead
// of importing the package directly, so the guard lives in exactly one place.
//
// The detection checks BOTH the TurboModule registry (new architecture) and the
// legacy NativeModules map, so it's correct whether or not the new arch is on.
// ─────────────────────────────────────────────────────────────────────────────

import { NativeModules, Platform, TurboModuleRegistry } from 'react-native';

// `TurboModuleRegistry.get` returns null (instead of throwing like getEnforcing)
// when the module is absent, so it's safe to probe with.
function detectModule(): boolean {
  if (Platform.OS !== 'android') return false;
  try {
    if (TurboModuleRegistry?.get?.('RNGoogleMobileAdsModule')) return true;
  } catch {
    /* fall through to the legacy check */
  }
  return !!(NativeModules as any)?.RNGoogleMobileAdsModule;
}

export const adsNativeAvailable = detectModule();

// Lazily load the library only when its native module is present. In Expo Go
// this stays null and all ads code no-ops. Typed as the package's module type
// so callers get full typing on Admob.BannerAd, Admob.InterstitialAd, etc.
let lib: typeof import('react-native-google-mobile-ads') | null = null;
if (adsNativeAvailable) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    lib = require('react-native-google-mobile-ads');
  } catch {
    lib = null;
  }
}

export const Admob = lib;
