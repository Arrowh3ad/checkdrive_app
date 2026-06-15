// ─────────────────────────────────────────────────────────────────────────────
// screens/SettingsScreen.tsx  —  User preferences and account management.
//
// SECTIONS
//   • Pro upgrade banner (free users) OR Pro-active status (Pro users)
//   • Preferences — push notifications, BT auto-detect, open-on-connect, streaks
//   • Car detection setup — link to the setup guide
//   • Stats grid — total trips + day streak
//   • Version footer
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppStore } from '../store/useAppStore';
import { theme } from '../theme';

export function SettingsScreen() {
  const navigation = useNavigation();
  const { settings, updateSettings, checklists } = useAppStore();

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

        {/* ── Pro banner / status ──────────────────────────────────────────── */}
        {settings.isPro ? (
          // Tappable so Pro users can still reach the Pro screen (it shows an
          // "active" state). Without this there's no way back into the paywall.
          <TouchableOpacity
            style={s.proActive}
            onPress={() => (navigation as any).navigate('Paywall')}
          >
            <MaterialCommunityIcons name="crown" size={18} color={theme.colors.purple} />
            <View style={{ flex: 1 }}>
              <Text style={s.proActiveTitle}>CheckDrive Pro</Text>
              <Text style={s.proActiveSub}>Unlimited checklists · No ads · Thank you!</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={theme.colors.textTertiary} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={s.proBanner}
            onPress={() => (navigation as any).navigate('Paywall')}
          >
            <View style={{ flex: 1 }}>
              <Text style={s.proTitle}>
                <MaterialCommunityIcons name="crown" size={13} /> Unlock CheckDrive Pro
              </Text>
              <Text style={s.proSub}>Unlimited checklists · No ads · One-time purchase</Text>
            </View>
            <View style={s.proBtn}>
              <Text style={s.proBtnText}>View</Text>
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
            subtitle="Open the app on connect, not just a notification"
            value={settings.openChecklistOnConnect}
            onToggle={(v) => updateSettings({ openChecklistOnConnect: v })}
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
            <Text style={s.statVal}>{checklists.length}</Text>
            <Text style={s.statLabel}>Checklists</Text>
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

  proActive: {
    backgroundColor: theme.colors.purpleLight,
    borderWidth: 0.5,
    borderColor: theme.colors.purpleBorder,
    borderRadius: theme.radius.lg,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  proActiveTitle: { fontSize: 14, fontWeight: '600', color: theme.colors.purpleDark },
  proActiveSub: { fontSize: 12, color: theme.colors.purple, marginTop: 2 },

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
