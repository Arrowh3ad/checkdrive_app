// ─────────────────────────────────────────────────────────────────────────────
// screens/CarDetectionSetupScreen.tsx  —  One-time car-detection setup guide.
//
// This screen explains why the app can't auto-detect CarPlay (Apple restricts
// the CarPlay SDK to approved categories) and walks the user through a
// one-time Shortcuts/automation setup that makes it work.
//
// iOS — TWO-SHORTCUT METHOD (required for iOS 17+ / 18+)
// ─────────────────────────────────────────────────────────
// In recent iOS versions, CarPlay automations don't surface "Open URLs"
// directly in the suggested-action picker — you see only "Open App",
// "New Shortcut", "Run Shortcut", etc. The solution is to put the URL-opening
// logic in a separate regular shortcut, then have the automation run that
// shortcut. This indirection always works because:
//   • Regular shortcuts always have the full action library available.
//   • "Run Shortcut" is always available inside automations.
// See useCarDetection.ts for the matching deep-link listener.
//
// ANDROID
// Three options of increasing complexity are described for Android, ranging
// from Google Assistant Routines (zero-install) to Tasker (full automation).
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Linking,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';

// ── Step data ─────────────────────────────────────────────────────────────────
// Typed inline by TypeScript inference — each object must have `n`, `title`,
// and `detail` string fields; the compiler will surface any missing fields.

// iOS 17+/18+ requires a two-shortcut approach because CarPlay automations
// limit the directly-available actions. We first create a standalone shortcut
// ("Start CheckDrive") that opens the deep link, then create a CarPlay
// automation that runs that shortcut.
const IOS_STEPS = [
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

const ANDROID_STEPS = [
  {
    n: '1',
    title: 'Option A — Google Assistant Routine',
    detail:
      'Open Google Assistant settings → Routines → "+ New" → Starter: "When I start driving" → Action: Open app or run shortcut to checkdrive://trigger.',
  },
  {
    n: '2',
    title: 'Option B — MacroDroid or Tasker',
    detail:
      'Create a profile: Trigger = "Bluetooth device connects" (your car\'s head unit) → Action = "Launch URL: checkdrive://trigger".',
  },
  {
    n: '3',
    title: 'Option C — Android Auto (Pro builds)',
    detail:
      'A bare-workflow build of this app can use UiModeManager.getCurrentModeType() to detect UI_MODE_TYPE_CAR=3 natively, without any third-party automation app.',
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

  function testDeepLink() {
    // Opening our own URL scheme re-triggers the `Linking.addEventListener('url')`
    // handler in useCarDetection, simulating a real CarPlay connect event.
    // On a simulator there's no background app to receive the URL, so we swallow
    // the error rather than showing a confusing alert.
    Linking.openURL('checkdrive://trigger').catch(() => {
      // Expected on iOS Simulator — not a real error
    });
  }

  // Derived value — no separate state needed.
  const steps = tab === 'ios' ? IOS_STEPS : ANDROID_STEPS;

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
            tools — it takes about 3 minutes and works reliably.
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

        {/* Step-by-step instructions — `steps` changes automatically when tab changes */}
        <View style={s.card}>
          {steps.map((step, idx) => (
            <View
              key={step.n}
              style={[s.stepRow, idx < steps.length - 1 && s.stepRowBorder]}
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

        {/* Copyable deep-link URL — `selectable` makes long-press-to-copy work */}
        <View style={s.urlCard}>
          <Text style={s.urlLabel}>Deep-link URL</Text>
          <View style={s.urlRow}>
            <Text style={s.urlText} selectable>checkdrive://trigger</Text>
          </View>
          <Text style={s.urlHint}>Long-press to copy · Paste this into the URL action (step 2)</Text>
        </View>

        {/* Test button — fires the URL scheme so you can verify the setup works */}
        <TouchableOpacity style={s.testBtn} onPress={testDeepLink}>
          <Ionicons name="flash" size={15} color={theme.colors.textPrimary} />
          <Text style={s.testBtnText}> Test deep link (simulates CarPlay connect)</Text>
        </TouchableOpacity>

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

  // Info callout that only appears on the iOS tab
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

  testBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 11,
    borderRadius: theme.radius.md,
    borderWidth: 0.5,
    borderColor: theme.colors.borderSecondary,
    backgroundColor: theme.colors.bgPrimary,
  },
  testBtnText: { fontSize: 14, fontWeight: '500', color: theme.colors.textPrimary },
});
