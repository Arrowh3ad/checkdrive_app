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
import { TestIds } from 'react-native-google-mobile-ads';
import { useAppStore } from '../store/useAppStore';

// Real (production) unit IDs — REPLACE with the IDs from your AdMob console.
// Format: 'ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX' (note the slash).
const REAL_UNITS = {
  banner: 'ca-app-pub-0000000000000000/0000000000',
  interstitial: 'ca-app-pub-0000000000000000/0000000000',
};

// In dev we force test IDs; in production we use the real ones. `TestIds.*`
// are Google's public sandbox units that always return a test ad.
export const AD_UNITS = {
  banner: __DEV__ ? TestIds.BANNER : REAL_UNITS.banner,
  interstitial: __DEV__ ? TestIds.INTERSTITIAL : REAL_UNITS.interstitial,
};

// Whether ads may show right now. Reads live store state, so call it at render
// time / right before requesting an interstitial.
export function adsEnabled(): boolean {
  if (Platform.OS !== 'android') return false; // Android-first
  const { settings, connectedToVehicle } = useAppStore.getState();
  if (settings.isPro) return false;            // future no-ads tier
  if (connectedToVehicle) return false;        // never mid-drive
  return true;
}
