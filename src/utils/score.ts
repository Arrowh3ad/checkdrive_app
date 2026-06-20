// ─────────────────────────────────────────────────────────────────────────────
// utils/score.ts  —  Pure trip-scoring logic for regular (non-multi-stop) runs.
//
// Extracted from ChecklistRunScreen so the rules below are unit-testable in
// isolation. Two ideas drive the score:
//
//   1. IGNORED ITEMS DON'T COUNT.
//      When the user taps "ignore" on an item they don't need this trip (e.g.
//      coffee on the way home), it's dropped from BOTH the numerator and the
//      denominator. Skipping something you didn't need never lowers your %.
//
//   2. ONLY PHASES YOU ACTUALLY RAN COUNT.
//      The score "activates" with the completion buttons, not with car
//      detection. A two-phase checklist only counts its start (departure) items
//      if the user completed the departure phase (`startDone`). So if you ignore
//      the connect reminder, then complete only the arrival items from the
//      disconnect reminder, the un-run departure items are NOT logged as misses.
//      Single-phase checklists (start-only or end-only) always count their one
//      list — there's no phase to skip.
// ─────────────────────────────────────────────────────────────────────────────

import { ChecklistItem } from '../types';

export type ScoreInput = {
  startItems: ChecklistItem[];
  endItems: ChecklistItem[];
  // Which lists this checklist actually has (mirrors ChecklistRunScreen).
  hasStart: boolean;
  hasEnd: boolean;
  // True when the checklist has BOTH a start and an end list (the tabbed flow).
  twoPhase: boolean;
  // True once the departure phase was completed via "Complete departure".
  startDone: boolean;
  // item id → checked / ignored maps for the current run.
  checked: Record<string, boolean>;
  ignored: Record<string, boolean>;
};

export type TripScore = {
  // The items that count toward the score, split by section, with ignored items
  // and un-run phases already removed. Callers reuse these for the per-item log.
  countedStart: ChecklistItem[];
  countedEnd: ChecklistItem[];
  checkedCount: number;
  totalCount: number;
  isComplete: boolean;
};

export function computeTripScore(input: ScoreInput): TripScore {
  const { startItems, endItems, hasStart, hasEnd, twoPhase, startDone, checked, ignored } = input;

  // Start items count only when the departure phase was actually run. For a
  // single-phase start-only checklist there's no departure step to skip, so it
  // always counts (twoPhase is false → the guard passes).
  const countStart = hasStart && (!twoPhase || startDone);
  // End items count whenever the checklist has them — finalizing IS completing
  // the arrival/only phase.
  const countEnd = hasEnd;

  const countedStart = countStart ? startItems.filter((it) => !ignored[it.id]) : [];
  const countedEnd = countEnd ? endItems.filter((it) => !ignored[it.id]) : [];

  const counted = [...countedStart, ...countedEnd];
  const checkedCount = counted.filter((it) => checked[it.id]).length;
  const totalCount = counted.length;

  return {
    countedStart,
    countedEnd,
    checkedCount,
    totalCount,
    // 0/0 (e.g. everything ignored) reads as complete — nothing was needed, so
    // the trip shouldn't be penalized as "incomplete".
    isComplete: checkedCount === totalCount,
  };
}
