// ─────────────────────────────────────────────────────────────────────────────
// ads/useAdsInit.ts  —  One-time AdMob SDK init + UMP consent.
//
// Called once near the app root. Two responsibilities:
//   1. UMP consent — request the consent-info update and, where required (EEA/
//      UK), show Google's consent form before any personalized ad loads. This
//      is mandatory for GDPR; Google's UMP SDK ships inside the ads library.
//   2. initialize() — start the Mobile Ads SDK after consent is gathered.
//
// On non-Android (iOS for now) and when the native module isn't present (Expo
// Go), everything no-ops so the app still boots.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect } from 'react';
import { Platform } from 'react-native';
import mobileAds, {
  AdsConsent,
  AdsConsentStatus,
} from 'react-native-google-mobile-ads';

export function useAdsInit(): void {
  useEffect(() => {
    if (Platform.OS !== 'android') return;

    let cancelled = false;
    (async () => {
      try {
        // 1. Gather consent. requestInfoUpdate tells us whether a form is
        //    required; if so we show it. Errors here must not block app use —
        //    we fall through to initializing the SDK regardless.
        const info = await AdsConsent.requestInfoUpdate();
        if (
          !cancelled &&
          info.isConsentFormAvailable &&
          info.status === AdsConsentStatus.REQUIRED
        ) {
          await AdsConsent.showForm();
        }
      } catch {
        /* consent unavailable — proceed with non-personalized ads */
      }

      try {
        // 2. Start the SDK. Safe to call once consent is resolved.
        if (!cancelled) await mobileAds().initialize();
      } catch {
        /* SDK init failed (e.g. module absent in Expo Go) — ignore */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);
}
