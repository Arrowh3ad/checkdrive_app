# CheckDrive — Play Store launch reference

Working notes for the Google Play production launch. Not shipped in the app.

---

## 1. Data safety form (Play Console → App content → Data safety)

Your own code collects **no** personal data (checklists/trips are local-only;
notifications are local). The only data collection comes from **AdMob** (ads) and
**Google Play Billing / RevenueCat** (purchases). Declare the following.

**Q: Does your app collect or share any of the required user data types?** → **Yes**
**Q: Is all of the user data collected by your app encrypted in transit?** → **Yes**
**Q: Do you provide a way for users to request that their data is deleted?** →
**No** (no accounts / no server data; data is stored on-device and removed on
uninstall. Users can reset their advertising ID in Android settings.) — the
privacy policy explains this.

### Data types to declare

| Data type | Collected | Shared | Purpose(s) | Source |
|---|---|---|---|---|
| **Device or other IDs** (Advertising ID) | Yes | Yes | Advertising or marketing; Analytics | AdMob |
| **Location → Approximate location** | Yes | Yes | Advertising or marketing | AdMob |
| **App activity → App interactions** | Yes | Yes | Advertising or marketing; Analytics | AdMob |
| **Financial info → Purchase history** | Yes | No | App functionality | Play Billing / RevenueCat |

For each AdMob row: mark collection as **required** (users can't opt out in-app,
though personalized ads use a consent prompt in EEA/UK). Purchase history is
**App functionality** only and not shared.

> Cross-check against Google's official AdMob data-safety guidance, since the
> exact toggles can change:
> https://support.google.com/admob/answer/11140253

---

## 2. Content rating (App content → Content rating)

Utility app, no objectionable content. Answer the IARC questionnaire:
- Violence / sexual / profanity / controlled substances / gambling → **No** to all
- User-generated content shared with others → **No** (data is local only)
- Users can communicate / share location with each other → **No**

Expected result: **Everyone / PEGI 3.**

---

## 3. Target audience & content (App content)

- Target age groups: **18 and over** (a driving aid for adult drivers). Do **not**
  include under-18 groups — keeps you out of the Families policy / COPPA scope.
- "Is your app designed for children?" → **No**.

---

## 4. App access (App content)

- All functionality is available without an account or login.
- Select: **"All functionality is available without special access."**

---

## 5. Privacy policy URL

`https://arrowh3ad.github.io/checkdrive-legal/privacy.html`

---

## 6. Store listing copy

**App name (≤30):**
`CheckDrive`

**Short description (≤80):**
`Pre-drive checklists so you never leave without the essentials.`

**Full description (≤4000):**
```
Never pull out of the driveway wondering if you forgot something again.

CheckDrive gives you a quick, tappable checklist for every trip — from your daily
commute to a multi-stop road trip — so the essentials are always covered before
you go.

KEY FEATURES
• Custom checklists — build a list for any trip: commute, school run, road trip,
  gym, groceries.
• Multi-stop trips — plan a route with separate checklists for each stop.
• Automatic car detection — CheckDrive can detect when your phone connects to
  your car's Bluetooth and remind you to run your checklist.
• Back-seat reminder — get a reminder to check the back seat when you arrive, so
  nothing (and no one) is ever left behind.
• Trip history & stats — see your recent trips and completion rate at a glance.
• Default checklist & quick duplicate — set a go-to list and copy lists in a tap.

FREE & PRO
CheckDrive is free to use, supported by ads. Upgrade to CheckDrive Pro — a
one-time purchase, yours forever, no subscription — to remove ads and unlock
unlimited checklists.

Drive off with peace of mind. Add CheckDrive to your routine today.
```

---

## 7. Graphic assets still needed

- **App icon** — 512 × 512 PNG (you have an in-app icon; export at 512).
- **Feature graphic** — 1024 × 500 PNG/JPG (required).
- **Phone screenshots** — at least 2 (recommended 4–8), 16:9 or 9:16,
  min 320px. Capture: Home, a checklist run, multi-stop, the Pro screen.

---

## 8. Launch sequence (the actual gate)

1. Finish sections 1–7 above (App content + store listing).
2. **Closed testing track** → upload the production `.aab` → add **12+ testers**
   (email list) → testers opt in via the link.
3. Keep them opted in **14 continuous days** (personal-account requirement).
4. **Apply for production access** (button appears after the 14 days).
5. Final build: flip `USE_TEST_ADS = false` in `src/ads/adConfig.ts`, rebuild,
   promote to **Production**.

> Keep `USE_TEST_ADS = true` through closed testing — only real end users should
> ever see live ads. Tapping your own live ads can get the AdMob account banned.
