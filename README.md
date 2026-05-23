# CheckDrive

Pre-trip checklist app that triggers when you get in your car.

## Quick start

```bash
cd checkdrive_app
npm install
npx expo start
```

Scan the QR code with Expo Go (iOS/Android) or press `i`/`a` for simulator.

## Car detection

### iOS — Siri Shortcuts (managed Expo, no entitlement needed)
1. Open **Shortcuts** → Automation → New Automation
2. Trigger: **CarPlay → Connects**
3. Action: **Open URLs** → `checkdrive://trigger`
4. Disable "Ask Before Running"

### Android — automation apps
- **Google Assistant Routine**: "When I start driving" → Open URL `checkdrive://trigger`
- **MacroDroid / Tasker**: Bluetooth device (car) connects → Open URL `checkdrive://trigger`

### Native Android Auto (bare workflow only)
Eject with `npx expo prebuild`, then add a native module that wraps
`android.app.UiModeManager.getCurrentModeType()`. Returns `UI_MODE_TYPE_CAR = 3`
when Android Auto is active.

## Monetisation
- Free tier: 3 checklists, banner ads
- Pro ($2.99/mo or $24.99/yr): unlimited checklists, no ads, geofencing, multi-stop trips
- Wire up RevenueCat (or StoreKit 2 / Google Billing directly) to `ProScreen.tsx`

## Architecture
| Layer | Technology |
|-------|-----------|
| Framework | Expo SDK 52 (managed workflow) |
| Navigation | React Navigation 6 native-stack |
| State + persistence | Zustand 5 + AsyncStorage |
| Notifications | expo-notifications (local) |
| Background tasks | expo-task-manager + expo-background-fetch |
| Deep links | expo-linking (scheme `checkdrive://`) |
