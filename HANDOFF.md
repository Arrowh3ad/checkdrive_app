# CheckDrive — Complete Project Handoff

> Self-contained context to continue the launch from a fresh conversation. Last updated 2026-06-18.

## 1. Overview
**CheckDrive** = a car-trip checklist app (quick tappable lists so you don't leave without essentials). Solo dev. Stack: **React Native 0.83.6 / React 19.2.0 / Expo SDK 55 / TypeScript**, Zustand + AsyncStorage. Launching on **Google Play** (closed testing) + **iOS App Store** (mid-submission, the active focus).

- **Project path:** `C:\Users\ruiya\coding\claude\checkdrive_app`
- **Git branch:** `staging` (PRs target `main`).
- **Verify before building:** `npx tsc --noEmit` && `npx jest` (14 tests pass). **Always `cd` into the project dir before `eas`/git** — background EAS builds fail with "Run this command inside a project directory" otherwise.
- Commit version-number bumps after each build (appVersionSource is "local").

## 2. Accounts, IDs, keys
- **Bundle/package ID (iOS + Android):** `com.checkdrive.app`
- **EAS:** project `@arrqwhead/checkdrive`, owner `arrqwhead`, projectId `49a7d2a4-4eee-43ff-903f-b0aa5debd87f`
- **Apple Team ID:** `64G5TP8428` (Ruiyang Wu, Individual)
- **App Store Connect app name:** "CheckDrive: Car Checklist"
- **App Store Connect API key** (build/submit): `AuthKey_3F582QKS25.p8`, Key ID `3F582QKS25`, App Manager role. Reuse; don't generate new.
- **RevenueCat:** entitlement `pro`; offering `default` → Lifetime package holds both store products; product ID `checkdrive_pro_lifetime` (non-consumable, same ID both stores).
  - `REVENUECAT_ANDROID_KEY = goog_fxwFsyzQJHQdcyQPpriKlBNEYhD`
  - `REVENUECAT_IOS_KEY = appl_DIkphqoboYZEMXtSSTLsJIKCNtM`
  - In `src/purchases/revenuecatConfig.ts` (public keys, safe to ship).
- **AdMob (Android only):** app ID `ca-app-pub-2899842987578725~9187822970`. Real unit IDs in `src/ads/adConfig.ts`, gated by `USE_TEST_ADS`.
- **Legal/support site:** separate public repo **`arrowh3ad/checkdrive-legal`** (GitHub Pages) → `https://arrowh3ad.github.io/checkdrive-legal/{privacy,terms,support}.html`. Contact: `unusualapps1@gmail.com`.

## 3. CRITICAL flags / gotchas
- ⚠️ **`USE_TEST_ADS = true`** (src/ads/adConfig.ts) — keep true through ALL testing. Flip to `false` ONLY for the final Android **production** build (own live-ad clicks can ban AdMob). iOS unaffected.
- ⚠️ **iOS is ad-free.** AdMob SDK excluded from iOS via `package.json` → `expo.autolinking.apple.exclude: ["react-native-google-mobile-ads"]`. Ads config plugin stays in app.json (GADApplicationIdentifier kept as crash-safety net); `NSUserTrackingUsageDescription` was removed (was blocking submission — no tracking on iOS).
- **Notifications are local only** (no remote push/APNs). On iOS builds, decline "Set up Push Notifications" (eas.json sets `promptToConfigurePushNotifications: false`).
- **No temporary hacks remain.** A `__DEV__`-gated Pro toggle in SettingsScreen compiles out of release builds.
- `eas build` ≠ `eas submit` (build makes artifact; submit uploads, no build credit).
- **EAS free plan: limited builds/month.** Android quota exhausted, **resets ~2026-07-01** (or upgrade).

## 4. Current build state
- **iOS build 4 (`buildNumber 4`): SUCCEEDED, READY TO SUBMIT.** No-tracking-string fix + deep-link fix.
  - .ipa: `https://expo.dev/artifacts/eas/FJIUPbm5pu1zw1PvUVOKBFFAZ9DDaNfJiXcTpgs7iVM.ipa`
  - Submit: `eas submit --platform ios --profile production` (reuse API key, No to new). Select **build 4** (NOT 2/3).
- **Android: last good = v14 (`versionCode 14`).** v15 (deep-link fix) blocked by EAS quota; fix committed (`90e9651`). After reset → build → upload to closed testing.
- `app.json` committed: `versionCode 14`, `ios.buildNumber 4`, `version 1.0.0`.

## 5. Monetization / Pro model
- **Free:** up to 3 checklists, ads on Android.
- **Pro (one-time lifetime, no subscription):** unlimited checklists + no ads (Android) + default checklist + **auto-open-on-connect** (Pro-exclusive; free users get an actionable notification instead).
- Purchases via RevenueCat only; unavailable in Expo Go (expected). RevenueCat "customers" = installs, not purchases. Android product also attached to a stray old "CheckDrive Pro" entitlement — harmless (app reads only `pro`).

## 6. Feature & architecture map
- **`src/store/useAppStore.ts`** — Zustand store. Seeds: Daily commute (start+end, default `cl-default-1`), School run (start+end), Weekend road trip (multi-stop `cl-default-2`). Persist `version: 1` migration converts old `autoDetect` → `defaultChecklistId`. `Settings`: `pushNotifications, bluetoothAutoDetect, isPro, totalTrips, defaultChecklistId, openChecklistOnConnect, reviewRequested`.
- **`src/types/index.ts`** — `Checklist` (no `autoDetect`), `Settings`, `TripLog`, `ActiveRun`, `Stop`, `RootStackParamList`.
- **Screens** (`src/screens/`): HomeScreen, ChecklistRunScreen, MultiStopScreen, NewChecklistScreen, SettingsScreen, PaywallScreen ("No ads" hidden on iOS), CarDetectionSetupScreen (iOS Shortcuts + Android paired-device picker + test buttons), TripHistoryScreen.
- **Car detection** (`src/hooks/useCarDetection.ts`): `simulateVehicleConnect`/`Disconnect`. Connect → default-trip context, multi-stop intercept, Pro auto-open or notification. Disconnect → back-seat (priority) → multi-stop "review stops" → end-of-trip → generic. Listens to `checkdrive://trigger` / `checkdrive://disconnect` + native Android BT events. Gated by `bluetoothAutoDetect`.
- **Notifications** (`src/hooks/useNotifications.ts`): local only.
- **Navigation** (`src/navigation/AppNavigator.tsx`): native stack + `linking`. `trigger`/`disconnect` are deliberately NOT mapped to screens (listener handles them) — mapping `trigger`→CarDetectionSetup was the deep-link bug, now fixed.
- **Ads** (`src/ads/`): adConfig.ts, admob.ts (Android-only guarded load), interstitial.ts (`maybeShowInterstitial` returns bool), AdBanner.tsx, useAdsInit.ts (iOS/ExpoGo no-op).
- **Purchases** (`src/purchases/`): purchases.ts, revenuecatConfig.ts (`ENTITLEMENT_ID='pro'`).
- **Rate prompt** (`src/reviews/appReview.ts`): `maybeRequestReview()` — expo-store-review, after 15 trips, once, skipped when an interstitial just showed.
- **Native module** (`modules/car-bluetooth/`): Android Kotlin (CompanionDeviceManager `associate`/`getBondedDevices`/`setTarget`, manifest ACL receiver, `configure`); iOS no-op stub; JS guards to Android.
- **Test car detection in Expo Go:** Settings → Car detection setup → "Test connect/disconnect".

## 7. iOS App Store Connect — remaining checklist
1. `eas submit --platform ios --profile production` (reuse API key) → select **build 4** after processing.
2. **App Review Information:** ⚠️ uncheck **"Sign-in required"**; add contact; review notes:
   > CheckDrive has no account or login — all features work immediately. iOS car detection uses a one-time Shortcuts automation that can't run in review; to test, open Settings → Car detection setup and use "Test connect" / "Test disconnect". CheckDrive Pro is a one-time non-consumable unlock (no subscription).
3. **App Privacy:** collect = Yes. Declare **Purchases** + **Identifiers (User ID + Device ID)** — all **App Functionality**, **Data Not Linked to You**, **No tracking** (RevenueCat). NOT collected: photos (on-device), payment info (Apple handles). Privacy URL: `https://arrowh3ad.github.io/checkdrive-legal/privacy.html`.
4. **Age Rating:** all None/No; Advertising → No → 4+.
5. **Primary category:** Utilities (optional secondary Productivity/Travel).
6. **Pricing:** Free.
7. ⚠️ **Agreements, Tax, Banking:** Paid Apps agreement must be **Active** (required for IAP).
8. IAP `checkdrive_pro_lifetime` attached for review with this version.
9. Metadata below. Screenshots: 5× iPhone 6.5" done; iPad not needed (`supportsTablet: false`). Optional fields (Promo Text, Marketing URL, Routing Coverage, Subtitle, Copyright) can be skipped.
10. Release option (Manual recommended) → Submit for Review.
11. **Verify on TestFlight first** (internal testing, no code for yourself): app launches, paywall shows buy button, `checkdrive://trigger` lands on Home + fires notification. More testers: External Testing + public link (one-time Beta App Review).

### Store copy (iOS — ad-free wording)
```
Never pull out of the driveway wondering if you forgot something again.

CheckDrive gives you a quick, tappable checklist for every trip — from your daily
commute to a multi-stop road trip — so the essentials are always covered before you go.

KEY FEATURES
• Custom checklists — build a list for any trip: commute, school run, road trip, gym, groceries.
• Multi-stop trips — plan a route with separate checklists for each stop.
• Car detection — set up a one-time Shortcuts automation so CheckDrive reminds you to run your checklist when CarPlay connects.
• Back-seat reminder — get a reminder to check the back seat when you arrive, so nothing (and no one) is ever left behind.
• Trip history & stats — see your recent trips and completion rate at a glance.
• Default checklist & quick duplicate — set a go-to list and copy lists in a tap.

CHECKDRIVE PRO
Upgrade to CheckDrive Pro — a one-time purchase, yours forever, no subscription — to unlock unlimited checklists and auto-open your default checklist when your car connects.

Drive off with peace of mind. Add CheckDrive to your routine today.
```
**Keywords:** `checklist,car,driving,commute,roadtrip,reminder,trip,packing,carplay,travel,todo,essentials`
**Support URL:** `https://arrowh3ad.github.io/checkdrive-legal/support.html`

### TestFlight Beta App Description
```
CheckDrive is a simple pre-drive checklist app — quick, tappable lists so you never leave without the essentials, whether it's your daily commute, the school run, or a multi-stop road trip.

In this beta you can: build custom checklists, run them before/after a trip, set up multi-stop trips, mark a default checklist, set a back-seat reminder, and try CheckDrive Pro (a one-time unlock for unlimited checklists). Car detection on iPhone is set up via a one-time Shortcuts automation (Settings → Car detection setup), or use the built-in "Test connect/disconnect" buttons.

Thanks for testing! Please send bugs or ideas through TestFlight feedback.
```
Feedback email: `unusualapps1@gmail.com`.

## 8. Outstanding action items
- ⚠️ **Publish `support.html`** to the `arrowh3ad/checkdrive-legal` repo (exists locally in `docs/`, but the live site is that separate repo). Otherwise the Support URL 404s.
- **Android v15 build** after ~2026-07-01 quota reset (deep-link fix) → upload to closed testing.
- **Final Android production build:** flip `USE_TEST_ADS = false`, rebuild, promote to Production (only after closed testing clears: 12+ testers × 14 days, then apply for production access). Data safety / content rating answers are in `LAUNCH.md`.

## 9. Config state (already applied)
- `app.json` iOS `infoPlist`: `ITSAppUsesNonExemptEncryption: false`, `NSPhotoLibraryUsageDescription` set, no `UIBackgroundModes`, no `NSUserTrackingUsageDescription`. `supportsTablet: false`.
- Removed deps: `expo-background-fetch`, `expo-task-manager` (no-op).
- `package.json`: `expo.autolinking.apple.exclude: ["react-native-google-mobile-ads"]`.
- `eas.json`: `cli.appVersionSource: "local"`, `promptToConfigurePushNotifications: false`; production profile = `autoIncrement: true` + Android `app-bundle`.

## 10. Recent commits (newest first)
`4cfc22d` iOS buildNumber 4 · `90e9651` fix deep link landing on CarDetectionSetup · `aa56346` buildNumber 3 · `9660d68` remove ATT string · `18b6861` buildNumber + skip push prompt · `78bac6c` pin appVersionSource local · `9944805` wire iOS RevenueCat key · `7cd7a38` drop background-fetch + exclude AdMob from iOS · `bd884cf` iOS prep (remote-notification/encryption/photo keys) · `a78a26a` support page · `1ededf0` Android v14 · `27240b3` remove FORCE_DEV_PAYWALL · `0961c34` hide No-ads perk iOS · `712eb34` multi-stop disconnect reminder · `0b8d09e` review prompt + dev affordances · `98dcbe8` School run end-of-trip + honest meta · `69f1a21` paired-device car picker · `67cae04` consolidate default-checklist model.
