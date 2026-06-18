// ─────────────────────────────────────────────────────────────────────────────
// purchases/revenuecatConfig.ts  —  RevenueCat keys + identifiers (one place).
//
// Replace REVENUECAT_ANDROID_KEY with your project's PUBLIC Android API key from
// the RevenueCat dashboard (Project settings → API keys → "Public app-specific"
// for the Android app). It's a *public* key — safe to ship in the app binary.
//
// ENTITLEMENT_ID must match the entitlement identifier you create in RevenueCat
// (Entitlements → e.g. "pro"). When the user owns the lifetime product, this
// entitlement becomes active, which is what flips the app to Pro.
// ─────────────────────────────────────────────────────────────────────────────

import { Platform } from 'react-native';

// Public Android SDK key from RevenueCat (Project → API keys). Public = safe to
// ship in the app binary.
export const REVENUECAT_ANDROID_KEY = 'goog_fxwFsyzQJHQdcyQPpriKlBNEYhD';

// Public iOS SDK key from RevenueCat (App Store app). Public = safe to ship.
export const REVENUECAT_IOS_KEY = 'appl_DIkphqoboYZEMXtSSTLsJIKCNtM';

// The entitlement identifier configured in the RevenueCat dashboard.
export const ENTITLEMENT_ID = 'pro';

// The platform key, or null when we have none (so init can no-op cleanly).
export function revenueCatKey(): string | null {
  if (Platform.OS === 'android') return REVENUECAT_ANDROID_KEY || null;
  if (Platform.OS === 'ios') return REVENUECAT_IOS_KEY || null;
  return null;
}
