// ─────────────────────────────────────────────────────────────────────────────
// screens/HomeScreen.tsx  —  Main screen of the app.
//
// LAYOUT (top to bottom):
//   • Topbar — app name + settings button
//   • Vehicle Detection Banner — shows CarPlay connection status; tapping it
//     opens the default/autoDetect checklist. Also contains the "Simulate"
//     button for testing.
//   • Ad banner — shown to free users only (placeholder for a real ad SDK)
//   • Checklists section — list of all user checklists with a ⋮ menu per row
//   • "New checklist" button — gated to 3 on the free plan
//   • Recent trips — last 3 trip logs
//   • Stats grid — trips this week + completion rate
//
// ⋮ MENU
// Each checklist row has an ellipsis button that opens an Alert with three
// options: Set/remove default (Pro-gated), Edit, Delete. The ⋮ button is
// rendered outside the main TouchableOpacity so the two touch targets don't
// interfere with each other.
//
// CONNECTIONS TO THE REST OF THE APP
//   useAppStore()       → reads checklists, logs, settings; writes defaultChecklistId
//   useCarDetection()   → mounts the deep-link listener; exposes simulate helpers
//   navigation.navigate → ChecklistRun / MultiStop / NewChecklist / Settings
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppStore } from '../store/useAppStore';
import { useCarDetection } from '../hooks/useCarDetection';
import { theme } from '../theme';
import { Checklist, RootStackParamList, ActiveRun } from '../types';
import { formatTimeAgo } from '../utils/time';

// Narrowing the navigation type to the 'Home' screen makes `navigation.navigate`
// type-safe: TypeScript knows which screens are reachable from here.
type Nav = NativeStackNavigationProp<RootStackParamList, 'Home'>;

export function HomeScreen() {
  const navigation = useNavigation<Nav>();
  const {
    checklists,
    tripLogs,
    settings,
    connectedToVehicle,
    deleteChecklist,
    setDefaultChecklist,
    duplicateChecklist,
    activeRuns,
    clearActiveRun,
  } = useAppStore();

  // Mounting useCarDetection here registers the deep-link listener for the
  // entire app session. The hook also exposes simulate helpers for the banner.
  const { simulateConnect, simulateDisconnect } = useCarDetection();

  // Derived stats — computed inline to avoid stale closure issues with useState.
  const recentLogs = tripLogs.slice(0, 3);
  const tripsThisWeek = tripLogs.filter(
    (l) => Date.now() - new Date(l.timestamp).getTime() < 7 * 86400000
  ).length;
  // Guard against dividing by zero when there are no logs yet.
  const completionRate =
    tripLogs.length > 0
      ? Math.round((tripLogs.filter((l) => l.isComplete).length / tripLogs.length) * 100)
      : 0;

  // In-progress runs to surface in the "continue where you left off" banner.
  // Filter out any run whose checklist no longer exists (defensive — deletes
  // already clear runs, but persisted data could theoretically drift), and show
  // the most-recently-touched first.
  const resumeRuns = activeRuns
    .filter((run) => checklists.some((c) => c.id === run.checklistId))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  // Navigates to the correct run screen based on whether the checklist is
  // multi-stop (MultiStopScreen) or regular (ChecklistRunScreen).
  // Multi-stop is Pro-only: free users who have a multi-stop checklist (created
  // while Pro, kept after downgrade) see an upsell alert instead.
  function onChecklistPress(id: string, isMultiStop: boolean) {
    if (isMultiStop && !settings.isPro) {
      Alert.alert(
        'Pro feature',
        'Multi-stop trips require Pro. Upgrade to run this checklist, or delete it from the ⋮ menu.',
        [
          { text: 'Not now', style: 'cancel' },
          { text: 'Upgrade', onPress: () => navigation.navigate('Pro') },
        ]
      );
      return;
    }
    navigation.navigate(isMultiStop ? 'MultiStop' : 'ChecklistRun', { checklistId: id });
  }

  // Enforces the free-plan 3-checklist limit before navigating to NewChecklist.
  function onNewChecklist() {
    if (!settings.isPro && checklists.length >= 3) {
      Alert.alert(
        'Checklist limit reached',
        'Free plan allows up to 3 checklists. Upgrade to Pro for unlimited.',
        [
          { text: 'Not now', style: 'cancel' },
          { text: 'Upgrade to Pro', onPress: () => navigation.navigate('Pro') },
        ]
      );
      return;
    }
    navigation.navigate('NewChecklist');
  }

  // Shows an action sheet for a given checklist row. The sheet has three
  // options: default toggle (Pro-gated), edit, and delete.
  function onChecklistMenu(cl: Checklist) {
    const isDefault = settings.defaultChecklistId === cl.id;

    Alert.alert(cl.name, undefined, [
      {
        // Label changes depending on current default state and Pro status.
        text: isDefault
          ? 'Remove as default'
          : settings.isPro
          ? 'Set as default'
          : 'Set as default (Pro)',
        onPress: () => {
          // Removing the default is always allowed (even on free plan after a downgrade).
          // Only gate the *setting* action behind Pro.
          if (!settings.isPro && !isDefault) {
            Alert.alert(
              'Pro feature',
              'Set a default checklist so the CarPlay notification opens it directly.',
              [
                { text: 'Not now', style: 'cancel' },
                { text: 'Upgrade', onPress: () => navigation.navigate('Pro') },
              ]
            );
            return;
          }
          // Toggle: if this checklist is already the default, clear it; otherwise set it.
          setDefaultChecklist(isDefault ? null : cl.id);
        },
      },
      {
        text: 'Edit',
        // Pass checklistId as a param — NewChecklistScreen uses it to enter edit mode.
        onPress: () => navigation.navigate('NewChecklist', { checklistId: cl.id }),
      },
      {
        text: settings.isPro ? 'Duplicate' : 'Duplicate (Pro)',
        onPress: () => {
          if (!settings.isPro) {
            Alert.alert(
              'Pro feature',
              'Upgrade to Pro to duplicate checklists.',
              [
                { text: 'Not now', style: 'cancel' },
                { text: 'Upgrade', onPress: () => navigation.navigate('Pro') },
              ]
            );
            return;
          }
          duplicateChecklist(cl.id);
        },
      },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          Alert.alert(
            'Delete checklist',
            `Delete "${cl.name}"? This cannot be undone.`,
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Delete',
                style: 'destructive',
                onPress: () => deleteChecklist(cl.id),
              },
            ]
          ),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  // Short progress summary shown under a checklist name in the resume banner.
  function resumeMeta(run: ActiveRun, cl: Checklist): string {
    if (cl.isMultiStop) {
      return `Stop ${run.stopIndex + 1} of ${cl.stops.length}`;
    }
    // Two-phase trips that have departed are awaiting their arrival items.
    if (run.startDone) return 'Departed · arrival items pending';
    // Otherwise count checked items across whichever lists this checklist has.
    const hasEnd = cl.endOfTripEnabled && cl.endItems.length > 0;
    const items = [...cl.startItems, ...(hasEnd ? cl.endItems : [])];
    const count = items.filter((it) => run.checked[it.id]).length;
    return `${count} item${count !== 1 ? 's' : ''} checked`;
  }

  // Confirm, then drop an in-progress run. The checklist itself is untouched.
  function discardResume(cl: Checklist) {
    Alert.alert(
      'Discard progress?',
      `Remove your in-progress run for "${cl.name}"? This won't delete the checklist.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: () => clearActiveRun(cl.id) },
      ]
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {/* ── Topbar ─────────────────────────────────────────────────────── */}
        <View style={s.topbar}>
          <MaterialCommunityIcons name="steering" size={22} color={theme.colors.primary} />
          <Text style={s.title}>CheckDrive</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Settings')} style={s.iconBtn}>
            <Ionicons name="settings-outline" size={20} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* ── Vehicle Detection Banner ────────────────────────────────────── */}
        {/* The banner's tap-to-run area is separate from the Simulate button so
            both touch targets function independently.                         */}
        <TouchableOpacity
          activeOpacity={0.8}
          style={[s.detectBanner, !connectedToVehicle && s.detectBannerOff]}
          onPress={() => {
            if (!connectedToVehicle) return;
            // Open the default checklist if one is set, otherwise the first
            // checklist that has autoDetect enabled.
            const cl =
              checklists.find((c) => c.id === settings.defaultChecklistId) ??
              checklists.find((c) => c.autoDetect);
            if (cl) onChecklistPress(cl.id, cl.isMultiStop);
          }}
        >
          <Ionicons
            name={connectedToVehicle ? 'wifi' : 'wifi-outline'}
            size={28}
            color={connectedToVehicle ? theme.colors.primaryDark : theme.colors.textTertiary}
          />
          <View style={{ flex: 1 }}>
            <Text style={[s.detectTitle, !connectedToVehicle && s.detectTitleOff]}>
              {connectedToVehicle ? 'CarPlay connected' : 'No car connected'}
            </Text>
            <Text style={[s.detectSub, !connectedToVehicle && s.detectSubOff]}>
              {connectedToVehicle
                ? settings.defaultChecklistId
                  ? `Opening: ${checklists.find(c => c.id === settings.defaultChecklistId)?.name ?? 'default'}`
                  : 'Tap to run your checklist'
                : 'Connect CarPlay or Android Auto'}
            </Text>
          </View>
          {/* Simulate button — toggles connectedToVehicle for testing */}
          <TouchableOpacity
            style={s.simBtn}
            onPress={connectedToVehicle ? simulateDisconnect : simulateConnect}
          >
            <Text style={s.simBtnText}>Simulate</Text>
          </TouchableOpacity>
        </TouchableOpacity>

        {/* Link to the setup guide for users who haven't configured Shortcuts yet */}
        <TouchableOpacity onPress={() => navigation.navigate('CarDetectionSetup')}>
          <Text style={s.setupLink}>
            <Ionicons name="information-circle-outline" size={13} /> Set up auto-detection →
          </Text>
        </TouchableOpacity>

        {/* ── Resume banner ───────────────────────────────────────────────── */}
        {/* In-progress runs the user can jump back into. Tapping a row reopens
            the run screen exactly where they left off; the ✕ discards it. */}
        {resumeRuns.length > 0 && (
          <>
            <Text style={s.sectionLabel}>Continue where you left off</Text>
            <View style={s.card}>
              {resumeRuns.map((run, idx) => {
                // Non-null: resumeRuns is already filtered to existing checklists.
                const cl = checklists.find((c) => c.id === run.checklistId)!;
                return (
                  <View
                    key={run.checklistId}
                    style={[s.clRow, idx < resumeRuns.length - 1 && s.clRowBorder]}
                  >
                    <TouchableOpacity
                      style={s.clMain}
                      onPress={() => onChecklistPress(cl.id, cl.isMultiStop)}
                      activeOpacity={0.7}
                    >
                      <View style={s.resumeIcon}>
                        <Ionicons name="play" size={14} color={theme.colors.primaryDeep} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.clName} numberOfLines={1}>{cl.name}</Text>
                        <Text style={s.clMeta}>{resumeMeta(run, cl)}</Text>
                      </View>
                    </TouchableOpacity>
                    {/* ✕ discard — its own touch target, outside the main row */}
                    <TouchableOpacity
                      style={s.menuBtn}
                      onPress={() => discardResume(cl)}
                      hitSlop={8}
                    >
                      <Ionicons name="close" size={18} color={theme.colors.textTertiary} />
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          </>
        )}

        {/* Ad placeholder — only shown to free users */}
        {!settings.isPro && (
          <View style={s.adBanner}>
            <Text style={s.adText}>Advertisement — upgrade to Pro to remove</Text>
          </View>
        )}

        {/* ── My checklists ───────────────────────────────────────────────── */}
        <Text style={s.sectionLabel}>My checklists</Text>
        {/* Slot counter — Pro users see unlimited, free users see X/3 */}
        {!settings.isPro && (
          <Text style={s.slotHint}>{checklists.length}/3 used on free plan</Text>
        )}

        <View style={s.card}>
          {checklists.map((cl, idx) => (
            <View
              key={cl.id}
              style={[s.clRow, idx < checklists.length - 1 && s.clRowBorder]}
            >
              {/* Left tappable area: icon + name + meta — navigates to the run screen */}
              <TouchableOpacity
                style={s.clMain}
                onPress={() => onChecklistPress(cl.id, cl.isMultiStop)}
                activeOpacity={0.7}
              >
                {/* Icon: either a custom photo (iconUri) or a preset Ionicons icon */}
                <View style={[s.clIcon, { backgroundColor: cl.iconUri ? '#fff' : cl.iconBg }]}>
                  {cl.iconUri ? (
                    <Image
                      source={{ uri: cl.iconUri }}
                      style={s.clIconImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <Ionicons name={cl.iconName as any} size={18} color={cl.iconColor} />
                  )}
                </View>

                <View style={{ flex: 1 }}>
                  {/* Name row with optional default-star badge (Pro feature) */}
                  <View style={s.clNameRow}>
                    <Text style={s.clName} numberOfLines={1}>{cl.name}</Text>
                    {settings.defaultChecklistId === cl.id && (
                      <Ionicons name="star" size={12} color={theme.colors.primary} />
                    )}
                  </View>
                  {/* Meta line differs for multi-stop vs regular checklists */}
                  <Text style={s.clMeta}>
                    {cl.isMultiStop
                      ? `${cl.stops.length} stops · ${cl.stops.reduce(
                          (a, st) => a + st.items.length,
                          0
                        )} items · Multi-stop`
                      : `${cl.startItems.length} start · ${cl.endItems.length} end · Auto ${
                          cl.autoDetect ? 'on' : 'off'
                        }`}
                  </Text>
                </View>
              </TouchableOpacity>

              {/* ⋮ button — deliberately outside the main TouchableOpacity so
                  it has its own independent touch target */}
              <TouchableOpacity
                style={s.menuBtn}
                onPress={() => onChecklistMenu(cl)}
                hitSlop={8}
              >
                <Ionicons name="ellipsis-vertical" size={17} color={theme.colors.textTertiary} />
              </TouchableOpacity>
            </View>
          ))}
        </View>

        <TouchableOpacity style={s.btn} onPress={onNewChecklist}>
          <Ionicons name="add" size={16} color={theme.colors.textPrimary} />
          <Text style={s.btnText}> New checklist</Text>
        </TouchableOpacity>

        {/* ── Recent trips ────────────────────────────────────────────────── */}
        <View style={s.sectionRow}>
          <Text style={s.sectionLabel}>Recent trips</Text>
          {settings.isPro && (
            <TouchableOpacity onPress={() => navigation.navigate('TripHistory')}>
              <Text style={s.viewAllLink}>View all →</Text>
            </TouchableOpacity>
          )}
        </View>
        <View style={s.card}>
          {recentLogs.length === 0 ? (
            <Text style={{ color: theme.colors.textSecondary, fontSize: 14 }}>
              No trips yet — start your first checklist!
            </Text>
          ) : (
            recentLogs.map((log, idx) => (
              <View
                key={log.id}
                style={[s.logRow, idx < recentLogs.length - 1 && s.logRowBorder]}
              >
                {/* Green dot = complete, red dot = incomplete */}
                <View
                  style={[
                    s.logDot,
                    { backgroundColor: log.isComplete ? theme.colors.primary : theme.colors.danger },
                  ]}
                />
                <Text style={s.logName}>{log.checklistName}</Text>
                <Text style={s.logMeta}>
                  {formatTimeAgo(log.timestamp)} · {log.checkedCount}/{log.totalCount}
                </Text>
              </View>
            ))
          )}
        </View>

        {/* ── Stats grid ──────────────────────────────────────────────────── */}
        <View style={s.statGrid}>
          <View style={s.statCard}>
            <Text style={s.statVal}>{tripsThisWeek}</Text>
            <Text style={s.statLabel}>Trips this week</Text>
          </View>
          <View style={s.statCard}>
            <Text style={[s.statVal, { color: theme.colors.primary }]}>{completionRate}%</Text>
            <Text style={s.statLabel}>Completion rate</Text>
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bgSecondary },
  scroll: { padding: 16, gap: 12 },
  topbar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingBottom: 4 },
  title: { flex: 1, fontSize: 18, fontWeight: '500', color: theme.colors.textPrimary },
  iconBtn: { padding: 6 },

  detectBanner: {
    backgroundColor: theme.colors.primaryLight,
    borderWidth: 0.5,
    borderColor: '#5DCAA5',
    borderRadius: theme.radius.lg,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  detectBannerOff: {
    backgroundColor: theme.colors.bgSecondary,
    borderColor: theme.colors.borderTertiary,
  },
  detectTitle: { fontSize: 14, fontWeight: '500', color: theme.colors.primaryDeep },
  detectTitleOff: { color: theme.colors.textSecondary },
  detectSub: { fontSize: 12, color: theme.colors.primaryDark, marginTop: 2 },
  detectSubOff: { color: theme.colors.textTertiary },
  simBtn: {
    backgroundColor: theme.colors.purple,
    borderRadius: theme.radius.md,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  simBtnText: { color: '#fff', fontSize: 12, fontWeight: '500' },
  setupLink: { fontSize: 12, color: theme.colors.textSecondary, textAlign: 'right', marginTop: -4 },

  adBanner: {
    backgroundColor: theme.colors.bgTertiary,
    borderWidth: 0.5,
    borderStyle: 'dashed',
    borderColor: theme.colors.borderSecondary,
    borderRadius: theme.radius.md,
    paddingVertical: 10,
    alignItems: 'center',
  },
  adText: { fontSize: 12, color: theme.colors.textTertiary },

  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingHorizontal: 2,
  },
  viewAllLink: { fontSize: 12, fontWeight: '500', color: theme.colors.purple },
  slotHint: { fontSize: 11, color: theme.colors.textTertiary, paddingHorizontal: 2, marginTop: -6 },

  card: {
    backgroundColor: theme.colors.bgPrimary,
    borderWidth: 0.5,
    borderColor: theme.colors.borderTertiary,
    borderRadius: theme.radius.lg,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },

  clRow: {
    flexDirection: 'row',
    alignItems: 'center',
    // Outer row provides the separator; inner clMain provides the real padding.
    paddingVertical: 2,
  },
  clRowBorder: { borderBottomWidth: 0.5, borderBottomColor: theme.colors.borderTertiary },
  clMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },

  clIcon: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden', // clips the custom photo image to the rounded rect
  },
  clIconImage: { width: 36, height: 36, borderRadius: theme.radius.md },
  // Small accented circle for the resume banner's play icon.
  resumeIcon: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clNameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  clName: { fontSize: 15, fontWeight: '500', color: theme.colors.textPrimary, flexShrink: 1 },
  clMeta: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },
  menuBtn: { paddingHorizontal: 6, paddingVertical: 10, marginLeft: 2 },

  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    borderRadius: theme.radius.md,
    borderWidth: 0.5,
    borderColor: theme.colors.borderSecondary,
    backgroundColor: theme.colors.bgPrimary,
  },
  btnText: { fontSize: 14, fontWeight: '500', color: theme.colors.textPrimary },

  logRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  logRowBorder: { borderBottomWidth: 0.5, borderBottomColor: theme.colors.borderTertiary },
  logDot: { width: 8, height: 8, borderRadius: 4 },
  logName: { flex: 1, fontSize: 13, fontWeight: '500', color: theme.colors.textPrimary },
  logMeta: { fontSize: 12, color: theme.colors.textSecondary },

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
});
