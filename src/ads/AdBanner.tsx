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

import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { BannerAd, BannerAdSize } from 'react-native-google-mobile-ads';
import { AD_UNITS, adsEnabled } from './adConfig';
import { useAppStore } from '../store/useAppStore';

export function AdBanner() {
  // Re-evaluate the gate whenever the inputs to adsEnabled() change.
  const isPro = useAppStore((s) => s.settings.isPro);
  const connected = useAppStore((s) => s.connectedToVehicle);
  const [failed, setFailed] = useState(false);

  // Reset the failed flag if the gate conditions change (e.g. car disconnects),
  // giving the banner a fresh chance to load.
  useEffect(() => {
    setFailed(false);
  }, [isPro, connected]);

  if (!adsEnabled() || failed) return null;

  return (
    <View style={s.wrap}>
      <BannerAd
        unitId={AD_UNITS.banner}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        // If a banner fails to fill, hide the container rather than leave a gap.
        onAdFailedToLoad={() => setFailed(true)}
      />
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
});
