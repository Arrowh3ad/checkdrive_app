// ─────────────────────────────────────────────────────────────────────────────
// screens/MultiStopScreen.tsx  —  Active run screen for multi-stop trips.
//
// This screen handles checklists where `isMultiStop === true`. For single-phase
// checklists, see ChecklistRunScreen.
//
// HOW MULTI-STOP WORKS
//   1. The user opens this screen (from HomeScreen, the resume banner, or a
//      push notification).
//   2. On mount, an ActiveRun is created in the store (if one doesn't already
//      exist) so useCarDetection can see the trip and the Home banner can show
//      it. The run holds stopIndex + per-stop checked items.
//   3. When the user reconnects CarPlay mid-trip (e.g. at a rest stop),
//      useCarDetection shows an Alert asking "Arrived at next stop?". If the
//      user taps Continue, `advanceActiveRunStop()` bumps the run's stopIndex
//      in the store; this screen, subscribed to `activeRuns`, re-renders onto
//      the new stop automatically.
//   4. The user can also advance manually by tapping "Continue to next stop".
//   5. On the last stop, the button becomes "Complete trip", which writes a
//      TripLog, clears the run, and pops the screen.
//
// SINGLE SOURCE OF TRUTH (the ActiveRun)
//   This screen keeps NO local checkbox state. Everything — the current stop
//   index and which items are checked on each stop — lives in the persisted
//   ActiveRun. Every tap calls `saveActiveRun`, so progress is auto-saved and
//   surviving back-navigation, app restarts, and external CarPlay advances all
//   come for free. `stopChecked` is keyed by stop index, so undo/redo across
//   stops never loses earlier checkmarks.
//
// NAVIGATION
// Reached from:
//   HomeScreen (tap a multi-stop checklist row, or the resume banner)
//   App.tsx notification listener (notification with `isMultiStop: true`)
// Params: `{ checklistId: string }`.
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
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore } from '../store/useAppStore';
import { maybeRequestReview } from '../reviews/appReview';
import { theme } from '../theme';
import { RootStackParamList, Stop, TripLogItem, ActiveRun } from '../types';

type Route = RouteProp<RootStackParamList, 'MultiStop'>;

export function MultiStopScreen() {
  const navigation = useNavigation();
  const { params } = useRoute<Route>();
  const {
    checklists,
    addTripLog,
    activeRuns,
    saveActiveRun,
    clearActiveRun,
  } = useAppStore();

  const checklist = checklists.find((c) => c.id === params.checklistId);

  // Where a brand-new run should start, before any ActiveRun exists. We use the
  // checklist's own `status === 'current'` marker as the ground truth.
  const effectiveInitialIdx = Math.max(
    0,
    checklist?.stops.findIndex((s) => s.status === 'current') ?? 0
  );

  // The persisted in-progress run is the single source of truth for this
  // screen. Reading it from the store means external CarPlay events
  // (advanceActiveRunStop, called by useCarDetection) update the screen
  // automatically, and back-navigation never loses progress.
  const run = activeRuns.find(
    (r) => r.checklistId === params.checklistId && r.isMultiStop
  );

  // Derive everything the UI needs from the run, with safe fallbacks for the
  // very first render (before the mount effect has created the run).
  const stopIndex     = run?.stopIndex ?? effectiveInitialIdx;
  const stopChecked   = run?.stopChecked ?? {};
  const stopCheckedAt = run?.stopCheckedAt ?? {};
  // Checked item IDs for the stop currently on screen, as a Set for O(1) `.has`.
  const checkedSet = new Set<string>(stopChecked[stopIndex] ?? []);

  // Builds a fresh run object — seeds the mount effect and serves as a fallback
  // base when mutating before the store has round-tripped.
  function makeRun(): ActiveRun {
    const now = new Date().toISOString();
    return {
      checklistId: params.checklistId,
      isMultiStop: true,
      startedAt: now,
      updatedAt: now,
      // Regular-trip fields are unused for a multi-stop run.
      phase: 'start',
      startDone: false,
      checked: {},
      checkedAt: {},
      stopIndex: effectiveInitialIdx,
      stopChecked: {},
      stopCheckedAt: {},
    };
  }

  // We deliberately do NOT create the run on mount (or clear it on unmount):
  // an untouched open shouldn't leave a phantom "continue" entry on the Home
  // banner — consistent with regular checklists. The run is created on the first
  // item tap (toggle), and cleared only on completion or the Home "discard".
  if (!checklist) {
    return (
      <SafeAreaView style={s.safe}>
        <Text style={{ padding: 20 }}>Checklist not found.</Text>
      </SafeAreaView>
    );
  }

  const stops = checklist.stops;
  const currentStop = stops[stopIndex];
  const totalItems = stops.reduce((a, st) => a + st.items.length, 0);
  // Progress bar percentage: number of *completed* stops / total stops.
  const pct = stops.length > 0 ? Math.round((stopIndex / stops.length) * 100) : 0;

  // Toggle one item in the CURRENT stop and persist immediately so progress is
  // never lost. Per-stop checked IDs are stored keyed by stop index.
  function toggle(id: string) {
    const base = run ?? makeRun();
    const cur = new Set<string>(base.stopChecked[stopIndex] ?? []);
    const at = { ...(base.stopCheckedAt[stopIndex] ?? {}) };
    if (cur.has(id)) {
      cur.delete(id);
      delete at[id];
    } else {
      cur.add(id);
      at[id] = new Date().toISOString();
    }
    saveActiveRun({
      ...base,
      updatedAt: new Date().toISOString(),
      stopIndex,
      stopChecked:   { ...base.stopChecked,   [stopIndex]: Array.from(cur) },
      stopCheckedAt: { ...base.stopCheckedAt, [stopIndex]: at },
    });
  }

  // Builds a section label for a stop, e.g. "Stop 2 — Rest stop — Gas & snacks".
  function stopSectionLabel(idx: number) {
    const name = stops[idx]?.name;
    return name ? `Stop ${idx + 1} — ${name}` : `Stop ${idx + 1}`;
  }

  // Advance to the next stop, or complete the trip on the last stop.
  function advance() {
    if (!checklist) return; // narrows `checklist` for the rest of this closure
    const base = run ?? makeRun();

    if (stopIndex < stops.length - 1) {
      // ── Mid-trip advance ────────────────────────────────────────────────
      // The current stop's checked items are already persisted (toggle saves
      // on every tap), so advancing is just a stopIndex bump. The screen
      // re-derives the next stop's checkmarks from the run automatically.
      saveActiveRun({ ...base, stopIndex: stopIndex + 1, updatedAt: new Date().toISOString() });
      return;
    }

    // ── Trip completion ───────────────────────────────────────────────────
    // Tally every stop straight from the run's per-stop checked data, so the
    // log is correct regardless of how the user navigated between stops.
    let totalChecked = 0;
    const allItems: TripLogItem[] = [];
    stops.forEach((stop, idx) => {
      const ids = new Set<string>(base.stopChecked[idx] ?? []);
      const at  = base.stopCheckedAt[idx] ?? {};
      stop.items.forEach((item) => {
        if (ids.has(item.id)) totalChecked++;
        allItems.push({
          id: item.id,
          label: item.label,
          checkedAt: at[item.id],
          section: stopSectionLabel(idx),
        });
      });
    });

    addTripLog({
      checklistId: checklist.id,
      checklistName: checklist.name,
      checkedCount: totalChecked,
      totalCount: totalItems,
      timestamp: new Date().toISOString(),
      isComplete: totalChecked === totalItems,
      items: allItems,
    });

    // The trip is finished — clear its run so it leaves the Home banner and the
    // next open starts fresh at the first stop.
    clearActiveRun(checklist.id);
    Alert.alert('Trip complete!', 'All stops checked off.', [
      {
        text: 'Done',
        onPress: () => {
          navigation.goBack();
          // Multi-stop completion shows no interstitial, so it's safe to ask for
          // a review here directly. One-time and self-gating (see appReview).
          maybeRequestReview();
        },
      },
    ]);
  }

  // Step back to the previous stop. Because per-stop checked data is keyed by
  // index, the previous stop's checkmarks reappear automatically.
  function rewind() {
    if (stopIndex <= 0) return;
    const base = run ?? makeRun();
    saveActiveRun({ ...base, stopIndex: stopIndex - 1, updatedAt: new Date().toISOString() });
  }

  // ── Badge helpers ──────────────────────────────────────────────────────────
  // Each stop in the timeline gets a badge showing its status relative to the
  // current stop (Done / Now / Upcoming). These helpers return the appropriate
  // style and text without needing a switch statement at the render site.

  function badgeStyle(stop: Stop, idx: number) {
    if (idx < stopIndex) return s.badgeDone;
    if (idx === stopIndex) return s.badgeCurrent;
    return s.badgeTodo;
  }
  function badgeText(idx: number) {
    if (idx < stopIndex) return 'Done';
    if (idx === stopIndex) return 'Now';
    return 'Upcoming';
  }
  function badgeTextStyle(idx: number) {
    if (idx < stopIndex) return s.badgeDoneText;
    if (idx === stopIndex) return s.badgeCurrentText;
    return s.badgeTodoText;
  }

  const isLastStop = stopIndex === stops.length - 1;

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {/* ── Topbar ─────────────────────────────────────────────────────── */}
        <View style={s.topbar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
            <Ionicons name="arrow-back" size={22} color={theme.colors.textSecondary} />
          </TouchableOpacity>
          <Text style={s.title} numberOfLines={1}>{checklist.name}</Text>
        </View>

        {/* ── Overall progress bar ─────────────────────────────────────────── */}
        <View style={s.card}>
          <View style={s.progressRow}>
            <Text style={s.progressText}>
              Stop {stopIndex + 1} of {stops.length} · In progress
            </Text>
            <Text style={[s.progressText, { color: theme.colors.purple, fontWeight: '500' }]}>
              Active
            </Text>
          </View>
          <View style={s.barTrack}>
            <View style={[s.barFill, { width: `${pct}%` }]} />
          </View>
        </View>

        {/* ── Stop timeline ────────────────────────────────────────────────── */}
        {/* Vertical list of all stops with a connector line between them.
            Each stop shows its name and a status badge. */}
        <View style={s.card}>
          {stops.map((stop, idx) => (
            <View key={stop.id} style={s.stopRow}>
              {/* Left column: dot + connector line */}
              <View style={s.stopDotCol}>
                <View
                  style={[
                    s.stopDot,
                    idx < stopIndex && s.stopDotDone,
                    idx === stopIndex && s.stopDotCurrent,
                    idx > stopIndex && s.stopDotUpcoming,
                  ]}
                />
                {/* Connector line — hidden after the last stop */}
                {idx < stops.length - 1 && <View style={s.stopLine} />}
              </View>
              {/* Right column: stop name, subtitle, and badge */}
              <View style={s.stopInfo}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={s.stopName}>{stop.name}</Text>
                  <View style={[s.badge, badgeStyle(stop, idx)]}>
                    <Text style={[s.badgeText, badgeTextStyle(idx)]}>{badgeText(idx)}</Text>
                  </View>
                </View>
                <Text style={s.stopSub}>
                  {/* Show "X items checked" for completed stops; original subtitle otherwise */}
                  {idx < stopIndex ? `${stop.items.length} items checked` : stop.subtitle}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* ── Active stop checklist ────────────────────────────────────────── */}
        {/* Highlighted card (thicker purple border) for the stop the user is
            currently working through. */}
        {currentStop && (
          <View style={[s.card, s.currentCard]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <Ionicons name="location" size={14} color={theme.colors.purple} />
              <Text style={s.currentLabel}>Current stop: {currentStop.name}</Text>
            </View>
            {currentStop.items.map((item, idx) => (
              <TouchableOpacity
                key={item.id}
                style={[
                  s.checkRow,
                  idx < currentStop.items.length - 1 && s.checkRowBorder,
                ]}
                onPress={() => toggle(item.id)}
                activeOpacity={0.7}
              >
                {/* Purple checkbox fill for multi-stop (vs green in ChecklistRunScreen) */}
                <View style={[s.checkbox, checkedSet.has(item.id) && s.checkboxChecked]}>
                  {checkedSet.has(item.id) && (
                    <Ionicons name="checkmark" size={13} color="#fff" />
                  )}
                </View>
                <Text style={[s.checkLabel, checkedSet.has(item.id) && s.checkLabelDone]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* ── Advance / complete button ─────────────────────────────────────── */}
        {/* Label and icon change on the last stop */}
        <TouchableOpacity style={s.btnPrimary} onPress={advance}>
          <Ionicons
            name={isLastStop ? 'checkmark-circle' : 'arrow-forward'}
            size={16}
            color="#fff"
          />
          <Text style={s.btnPrimaryText}>
            {isLastStop ? ' Complete trip' : ' Continue to next stop'}
          </Text>
        </TouchableOpacity>

        {/* Undo button — only available after the first advance so there's
            something to roll back. Because per-stop checked data is keyed by
            stop index, stepping back restores the previous stop's checkmarks. */}
        {stopIndex > 0 && (
          <TouchableOpacity style={s.btnUndo} onPress={rewind}>
            <Ionicons name="arrow-undo-outline" size={15} color={theme.colors.textSecondary} />
            <Text style={s.btnUndoText}> Undo last advance</Text>
          </TouchableOpacity>
        )}

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
  // The active stop card gets a thicker purple border for prominence.
  currentCard: { borderWidth: 1.5, borderColor: theme.colors.purpleBorder },

  progressRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  progressText: { fontSize: 12, color: theme.colors.textSecondary },
  barTrack: {
    height: 6,
    backgroundColor: theme.colors.bgSecondary,
    borderRadius: 3,
    overflow: 'hidden',
  },
  barFill: { height: '100%', backgroundColor: theme.colors.purple, borderRadius: 3 },

  stopRow: { flexDirection: 'row', gap: 10, paddingVertical: 4 },
  stopDotCol: { alignItems: 'center', width: 16 },
  stopDot: { width: 12, height: 12, borderRadius: 6, marginTop: 2 },
  stopDotDone: { backgroundColor: theme.colors.primary },
  // The current-stop dot has a glow effect via shadow props.
  stopDotCurrent: {
    backgroundColor: theme.colors.primary,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 4, // Android shadow equivalent
  },
  stopDotUpcoming: { backgroundColor: theme.colors.borderSecondary },
  stopLine: { width: 2, flex: 1, backgroundColor: theme.colors.borderTertiary, marginTop: 2 },
  stopInfo: { flex: 1, paddingBottom: 12 },
  stopName: { fontSize: 14, fontWeight: '500', color: theme.colors.textPrimary },
  stopSub: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },

  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: theme.radius.md },
  badgeDone: { backgroundColor: theme.colors.primaryLight },
  badgeCurrent: { backgroundColor: theme.colors.purpleLight },
  badgeTodo: { backgroundColor: theme.colors.bgSecondary },
  badgeText: { fontSize: 11, fontWeight: '500' },
  badgeDoneText: { color: theme.colors.primaryDeep },
  badgeCurrentText: { color: theme.colors.purpleDark },
  badgeTodoText: { color: theme.colors.textSecondary },

  currentLabel: { fontSize: 13, fontWeight: '500', color: theme.colors.purple },

  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 11,
  },
  checkRowBorder: {
    borderBottomWidth: 0.5,
    borderBottomColor: theme.colors.borderTertiary,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: theme.colors.borderSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Multi-stop uses purple for its checked state (vs green in ChecklistRunScreen).
  checkboxChecked: {
    backgroundColor: theme.colors.purple,
    borderColor: theme.colors.purple,
  },
  checkLabel: { flex: 1, fontSize: 15, color: theme.colors.textPrimary },
  checkLabelDone: { color: theme.colors.textTertiary, textDecorationLine: 'line-through' },

  btnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.purple,
  },
  btnPrimaryText: { fontSize: 15, fontWeight: '500', color: '#fff' },
  btnUndo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 11,
    borderRadius: theme.radius.md,
    borderWidth: 0.5,
    borderColor: theme.colors.borderSecondary,
    backgroundColor: theme.colors.bgPrimary,
  },
  btnUndoText: { fontSize: 14, color: theme.colors.textSecondary },
});
