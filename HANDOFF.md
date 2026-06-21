# CheckDrive — Complete Project Handoff

> Self-contained context to continue the launch from a fresh conversation. Last updated 2026-06-20. Branch `staging`, HEAD `80738e7`.

## 1. Overview
**CheckDrive** = a car-trip checklist app (quick tappable lists so you don't leave without essentials). Solo dev, side project he wants to make money. Stack: **React Native 0.83.6 / React 19.2.0 / Expo SDK 55 / TypeScript**, Zustand + AsyncStorage. Launching on **Google Play** (closed testing) + **iOS App Store** (mid-submission, active focus).

- **Project path:** `C:\Users\ruiya\coding\claude\checkdrive_app`  (Windows, Git Bash; `jq` is NOT installed)
- **Git branch:** `staging` (PRs target `main`). Remote: `https://github.com/Arrowh3ad/checkdrive_app`.
- **Verify before building:** `npx tsc --noEmit` && `npx jest` (20 tests pass). **Always `cd` into the project dir before `eas`/git** — background EAS builds fail with "Run this command inside a project directory" otherwise.
- Commit version-number bumps after each build (appVersionSource = "local").

## 2. Accounts, IDs, keys (ALL of them)
- **Bundle/package ID (iOS + Android):** `com.checkdrive.app`
- **EAS:** project `@arrqwhead/checkdrive`, owner `arrqwhead`, projectId `49a7d2a4-4eee-43ff-903f-b0aa5debd87f`
- **Apple Team ID:** `64G5TP8428` (Ruiyang Wu, Individual)
- **App Store Connect app name:** "CheckDrive: Car Checklist"
- **App Store Connect API key** (build + submit): file `AuthKey_3F582QKS25.p8`, **Key ID `3F582QKS25`**, App Manager role. Reuse it; answer "No" to generating a new one.
- **RevenueCat:** entitlement `pro`; offering `default` → Lifetime package holds BOTH store products; product ID `checkdrive_pro_lifetime` (non-consumable, same ID both stores). Keys in `src/purchases/revenuecatConfig.ts`:
  - `REVENUECAT_ANDROID_KEY = 'goog_fxwFsyzQJHQdcyQPpriKlBNEYhD'`
  - `REVENUECAT_IOS_KEY = 'appl_DIkphqoboYZEMXtSSTLsJIKCNtM'`
  - `ENTITLEMENT_ID = 'pro'`
  - (Android product also attached to a stray old "CheckDrive Pro" entitlement — harmless, app reads only `pro`; optional cleanup.)
- **AdMob (Android only):** app ID `ca-app-pub-2899842987578725~9187822970`. Real unit IDs live in `src/ads/adConfig.ts`, gated by `USE_TEST_ADS`.
- **iOS Shortcut iCloud links** (in `src/screens/CarDetectionSetupScreen.tsx`):
  - Enter car (ask-first): `https://www.icloud.com/shortcuts/7b126e4f25e44f7291e349dc47f9a93e`
  - Exit car: `https://www.icloud.com/shortcuts/9bc4c25822234379bb70daee3fda9484`
- **Legal/support site:** separate public repo **`arrowh3ad/checkdrive-legal`** (GitHub Pages) → `https://arrowh3ad.github.io/checkdrive-legal/{privacy,terms,support}.html`. Contact email: `unusualapps1@gmail.com`.

## 3. CRITICAL flags / gotchas
- ⚠️ **`USE_TEST_ADS = true`** (src/ads/adConfig.ts) — keep true through ALL testing. Flip to `false` ONLY for the final Android **production** build (own live-ad clicks can ban AdMob). iOS unaffected.
- ⚠️ **iOS is ad-free.** AdMob SDK excluded from iOS via `package.json` → `expo.autolinking.apple.exclude: ["react-native-google-mobile-ads"]`. The ads config plugin stays (GADApplicationIdentifier kept as crash-safety net); `NSUserTrackingUsageDescription` was removed (was blocking submission — no tracking on iOS).
- **Notifications are local only** (no remote push/APNs). On iOS builds, decline "Set up Push Notifications" (eas.json sets `promptToConfigurePushNotifications: false`).
- **No temporary hacks remain.** A `__DEV__`-gated Pro toggle in SettingsScreen compiles out of release builds.
- `eas build` ≠ `eas submit` (build makes artifact; submit uploads, no build credit).
- **EAS free plan: limited builds/month.** Android quota exhausted, **resets ~2026-07-01**. iOS NOT quota-blocked.

## 4. Current build state — IMPORTANT
- **iOS build 4 (`buildNumber 4`, artifact `.../FJIUPbm5pu1zw1PvUVOKBFFAZ9DDaNfJiXcTpgs7iVM.ipa`) is now STALE.** It predates the onboarding, ignore-scoring, one-tap shortcut links, and simplified iOS setup (all committed after `4cfc22d`). **A fresh iOS build (build 5) is needed to include them** before submitting/TestFlight. iOS is not quota-blocked — build anytime: `eas build --platform ios --profile production --non-interactive` (runs unattended with cached creds), then `eas submit --platform ios --profile production`, then select the new build in App Store Connect.
- **Android: last good = v14 (`versionCode 14`).** Also stale vs staging. New Android build blocked by EAS quota until ~2026-07-01. Then `eas build --platform android --profile production --non-interactive` → versionCode 15 → upload to closed testing.
- `app.json` committed: `versionCode 14`, `ios.buildNumber 4`, `version 1.0.0`.

## 5. Monetization / Pro model
- **Free:** up to 3 checklists, ads on Android.
- **Pro (one-time lifetime, no subscription):** unlimited checklists + no ads (Android) + default checklist + **auto-open-on-connect** (Pro-exclusive; free users get an actionable notification instead).
- Purchases via RevenueCat only; unavailable in Expo Go (expected). RevenueCat "customers" = installs, not purchases.

## 6. Feature & architecture map
- **`src/store/useAppStore.ts`** — Zustand store. Seeds: Daily commute (start+end, default `cl-default-1`), School run (start+end), Weekend road trip (multi-stop `cl-default-2`). Persist `version: 1` migration converts old `autoDetect` → `defaultChecklistId`. `Settings` fields: `pushNotifications, bluetoothAutoDetect, isPro, totalTrips, defaultChecklistId, openChecklistOnConnect, reviewRequested, onboardingSeen`.
- **`src/types/index.ts`** — `Checklist` (no `autoDetect`), `Settings`, `TripLog`, `ActiveRun` (now has optional `ignored?: Record<string,boolean>`), `Stop`, `RootStackParamList`.
- **Screens** (`src/screens/`): HomeScreen (renders `<Onboarding>` gated on `!onboardingSeen`), ChecklistRunScreen (ignore-item feature wired), MultiStopScreen, NewChecklistScreen, SettingsScreen (Pro card, prefs, "Replay tutorial" row, `__DEV__` Pro toggle), PaywallScreen ("No ads" hidden on iOS), CarDetectionSetupScreen, TripHistoryScreen, **Onboarding.tsx** (new — 3-page swipeable intro).
- **Onboarding** (`src/screens/Onboarding.tsx`): native paging ScrollView, 3 slides (what it is / set up a list / auto-detect + more), Ionicon placeholders where screenshots go, gated by `settings.onboardingSeen`. Replay = Settings → "Replay tutorial" (sets flag false + navigates Home).
- **Ignore-item scoring** (`src/utils/score.ts`, tested in `src/utils/__tests__/score.test.ts`): `computeTripScore` drops ignored items AND un-run phases from the % (`countStart = hasStart && (!twoPhase || startDone)`). Wired in `ChecklistRunScreen.markDone`; per-item ignore button + "Skipped" tag in the run UI; `ignored` persisted in ActiveRun.
- **Car detection** (`src/hooks/useCarDetection.ts`): `simulateVehicleConnect`/`Disconnect`. Disconnect → back-seat (priority) → multi-stop "review stops" → end-of-trip → generic. Listens to `checkdrive://trigger` / `checkdrive://disconnect` + native Android BT events. Gated by `bluetoothAutoDetect`.
- **Notifications** (`src/hooks/useNotifications.ts`): local only.
- **Navigation** (`src/navigation/AppNavigator.tsx`): native stack + `linking`. `trigger`/`disconnect` are deliberately NOT mapped to screens (fixed deep-link bug where `trigger`→CarDetectionSetup).
- **Ads** (`src/ads/`): adConfig.ts, admob.ts (Android-only guarded load), interstitial.ts, AdBanner.tsx, useAdsInit.ts (iOS/ExpoGo no-op).
- **Purchases** (`src/purchases/`): purchases.ts, revenuecatConfig.ts.
- **Rate prompt** (`src/reviews/appReview.ts`): expo-store-review, after 15 trips, once, skipped when an interstitial just showed.
- **Native module** (`modules/car-bluetooth/`): Android Kotlin (CompanionDeviceManager `associate`/`getBondedDevices`/`setTarget`, manifest ACL receiver, `configure`); iOS no-op stub.
- **Test car detection in Expo Go:** Settings → Car detection setup → "Test connect/disconnect".

## 7. iOS car-detection setup — current state + pending
The iOS section now uses the **one-tap iCloud Shortcut links** (buttons added) + a **simplified flow**: add the prebuilt shortcut → wire the CarPlay automation (connect = 4 steps, disconnect = 3 steps). The hand-build steps are gone.
- **PENDING — user is sharing an INSTANT-OPEN (no-alert) iCloud shortcut link.** When it arrives: add `SHORTCUT_CONNECT_INSTANT_URL` + a second button under "Enter car" ("Prefer instant open? Add the no-prompt version"). The copy already references "the instant-open version of the shortcut" in 2 spots.
- **PENDING — user is uploading automation SCREENSHOTS.** They can't paste images into the repo (only viewable); the user drops PNGs into `assets/` and says which file maps to which step/slide, then wire `<Image>` into the StepList rows and the Onboarding slides (currently Ionicon placeholders).

## 8. iOS App Store Connect — remaining checklist
1. **Build a fresh iOS build (5)** so it includes the session's work, then `eas submit` → select it.
2. **App Review Information:** ⚠️ uncheck **"Sign-in required"**; add contact; review notes:
   > CheckDrive has no account or login — all features work immediately. iOS car detection uses a one-time Shortcuts automation that can't run in review; to test, open Settings → Car detection setup and use "Test connect" / "Test disconnect". CheckDrive Pro is a one-time non-consumable unlock (no subscription).
3. **App Privacy:** collect = Yes. Declare **Purchases** + **Identifiers (User ID + Device ID)** — all **App Functionality**, **Data Not Linked to You**, **No tracking** (RevenueCat). NOT collected: photos (on-device), payment info (Apple handles). Privacy URL: `https://arrowh3ad.github.io/checkdrive-legal/privacy.html`.
4. **Age Rating:** all None/No; **Advertising → No** → 4+.
5. **Primary category:** Utilities (optional secondary Productivity/Travel).
6. **Pricing:** Free.
7. ⚠️ **Agreements, Tax, Banking:** Paid Apps agreement must be **Active** (required for IAP).
8. IAP `checkdrive_pro_lifetime` attached for review with this version.
9. Metadata below. Screenshots: iPhone 6.5" set exists (5); iPad not needed (`supportsTablet: false`). Optional fields (Promo Text, Marketing URL, Routing Coverage, Subtitle, Copyright) can be skipped.
10. Release option (Manual recommended) → Submit for Review.
11. **Verify on TestFlight first** (internal testing, no code for yourself): app launches, paywall shows buy button, `checkdrive://trigger` lands on Home + fires notification, onboarding shows on fresh install.

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

## 9. Outstanding action items
- ⚠️ **Publish `support.html`** to the `arrowh3ad/checkdrive-legal` repo (exists locally in `docs/`, but the live site is that separate repo). Otherwise the Support URL 404s.
- **Fresh iOS build (5)** to include onboarding/ignore/shortcuts/iOS-setup work → submit → TestFlight verify.
- Wire the **instant-open shortcut link** + **automation screenshots** when the user provides them (Section 7).
- **Android v15 build** after ~2026-07-01 quota reset → upload to closed testing.
- **Final Android production build:** flip `USE_TEST_ADS = false`, rebuild, promote to Production (only after closed testing clears: 12+ testers × 14 days, then apply for production access). Data safety / content rating answers are in `LAUNCH.md`.

## 10. Open review notes (informational, NOT fixed — from /review on 80738e7)
1. Existing testers will see the onboarding once after they update (persisted settings lacks `onboardingSeen` → falsy → shows). Intended-ish.
2. [CarDetectionSetupScreen.tsx ~line 24] stale header comment still describes the old hand-built "Show Alert" shortcut flow. Dev-only doc drift.
3. `Linking.openURL` on the shortcut buttons has no `.catch` (unhandled rejection if it ever fails; negligible for https).
4. A fully-ignored trip logs `0/0`, `isComplete:true` (score.ts:74) → counts as complete in Home's completion-rate stat. Intended per comment.

## 11. Config state (already applied)
- `app.json` iOS `infoPlist`: `ITSAppUsesNonExemptEncryption: false`, `NSPhotoLibraryUsageDescription` set, no `UIBackgroundModes`, no `NSUserTrackingUsageDescription`. `supportsTablet: false`.
- Removed deps: `expo-background-fetch`, `expo-task-manager` (no-op). Added: `expo-store-review`.
- `package.json`: `expo.autolinking.apple.exclude: ["react-native-google-mobile-ads"]`.
- `eas.json`: `cli.appVersionSource: "local"`, `promptToConfigurePushNotifications: false`; production profile = `autoIncrement: true` + Android `app-bundle`.

## 12. Office-hours design doc (2026-06-19)
Saved at `~/.gstack/projects/Arrowh3ad-checkdrive_app/ruiya-staging-design-20260619-214858.md`. Key takeaways: the **auto-trigger on car-connect IS the product** (a manual checklist can't fix forgetting); **setup friction is the #1 risk**; the app supports multi-occasion via user lists (broad app, narrow pitch); **validate with real users** before building more. Real demand evidence from the builder: Ubered home twice for a forgotten badge, near-misses on wallet/license, keys locked in car. Assignment: watch a real person attempt the Shortcuts setup unaided.

## 13. Recent commits (newest first)
`80738e7` iOS setup collapse to prebuilt-shortcut flow · `543ec78` Replay tutorial row · `fabef64` reshape onboarding slides · `90a6ac2` 3-page onboarding · `0f61866` ignore-item scoring + welcome sheet · `179e507` one-tap shortcut links · `64b722b` HANDOFF.md · `90e9651` fix trigger deep link · `9660d68` remove ATT string · `9944805` wire iOS RevenueCat key · `7cd7a38` drop background-fetch + exclude AdMob from iOS · `0961c34` hide No-ads perk iOS · `67cae04` consolidate default-checklist model.
