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
import { View, Text, Platform, StyleSheet } from 'react-native';
import { Admob, adsNativeAvailable } from './admob';
import { AD_UNITS, adsEnabled } from './adConfig';
import { useAppStore } from '../store/useAppStore';

// TEMPORARY DIAGNOSTIC: when true, the banner area always renders a small status
// line explaining why an ad is/ isn't showing. Set to false (or delete the diag
// branches) before the store release.
const DIAG = true;

// How many times to retry a failed banner load before giving up for this
// session, and how long to wait between attempts. A first-load failure is
// common (e.g. the banner requests before the Mobile Ads SDK finishes
// initializing, or a transient no-fill), so we retry rather than hide forever.
const MAX_ATTEMPTS = 4;
const RETRY_DELAY_MS = 4000;

export function AdBanner() {
  // Re-evaluate the gate whenever the inputs to adsEnabled() change.
  const isPro = useAppStore((s) => s.settings.isPro);
  const connected = useAppStore((s) => s.connectedToVehicle);

  // `attempt` doubles as the BannerAd `key`: bumping it remounts the banner,
  // which triggers a fresh load. `gaveUp` hides the slot only after we've
  // exhausted MAX_ATTEMPTS.
  const [attempt, setAttempt] = useState(0);
  const [gaveUp, setGaveUp] = useState(false);
  const [adErr, setAdErr] = useState<string | null>(null);
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

  // TEMPORARY DIAGNOSTIC: explain the gate state on-screen.
  if (DIAG) {
    let reason: string | null = null;
    if (Platform.OS !== 'android') reason = 'gated: not android';
    else if (!adsNativeAvailable || !Admob) reason = 'ads NATIVE MODULE MISSING';
    else if (isPro) reason = 'gated: isPro';
    else if (connected) reason = 'gated: connectedToVehicle';
    else if (gaveUp) reason = `gave up after ${MAX_ATTEMPTS} tries — last err: ${adErr ?? '?'}`;

    if (reason) {
      return (
        <View style={s.wrap}>
          <Text style={s.diag}>ad diag: {reason}</Text>
        </View>
      );
    }
    // Otherwise fall through to render the banner (plus a tiny status line).
  }

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
        onAdLoaded={() => DIAG && setAdErr('loaded OK')}
        onAdFailedToLoad={(e: any) => {
          if (DIAG) setAdErr(`${e?.code ?? ''} ${e?.message ?? String(e)}`.trim());
          // Retry a few times (remount via key), then hide the slot so we never
          // leave a permanent gap.
          if (attempt + 1 < MAX_ATTEMPTS) {
            timer.current = setTimeout(() => setAttempt((a) => a + 1), RETRY_DELAY_MS);
          } else {
            setGaveUp(true);
          }
        }}
      />
      {DIAG && <Text style={s.diag}>ad diag: attempt {attempt + 1} · {adErr ?? 'loading…'}</Text>}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: 4 },
  diag: { fontSize: 11, color: '#E24B4A', textAlign: 'center', fontFamily: 'monospace' },
});
