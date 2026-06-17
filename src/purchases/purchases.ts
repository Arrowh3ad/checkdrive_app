// ─────────────────────────────────────────────────────────────────────────────
// purchases/purchases.ts  —  Guarded RevenueCat access + Pro entitlement logic.
//
// react-native-purchases is a native module, absent in Expo Go / web, so (like
// the ads layer) we detect it and only require() it when present. Everything
// here no-ops gracefully when it's missing, so the app boots everywhere and
// purchases simply aren't offered.
//
// FLOW
//   initPurchases()      → configure the SDK once at app root, then push the
//                          current entitlement into the store (settings.isPro).
//   getProOffering()     → fetch the lifetime package to show on the paywall.
//   purchasePro(pkg)     → run the purchase; on success isPro flips to true.
//   restorePurchases()   → re-grant Pro on a new device / reinstall.
//   syncProFromCustomer  → maps a RevenueCat CustomerInfo → settings.isPro.
//
// isPro is OWNED BY THIS MODULE now. The store no longer hardcodes it; we write
// it from the live entitlement so it always reflects the real purchase state.
// ─────────────────────────────────────────────────────────────────────────────

import { Platform } from 'react-native';
import { useAppStore } from '../store/useAppStore';
import { ENTITLEMENT_ID, revenueCatKey } from './revenuecatConfig';

// ── Guarded native-module load ────────────────────────────────────────────────
let Purchases: any = null;
let nativeAvailable = false;
if (Platform.OS !== 'web') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('react-native-purchases');
    Purchases = mod?.default ?? mod;
    // The native module registers a Purchases TurboModule; if require succeeded
    // and the object looks right, treat it as available.
    nativeAvailable = !!Purchases && typeof Purchases.configure === 'function';
  } catch {
    Purchases = null;
    nativeAvailable = false;
  }
}

// Dev-only paywall mock. In Expo Go there's no native RevenueCat, so the paywall
// would normally show its "purchases unavailable" state — useless for capturing
// store screenshots. While __DEV__ we surface a fake lifetime package so the buy
// screen renders and the Pro flow can be exercised without a real store. This is
// never active in release builds (__DEV__ is false there).
const DEV_MOCK = __DEV__ && !nativeAvailable;
const DEV_MOCK_PRICE = '$4.99'; // shown on the dev paywall only — edit to taste

export const purchasesAvailable = nativeAvailable || DEV_MOCK;

// The RevenueCat package identifier for the lifetime product. We look it up by
// the SDK's standard LIFETIME package type, falling back to the first available
// package in the "current" offering.
export type ProPackage = {
  identifier: string;
  priceString: string; // e.g. "$4.99" — display as-is (already localized)
  raw: any;            // the underlying RevenueCat package, passed to purchase()
};

// Map a RevenueCat CustomerInfo into our store's isPro flag.
function syncProFromCustomer(customerInfo: any): boolean {
  const active = !!customerInfo?.entitlements?.active?.[ENTITLEMENT_ID];
  const current = useAppStore.getState().settings.isPro;
  if (active !== current) {
    useAppStore.getState().updateSettings({ isPro: active });
  }
  return active;
}

// Configure the SDK once, then sync entitlement → store. No-ops without a key
// or native module (so Expo Go just runs as free with ads).
export async function initPurchases(): Promise<void> {
  if (!nativeAvailable || !Purchases) return;
  const key = revenueCatKey();
  if (!key) return;
  try {
    Purchases.configure({ apiKey: key });
    // Push current state immediately…
    const info = await Purchases.getCustomerInfo();
    syncProFromCustomer(info);
    // …and keep it live if the entitlement changes (e.g. restore elsewhere).
    Purchases.addCustomerInfoUpdateListener((ci: any) => syncProFromCustomer(ci));
  } catch {
    /* configuration failed — stay free */
  }
}

// Fetch the lifetime package to display on the paywall, or null if unavailable.
export async function getProOffering(): Promise<ProPackage | null> {
  if (DEV_MOCK) {
    return { identifier: 'dev_lifetime', priceString: DEV_MOCK_PRICE, raw: null };
  }
  if (!nativeAvailable || !Purchases) return null;
  try {
    const offerings = await Purchases.getOfferings();
    const current = offerings?.current;
    if (!current) return null;
    // Prefer the explicit lifetime package; otherwise take the first one.
    const pkg =
      current.lifetime ??
      current.availablePackages?.[0] ??
      null;
    if (!pkg) return null;
    return {
      identifier: pkg.identifier,
      priceString: pkg.product?.priceString ?? '',
      raw: pkg,
    };
  } catch {
    return null;
  }
}

// Run the purchase. Returns true if Pro is now active. Throws on real errors so
// the paywall can show a message; silently returns false on user cancellation.
export async function purchasePro(pkg: ProPackage): Promise<boolean> {
  if (DEV_MOCK) {
    useAppStore.getState().updateSettings({ isPro: true });
    return true;
  }
  if (!nativeAvailable || !Purchases) return false;
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg.raw);
    return syncProFromCustomer(customerInfo);
  } catch (e: any) {
    if (e?.userCancelled) return false; // not an error — user backed out
    throw e;
  }
}

// Restore a previous purchase (new device / reinstall). Returns whether Pro is
// active afterward.
export async function restorePurchases(): Promise<boolean> {
  if (DEV_MOCK) return useAppStore.getState().settings.isPro;
  if (!nativeAvailable || !Purchases) return false;
  try {
    const info = await Purchases.restorePurchases();
    return syncProFromCustomer(info);
  } catch {
    return false;
  }
}
