// ─────────────────────────────────────────────────────────────────────────────
// screens/MultiStopScreen.tsx  —  Active run screen for multi-stop trips.
//
// This screen handles checklists where `isMultiStop === true`. For single-phase
// checklists, see ChecklistRunScreen.
//
// HOW MULTI-STOP WORKS
//   1. The user opens this screen (from HomeScreen or a push notification).
//   2. On mount, `startMultiStopTrip(checklistId, initialIdx)` registers the
//      active trip in the Zustand store so useCarDetection can see it.
//   3. When the user reconnects CarPlay mid-trip (e.g. at a rest stop),
//      useCarDetection shows an Alert asking "Arrived at next stop?". If the
//      user taps Continue, `advanceMultiStopStop()` increments `stopIndex` in
//      the store. This screen's useEffect detects the change and resets `checked`
//      for the new stop.
//   4. The user can also advance manually by tapping "Continue to next stop".
//   5. On the last stop, the button becomes "Complete trip", which logs the run
//      and pops the screen.
//
// STORE vs LOCAL STATE
//   `stopIndex` — lives in the Zustand store so CarPlay events can advance it
//   from outside this component (via useCarDetection).
//   `checked` — local component state; transient UI, not persisted. Reset every
//   time `stopIndex` changes (detected via the second useEffect).
//
// NAVIGATION
// Reached from:
//   HomeScreen (tap a multi-stop checklist row)
//   App.tsx notification listener (notification with `isMultiStop: true`)
// Params: `{ checklistId: string }`.
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
import { theme } from '../theme';
import { RootStackParamList, Stop } from '../types';

type Route = RouteProp<RootStackParamList, 'MultiStop'>;

export function MultiStopScreen() {
  const navigation = useNavigation();
  const { params } = useRoute<Route>();
  const {
    checklists,
    addTripLog,
    activeMultiStopTrip,
    startMultiStopTrip,
    advanceMultiStopStop,
    rewindMultiStopStop,
    endMultiStopTrip,
  } = useAppStore();

  const checklist = checklists.find((c) => c.id === params.checklistId);

  // Compute the correct starting stop index before the store is initialised.
  // Without this, the first render would always show stop 0 briefly before
  // the store effect runs — a visible flash.
  // We use the checklist's own `status === 'current'` marker as the ground truth.
  const effectiveInitialIdx = Math.max(
    0,
    checklist?.stops.findIndex((s) => s.status === 'current') ?? 0
  );

  // Read stopIndex from the store so external CarPlay events (advanceMultiStopStop
  // called by useCarDetection) can update it without the user touching anything.
  // Fall back to `effectiveInitialIdx` if no active trip is registered yet.
  const stopIndex =
    activeMultiStopTrip?.checklistId === params.checklistId
      ? activeMultiStopTrip.stopIndex
      : effectiveInitialIdx;

  // `checked` is local state — transient UI, not persisted. Initialised with
  // whatever items the initial stop already had pre-checked (from checklist data).
  const [checked, setChecked] = useState<Record<string, boolean>>(() => {
    const stop = checklist?.stops[effectiveInitialIdx];
    const init: Record<string, boolean> = {};
    stop?.checkedItems.forEach((id) => { init[id] = true; });
    return init;
  });

  // Register this as the active multi-stop trip when the screen mounts.
  // The cleanup fn calls endMultiStopTrip() on unmount (back nav or completion)
  // so useCarDetection no longer sees an active trip.
  useEffect(() => {
    if (!checklist) return;
    startMultiStopTrip(params.checklistId, effectiveInitialIdx);
    return () => {
      endMultiStopTrip();
    };
  }, []); // intentionally empty deps — this effect is purely a lifecycle registration

  // `useRef` lets us know whether this is the first render so we can skip the
  // initial effect run (the useState initializer already seeded `checked`).
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    // `stopIndex` changed externally (CarPlay advance) or via the manual button.
    // Seed `checked` with the new stop's pre-checked items.
    const stop = checklist?.stops[stopIndex];
    const init: Record<string, boolean> = {};
    stop?.checkedItems.forEach((id) => { init[id] = true; });
    setChecked(init);
  }, [stopIndex]); // `checklist` omitted intentionally — it's stable from the store

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

  function toggle(id: string) {
    setChecked((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  // Advance to the next stop, or complete the trip on the last stop.
  function advance() {
    const checkedCount = currentStop.items.filter((it) => checked[it.id]).length;
    if (stopIndex < stops.length - 1) {
      // More stops remain — increment the store; the useEffect above will
      // pick up the change and reset `checked` for the new stop.
      advanceMultiStopStop();
    } else {
      // Last stop — write the trip log, clean up the store, and go home.
      addTripLog({
        checklistId: checklist.id,
        checklistName: checklist.name,
        checkedCount,
        totalCount: totalItems,
        timestamp: new Date().toISOString(),
        isComplete: true,
      });
      endMultiStopTrip();
      Alert.alert('Trip complete!', 'All stops checked off.', [
        { text: 'Done', onPress: () => navigation.goBack() },
      ]);
    }
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
                <View style={[s.checkbox, checked[item.id] && s.checkboxChecked]}>
                  {checked[item.id] && (
                    <Ionicons name="checkmark" size={13} color="#fff" />
                  )}
                </View>
                <Text style={[s.checkLabel, checked[item.id] && s.checkLabelDone]}>
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
            something to roll back. The useEffect on stopIndex reseeds `checked`
            with the previous stop's pre-checked items automatically. */}
        {stopIndex > 0 && (
          <TouchableOpacity style={s.btnUndo} onPress={rewindMultiStopStop}>
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
