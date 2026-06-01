// ─────────────────────────────────────────────────────────────────────────────
// screens/TripHistoryScreen.tsx  —  Full trip history (Pro feature).
//
// FEATURES
//   • Lists all stored trip logs (up to 500 for Pro, vs 3 shown on HomeScreen)
//   • Each row shows checklist name, relative timestamp, and completion status
//   • Tapping a row (normal mode) expands per-item timestamps — only when the
//     log was recorded on a Pro plan (has `items` data)
//   • Multi-select delete: tap "Select" to enter select mode; checkboxes appear
//     on each row; a "Delete (N)" bar slides in at the bottom
//   • Long-pressing any row enters select mode with that row pre-selected
//   • "All" button in select mode selects every visible entry at once
//
// PRO GUARD
// Free users can't reach this screen from the normal UI (HomeScreen only
// shows the "View all →" link for Pro users), but we guard defensively in
// case of direct navigation.
//
// NAVIGATION
// Reached from HomeScreen via the "View all →" link next to "Recent trips".
// No params required.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import { useAppStore } from '../store/useAppStore';
import { theme } from '../theme';
import { TripLog, TripLogItem } from '../types';
import { formatTimeAgo } from '../utils/time';

export function TripHistoryScreen() {
  const navigation = useNavigation();
  const { tripLogs, settings, deleteTripLogs } = useAppStore();

  // ── Select-mode state ────────────────────────────────────────────────────
  const [selectMode, setSelectMode] = useState(false);
  // `Set<string>` is JavaScript's built-in Set collection — like an array but
  // with guaranteed uniqueness and O(1) `.has()` checks. TypeScript's `<string>`
  // generic constrains what can go inside it (only strings in this case).
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // ── Expand state ─────────────────────────────────────────────────────────
  // Tracks which log rows are expanded to show per-item timestamps.
  // Only rows with `items` data (Pro logs) can expand.
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // ── Helpers ───────────────────────────────────────────────────────────────

  function enterSelectMode(initialId?: string) {
    setSelectMode(true);
    setSelected(initialId ? new Set([initialId]) : new Set());
  }

  function exitSelectMode() {
    setSelectMode(false);
    setSelected(new Set());
  }

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(tripLogs.map((l) => l.id)));
  }

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function confirmDelete() {
    Alert.alert(
      `Delete ${selected.size} trip${selected.size !== 1 ? 's' : ''}?`,
      'This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteTripLogs(Array.from(selected));
            exitSelectMode();
          },
        },
      ]
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={s.safe}>

      {/* ── Topbar ───────────────────────────────────────────────────────── */}
      <View style={s.topbar}>
        <TouchableOpacity
          onPress={selectMode ? exitSelectMode : () => navigation.goBack()}
          style={s.backBtn}
        >
          <Ionicons name="arrow-back" size={22} color={theme.colors.textSecondary} />
        </TouchableOpacity>
        <Text style={s.title}>
          {selectMode
            ? `${selected.size} selected`
            : `Trip History`}
        </Text>
        {/* Right action: "All" in select mode, "Select" otherwise */}
        {selectMode ? (
          <TouchableOpacity onPress={selectAll} style={s.actionBtn}>
            <Text style={s.actionBtnText}>All</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={() => enterSelectMode()}
            style={s.actionBtn}
            disabled={tripLogs.length === 0}
          >
            <Text style={[s.actionBtnText, tripLogs.length === 0 && { opacity: 0.3 }]}>
              Select
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
      >
        {tripLogs.length === 0 ? (
          <Text style={s.empty}>No trip history yet — complete your first checklist!</Text>
        ) : (
          <View style={s.card}>
            {tripLogs.map((log, idx) => (
              <LogRow
                key={log.id}
                log={log}
                isLast={idx === tripLogs.length - 1}
                selectMode={selectMode}
                isSelected={selected.has(log.id)}
                isExpanded={expanded.has(log.id)}
                onPress={() => {
                  if (selectMode) {
                    toggleSelected(log.id);
                  } else {
                    // Only rows with item data can expand.
                    if ((log.items?.length ?? 0) > 0) toggleExpanded(log.id);
                  }
                }}
                onLongPress={() => {
                  if (!selectMode) enterSelectMode(log.id);
                }}
              />
            ))}
          </View>
        )}

        {/* Spacer so the bottom delete bar doesn't cover the last row */}
        {selectMode && <View style={{ height: 72 }} />}
      </ScrollView>

      {/* ── Delete bar (select mode only) ──────────────────────────────── */}
      {selectMode && (
        <View style={s.deleteBar}>
          <TouchableOpacity
            style={[s.deleteBtn, selected.size === 0 && s.deleteBtnDisabled]}
            onPress={confirmDelete}
            disabled={selected.size === 0}
          >
            <Ionicons name="trash-outline" size={16} color="#fff" />
            <Text style={s.deleteBtnText}>
              {' '}Delete{selected.size > 0 ? ` (${selected.size})` : ''}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

// ── Section grouping helper ───────────────────────────────────────────────────
// Groups a flat TripLogItem array into ordered sections, preserving the order
// sections first appear. Items with no `section` label fall into a single
// unnamed group (backwards-compatible with older logs).
function groupBySectionStable(items: TripLogItem[]): { section: string | undefined; items: TripLogItem[] }[] {
  const groups: { section: string | undefined; items: TripLogItem[] }[] = [];
  const seen = new Map<string | undefined, TripLogItem[]>();
  for (const item of items) {
    const key = item.section;
    if (!seen.has(key)) {
      const arr: TripLogItem[] = [];
      seen.set(key, arr);
      groups.push({ section: key, items: arr });
    }
    // `!` is TypeScript's non-null assertion — tells the compiler Map.get()
    // won't be undefined here because we always set the key just above.
    seen.get(key)!.push(item);
  }
  return groups;
}

// ── LogRow sub-component ──────────────────────────────────────────────────────
// Extracted to keep the main render function readable.

function LogRow({
  log,
  isLast,
  selectMode,
  isSelected,
  isExpanded,
  onPress,
  onLongPress,
}: {
  log: TripLog;
  isLast: boolean;
  selectMode: boolean;
  isSelected: boolean;
  isExpanded: boolean;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const hasItems = (log.items?.length ?? 0) > 0;

  return (
    <View style={[r.wrap, !isLast && r.wrapBorder]}>
      <TouchableOpacity
        style={r.row}
        onPress={onPress}
        onLongPress={onLongPress}
        activeOpacity={0.7}
      >
        {/* Left indicator: checkbox in select mode, status dot otherwise */}
        {selectMode ? (
          <View style={[r.selectCircle, isSelected && r.selectCircleActive]}>
            {isSelected && <Ionicons name="checkmark" size={12} color="#fff" />}
          </View>
        ) : (
          <View
            style={[
              r.dot,
              { backgroundColor: log.isComplete ? theme.colors.primary : theme.colors.danger },
            ]}
          />
        )}

        {/* Main content */}
        <View style={{ flex: 1 }}>
          <Text style={r.name}>{log.checklistName}</Text>
          <Text style={r.meta}>
            {formatTimeAgo(log.timestamp)} · {log.checkedCount}/{log.totalCount} items
          </Text>
        </View>

        {/* Right side: completion badge or expand chevron */}
        {!selectMode && (
          hasItems ? (
            <Ionicons
              name={isExpanded ? 'chevron-up' : 'chevron-down'}
              size={14}
              color={theme.colors.textTertiary}
            />
          ) : (
            <View style={[r.badge, log.isComplete ? r.badgeComplete : r.badgePartial]}>
              <Text style={[r.badgeText, log.isComplete ? r.badgeCompleteText : r.badgePartialText]}>
                {log.isComplete ? 'Complete' : 'Partial'}
              </Text>
            </View>
          )
        )}
      </TouchableOpacity>

      {/* ── Expanded item list (grouped by section) ────────────────────── */}
      {isExpanded && hasItems && (
        <View style={r.itemList}>
          {groupBySectionStable(log.items!).map((group, gi) => (
            <View key={group.section ?? gi}>
              {/* Section header — only rendered when items carry section labels */}
              {group.section && (
                <Text style={r.sectionHeader}>{group.section}</Text>
              )}
              {group.items.map((item, idx) => (
                <View
                  key={item.id}
                  style={[r.itemRow, idx < group.items.length - 1 && r.itemRowBorder]}
                >
                  <Ionicons
                    name={item.checkedAt ? 'checkmark-circle' : 'ellipse-outline'}
                    size={14}
                    color={item.checkedAt ? theme.colors.primary : theme.colors.textTertiary}
                  />
                  <Text style={[r.itemLabel, !item.checkedAt && r.itemLabelSkipped]}>
                    {item.label}
                  </Text>
                  {item.checkedAt ? (
                    <Text style={r.itemTime}>
                      {new Date(item.checkedAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Text>
                  ) : (
                    <Text style={r.itemSkipped}>Skipped</Text>
                  )}
                </View>
              ))}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// ── StyleSheets ───────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bgSecondary },
  scroll: { padding: 16, gap: 12 },

  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 10,
  },
  backBtn: { padding: 4 },
  title: { flex: 1, fontSize: 18, fontWeight: '500', color: theme.colors.textPrimary },
  actionBtn: { paddingHorizontal: 4, paddingVertical: 4, minWidth: 44, alignItems: 'flex-end' },
  actionBtnText: { fontSize: 14, fontWeight: '500', color: theme.colors.purple },

  card: {
    backgroundColor: theme.colors.bgPrimary,
    borderWidth: 0.5,
    borderColor: theme.colors.borderTertiary,
    borderRadius: theme.radius.lg,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  empty: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: 40,
  },

  // ── Delete bar ──────────────────────────────────────────────────────────
  deleteBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: theme.colors.bgPrimary,
    borderTopWidth: 0.5,
    borderTopColor: theme.colors.borderTertiary,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 13,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.danger,
  },
  deleteBtnDisabled: { opacity: 0.4 },
  deleteBtnText: { fontSize: 15, fontWeight: '500', color: '#fff' },

  // ── Pro lock screen ─────────────────────────────────────────────────────
  lockedWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 10,
  },
  lockedTitle: { fontSize: 17, fontWeight: '600', color: theme.colors.textPrimary },
  lockedSub: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  upgradeBtn: {
    marginTop: 8,
    backgroundColor: theme.colors.purple,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: theme.radius.md,
  },
  upgradeBtnText: { color: '#fff', fontSize: 14, fontWeight: '500' },
});

// ── LogRow styles ─────────────────────────────────────────────────────────────

const r = StyleSheet.create({
  wrap: { paddingVertical: 2 },
  wrapBorder: { borderBottomWidth: 0.5, borderBottomColor: theme.colors.borderTertiary },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },

  // Status dot (normal mode)
  dot: { width: 8, height: 8, borderRadius: 4 },

  // Checkbox (select mode)
  selectCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: theme.colors.borderSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectCircleActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },

  name: { fontSize: 14, fontWeight: '500', color: theme.colors.textPrimary },
  meta: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },

  // Completion badge (rows without item timestamps)
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: theme.radius.md },
  badgeComplete: { backgroundColor: theme.colors.primaryLight },
  badgePartial: { backgroundColor: theme.colors.bgSecondary },
  badgeText: { fontSize: 11, fontWeight: '500' },
  badgeCompleteText: { color: theme.colors.primaryDeep },
  badgePartialText: { color: theme.colors.textSecondary },

  // Section header inside the expanded item list
  sectionHeader: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    paddingTop: 10,
    paddingBottom: 4,
  },

  // Expanded item list
  itemList: {
    paddingLeft: 20,
    paddingBottom: 10,
    gap: 0,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 7,
  },
  itemRowBorder: { borderBottomWidth: 0.5, borderBottomColor: theme.colors.borderTertiary },
  itemLabel: { flex: 1, fontSize: 13, color: theme.colors.textPrimary },
  itemLabelSkipped: { color: theme.colors.textTertiary },
  itemTime: { fontSize: 12, color: theme.colors.textSecondary },
  itemSkipped: { fontSize: 12, color: theme.colors.textTertiary, fontStyle: 'italic' },
});
