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
  const usedSlots = checklists.length;
  const maxSlots = settings.isPro ? '∞' : '3';

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        {/* Topbar */}
        <View style={s.topbar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
            <Ionicons name="arrow-back" size={22} color={theme.colors.textSecondary} />
          </TouchableOpacity>
          <Text style={s.title}>Settings</Text>
        </View>

        {/* Account */}
        <View style={s.card}>
          <Text style={s.cardLabel}>Account</Text>
          <View style={s.accountRow}>
            <View style={s.avatar}>
              <Text style={s.avatarText}>JD</Text>
            </View>
            <View>
              <Text style={s.accountName}>John Doe</Text>
              <Text style={s.accountMeta}>
                {settings.isPro ? 'Pro plan' : `Free plan · ${usedSlots}/${maxSlots} checklists`}
              </Text>
            </View>
          </View>
        </View>

        {/* Pro banner */}
        {!settings.isPro && (
          <View style={s.proBanner}>
            <View style={{ flex: 1 }}>
              <Text style={s.proTitle}>
                <MaterialCommunityIcons name="crown" size={13} /> Upgrade to Pro
              </Text>
              <Text style={s.proSub}>Unlimited lists · No ads · Geofencing</Text>
            </View>
            <TouchableOpacity
              style={s.proBtn}
              onPress={() => (navigation as any).navigate('Pro')}
            >
              <Text style={s.proBtnText}>$2.99/mo</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Preferences */}
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
            title="Trip streaks"
            subtitle="Track consecutive complete trips"
            value={settings.tripStreaks}
            onToggle={(v) => updateSettings({ tripStreaks: v })}
          />
        </View>

        {/* Car detection setup */}
        <TouchableOpacity
          style={s.card}
          onPress={() => (navigation as any).navigate('CarDetectionSetup')}
        >
          <View style={s.setupRow}>
            <View>
              <Text style={s.setupTitle}>Car detection setup</Text>
              <Text style={s.setupSub}>Configure Siri Shortcuts / Android automation</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={theme.colors.textTertiary} />
          </View>
        </TouchableOpacity>

        {/* Stats */}
        <View style={s.statGrid}>
          <View style={s.statCard}>
            <Text style={s.statVal}>{settings.totalTrips}</Text>
            <Text style={s.statLabel}>Total trips</Text>
          </View>
          <View style={s.statCard}>
            <Text style={s.statVal}>
              {settings.tripStreaks ? `🔥 ${settings.currentStreak}` : '—'}
            </Text>
            <Text style={s.statLabel}>Day streak</Text>
          </View>
        </View>

        {/* App version */}
        <Text style={s.version}>CheckDrive v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

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
