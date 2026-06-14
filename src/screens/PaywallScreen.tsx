// ─────────────────────────────────────────────────────────────────────────────
// screens/PaywallScreen.tsx  —  CheckDrive Pro (lifetime unlock).
//
// Minimal Pro: a one-time lifetime purchase that removes ads and the free
// checklist cap. Price/“lifetime” framing comes from the RevenueCat package
// (priceString is already localized), so we never hardcode a number.
//
// REVIEW REQUIREMENTS COVERED
//   • Clear description of what's unlocked and that it's a one-time purchase.
//   • Visible price (from the store product).
//   • Restore Purchases button (required).
//   • Terms / Privacy links (required on a purchase screen).
//
// When purchases aren't available (Expo Go, missing key, store offline) we show
// a graceful "unavailable" state instead of a dead button.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppStore } from '../store/useAppStore';
import {
  getProOffering,
  purchasePro,
  restorePurchases,
  purchasesAvailable,
  ProPackage,
} from '../purchases/purchases';
import { theme } from '../theme';

// Hosted via GitHub Pages from the separate public `checkdrive-legal` repo
// (keeps the app source private). Swap to a custom domain later if you get one.
const TERMS_URL = 'https://arrowh3ad.github.io/checkdrive-legal/terms.html';
const PRIVACY_URL = 'https://arrowh3ad.github.io/checkdrive-legal/privacy.html';

const PERKS = [
  { icon: 'infinite', title: 'Unlimited checklists', sub: 'Free plan is limited to 3' },
  { icon: 'remove-circle-outline', title: 'No ads', sub: 'A clean, distraction-free app' },
  { icon: 'star-outline', title: 'Default checklist', sub: 'Auto-open your go-to list when the car connects' },
  { icon: 'heart-outline', title: 'Support development', sub: 'A one-time thank-you' },
] as const;

export function PaywallScreen() {
  const navigation = useNavigation();
  const isPro = useAppStore((s) => s.settings.isPro);

  const [pkg, setPkg] = useState<ProPackage | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // Fetch the lifetime package on mount.
  useEffect(() => {
    let alive = true;
    (async () => {
      const p = await getProOffering();
      if (alive) {
        setPkg(p);
        setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // When the user is Pro we don't auto-close — we render an "active" confirmation
  // state (see below) so a purchase/restore gives clear feedback.

  async function handleBuy() {
    if (!pkg) return;
    setBusy(true);
    try {
      const ok = await purchasePro(pkg);
      if (!ok) {
        // false = user cancelled (purchasePro throws on real errors).
      }
    } catch (e: any) {
      Alert.alert('Purchase failed', e?.message ?? 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function handleRestore() {
    setBusy(true);
    try {
      const ok = await restorePurchases();
      if (!ok) {
        Alert.alert('Nothing to restore', 'We couldn’t find a previous CheckDrive Pro purchase on this account.');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        {/* Topbar */}
        <View style={s.topbar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
            <Ionicons name="close" size={24} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Hero */}
        <View style={s.hero}>
          <View style={s.crown}>
            <MaterialCommunityIcons name="crown" size={30} color={theme.colors.purple} />
          </View>
          <Text style={s.title}>CheckDrive Pro</Text>
          <Text style={s.subtitle}>A one-time unlock — yours forever, no subscription.</Text>
        </View>

        {/* Perks */}
        <View style={s.card}>
          {PERKS.map((p, i) => (
            <View key={p.title} style={[s.perkRow, i < PERKS.length - 1 && s.perkBorder]}>
              <View style={s.perkIcon}>
                <Ionicons name={p.icon as any} size={18} color={theme.colors.purple} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.perkTitle}>{p.title}</Text>
                <Text style={s.perkSub}>{p.sub}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Buy / states */}
        {isPro ? (
          // Already Pro — show a confirmation instead of the buy button. (A
          // lifetime unlock can't be re-bought, so no purchase UI here.)
          <View style={s.activeBox}>
            <Ionicons name="checkmark-circle" size={40} color={theme.colors.purple} />
            <Text style={s.activeTitle}>Pro is active</Text>
            <Text style={s.activeSub}>
              You have lifetime access — thank you for your support!
            </Text>
            <TouchableOpacity style={s.buyBtn} onPress={() => navigation.goBack()}>
              <Text style={s.buyBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        ) : loading ? (
          <ActivityIndicator style={{ marginTop: 20 }} color={theme.colors.purple} />
        ) : !purchasesAvailable || !pkg ? (
          <View style={s.unavailable}>
            <Text style={s.unavailableText}>
              Purchases aren’t available right now. Please check your connection and
              try again in a moment.
            </Text>
          </View>
        ) : (
          <>
            <TouchableOpacity style={s.buyBtn} onPress={handleBuy} disabled={busy}>
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={s.buyBtnText}>Unlock Pro · {pkg.priceString}</Text>
              )}
            </TouchableOpacity>
            <Text style={s.oneTime}>One-time payment · No recurring charges</Text>

            <TouchableOpacity onPress={handleRestore} disabled={busy} style={s.restoreBtn}>
              <Text style={s.restoreText}>Restore purchase</Text>
            </TouchableOpacity>
          </>
        )}

        {/* Legal — required on a purchase screen */}
        <View style={s.legalRow}>
          <TouchableOpacity onPress={() => Linking.openURL(TERMS_URL)}>
            <Text style={s.legalLink}>Terms</Text>
          </TouchableOpacity>
          <Text style={s.legalDot}>·</Text>
          <TouchableOpacity onPress={() => Linking.openURL(PRIVACY_URL)}>
            <Text style={s.legalLink}>Privacy Policy</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bgSecondary },
  scroll: { padding: 16, paddingBottom: 32 },
  topbar: { flexDirection: 'row', alignItems: 'center', paddingBottom: 4 },
  backBtn: { padding: 4 },

  hero: { alignItems: 'center', marginTop: 8, marginBottom: 24, gap: 8 },
  crown: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: theme.colors.purpleLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  title: { fontSize: 24, fontWeight: '600', color: theme.colors.textPrimary },
  subtitle: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 16,
  },

  card: {
    backgroundColor: theme.colors.bgPrimary,
    borderWidth: 0.5,
    borderColor: theme.colors.borderTertiary,
    borderRadius: theme.radius.lg,
    paddingHorizontal: 16,
  },
  perkRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14 },
  perkBorder: { borderBottomWidth: 0.5, borderBottomColor: theme.colors.borderTertiary },
  perkIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: theme.colors.purpleLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  perkTitle: { fontSize: 15, fontWeight: '500', color: theme.colors.textPrimary },
  perkSub: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },

  buyBtn: {
    backgroundColor: theme.colors.purple,
    borderRadius: theme.radius.md,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    minHeight: 54,
  },
  buyBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  oneTime: { fontSize: 12, color: theme.colors.textTertiary, textAlign: 'center', marginTop: 8 },

  restoreBtn: { alignItems: 'center', paddingVertical: 14, marginTop: 4 },
  restoreText: { fontSize: 14, color: theme.colors.purple, fontWeight: '500' },

  unavailable: {
    backgroundColor: theme.colors.bgPrimary,
    borderWidth: 0.5,
    borderColor: theme.colors.borderTertiary,
    borderRadius: theme.radius.md,
    padding: 16,
    marginTop: 20,
  },
  unavailableText: { fontSize: 13, color: theme.colors.textSecondary, lineHeight: 19, textAlign: 'center' },

  activeBox: { alignItems: 'center', marginTop: 24, gap: 8 },
  activeTitle: { fontSize: 18, fontWeight: '600', color: theme.colors.textPrimary, marginTop: 4 },
  activeSub: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 16,
    marginBottom: 8,
  },

  legalRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 24 },
  legalLink: { fontSize: 12, color: theme.colors.textTertiary, textDecorationLine: 'underline' },
  legalDot: { fontSize: 12, color: theme.colors.textTertiary },
});
