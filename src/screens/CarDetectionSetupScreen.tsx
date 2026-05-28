// ─────────────────────────────────────────────────────────────────────────────
// screens/CarDetectionSetupScreen.tsx  —  One-time car-detection setup guide.
//
// This screen explains why the app can't auto-detect CarPlay / Android Auto
// (Apple and Google restrict SDK access to approved categories) and walks the
// user through a one-time automation setup for BOTH connect and disconnect.
//
// iOS — TWO-SHORTCUT METHOD (required for iOS 17+ / 18+)
// ─────────────────────────────────────────────────────────
// In recent iOS versions, CarPlay automations don't surface "Open URLs"
// directly in the suggested-action picker — you see only "Open App",
// "New Shortcut", "Run Shortcut", etc. The solution is to put the URL-opening
// logic in a separate regular shortcut, then have the automation run that
// shortcut. This indirection always works because regular shortcuts have the
// full action library available, and "Run Shortcut" is always available inside
// automations.
//
// Two shortcuts + two automations are needed:
//   "Start CheckDrive" shortcut  → checkdrive://trigger
//   "Stop CheckDrive" shortcut   → checkdrive://disconnect
//   Automation: CarPlay Is Connected    → Run "Start CheckDrive"
//   Automation: CarPlay Is Disconnected → Run "Stop CheckDrive"
//
// ANDROID — BLUETOOTH TRIGGER + SEND INTENT
// ──────────────────────────────────────────
// True Android Auto connection detection (androidx.car.app.connection.
// CarConnection content provider) requires native Kotlin code inside the app
// binary — it can't be set up by the user from outside. The practical
// alternative for the managed Expo workflow is a user-side automation app
// (Tasker or MacroDroid) that listens for a Bluetooth-connect/-disconnect
// event from the car kit and fires a Send Intent.
//
// WHY SEND INTENT, NOT "BROWSE URL" / "OPEN WEBSITE"?
// Those actions pass the URL to a browser; the browser may intercept custom
// schemes or drop them silently. Send Intent fires android.intent.action.VIEW
// directly — Android resolves it to the registered URL-scheme handler
// (CheckDrive) without any browser involvement.
//
// WHY NOT GOOGLE ASSISTANT ROUTINES?
// Routines don't support arbitrary URL scheme launching. The "start/stop
// driving" triggers also require Android Auto to be active, not just
// Bluetooth. Routines are also being deprecated in favour of Gemini (2026).
//
// TEST BUTTONS
// `Linking.openURL('checkdrive://trigger')` does NOT work for testing on iOS —
// iOS won't route an app's own URL scheme back to itself when it's already open.
// Instead the buttons call `simulateVehicleConnect` / `simulateVehicleDisconnect`
// directly (exported from useCarDetection.ts), which run the same logic without
// going through the URL scheme.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';
import { simulateVehicleConnect, simulateVehicleDisconnect } from '../hooks/useCarDetection';

// ── Step data ─────────────────────────────────────────────────────────────────

// iOS connect — two-shortcut method (steps 1–4: create the shortcut,
// steps 5–7: create the automation that runs it).
const IOS_CONNECT_STEPS = [
  {
    n: '1',
    title: 'Open Shortcuts → tap "+" to create a new shortcut',
    detail:
      'Go to the "My Shortcuts" tab (not Automation). Tap the "+" button in the top-right corner to create a new blank shortcut.',
  },
  {
    n: '2',
    title: 'Tap "Add Action" → search "URL" → add it',
    detail:
      'In the shortcut editor, tap "Add Action". Search for "URL" (it\'s in the Web category). Add it, then type the deep link: checkdrive://trigger',
  },
  {
    n: '3',
    title: 'Tap "Add Action" again → search "Open URLs" → add it',
    detail:
      '"Open URLs" will automatically use the URL you typed in the previous step. You should now see two actions stacked: URL → Open URLs.',
  },
  {
    n: '4',
    title: 'Name the shortcut "Start CheckDrive" → tap Done',
    detail:
      'Tap the shortcut\'s title at the top of the editor to rename it. Then tap Done. You can test it right now — tapping the shortcut should open CheckDrive.',
  },
  {
    n: '5',
    title: 'Go to Automation tab → "+" → New Automation → CarPlay',
    detail:
      'Switch to the Automation tab. Tap "+" → "New Automation". Scroll through the trigger list to find "CarPlay", then select "Is Connected".',
  },
  {
    n: '6',
    title: 'Tap "Add Action" → search "Run Shortcut" → select "Start CheckDrive"',
    detail:
      'Tap "Add Action" inside the automation editor. Search for "Run Shortcut", add it, then tap the "Shortcut" placeholder and choose "Start CheckDrive" from your shortcuts list.',
  },
  {
    n: '7',
    title: 'Turn off "Ask Before Running" → tap Done',
    detail:
      'At the bottom of the automation editor, toggle off "Ask Before Running" (and "Notify When Run" if shown). This lets CheckDrive open automatically whenever CarPlay connects.',
  },
];

// iOS disconnect — same two-shortcut pattern but with the disconnect URL
// and the "Is Disconnected" trigger. Kept shorter since the user already
// understands the pattern from the connect setup above.
const IOS_DISCONNECT_STEPS = [
  {
    n: '1',
    title: 'Open Shortcuts → tap "+" to create another new shortcut',
    detail:
      'Same as before — go to "My Shortcuts" tab, tap "+". This shortcut will send the disconnect signal.',
  },
  {
    n: '2',
    title: 'Add "URL" action → type checkdrive://disconnect → add "Open URLs"',
    detail:
      'Same two-action pattern: URL action with checkdrive://disconnect, then Open URLs. Name the shortcut "Stop CheckDrive" and tap Done.',
  },
  {
    n: '3',
    title: 'Automation tab → "+" → New Automation → CarPlay → Is Disconnected',
    detail:
      'Same flow as the connect automation, but choose "Is Disconnected" as the CarPlay trigger instead of "Is Connected".',
  },
  {
    n: '4',
    title: 'Add Action → "Run Shortcut" → select "Stop CheckDrive" → turn off "Ask Before Running" → Done',
    detail:
      'CheckDrive will now send an arrival reminder notification whenever CarPlay unplugs, so you don\'t forget your end-of-trip checklist.',
  },
];

// Android connect — Tasker and MacroDroid using a Bluetooth-connect trigger
// and a Send Intent action. Step 1 covers one-time permissions that must be
// granted before either automation app will fire reliably in the background.
const ANDROID_CONNECT_STEPS = [
  {
    n: '1',
    title: 'Grant permissions to your automation app (one-time setup)',
    detail:
      'Without these two settings, the trigger silently fails when the screen is off.\n\n' +
      '① Draw Over Other Apps — Settings → Apps → [Tasker or MacroDroid] → ' +
      'Advanced → Display over other apps → Allow.\n\n' +
      '② Unrestricted battery — Settings → Apps → [app] → Battery → Unrestricted ' +
      '(look for "Optimize battery usage" if you don\'t see this directly).\n\n' +
      'Manufacturer extras: on Samsung also enable Auto-start in the same battery menu. ' +
      'On Xiaomi go to Security → Autostart. On OnePlus check Battery Optimization in ' +
      'the system Battery settings.',
  },
  {
    n: '2',
    title: 'Option A — Tasker: New Profile → Event → Net → BT Connected',
    detail:
      'Tap + to create a new profile → Event → Net → BT Connected. Tap the "Device" ' +
      'field and choose your car\'s Bluetooth name to avoid triggering on other devices ' +
      '(optional but recommended).\n\n' +
      'Tap the back arrow → New Task → tap + to add an action → System → Send Intent. ' +
      'Fill in these three fields and leave everything else blank:\n' +
      '  Action:  android.intent.action.VIEW\n' +
      '  Data:    checkdrive://trigger\n' +
      '  Target:  Activity',
  },
  {
    n: '3',
    title: 'Option B — MacroDroid: + Macro → Triggers → Connectivity → Bluetooth Device Connects',
    detail:
      'Tap + Macro → under Triggers tap + → Connectivity → Bluetooth Device Connects. ' +
      'Select your car\'s Bluetooth device from the list.\n\n' +
      'Under Actions tap + → Connectivity → Send Intent. Fill in:\n' +
      '  Action:   android.intent.action.VIEW\n' +
      '  Data URI: checkdrive://trigger\n' +
      '  Target:   Activity\n\n' +
      'Do NOT use "Open Website" or "HTTP GET" — those route through a browser and ' +
      'cannot open custom URL schemes like checkdrive://.',
  },
];

// Android disconnect — same Send Intent approach, Bluetooth Disconnected trigger.
// Permissions are already covered by step 1 of the connect section above.
const ANDROID_DISCONNECT_STEPS = [
  {
    n: '1',
    title: 'Option A — Tasker: New Profile → Event → Net → BT Disconnected',
    detail:
      'Same flow as the connect profile — tap + → Event → Net — but this time choose ' +
      '"BT Disconnected". Set Device to your car\'s Bluetooth name.\n\n' +
      'Link a new Task with one Send Intent action:\n' +
      '  Action:  android.intent.action.VIEW\n' +
      '  Data:    checkdrive://disconnect\n' +
      '  Target:  Activity\n\n' +
      'This fires the arrival-reminder notification so you don\'t forget end-of-trip items.',
  },
  {
    n: '2',
    title: 'Option B — MacroDroid: + Macro → Triggers → Connectivity → Bluetooth Device Disconnects',
    detail:
      'Same as the connect macro but choose "Bluetooth Device Disconnects" as the trigger. ' +
      'Select your car\'s Bluetooth device.\n\n' +
      'Under Actions add a Send Intent:\n' +
      '  Action:   android.intent.action.VIEW\n' +
      '  Data URI: checkdrive://disconnect\n' +
      '  Target:   Activity',
  },
];

export function CarDetectionSetupScreen() {
  const navigation = useNavigation();

  // Union type `'ios' | 'android'` constrains the tab state to exactly those
  // two strings — TypeScript will error if anything else is assigned.
  // Default to the current platform so the right instructions show first.
  const [tab, setTab] = useState<'ios' | 'android'>(
    Platform.OS === 'android' ? 'android' : 'ios'
  );

  // Connect steps and disconnect steps both swap when the tab changes.
  const connectSteps    = tab === 'ios' ? IOS_CONNECT_STEPS    : ANDROID_CONNECT_STEPS;
  const disconnectSteps = tab === 'ios' ? IOS_DISCONNECT_STEPS : ANDROID_DISCONNECT_STEPS;

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {/* Topbar */}
        <View style={s.topbar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
            <Ionicons name="arrow-back" size={22} color={theme.colors.textSecondary} />
          </TouchableOpacity>
          <Text style={s.title}>Car Detection Setup</Text>
        </View>

        {/* Explanation card — answers "why can't the app do this automatically?" */}
        <View style={s.card}>
          <Text style={s.infoTitle}>Why can't the app detect my car automatically?</Text>
          <Text style={s.infoText}>
            Apple restricts CarPlay SDK access to approved app categories (navigation, audio,
            etc.). Android Auto has similar restrictions for background apps. The safest
            cross-platform solution is to wire up a one-time automation using your OS's built-in
            tools — it takes about 5 minutes and works reliably.
          </Text>
        </View>

        {/* Platform tabs — same segmented-control pattern used in ChecklistRunScreen */}
        <View style={s.tabs}>
          <TouchableOpacity
            style={[s.tab, tab === 'ios' && s.tabActive]}
            onPress={() => setTab('ios')}
          >
            <Ionicons
              name="logo-apple"
              size={14}
              color={tab === 'ios' ? theme.colors.textPrimary : theme.colors.textSecondary}
            />
            <Text style={[s.tabText, tab === 'ios' && s.tabTextActive]}>iOS (Shortcuts)</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.tab, tab === 'android' && s.tabActive]}
            onPress={() => setTab('android')}
          >
            <Ionicons
              name="logo-android"
              size={14}
              color={tab === 'android' ? theme.colors.textPrimary : theme.colors.textSecondary}
            />
            <Text style={[s.tabText, tab === 'android' && s.tabTextActive]}>
              Android
            </Text>
          </TouchableOpacity>
        </View>

        {/* Android-only info callout — explains why Bluetooth is used as a proxy
            rather than direct Android Auto detection, so users understand the
            trade-off before following the steps. */}
        {tab === 'android' && (
          <View style={s.noteCard}>
            <Ionicons name="information-circle" size={16} color={theme.colors.primary} />
            <Text style={s.noteText}>
              <Text style={{ fontWeight: '600' }}>You don't have to do any of this. </Text>
              CheckDrive works perfectly without automation — just open the app yourself
              when you get in the car. The steps below are only for hands-free auto-launch,
              and they require installing a third-party automation app:{'\n\n'}
              <Text style={{ fontWeight: '600' }}>• MacroDroid </Text>(free, has ads) —
              easiest to set up.{'\n'}
              <Text style={{ fontWeight: '600' }}>• Tasker </Text>(~$3.50, no ads) —
              more powerful.{'\n\n'}
              Why can't the app do this on its own? Android Auto and Bluetooth-event detection
              require native Java/Kotlin code that's not available in the current build.
              These automation apps act as a permitted intermediary — they listen for the
              car's Bluetooth connection and tap a special URL that opens CheckDrive.
            </Text>
          </View>
        )}

        {/* Android-only prerequisites warning — shown before both sections.
            Covers the two most common reasons automation silently fails:
            missing "Draw Over Other Apps" and aggressive battery management. */}
        {tab === 'android' && (
          <View style={s.warnCard}>
            <Ionicons name="warning-outline" size={16} color={theme.colors.warning} />
            <Text style={s.warnText}>
              <Text style={{ fontWeight: '600' }}>Standalone build required. </Text>
              This only works with the app installed from Google Play or an EAS Build —
              not through Expo Go.{'\n\n'}
              <Text style={{ fontWeight: '600' }}>Grant permissions first </Text>
              (see Step 1 below) or triggers will silently fail when the screen is off.
            </Text>
          </View>
        )}

        {/* ── Connect automation section ───────────────────────────────────── */}
        <Text style={s.sectionLabel}>Connect automation</Text>

        {/* iOS-only note about the two-shortcut method */}
        {tab === 'ios' && (
          <View style={s.noteCard}>
            <Ionicons name="information-circle" size={16} color={theme.colors.primary} />
            <Text style={s.noteText}>
              On iOS 17+ / 18, CarPlay automations don't show "Open URLs" directly. Steps 1–4
              create a standalone shortcut; steps 5–7 wire it to CarPlay. This works on all
              recent iOS versions.
            </Text>
          </View>
        )}

        {/* Connect step-by-step instructions */}
        <View style={s.card}>
          {connectSteps.map((step, idx) => (
            <View
              key={step.n}
              style={[s.stepRow, idx < connectSteps.length - 1 && s.stepRowBorder]}
            >
              <View style={s.stepNum}>
                <Text style={s.stepNumText}>{step.n}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.stepTitle}>{step.title}</Text>
                <Text style={s.stepDetail}>{step.detail}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Copyable connect URL — `selectable` makes long-press-to-copy work */}
        <View style={s.urlCard}>
          <Text style={s.urlLabel}>Connect URL</Text>
          <View style={s.urlRow}>
            <Text style={s.urlText} selectable>checkdrive://trigger</Text>
          </View>
          <Text style={s.urlHint}>Long-press to copy · Paste this into the URL action</Text>
        </View>

        {/* ── Disconnect automation section ────────────────────────────────── */}
        <Text style={s.sectionLabel}>Disconnect automation</Text>

        {/* iOS-only note for disconnect */}
        {tab === 'ios' && (
          <View style={s.noteCard}>
            <Ionicons name="information-circle" size={16} color={theme.colors.primary} />
            <Text style={s.noteText}>
              Same two-shortcut approach as above, but with "Is Disconnected" as the trigger
              and checkdrive://disconnect as the URL. Without this, the arrival reminder
              notification won't fire automatically when you unplug CarPlay.
            </Text>
          </View>
        )}

        {/* Android-only note for disconnect */}
        {tab === 'android' && (
          <View style={s.noteCard}>
            <Ionicons name="information-circle" size={16} color={theme.colors.primary} />
            <Text style={s.noteText}>
              Permissions from Step 1 above also cover the disconnect automation — no extra
              setup needed. Create this as a separate profile/macro from the connect one.
            </Text>
          </View>
        )}

        {/* Disconnect step-by-step instructions */}
        <View style={s.card}>
          {disconnectSteps.map((step, idx) => (
            <View
              key={step.n}
              style={[s.stepRow, idx < disconnectSteps.length - 1 && s.stepRowBorder]}
            >
              <View style={s.stepNum}>
                <Text style={s.stepNumText}>{step.n}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.stepTitle}>{step.title}</Text>
                <Text style={s.stepDetail}>{step.detail}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Copyable disconnect URL */}
        <View style={s.urlCard}>
          <Text style={s.urlLabel}>Disconnect URL</Text>
          <View style={s.urlRow}>
            <Text style={s.urlText} selectable>checkdrive://disconnect</Text>
          </View>
          <Text style={s.urlHint}>Long-press to copy · Paste this into the URL action</Text>
        </View>

        {/* ── Test buttons ─────────────────────────────────────────────────── */}
        {/* These call the exported simulator functions directly rather than
            opening the URL scheme, because iOS won't route an app's own URL
            scheme back to itself when it's already running in the foreground. */}
        <View style={s.testBtnRow}>
          <TouchableOpacity style={s.testBtn} onPress={() => simulateVehicleConnect()}>
            <Ionicons name="flash" size={14} color={theme.colors.primary} />
            <Text style={[s.testBtnText, { color: theme.colors.primary }]}> Test connect</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.testBtn} onPress={() => simulateVehicleDisconnect()}>
            <Ionicons name="flash-off" size={14} color={theme.colors.textSecondary} />
            <Text style={s.testBtnText}> Test disconnect</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bgSecondary },
  scroll: { padding: 16, gap: 12 },
  topbar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingBottom: 4 },
  backBtn: { padding: 4 },
  title: { flex: 1, fontSize: 18, fontWeight: '500', color: theme.colors.textPrimary },

  sectionLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingHorizontal: 2,
  },

  card: {
    backgroundColor: theme.colors.bgPrimary,
    borderWidth: 0.5,
    borderColor: theme.colors.borderTertiary,
    borderRadius: theme.radius.lg,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 0,
  },
  infoTitle: { fontSize: 14, fontWeight: '500', color: theme.colors.textPrimary, marginBottom: 8 },
  infoText: { fontSize: 13, color: theme.colors.textSecondary, lineHeight: 19 },

  // Amber warning callout — Android prerequisites, shown once before connect steps
  warnCard: {
    backgroundColor: theme.colors.warningLight,
    borderWidth: 0.5,
    borderColor: '#D4A24C',
    borderRadius: theme.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  warnText: { flex: 1, fontSize: 13, color: theme.colors.warning, lineHeight: 18 },

  // Green info callout that appears above each section on the iOS tab
  noteCard: {
    backgroundColor: theme.colors.primaryLight,
    borderWidth: 0.5,
    borderColor: '#5DCAA5',
    borderRadius: theme.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  noteText: { flex: 1, fontSize: 13, color: theme.colors.primaryDeep, lineHeight: 18 },

  tabs: {
    flexDirection: 'row',
    backgroundColor: theme.colors.bgSecondary,
    borderRadius: theme.radius.md,
    padding: 3,
    gap: 2,
    borderWidth: 0.5,
    borderColor: theme.colors.borderTertiary,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    gap: 5,
    borderRadius: theme.radius.sm,
  },
  tabActive: {
    backgroundColor: theme.colors.bgPrimary,
    borderWidth: 0.5,
    borderColor: theme.colors.borderTertiary,
  },
  tabText: { fontSize: 13, fontWeight: '500', color: theme.colors.textSecondary },
  tabTextActive: { color: theme.colors.textPrimary },

  stepRow: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 12,
    alignItems: 'flex-start',
  },
  stepRowBorder: { borderBottomWidth: 0.5, borderBottomColor: theme.colors.borderTertiary },
  stepNum: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
    // Prevent the number circle from shrinking when the detail text is long
    flexShrink: 0,
  },
  stepNumText: { fontSize: 12, fontWeight: '600', color: theme.colors.primaryDark },
  stepTitle: { fontSize: 14, fontWeight: '500', color: theme.colors.textPrimary, marginBottom: 3 },
  stepDetail: { fontSize: 13, color: theme.colors.textSecondary, lineHeight: 18 },

  urlCard: {
    backgroundColor: theme.colors.bgPrimary,
    borderWidth: 0.5,
    borderColor: theme.colors.borderTertiary,
    borderRadius: theme.radius.lg,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 6,
  },
  urlLabel: { fontSize: 12, fontWeight: '500', color: theme.colors.textSecondary },
  urlRow: {
    backgroundColor: theme.colors.bgSecondary,
    borderRadius: theme.radius.sm,
    padding: 10,
  },
  urlText: {
    // Use a monospace font appropriate for each platform.
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 14,
    color: theme.colors.primaryDark,
  },
  urlHint: { fontSize: 12, color: theme.colors.textTertiary },

  // Side-by-side test buttons at the bottom of the screen
  testBtnRow: { flexDirection: 'row', gap: 8 },
  testBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 11,
    borderRadius: theme.radius.md,
    borderWidth: 0.5,
    borderColor: theme.colors.borderSecondary,
    backgroundColor: theme.colors.bgPrimary,
  },
  testBtnText: { fontSize: 13, fontWeight: '500', color: theme.colors.textSecondary },
});
