// ─────────────────────────────────────────────────────────────────────────────
// ads/interstitial.ts  —  Frequency-capped full-screen interstitial.
//
// Interstitials must be preloaded, so we keep a single instance, load it ahead
// of time, and reload after each show. `maybeShowInterstitial()` is called at a
// natural break (e.g. finishing a checklist) and self-gates:
//   • respects adsEnabled() (Android, non-Pro, not while driving),
//   • enforces a minimum gap between interstitials (MIN_GAP_MS) AND a minimum
//     number of "breaks" between shows, so users aren't hammered,
//   • silently no-ops if no ad is loaded yet (never blocks the user flow).
//
// Driving-app caution: this is intentionally conservative. We never show an
// interstitial on connect, only at trip/checklist completion via the caller.
// ─────────────────────────────────────────────────────────────────────────────

import { InterstitialAd, AdEventType } from 'react-native-google-mobile-ads';
import { AD_UNITS, adsEnabled } from './adConfig';

const MIN_GAP_MS = 3 * 60 * 1000; // at most one interstitial per 3 minutes
const SHOW_EVERY_N = 3;           // ...and at most once per 3 eligible breaks

let interstitial: InterstitialAd | null = null;
let loaded = false;
let lastShownAt = 0;
let breakCount = 0;

// Build + start loading a fresh interstitial. Safe to call repeatedly.
function preload() {
  try {
    interstitial = InterstitialAd.createForAdRequest(AD_UNITS.interstitial);
    loaded = false;
    interstitial.addAdEventListener(AdEventType.LOADED, () => {
      loaded = true;
    });
    interstitial.addAdEventListener(AdEventType.CLOSED, () => {
      // Reload for next time once the user dismisses it.
      preload();
    });
    interstitial.addAdEventListener(AdEventType.ERROR, () => {
      loaded = false;
    });
    interstitial.load();
  } catch {
    interstitial = null;
    loaded = false;
  }
}

// Call once at app start (after init) to warm the first ad.
export function initInterstitial() {
  if (!interstitial) preload();
}

// Show an interstitial if all gates pass; otherwise no-op. Returns whether one
// was actually shown (useful for callers that want to know).
export function maybeShowInterstitial(): boolean {
  if (!adsEnabled()) return false;

  // Frequency cap by count: only every Nth eligible break is a candidate.
  breakCount += 1;
  if (breakCount % SHOW_EVERY_N !== 0) return false;

  // Frequency cap by time.
  const now = Date.now();
  if (now - lastShownAt < MIN_GAP_MS) return false;

  if (!interstitial || !loaded) {
    // Nothing ready — make sure one is loading for next time.
    if (!interstitial) preload();
    return false;
  }

  try {
    interstitial.show();
    lastShownAt = now;
    loaded = false; // consumed; CLOSED handler will preload the next
    return true;
  } catch {
    return false;
  }
}
