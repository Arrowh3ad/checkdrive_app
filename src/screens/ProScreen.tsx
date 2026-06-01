// ─────────────────────────────────────────────────────────────────────────────
// screens/ProScreen.tsx  —  Pro plan upgrade page.
//
// This screen presents the Pro feature list and a subscribe CTA. In production
// the subscribe flow would go through RevenueCat (iOS) or Google Play Billing
// (Android). For now, "Simulate Pro" sets `isPro: true` in the Zustand store
// so we can test all Pro-gated features without a real payment setup.
//
// NAVIGATION
// Reached from:
//   HomeScreen → free-plan "new checklist" limit alert
//   NewChecklistScreen → multi-stop or geofence Pro prompt
//   SettingsScreen → Pro upgrade banner
//   Various Alert dialogs throughout the app ("Upgrade" button)
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppStore } from '../store/useAppStore';
import { theme } from '../theme';

// Feature list rendered in the "What's included" card.
// TypeScript infers the type from the literal — no explicit annotation needed
// as long as every object has the same shape.
const FEATURES = [
  {
    title: 'Unlimited checklists',
    subtitle: 'Free plan limited to 3',
  },
  {
    title: 'Multi-stop trips',
    subtitle: 'Per-stop checklists for complex routes',
  },
  {
    title: 'Parking finder extras',
    subtitle: 'Photos, notes & history for your saved spots',
  },
  {
    title: 'No ads',
    subtitle: 'Clean, distraction-free experience',
  },
  {
    title: 'Trip history & analytics',
    subtitle: 'Full logs and completion trends',
  },
];

export function ProScreen() {
  const navigation = useNavigation();
  // We need `user` to gate the subscribe flow behind sign-in. An account is
  // required for Pro so the subscription stays tied to the user across
  // devices, app reinstalls, and platform changes.
  const { updateSettings, user } = useAppStore();

  function handleSubscribe() {
    // GUEST PATH: prompt to sign in before any payment flow. The auth screens
    // pop back here on success; the user can then tap subscribe again. We
    // don't auto-trigger the purchase post-login to avoid surprises.
    if (!user) {
      Alert.alert(
        'Sign in to continue',
        'Pro subscriptions are tied to your account so they follow you across devices. Create a free account (or sign in) to subscribe.',
        [
          { text: 'Not now', style: 'cancel' },
          { text: 'Sign in', onPress: () => (navigation as any).navigate('SignIn') },
        ]
      );
      return;
    }

    // SIGNED-IN PATH: in production this calls RevenueCat / Google Play Billing.
    Alert.alert(
      'Subscribe to Pro',
      'In production this opens the App Store / Google Play in-app purchase flow via RevenueCat or similar.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Simulate Pro',
          onPress: () => {
            // Flip the isPro flag so gated features unlock immediately.
            updateSettings({ isPro: true });
            Alert.alert('Welcome to Pro!', 'Pro features are now unlocked.', [
              { text: 'OK', onPress: () => navigation.goBack() },
            ]);
          },
        },
      ]
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {/* ── Topbar ─────────────────────────────────────────────────────── */}
        <View style={s.topbar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
            <Ionicons name="arrow-back" size={22} color={theme.colors.textSecondary} />
          </TouchableOpacity>
          <Text style={s.title}>CheckDrive Pro</Text>
        </View>

        {/* ── Hero card ────────────────────────────────────────────────────── */}
        {/* Two StyleSheet rules merged with array syntax: card + hero.
            `card` provides shared surface styling; `hero` adds centred layout
            and extra vertical padding specific to this block. */}
        <View style={[s.card, s.hero]}>
          <MaterialCommunityIcons name="crown" size={42} color={theme.colors.purple} />
          <Text style={s.heroTitle}>Go Pro</Text>
          <Text style={s.heroSub}>Everything you need, nothing you don't</Text>
        </View>

        {/* ── Feature list ─────────────────────────────────────────────────── */}
        {/* `f.title` used as the React list key because it's guaranteed unique
            in this static array. */}
        <View style={s.card}>
          {FEATURES.map((f, idx) => (
            <View
              key={f.title}
              style={[s.featureRow, idx < FEATURES.length - 1 && s.featureRowBorder]}
            >
              <Ionicons name="checkmark" size={18} color={theme.colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={s.featureTitle}>{f.title}</Text>
                <Text style={s.featureSub}>{f.subtitle}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* ── Primary CTA ──────────────────────────────────────────────────── */}
        <TouchableOpacity style={s.subscribeBtn} onPress={handleSubscribe}>
          <MaterialCommunityIcons name="crown" size={16} color="#fff" />
          <Text style={s.subscribeBtnText}> Start for $2.99/month</Text>
        </TouchableOpacity>

        <Text style={s.annualNote}>
          Also available: $24.99/year (save 30%) · Cancel anytime
        </Text>

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
  },
  // Additional styles for the hero block; merged with `card` at the render site.
  hero: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 6,
  },
  heroTitle: { fontSize: 20, fontWeight: '500', color: theme.colors.textPrimary },
  heroSub: { fontSize: 14, color: theme.colors.textSecondary },

  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 12,
  },
  featureRowBorder: {
    borderBottomWidth: 0.5,
    borderBottomColor: theme.colors.borderTertiary,
  },
  featureTitle: { fontSize: 14, fontWeight: '500', color: theme.colors.textPrimary },
  featureSub: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },

  subscribeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primary,
  },
  subscribeBtnText: { fontSize: 16, fontWeight: '500', color: '#fff' },
  annualNote: { textAlign: 'center', fontSize: 12, color: theme.colors.textTertiary },
});
