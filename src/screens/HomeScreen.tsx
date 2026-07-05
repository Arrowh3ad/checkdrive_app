// ─────────────────────────────────────────────────────────────────────────────
// screens/HomeScreen.tsx  -  Main screen of the app.
//
// LAYOUT (top to bottom):
//   • Topbar - app name + settings button
//   • Vehicle Detection Banner - shows connection status; tapping it opens the
//     default checklist (or the first one when no default is set).
//   • Checklists section - list of all user checklists with a ⋮ menu per row
//   • "New checklist" button - gated to 3 on the free plan
//   • Recent trips - last 3 trip logs
//   • Stats grid - trips this week + completion rate
//
// ⋮ MENU
// Each checklist row has an ellipsis button that opens a bottom-sheet Modal
// with options: Set/remove default, Edit, Duplicate, Delete, and Cancel. We
// use a custom Modal rather than Alert.alert because Android's native dialog
// caps at three buttons and silently drops the rest (including Cancel), so an
// Alert-based menu leaves Android users with no way to back out. The ⋮ button
// is rendered outside the main TouchableOpacity so the two touch targets don't
// interfere with each other.
//
// CONNECTIONS TO THE REST OF THE APP
//   useAppStore()       → reads checklists, logs, settings; writes defaultChecklistId
//   useCarDetection()   → mounts the deep-link listener; exposes simulate helpers
//   navigation.navigate → ChecklistRun / MultiStop / NewChecklist / Settings
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Image,
  Modal,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { resolveIconUri } from '../utils/icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppStore } from '../store/useAppStore';
import { useCarDetection } from '../hooks/useCarDetection';
import { AdBanner } from '../ads/AdBanner';
import { FREE_CHECKLIST_LIMIT } from '../constants';
import { theme } from '../theme';
import { Checklist, RootStackParamList, ActiveRun } from '../types';
import { formatTimeAgo } from '../utils/time';
import { computeStreak } from '../utils/streaks';
import { Onboarding } from './Onboarding';

// Narrowing the navigation type to the 'Home' screen makes `navigation.navigate`
// type-safe: TypeScript knows which screens are reachable from here.
type Nav = NativeStackNavigationProp<RootStackParamList, 'Home'>;

export function HomeScreen() {
  const navigation = useNavigation<Nav>();
  const {
    checklists,
    tripLogs,
    settings,
    deleteChecklist,
    setDefaultChecklist,
    duplicateChecklist,
    activeRuns,
    clearActiveRun,
    updateSettings,
  } = useAppStore();

  // First-run welcome sheet: shown until dismissed (persisted flag).
  const dismissOnboarding = () => updateSettings({ onboardingSeen: true });

  // Mounting useCarDetection here registers the deep-link + native car-event
  // listeners for the entire app session.
  useCarDetection();

  // The checklist whose ⋮ menu is open, or null when the sheet is closed.
  const [menuTarget, setMenuTarget] = useState<Checklist | null>(null);

  // Derived stats - computed inline to avoid stale closure issues with useState.
  const recentLogs = tripLogs.slice(0, 3);
  const tripsThisWeek = tripLogs.filter(
    (l) => Date.now() - new Date(l.timestamp).getTime() < 7 * 86400000
  ).length;
  // Guard against dividing by zero when there are no logs yet.
  const completionRate =
    tripLogs.length > 0
      ? Math.round((tripLogs.filter((l) => l.isComplete).length / tripLogs.length) * 100)
      : 0;
  // Consecutive-day streak, derived from the logs (see utils/streaks.ts).
  const streak = computeStreak(tripLogs.map((l) => l.timestamp));

  // In-progress runs to surface in the "continue where you left off" banner.
  // Filter out any run whose checklist no longer exists (defensive - deletes
  // already clear runs, but persisted data could theoretically drift), and show
  // the most-recently-touched first.
  const resumeRuns = activeRuns
    .filter((run) => checklists.some((c) => c.id === run.checklistId))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  // Navigates to the correct run screen based on whether the checklist is
  // multi-stop (MultiStopScreen) or regular (ChecklistRunScreen).
  function onChecklistPress(id: string, isMultiStop: boolean) {
    navigation.navigate(isMultiStop ? 'MultiStop' : 'ChecklistRun', { checklistId: id });
  }

  // Opens the new-checklist editor, enforcing the free-tier cap. Free users get
  // FREE_CHECKLIST_LIMIT lists; beyond that we route to the paywall. Pro is
  // unlimited. Existing lists are never touched - this only gates *creation*.
  function onNewChecklist() {
    if (!settings.isPro && checklists.length >= FREE_CHECKLIST_LIMIT) {
      Alert.alert(
        'Checklist limit reached',
        `The free plan includes up to ${FREE_CHECKLIST_LIMIT} checklists. Unlock CheckDrive Pro for unlimited checklists and no ads.`,
        [
          { text: 'Not now', style: 'cancel' },
          { text: 'See Pro', onPress: () => navigation.navigate('Paywall') },
        ]
      );
      return;
    }
    navigation.navigate('NewChecklist');
  }

  // Opens the bottom-sheet menu for a checklist row (see the ⋮ MENU note up top
  // for why this is a Modal and not Alert.alert).
  function onChecklistMenu(cl: Checklist) {
    setMenuTarget(cl);
  }

  // Runs a menu action, closing the sheet first so the action's own UI (e.g.
  // navigation, or the delete-confirm Alert) isn't stacked under the modal.
  function runMenuAction(action: () => void) {
    setMenuTarget(null);
    action();
  }

  // Delete confirmation. Two buttons only, so Alert.alert is safe on Android here.
  function confirmDeleteChecklist(cl: Checklist) {
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
    );
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

        {/* Link to the car-detection setup guide. (The old "car connected"
            status banner was removed - it relied on an iOS connect/disconnect
            signal that can't be detected reliably, so it went stale. The resume
            banner below covers in-progress checklists from real app state.) */}
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
                    {/* ✕ discard - its own touch target, outside the main row */}
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

        {/* The real ad banner is the anchored <AdBanner /> at the bottom of the
            screen - no inline placeholder here. */}

        {/* ── My checklists ───────────────────────────────────────────────── */}
        <Text style={s.sectionLabel}>My checklists</Text>
        {/* Slot counter - Pro users see unlimited, free users see X/3 */}
        {!settings.isPro && (
          <Text style={s.slotHint}>{checklists.length}/3 used on free plan</Text>
        )}

        <View style={s.card}>
          {checklists.map((cl, idx) => (
            <View
              key={cl.id}
              style={[s.clRow, idx < checklists.length - 1 && s.clRowBorder]}
            >
              {/* Left tappable area: icon + name + meta - navigates to the run screen */}
              <TouchableOpacity
                style={s.clMain}
                onPress={() => onChecklistPress(cl.id, cl.isMultiStop)}
                activeOpacity={0.7}
              >
                {/* Icon: either a custom photo (iconUri) or a preset Ionicons icon */}
                <View style={[s.clIcon, { backgroundColor: cl.iconUri ? '#fff' : cl.iconBg }]}>
                  {cl.iconUri ? (
                    <Image
                      source={{ uri: resolveIconUri(cl.iconUri) }}
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
                      : cl.endOfTripEnabled && cl.endItems.length > 0
                        ? `${cl.startItems.length} start · ${cl.endItems.length} end`
                        : `${cl.startItems.length} item${cl.startItems.length !== 1 ? 's' : ''}`}
                  </Text>
                </View>
              </TouchableOpacity>

              {/* ⋮ button - deliberately outside the main TouchableOpacity so
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
          {tripLogs.length > 0 && (
            <TouchableOpacity onPress={() => navigation.navigate('TripHistory')}>
              <Text style={s.viewAllLink}>View all →</Text>
            </TouchableOpacity>
          )}
        </View>
        <View style={s.card}>
          {recentLogs.length === 0 ? (
            <Text style={{ color: theme.colors.textSecondary, fontSize: 14 }}>
              No trips yet - start your first checklist!
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
          {/* Streak card - the "reason to come back" a plain checklist lacks.
              Flame lights up while a streak is alive; label shows the personal
              best once there is one worth beating. */}
          <View style={s.statCard}>
            <View style={s.statValRow}>
              {streak.current > 0 && (
                <Ionicons name="flame" size={18} color={theme.colors.warning} />
              )}
              <Text style={s.statVal}>{streak.current}</Text>
            </View>
            <Text style={s.statLabel}>
              {streak.best > streak.current ? `Streak · best ${streak.best}` : 'Day streak'}
            </Text>
          </View>
        </View>

      </ScrollView>

      {/* Anchored banner ad - self-gates (hidden for Pro, on iOS, while driving,
          and in Expo Go). Sits below the scroll content, above the safe area. */}
      <AdBanner />

      {/* ── Checklist ⋮ menu (bottom sheet) ──────────────────────────────────
          Custom Modal instead of Alert.alert: Android's native dialog caps at
          three buttons, which would silently drop options (including Cancel).
          Tapping the backdrop or Cancel dismisses on both platforms. */}
      <Modal
        visible={menuTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuTarget(null)}
      >
        <Pressable style={s.menuBackdrop} onPress={() => setMenuTarget(null)}>
          {/* Stop propagation so taps on the sheet itself don't close it. */}
          <Pressable style={s.menuSheet} onPress={() => {}}>
            {menuTarget && (
              <>
                <Text style={s.menuTitle} numberOfLines={1}>{menuTarget.name}</Text>

                <TouchableOpacity
                  style={s.menuItem}
                  onPress={() => {
                    // Setting a default is free now - it just marks the list and
                    // ties car connect/disconnect reminders to it. (Pro layers on
                    // auto-opening it via the "open on connect" setting.) Toggle:
                    // tapping the current default clears it.
                    const isDefault = settings.defaultChecklistId === menuTarget.id;
                    runMenuAction(() => setDefaultChecklist(isDefault ? null : menuTarget.id));
                  }}
                >
                  <Ionicons
                    name={settings.defaultChecklistId === menuTarget.id ? 'star-outline' : 'star'}
                    size={18}
                    color={theme.colors.textSecondary}
                  />
                  <Text style={s.menuItemText}>
                    {settings.defaultChecklistId === menuTarget.id
                      ? 'Remove as default'
                      : 'Set as default'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={s.menuItem}
                  onPress={() =>
                    runMenuAction(() =>
                      navigation.navigate('NewChecklist', { checklistId: menuTarget.id })
                    )
                  }
                >
                  <Ionicons name="create-outline" size={18} color={theme.colors.textSecondary} />
                  <Text style={s.menuItemText}>Edit</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={s.menuItem}
                  onPress={() => runMenuAction(() => duplicateChecklist(menuTarget.id))}
                >
                  <Ionicons name="copy-outline" size={18} color={theme.colors.textSecondary} />
                  <Text style={s.menuItemText}>Duplicate</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={s.menuItem}
                  onPress={() => runMenuAction(() => confirmDeleteChecklist(menuTarget))}
                >
                  <Ionicons name="trash-outline" size={18} color={theme.colors.danger} />
                  <Text style={[s.menuItemText, { color: theme.colors.danger }]}>Delete</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[s.menuItem, s.menuCancel]}
                  onPress={() => setMenuTarget(null)}
                >
                  <Text style={[s.menuItemText, s.menuCancelText]}>Cancel</Text>
                </TouchableOpacity>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* First-run swipeable intro - addresses "hard to know what to do at the
          start". Shown once (persisted onboardingSeen flag). */}
      <Onboarding
        visible={!settings.onboardingSeen}
        onDone={(setup) => {
          dismissOnboarding();
          if (setup) navigation.navigate('CarDetectionSetup');
        }}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bgSecondary },
  scroll: { padding: 16, gap: 12 },
  topbar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingBottom: 4 },
  title: { flex: 1, fontSize: 18, fontWeight: '500', color: theme.colors.textPrimary },
  iconBtn: { padding: 6 },

  simBtn: {
    backgroundColor: theme.colors.purple,
    borderRadius: theme.radius.md,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  simBtnText: { color: '#fff', fontSize: 12, fontWeight: '500' },
  setupLink: { fontSize: 12, color: theme.colors.textSecondary, textAlign: 'right', marginTop: -4 },

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
  statValRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  statLabel: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },

  // ── ⋮ menu (bottom sheet) ───────────────────────────────────────────────
  menuBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  menuSheet: {
    backgroundColor: theme.colors.bgPrimary,
    borderTopLeftRadius: theme.radius.lg,
    borderTopRightRadius: theme.radius.lg,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.xxl,
  },
  menuTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: theme.spacing.sm,
    paddingHorizontal: 2,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderTopWidth: 0.5,
    borderTopColor: theme.colors.borderTertiary,
  },
  menuItemText: { fontSize: 16, color: theme.colors.textPrimary },
  menuCancel: { justifyContent: 'center', marginTop: theme.spacing.sm, borderTopWidth: 0 },
  menuCancelText: { color: theme.colors.textSecondary, fontWeight: '500' },
});
