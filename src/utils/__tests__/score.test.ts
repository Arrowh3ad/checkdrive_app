// ─────────────────────────────────────────────────────────────────────────────
// Tests for computeTripScore - the regular-trip scoring rules (ignore + only
// count phases that were run). Pure logic, no React/device.
// ─────────────────────────────────────────────────────────────────────────────

import { computeTripScore, ScoreInput } from '../score';
import { ChecklistItem } from '../../types';

// Build a list of items with the given ids (label === id for readability).
const items = (...ids: string[]): ChecklistItem[] => ids.map((id) => ({ id, label: id }));
// Turn a list of ids into a `{ id: true }` map (for checked / ignored).
const map = (...ids: string[]): Record<string, boolean> =>
  Object.fromEntries(ids.map((id) => [id, true]));

// A two-phase checklist base: 2 start items + 2 end items, nothing checked yet.
const twoPhaseBase: ScoreInput = {
  startItems: items('s1', 's2'),
  endItems: items('e1', 'e2'),
  hasStart: true,
  hasEnd: true,
  twoPhase: true,
  startDone: false,
  checked: {},
  ignored: {},
};

describe('computeTripScore - full runs', () => {
  it('two-phase, departure done + everything checked → 4/4 complete', () => {
    const r = computeTripScore({
      ...twoPhaseBase,
      startDone: true,
      checked: map('s1', 's2', 'e1', 'e2'),
    });
    expect(r).toMatchObject({ checkedCount: 4, totalCount: 4, isComplete: true });
  });

  it('two-phase, departure done but no arrival items checked → 2/4 incomplete', () => {
    const r = computeTripScore({ ...twoPhaseBase, startDone: true, checked: map('s1', 's2') });
    expect(r).toMatchObject({ checkedCount: 2, totalCount: 4, isComplete: false });
  });
});

describe('computeTripScore - only count phases you ran', () => {
  it('skips the un-run departure phase: arrival-only completion counts just the end items', () => {
    // The "ignored a connect reminder, then finished from the disconnect
    // reminder" case - start items must NOT be logged as misses.
    const r = computeTripScore({
      ...twoPhaseBase,
      startDone: false,
      checked: map('e1', 'e2'),
    });
    expect(r.countedStart).toHaveLength(0);
    expect(r).toMatchObject({ checkedCount: 2, totalCount: 2, isComplete: true });
  });

  it('single-phase (start-only) always counts its one list regardless of startDone', () => {
    const r = computeTripScore({
      startItems: items('s1', 's2'),
      endItems: [],
      hasStart: true,
      hasEnd: false,
      twoPhase: false,
      startDone: false,
      checked: map('s1', 's2'),
      ignored: {},
    });
    expect(r).toMatchObject({ checkedCount: 2, totalCount: 2, isComplete: true });
  });
});

describe('computeTripScore - ignored items', () => {
  it('drops ignored items from BOTH numerator and denominator', () => {
    // 2 start + 2 end, departure done, check s1 + e1, ignore s2 and e2 →
    // counted = s1, e1 → 2/2 complete (skipping what you didn\'t need keeps 100%).
    const r = computeTripScore({
      ...twoPhaseBase,
      startDone: true,
      checked: map('s1', 'e1'),
      ignored: map('s2', 'e2'),
    });
    expect(r).toMatchObject({ checkedCount: 2, totalCount: 2, isComplete: true });
    expect(r.countedStart.map((i) => i.id)).toEqual(['s1']);
    expect(r.countedEnd.map((i) => i.id)).toEqual(['e1']);
  });

  it('all items ignored → 0/0, treated as complete (nothing was needed)', () => {
    const r = computeTripScore({
      ...twoPhaseBase,
      startDone: true,
      ignored: map('s1', 's2', 'e1', 'e2'),
    });
    expect(r).toMatchObject({ checkedCount: 0, totalCount: 0, isComplete: true });
  });
});
