// ─────────────────────────────────────────────────────────────────────────────
// screens/ChecklistRunScreen.tsx  -  Active checklist run for regular trips.
//
// This screen is used for checklists where `isMultiStop === false`. For
// multi-stop checklists, see MultiStopScreen.
//
// TWO-PHASE COMPLETION
//   Start-of-trip items are checked at departure; end-of-trip items on arrival,
//   possibly hours later. So a checklist with BOTH lists is run in two phases:
//     • "Complete departure" finishes the start list, marks the run as
//       in-progress (startDone), and switches to the arrival tab. It does NOT
//       write a history entry.
//     • "Complete trip" (on the arrival tab) writes ONE combined TripLog
//       spanning both lists and clears the run.
//   AUTO SINGLE-PHASE: when only one list has items (start-only, or end-only),
//   there is no tab switcher - a single "Complete trip" button finalizes
//   immediately.
//
// AUTO-SAVE
//   Progress is mirrored into the store as an ActiveRun on every change, so
//   navigating back never loses it. Reopening the checklist resumes exactly
//   where the user left off, and the Home screen shows a "resume" banner.
//   The run is cleared when the trip is finalized or fully reset.
//
// STATE MODEL
//   `checked` - `Record<string, boolean>` (item ID → checked); O(1) lookups.
//   `checkedAt` - `Record<string, string>` (item ID → ISO timestamp).
//   `activeTab` - 'start' | 'end'. A single `checked` map covers both tabs
//   (item IDs are unique across the two lists), so switching tabs does NOT
//   clear progress.
//   `startDone` - whether the departure phase has been completed.
//
// NAVIGATION
// Reached from:
//   HomeScreen (tap a checklist row, or the resume banner)
//   App.tsx notification listener (tap a push notification)
// Params: `{ checklistId: string; tab?: 'start' | 'end' }`.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useRef } from 'react';
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
import { maybeShowInterstitial } from '../ads/interstitial';
import { maybeRequestReview } from '../reviews/appReview';
import { computeTripScore } from '../utils/score';
import { theme } from '../theme';
import { RootStackParamList, ActiveRun } from '../types';

// `RouteProp<RootStackParamList, 'ChecklistRun'>` gives us a typed `params`
// object: TypeScript knows `params.checklistId` is a `string`.
type Route = RouteProp<RootStackParamList, 'ChecklistRun'>;

export function ChecklistRunScreen() {
  const navigation = useNavigation();
  const { params } = useRoute<Route>();
  const { checklists, addTripLog, activeRuns, saveActiveRun, clearActiveRun } =
    useAppStore();

  // Look up the checklist by the ID passed as a navigation param.
  // `.find` returns `Checklist | undefined` - we guard below.
  const checklist = checklists.find((c) => c.id === params.checklistId);

  // Any previously-saved progress for this checklist (resume support). Found
  // once at mount via a ref-free lookup; `activeRuns` is stable enough for the
  // initial seed (we don't want this screen to re-seed on every store change).
  const existingRun = activeRuns.find(
    (r) => r.checklistId === params.checklistId && !r.isMultiStop
  );

  // Which phases this checklist actually has. "Auto single-phase": if only one
  // side has items, we hide the tab switcher and show just that list.
  const hasStart = !!checklist && checklist.startItems.length > 0;
  const hasEnd =
    !!checklist && checklist.endOfTripEnabled && checklist.endItems.length > 0;
  const twoPhase = hasStart && hasEnd;

  // Pick the initial tab. Priority: an explicit nav param (disconnect → 'end'),
  // then the saved run's phase, then the only available phase, then 'start'.
  // A param/phase pointing at a non-existent list falls back sensibly.
  function initialTab(): 'start' | 'end' {
    const wanted = params.tab ?? existingRun?.phase;
    if (wanted === 'end' && hasEnd) return 'end';
    if (wanted === 'start' && hasStart) return 'start';
    if (!hasStart && hasEnd) return 'end'; // end-only checklist
    return 'start';
  }

  // Which tab is active: 'start' (before trip) or 'end' (on arrival).
  const [activeTab, setActiveTab] = useState<'start' | 'end'>(initialTab);

  // Map from item ID → checked boolean (covers both tabs; IDs are unique).
  const [checked, setChecked] = useState<Record<string, boolean>>(
    existingRun?.checked ?? {}
  );
  // Pro: ISO timestamp at which each item was checked. Cleared on uncheck/reset.
  const [checkedAt, setCheckedAt] = useState<Record<string, string>>(
    existingRun?.checkedAt ?? {}
  );
  // Items the user has marked "ignore" for this trip - excluded from the score
  // (see computeTripScore). Per-run only; reset clears it. `?? {}` for older
  // persisted runs that predate the field.
  const [ignored, setIgnored] = useState<Record<string, boolean>>(
    existingRun?.ignored ?? {}
  );
  // Whether the departure (start) phase has been completed.
  const [startDone, setStartDone] = useState<boolean>(existingRun?.startDone ?? false);

  // Preserve the original start time across the many auto-saves below.
  const startedAtRef = useRef(existingRun?.startedAt ?? new Date().toISOString());

  // ── Auto-save ──────────────────────────────────────────────────────────────
  // Mirror local progress into the store on every change so back-navigation
  // never loses it. A run is only kept while it's "non-empty" (something checked
  // or the departure marked done); otherwise we clear it so an untouched open
  // doesn't leave a phantom entry on the Home banner. We skip the first render
  // (the state was just seeded from the store - no need to write it straight
  // back and bump `updatedAt`).
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (!checklist) return;
    const anyChecked = Object.values(checked).some(Boolean);
    const anyIgnored = Object.values(ignored).some(Boolean);
    if (anyChecked || anyIgnored || startDone) {
      const run: ActiveRun = {
        checklistId: checklist.id,
        isMultiStop: false,
        startedAt: startedAtRef.current,
        updatedAt: new Date().toISOString(),
        phase: activeTab,
        startDone,
        checked,
        checkedAt,
        ignored,
        // Multi-stop fields stay at their empty defaults for a regular run.
        stopIndex: 0,
        stopChecked: {},
        stopCheckedAt: {},
      };
      saveActiveRun(run);
    } else {
      clearActiveRun(checklist.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checked, checkedAt, ignored, startDone, activeTab]);

  // Guard: show a clear error state if the checklist was deleted while this
  // screen was on the navigation stack (can happen if the user deletes it from
  // another route while this screen is mounted).
  if (!checklist) {
    return (
      <SafeAreaView style={s.safe}>
        <Text style={{ padding: 20, color: theme.colors.textPrimary }}>Checklist not found.</Text>
      </SafeAreaView>
    );
  }

  // Items displayed depend on which tab is active.
  const items = activeTab === 'start' ? checklist.startItems : checklist.endItems;
  // Ignored items are skipped for this trip: they don't count toward the score,
  // so the progress bar is computed over the non-ignored ("active") items only.
  const activeItems = items.filter((it) => !ignored[it.id]);
  const checkedCount = activeItems.filter((it) => checked[it.id]).length;
  const ignoredCount = items.length - activeItems.length;
  // Avoid dividing by zero when a tab has no active items.
  const pct =
    activeItems.length > 0 ? Math.round((checkedCount / activeItems.length) * 100) : 0;

  // Flip a single item's checked state and record/clear its timestamp. Tapping
  // an ignored row restores it (so the row tap is never a dead end).
  function toggle(id: string) {
    if (ignored[id]) {
      toggleIgnore(id);
      return;
    }
    const wasChecked = checked[id] ?? false;
    setChecked((prev) => ({ ...prev, [id]: !prev[id] }));
    // Pro: record or remove the timestamp based on the new checked state.
    setCheckedAt((prev) => {
      if (!wasChecked) return { ...prev, [id]: new Date().toISOString() };
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
  }

  // Mark an item "ignore" (or restore it). Ignoring also clears any checked
  // state + timestamp so an ignored item can never count toward the score.
  function toggleIgnore(id: string) {
    const willIgnore = !ignored[id];
    setIgnored((prev) => {
      const next = { ...prev };
      if (willIgnore) next[id] = true;
      else delete next[id];
      return next;
    });
    if (willIgnore) {
      setChecked((prev) => {
        if (!prev[id]) return prev;
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });
      setCheckedAt((prev) => {
        if (!prev[id]) return prev;
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });
    }
  }

  // Clear all checked + ignored items across both tabs and reset the departure
  // flag - lets the user restart fresh. The auto-save effect then clears the run.
  function resetAll() {
    setChecked({});
    setCheckedAt({});
    setIgnored({});
    setStartDone(false);
  }

  // Switch tabs WITHOUT clearing checked state. Start and end items all have
  // unique IDs, so a single `checked` map naturally tracks both tabs at once.
  function switchTab(tab: 'start' | 'end') {
    setActiveTab(tab);
  }

  // Check/uncheck every ACTIVE item in the current tab at once (ignored items
  // are left untouched). If all are already checked → uncheck all; else → check all.
  function toggleAll() {
    const allChecked = activeItems.length > 0 && activeItems.every((it) => checked[it.id]);
    const now = new Date().toISOString();
    if (allChecked) {
      // Uncheck: remove every active current-tab item from both maps.
      setChecked((prev) => {
        const copy = { ...prev };
        activeItems.forEach((it) => { delete copy[it.id]; });
        return copy;
      });
      setCheckedAt((prev) => {
        const copy = { ...prev };
        activeItems.forEach((it) => { delete copy[it.id]; });
        return copy;
      });
    } else {
      // Check all active items that aren't already checked.
      setChecked((prev) => {
        const next = { ...prev };
        activeItems.forEach((it) => { next[it.id] = true; });
        return next;
      });
      setCheckedAt((prev) => {
        const next = { ...prev };
        activeItems.forEach((it) => { if (!prev[it.id]) next[it.id] = now; });
        return next;
      });
    }
  }

  // ── Phase 1 → Phase 2: complete departure ───────────────────────────────────
  // Two-phase only. Marks the start list done and switches to the arrival tab
  // WITHOUT writing history - the trip stays "in progress" until arrival. The
  // auto-save effect persists the new phase/startDone for the Home banner.
  function completeDeparture() {
    setStartDone(true);
    setActiveTab('end');
  }

  // ── Finalize: write a single combined TripLog and clear the run ──────────────
  // Used by single-phase checklists and by the arrival phase of two-phase ones.
  function markDone() {
    if (!checklist) return; // narrows `checklist` for the rest of this closure
    // Score only the items that count: ignored items and un-run phases are
    // excluded (see computeTripScore). `countedStart`/`countedEnd` are already
    // filtered, so we reuse them for the per-item history too.
    const score = computeTripScore({
      startItems: checklist.startItems,
      endItems: checklist.endItems,
      hasStart,
      hasEnd,
      twoPhase,
      startDone,
      checked,
      ignored,
    });

    addTripLog({
      checklistId: checklist.id,
      checklistName: checklist.name,
      checkedCount: score.checkedCount,
      totalCount: score.totalCount,
      timestamp: new Date().toISOString(),
      isComplete: score.isComplete,
      // Attach per-item timestamps and section labels so the history screen can
      // group and display them clearly. Ignored / un-run items are omitted so
      // history matches the score.
      items: [
        ...score.countedStart.map((item) => ({
          id: item.id,
          label: item.label,
          checkedAt: checkedAt[item.id],
          section: 'Start of trip',
        })),
        ...score.countedEnd.map((item) => ({
          id: item.id,
          label: item.label,
          checkedAt: checkedAt[item.id],
          section: 'End of trip',
        })),
      ],
    });
    // The trip is finished - remove its in-progress run so the Home banner and
    // resume state are cleared.
    clearActiveRun(checklist.id);
    Alert.alert('Trip complete!', `${score.checkedCount}/${score.totalCount} items checked.`, [
      {
        text: 'OK',
        onPress: () => {
          navigation.goBack();
          // Natural break: try an interstitial after returning Home. Self-gates
          // (non-Pro, Android, not driving) and frequency-caps internally, so
          // most completions won't show one.
          const showedAd = maybeShowInterstitial();
          // Only ask for a review when we DIDN'T just show an ad, so the rating
          // prompt never stacks on top of an interstitial. It's one-time and
          // self-gating, so it'll land on a later ad-free completion otherwise.
          if (!showedAd) maybeRequestReview();
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {/* ── Topbar ─────────────────────────────────────────────────────── */}
        <View style={s.topbar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
            <Ionicons name="arrow-back" size={22} color={theme.colors.textSecondary} />
          </TouchableOpacity>
          {/* numberOfLines={1} truncates with "…" so long names don't overflow */}
          <Text style={s.title} numberOfLines={1}>{checklist.name}</Text>
        </View>

        {/* ── Tab switcher (only for two-phase checklists) ──────────────────── */}
        {/* Single-phase checklists skip this entirely - there's only one list. */}
        {twoPhase && (
          <View style={s.tabs}>
            <TouchableOpacity
              style={[s.tab, activeTab === 'start' && s.tabActive]}
              onPress={() => switchTab('start')}
            >
              {/* A small check appears once departure has been completed. */}
              {startDone && (
                <Ionicons
                  name="checkmark-circle"
                  size={13}
                  color={theme.colors.primary}
                  style={{ marginRight: 4 }}
                />
              )}
              <Text style={[s.tabText, activeTab === 'start' && s.tabTextActive]}>
                Start of trip
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.tab, activeTab === 'end' && s.tabActive]}
              onPress={() => switchTab('end')}
            >
              <Text style={[s.tabText, activeTab === 'end' && s.tabTextActive]}>
                End of trip
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Phase hint ────────────────────────────────────────────────────── */}
        {/* Two-phase only: explains the current step so "complete" is unambiguous. */}
        {twoPhase && (
          <View style={s.phaseNote}>
            <Ionicons
              name={startDone ? 'flag' : 'information-circle'}
              size={14}
              color={theme.colors.primaryDeep}
            />
            <Text style={s.phaseNoteText}>
              {startDone
                ? 'Departure complete. Finish these arrival items when you reach your destination.'
                : activeTab === 'start'
                ? 'Check off your departure items, then tap “Complete departure”.'
                : 'These are your arrival items - complete the trip once you arrive.'}
            </Text>
          </View>
        )}

        {/* ── Progress bar ────────────────────────────────────────────────── */}
        <View style={s.card}>
          <View style={s.progressRow}>
            <Text style={s.progressText}>
              {checkedCount} of {activeItems.length} checked
              {ignoredCount > 0 ? ` · ${ignoredCount} skipped` : ''}
            </Text>
            <Text style={s.progressPct}>{pct}%</Text>
          </View>
          <View style={s.barTrack}>
            {/* Inline `width` style - `${pct}%` produces e.g. "75%" which
                React Native's layout engine handles as a percentage of the
                parent's width. */}
            <View style={[s.barFill, { width: `${pct}%` }]} />
          </View>
        </View>

        {/* ── Checklist items ─────────────────────────────────────────────── */}
        <View style={s.card}>
          {/* Header row: item count + "All" toggle button */}
          {items.length > 0 && (
            <View style={s.itemsHeader}>
              <Text style={s.itemsHeaderText}>
                {items.length} item{items.length !== 1 ? 's' : ''}
              </Text>
              <TouchableOpacity onPress={toggleAll} hitSlop={8}>
                <Text style={s.allBtnText}>
                  {activeItems.length > 0 && activeItems.every((it) => checked[it.id])
                    ? 'None'
                    : 'All'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
          {items.length === 0 ? (
            <Text style={{ color: theme.colors.textSecondary, fontSize: 14, paddingVertical: 8 }}>
              No items for this tab. Add them in edit mode.
            </Text>
          ) : (
            items.map((item, idx) => {
              const isChecked = !!checked[item.id];
              const isIgnored = !!ignored[item.id];
              return (
                <View
                  key={item.id}
                  style={[s.checkRow, idx < items.length - 1 && s.checkRowBorder]}
                >
                  {/* Main tappable area: checkbox + label. Tapping toggles the
                      check (or restores an ignored item). */}
                  <TouchableOpacity
                    style={s.checkMain}
                    onPress={() => toggle(item.id)}
                    activeOpacity={0.7}
                  >
                    {/* Circular checkbox: filled when checked, muted dash when ignored. */}
                    <View
                      style={[
                        s.checkbox,
                        isChecked && s.checkboxChecked,
                        isIgnored && s.checkboxIgnored,
                      ]}
                    >
                      {isChecked && <Ionicons name="checkmark" size={13} color="#fff" />}
                      {isIgnored && (
                        <Ionicons name="remove" size={13} color={theme.colors.textTertiary} />
                      )}
                    </View>
                    <Text
                      style={[
                        s.checkLabel,
                        isChecked && s.checkLabelDone,
                        isIgnored && s.checkLabelIgnored,
                      ]}
                    >
                      {item.label}
                    </Text>
                    {isIgnored && (
                      <View style={s.skipTag}>
                        <Text style={s.skipTagText}>Skipped</Text>
                      </View>
                    )}
                  </TouchableOpacity>

                  {/* Trailing Ignore / Restore control - its own touch target so
                      it never competes with the check tap. */}
                  <TouchableOpacity
                    style={s.ignoreBtn}
                    onPress={() => toggleIgnore(item.id)}
                    hitSlop={8}
                  >
                    <Ionicons
                      name={isIgnored ? 'arrow-undo-outline' : 'remove-circle-outline'}
                      size={18}
                      color={isIgnored ? theme.colors.primary : theme.colors.textTertiary}
                    />
                  </TouchableOpacity>
                </View>
              );
            })
          )}
        </View>

        {/* ── Action buttons ───────────────────────────────────────────────── */}
        {/* The primary button is phase-aware:
              • two-phase / start tab, not yet departed → "Complete departure"
                (marks the start done and moves to the arrival tab; no log yet)
              • two-phase / start tab, already departed  → "Go to arrival items"
              • two-phase / arrival tab, or single-phase → "Complete trip"
                (writes the combined TripLog and exits)                        */}
        <View style={s.btnRow}>
          <TouchableOpacity style={s.btnSecondary} onPress={resetAll}>
            <Ionicons name="refresh" size={15} color={theme.colors.textPrimary} />
            <Text style={s.btnSecondaryText}> Reset</Text>
          </TouchableOpacity>

          {twoPhase && activeTab === 'start' && !startDone ? (
            <TouchableOpacity style={s.btnPrimary} onPress={completeDeparture}>
              <Ionicons name="arrow-forward-circle" size={15} color="#fff" />
              <Text style={s.btnPrimaryText}> Complete departure</Text>
            </TouchableOpacity>
          ) : twoPhase && activeTab === 'start' && startDone ? (
            <TouchableOpacity style={s.btnPrimary} onPress={() => switchTab('end')}>
              <Ionicons name="arrow-forward" size={15} color="#fff" />
              <Text style={s.btnPrimaryText}> Go to arrival items</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={s.btnPrimary} onPress={markDone}>
              <Ionicons name="checkmark-circle" size={15} color="#fff" />
              <Text style={s.btnPrimaryText}> Complete trip</Text>
            </TouchableOpacity>
          )}
        </View>

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
    paddingVertical: 7,
    borderRadius: theme.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabActive: {
    backgroundColor: theme.colors.bgPrimary,
    borderWidth: 0.5,
    borderColor: theme.colors.borderTertiary,
  },
  tabText: { fontSize: 13, fontWeight: '500', color: theme.colors.textSecondary },
  tabTextActive: { color: theme.colors.textPrimary },

  // Green hint callout explaining the current phase (two-phase checklists only).
  phaseNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: theme.colors.primaryLight,
    borderWidth: 0.5,
    borderColor: '#5DCAA5',
    borderRadius: theme.radius.md,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  phaseNoteText: { flex: 1, fontSize: 12, color: theme.colors.primaryDeep, lineHeight: 17 },

  card: {
    backgroundColor: theme.colors.bgPrimary,
    borderWidth: 0.5,
    borderColor: theme.colors.borderTertiary,
    borderRadius: theme.radius.lg,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  progressText: { fontSize: 12, color: theme.colors.textSecondary },
  progressPct: { fontSize: 12, color: theme.colors.textSecondary },
  barTrack: {
    height: 6,
    backgroundColor: theme.colors.bgSecondary,
    borderRadius: 3,
    overflow: 'hidden', // clips the fill bar to the track's rounded corners
  },
  barFill: { height: '100%', backgroundColor: theme.colors.primary, borderRadius: 3 },

  itemsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  itemsHeaderText: { fontSize: 12, color: theme.colors.textSecondary },
  allBtnText: { fontSize: 13, fontWeight: '500', color: theme.colors.primary },

  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  // Inner tappable area (checkbox + label). The outer row owns the separator;
  // this owns the real vertical padding / tap target.
  checkMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  checkRowBorder: {
    borderBottomWidth: 0.5,
    borderBottomColor: theme.colors.borderTertiary,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11, // perfect circle
    borderWidth: 2,
    borderColor: theme.colors.borderSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  // Ignored items get a muted, hollow checkbox (a dash, not a check) so they're
  // clearly distinct from both "to do" and "done".
  checkboxIgnored: {
    backgroundColor: theme.colors.bgSecondary,
    borderColor: theme.colors.borderSecondary,
  },
  checkLabel: { flex: 1, fontSize: 15, color: theme.colors.textPrimary },
  checkLabelDone: { color: theme.colors.textTertiary, textDecorationLine: 'line-through' },
  // Muted (no strike-through - that means "done", this means "skipped").
  checkLabelIgnored: { color: theme.colors.textTertiary },
  skipTag: {
    backgroundColor: theme.colors.bgSecondary,
    borderRadius: theme.radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  skipTagText: { fontSize: 11, fontWeight: '500', color: theme.colors.textTertiary },
  ignoreBtn: { paddingHorizontal: 6, paddingVertical: 10, marginLeft: 4 },

  btnRow: { flexDirection: 'row', gap: 8 },
  btnSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 11,
    borderRadius: theme.radius.md,
    borderWidth: 0.5,
    borderColor: theme.colors.borderSecondary,
    backgroundColor: theme.colors.bgPrimary,
  },
  btnSecondaryText: { fontSize: 14, fontWeight: '500', color: theme.colors.textPrimary },
  btnPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 11,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primary,
  },
  btnPrimaryText: { fontSize: 14, fontWeight: '500', color: '#fff' },
});
