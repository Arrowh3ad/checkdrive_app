// ─────────────────────────────────────────────────────────────────────────────
// ads/AdBanner.tsx  —  Anchored banner ad, self-gating.
//
// Renders an adaptive banner when ads are allowed (see adsEnabled), and renders
// nothing otherwise — so callers can drop <AdBanner /> in unconditionally and it
// simply disappears for Pro users, on iOS, while driving, or in Expo Go.
//
// `subscribeToStore` re-checks the gate when relevant store state changes (e.g.
// the car connects → the banner should vanish), since adsEnabled() reads a
// snapshot that wouldn't otherwise trigger a re-render.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Admob } from './admob';
import { AD_UNITS, adsEnabled } from './adConfig';
import { useAppStore } from '../store/useAppStore';

// How many times to retry a failed banner load before giving up for this
// session, and how long to wait between attempts. A first-load failure is
// common (e.g. the banner requests before the Mobile Ads SDK finishes
// initializing, or a transient no-fill), so we retry rather than hide forever.
const MAX_ATTEMPTS = 4;
const RETRY_DELAY_MS = 2000;

export function AdBanner() {
  // Re-evaluate the gate whenever the inputs to adsEnabled() change.
  const isPro = useAppStore((s) => s.settings.isPro);
  const connected = useAppStore((s) => s.connectedToVehicle);

  // `attempt` doubles as the BannerAd `key`: bumping it remounts the banner,
  // which triggers a fresh load. `gaveUp` hides the slot only after we've
  // exhausted MAX_ATTEMPTS.
  const [attempt, setAttempt] = useState(0);
  const [gaveUp, setGaveUp] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset retries if the gate conditions change (e.g. car disconnects), giving
  // the banner a fresh chance to load.
  useEffect(() => {
    setAttempt(0);
    setGaveUp(false);
  }, [isPro, connected]);

  // Clear any pending retry timer on unmount.
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  // `Admob` is null when the native module isn't present (Expo Go) — bail before
  // touching BannerAd. adsEnabled() also already covers this, but guarding here
  // keeps TypeScript happy about the possibly-null library.
  if (!Admob || !adsEnabled() || gaveUp) return null;

  const { BannerAd, BannerAdSize } = Admob;

  return (
    <View style={s.wrap}>
      <BannerAd
        key={attempt}
        unitId={AD_UNITS.banner}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        onAdFailedToLoad={() => {
          // Retry a few times (remount via key), then hide the slot so we never
          // leave a permanent gap.
          if (attempt + 1 < MAX_ATTEMPTS) {
            timer.current = setTimeout(() => setAttempt((a) => a + 1), RETRY_DELAY_MS);
          } else {
            setGaveUp(true);
          }
        }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
});
