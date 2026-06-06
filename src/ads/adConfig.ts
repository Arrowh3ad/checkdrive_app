// ─────────────────────────────────────────────────────────────────────────────
// ads/adConfig.ts  —  Single source of truth for AdMob unit IDs + gating.
//
// TEST vs REAL
// While __DEV__ (Metro/dev builds) we ALWAYS use Google's official test ad unit
// IDs. Clicking your own *live* ads can get the AdMob account banned, so live
// units only ever load in a production (store) build. Swap the real IDs into
// REAL_UNITS below once they exist in your AdMob console; nothing else changes.
//
// GATING
// `adsEnabled` centralizes whether ads should show at all. Ads are gated off:
//   • on iOS for now (we ship ads Android-first),
//   • for "Pro" users (kept for when a paid no-ads tier returns; everyone is
//     effectively free in the current MVP),
//   • while connected to the vehicle (never show ads mid-drive),
//   • on a checklist run screen (caller's responsibility — banners simply
//     aren't mounted there).
// ─────────────────────────────────────────────────────────────────────────────

import { Platform } from 'react-native';
import { useAppStore } from '../store/useAppStore';
import { Admob, adsNativeAvailable } from './admob';

// Real (production) AdMob ad-unit IDs for CheckDrive.
const REAL_UNITS = {
  banner: 'ca-app-pub-2899842987578725/7257839806',
  interstitial: 'ca-app-pub-2899842987578725/5944758135',
};

// ⚠️ SAFETY FLAG — keep TRUE for every build except the final store release.
// EAS preview/production builds are RELEASE builds where __DEV__ is FALSE, so
// without this flag they would load REAL ads — and tapping your own live ads
// can get the AdMob account BANNED. Leave true while testing; flip to false
// ONLY for the production build you actually submit to the store.
export const USE_TEST_ADS = true;

const useTest = __DEV__ || USE_TEST_ADS;

// Test IDs (Google's public sandbox units, always safe to tap) until the store
// build; real IDs only when useTest is false.
export const AD_UNITS = {
  banner: useTest ? (Admob?.TestIds.BANNER ?? REAL_UNITS.banner) : REAL_UNITS.banner,
  interstitial: useTest
    ? (Admob?.TestIds.INTERSTITIAL ?? REAL_UNITS.interstitial)
    : REAL_UNITS.interstitial,
};

// Whether ads may show right now. Reads live store state, so call it at render
// time / right before requesting an interstitial.
export function adsEnabled(): boolean {
  if (Platform.OS !== 'android') return false; // Android-first
  if (!adsNativeAvailable) return false;       // not in Expo Go / web
  const { settings, connectedToVehicle } = useAppStore.getState();
  if (settings.isPro) return false;            // no-ads (Pro) tier
  if (connectedToVehicle) return false;        // never mid-drive
  return true;
}
