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

const IOS_STEPS = [
  {
    n: '1',
    title: 'Open the Shortcuts app',
    detail: 'Built into iOS — search for it if you can\'t find it.',
  },
  {
    n: '2',
    title: 'Go to Automation → New Automation',
    detail: 'Tap the "+" in the top-right corner.',
  },
  {
    n: '3',
    title: 'Select "CarPlay" → "Connects"',
    detail: 'Scroll down to find CarPlay in the trigger list.',
  },
  {
    n: '4',
    title: 'Add action: "Open URLs"',
    detail: 'Search "Open URLs" and add the action.',
  },
  {
    n: '5',
    title: 'Enter: checkdrive://trigger',
    detail: 'Paste the URL above into the URL field.',
  },
  {
    n: '6',
    title: 'Disable "Ask Before Running"',
    detail: 'Toggle off so the checklist opens automatically.',
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
  const [tab, setTab] = useState<'ios' | 'android'>(
    Platform.OS === 'android' ? 'android' : 'ios'
  );

  function testDeepLink() {
    Linking.openURL('checkdrive://trigger').catch(() => {
      // Already in the app — this is expected on iOS simulator
    });
  }

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

        {/* Explanation */}
        <View style={s.card}>
          <Text style={s.infoTitle}>Why can't the app detect my car automatically?</Text>
          <Text style={s.infoText}>
            Apple restricts CarPlay SDK access to approved app categories (navigation, audio,
            etc.). Android Auto has similar restrictions for background apps. The safest
            cross-platform solution is to wire up a one-time automation using your OS's built-in
            tools — it takes about 2 minutes and works reliably.
          </Text>
        </View>

        {/* Platform tabs */}
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

        {/* Steps */}
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

        {/* URL to copy */}
        <View style={s.urlCard}>
          <Text style={s.urlLabel}>Deep-link URL</Text>
          <View style={s.urlRow}>
            <Text style={s.urlText} selectable>checkdrive://trigger</Text>
          </View>
          <Text style={s.urlHint}>Long-press to copy · Works on both iOS and Android</Text>
        </View>

        {/* Test */}
        <TouchableOpacity style={s.testBtn} onPress={testDeepLink}>
          <Ionicons name="flash" size={15} color={theme.colors.textPrimary} />
          <Text style={s.testBtnText}> Test deep link (opens app from background)</Text>
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
