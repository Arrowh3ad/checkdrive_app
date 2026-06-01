// ─────────────────────────────────────────────────────────────────────────────
// screens/SettingsScreen.tsx  —  User preferences and account management.
//
// SECTIONS
//   • Account card — avatar, name, plan badge
//   • Pro upgrade banner (free users) OR manage-subscription row (Pro users)
//   • Preferences — push notifications, BT auto-detect, trip streaks
//   • Car detection setup — link to the Shortcuts setup guide
//   • Stats grid — total trips + day streak
//   • Version footer
//
// SIMULATE DOWNGRADE
// The "Manage Subscription" dialog includes a "Simulate Downgrade" button that
// calls `downgradeFromPro()`. This trims checklists to 3 and clears Pro-only
// state so we can test the downgrade path without a real payment provider.
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
  StyleSheet,
  Alert,
  Platform,
  PermissionsAndroid,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppStore } from '../store/useAppStore';
import { signOutUser } from '../services/firebase';
import { theme } from '../theme';

export function SettingsScreen() {
  const navigation = useNavigation();
  const { settings, updateSettings, checklists, downgradeFromPro, user } = useAppStore();
  const usedSlots = checklists.length;
  // Pro users see "∞"; free users see the numeric cap.
  const maxSlots = settings.isPro ? '∞' : '3';

  // Derive the avatar text. Use the first two chars of the email local-part,
  // uppercased. Guests get a generic person glyph instead of letters.
  const initials = user?.email
    ? user.email.split('@')[0].slice(0, 2).toUpperCase()
    : null;

  // Enabling the parking finder needs location permission (foreground is
  // enough — capture happens via a foreground service). Android-only.
  async function handleParkingToggle(v: boolean) {
    if (!v) {
      updateSettings({ parkingFinderEnabled: false });
      return;
    }
    try {
      const res = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
      );
      if (res === PermissionsAndroid.RESULTS.GRANTED) {
        updateSettings({ parkingFinderEnabled: true });
      } else {
        Alert.alert(
          'Location needed',
          'Parking finder needs location permission to save where you parked. ' +
            'You can enable it in Settings → Apps → CheckDrive → Permissions.'
        );
      }
    } catch {
      Alert.alert('Something went wrong', 'Could not request location permission.');
    }
  }

  function handleSignOut() {
    Alert.alert(
      'Sign out?',
      'You can sign back in any time. Your local checklists stay on this device.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign out',
          style: 'destructive',
          // signOutUser triggers the auth listener which clears `user` in the
          // store; the account card re-renders into its guest state.
          onPress: () => { void signOutUser(); },
        },
      ]
    );
  }

  function handleManageSubscription() {
    // In production this would open the OS's subscription management flow
    // (StoreKit on iOS, Google Play Billing on Android). "Simulate Downgrade"
    // lets us test gated-feature removal during development.
    Alert.alert(
      'Manage Subscription',
      'In production this opens the App Store / Google Play subscription management page.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Simulate Downgrade',
          style: 'destructive',
          onPress: () => {
            downgradeFromPro();
            Alert.alert(
              'Downgraded to free',
              'You are now on the free plan. Checklists beyond 3 have been removed.'
            );
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
          <Text style={s.title}>Settings</Text>
        </View>

        {/* ── Account card ─────────────────────────────────────────────────── */}
        {/* Two states: signed in (show email + sign-out row) vs guest (show a
            "Sign in" CTA). The Sign In screen is also where new users sign up. */}
        <View style={s.card}>
          <Text style={s.cardLabel}>Account</Text>
          <View style={s.accountRow}>
            <View style={s.avatar}>
              {initials ? (
                <Text style={s.avatarText}>{initials}</Text>
              ) : (
                <Ionicons name="person-outline" size={20} color={theme.colors.primaryDeep} />
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.accountName} numberOfLines={1}>
                {user?.email ?? 'Guest'}
              </Text>
              <Text style={s.accountMeta}>
                {settings.isPro
                  ? 'Pro plan · Unlimited checklists'
                  : `Free plan · ${usedSlots}/${maxSlots} checklists`}
              </Text>
            </View>
          </View>

          {/* Honest expectation-setting: data + Pro are local to this device. */}
          <Text style={s.syncNote}>
            Checklists, settings, and Pro are stored on this device — cross-device sync isn't
            available yet.
          </Text>

          {/* Guest CTA: prompts sign-in. No account is required to use the app —
              this is just where users go to enable Pro / cross-device sync. */}
          {!user && (
            <TouchableOpacity
              style={s.accountCta}
              onPress={() => (navigation as any).navigate('SignIn')}
            >
              <Ionicons name="log-in-outline" size={16} color={theme.colors.primary} />
              <Text style={s.accountCtaText}>Sign in or create account</Text>
              <Ionicons
                name="chevron-forward"
                size={14}
                color={theme.colors.textTertiary}
                style={{ marginLeft: 'auto' }}
              />
            </TouchableOpacity>
          )}

          {/* Signed-in: offer sign-out. Destructive-style alert confirms. */}
          {user && (
            <TouchableOpacity style={s.accountCta} onPress={handleSignOut}>
              <Ionicons name="log-out-outline" size={16} color={theme.colors.danger} />
              <Text style={[s.accountCtaText, { color: theme.colors.danger }]}>Sign out</Text>
              <Ionicons
                name="chevron-forward"
                size={14}
                color={theme.colors.textTertiary}
                style={{ marginLeft: 'auto' }}
              />
            </TouchableOpacity>
          )}
        </View>

        {/* ── Pro upgrade banner (free users only) ─────────────────────────── */}
        {!settings.isPro && (
          <View style={s.proBanner}>
            <View style={{ flex: 1 }}>
              <Text style={s.proTitle}>
                <MaterialCommunityIcons name="crown" size={13} /> Upgrade to Pro
              </Text>
              <Text style={s.proSub}>Unlimited lists · No ads · Multi-stop · Parking extras</Text>
            </View>
            <TouchableOpacity
              style={s.proBtn}
              onPress={() => (navigation as any).navigate('Pro')}
            >
              <Text style={s.proBtnText}>$2.99/mo</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Subscription management (Pro users only) ─────────────────────── */}
        {settings.isPro && (
          <TouchableOpacity style={s.card} onPress={handleManageSubscription}>
            <View style={s.setupRow}>
              <View>
                <Text style={s.setupTitle}>
                  <MaterialCommunityIcons name="crown" size={14} color={theme.colors.purple} />{' '}
                  Manage subscription
                </Text>
                <Text style={s.setupSub}>Cancel or change your Pro plan</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={theme.colors.textTertiary} />
            </View>
          </TouchableOpacity>
        )}

        {/* ── Preferences ──────────────────────────────────────────────────── */}
        {/* Each toggle writes directly to the Zustand store via updateSettings() */}
        <View style={s.card}>
          <Text style={s.cardLabel}>Preferences</Text>
          <ToggleRow
            title="Push notifications"
            subtitle="Alert when car detected"
            value={settings.pushNotifications}
            onToggle={(v) => updateSettings({ pushNotifications: v })}
          />
          <View style={s.divider} />
          <ToggleRow
            title="Bluetooth auto-detect"
            subtitle="Detect car Bluetooth as trigger"
            value={settings.bluetoothAutoDetect}
            onToggle={(v) => updateSettings({ bluetoothAutoDetect: v })}
          />
          <View style={s.divider} />
          <ToggleRow
            title="Open app on connect"
            subtitle={
              settings.isPro
                ? 'Open your default checklist, not just a notification'
                : 'Open the app on connect, not just a notification'
            }
            value={settings.openChecklistOnConnect}
            onToggle={(v) => updateSettings({ openChecklistOnConnect: v })}
          />
          {Platform.OS === 'android' && (
            <>
              <View style={s.divider} />
              <ToggleRow
                title="Parking finder"
                subtitle="Save where you parked when the car disconnects"
                value={settings.parkingFinderEnabled}
                onToggle={handleParkingToggle}
              />
            </>
          )}
          <View style={s.divider} />
          <ToggleRow
            title="Trip streaks"
            subtitle="Track consecutive complete trips"
            value={settings.tripStreaks}
            onToggle={(v) => updateSettings({ tripStreaks: v })}
          />
        </View>


        {/* ── Car detection setup ──────────────────────────────────────────── */}
        <TouchableOpacity
          style={s.card}
          onPress={() => (navigation as any).navigate('CarDetectionSetup')}
        >
          <View style={s.setupRow}>
            <View>
              <Text style={s.setupTitle}>Car detection setup</Text>
              <Text style={s.setupSub}>Configure iOS Shortcuts / Android automation</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={theme.colors.textTertiary} />
          </View>
        </TouchableOpacity>

        {/* ── Stats grid ───────────────────────────────────────────────────── */}
        <View style={s.statGrid}>
          <View style={s.statCard}>
            <Text style={s.statVal}>{settings.totalTrips}</Text>
            <Text style={s.statLabel}>Total trips</Text>
          </View>
          <View style={s.statCard}>
            {/* Show a flame emoji when streaks are enabled; "—" otherwise */}
            <Text style={s.statVal}>
              {settings.tripStreaks ? `🔥 ${settings.currentStreak}` : '—'}
            </Text>
            <Text style={s.statLabel}>Day streak</Text>
          </View>
        </View>

        <Text style={s.version}>CheckDrive v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Sub-component ─────────────────────────────────────────────────────────────
// Extracted to avoid repeating the row layout and text styles for each toggle.

function ToggleRow({
  title,
  subtitle,
  value,
  onToggle,
}: {
  title: string;
  subtitle: string;
  value: boolean;
  onToggle: (v: boolean) => void;
}) {
  return (
    <View style={t.row}>
      <Switch
        value={value}
        onValueChange={onToggle}
        // `trackColor` sets the off-state and on-state track colors separately.
        trackColor={{ false: theme.colors.borderSecondary, true: theme.colors.primary }}
        thumbColor="#fff"
      />
      <View style={{ flex: 1 }}>
        <Text style={t.rowTitle}>{title}</Text>
        <Text style={t.rowSub}>{subtitle}</Text>
      </View>
    </View>
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
    gap: 10,
  },
  cardLabel: { fontSize: 13, fontWeight: '500', color: theme.colors.textSecondary },
  divider: { height: 0.5, backgroundColor: theme.colors.borderTertiary },

  accountRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  accountCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 4,
    marginTop: 4,
    borderTopWidth: 0.5,
    borderTopColor: theme.colors.borderTertiary,
  },
  accountCtaText: { fontSize: 14, fontWeight: '500', color: theme.colors.primary },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 14, fontWeight: '500', color: theme.colors.primaryDeep },
  accountName: { fontSize: 15, fontWeight: '500', color: theme.colors.textPrimary },
  accountMeta: { fontSize: 12, color: theme.colors.textSecondary },
  syncNote: {
    fontSize: 12,
    color: theme.colors.textTertiary,
    lineHeight: 16,
    marginTop: 2,
  },

  proBanner: {
    backgroundColor: theme.colors.purpleLight,
    borderWidth: 0.5,
    borderColor: theme.colors.purpleBorder,
    borderRadius: theme.radius.lg,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  proTitle: { fontSize: 14, fontWeight: '500', color: theme.colors.purpleDark },
  proSub: { fontSize: 12, color: theme.colors.purple, marginTop: 2 },
  proBtn: {
    backgroundColor: theme.colors.purple,
    borderRadius: theme.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  proBtnText: { color: '#fff', fontSize: 13, fontWeight: '500' },

  setupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  setupTitle: { fontSize: 15, fontWeight: '500', color: theme.colors.textPrimary },
  setupSub: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },

  statGrid: { flexDirection: 'row', gap: 8 },
  statCard: {
    flex: 1,
    backgroundColor: theme.colors.bgSecondary,
    borderRadius: theme.radius.md,
    padding: 12,
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: theme.colors.borderTertiary,
  },
  statVal: { fontSize: 22, fontWeight: '500', color: theme.colors.textPrimary },
  statLabel: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },
  version: { textAlign: 'center', fontSize: 12, color: theme.colors.textTertiary },
});

const t = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 2 },
  rowTitle: { fontSize: 14, fontWeight: '500', color: theme.colors.textPrimary },
  rowSub: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },
});
