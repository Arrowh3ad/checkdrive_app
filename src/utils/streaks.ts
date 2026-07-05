// ─────────────────────────────────────────────────────────────────────────────
// utils/streaks.ts  -  Consecutive-day trip streak, derived from trip logs.
//
// DERIVED, NOT STORED
// The streak is computed from tripLogs timestamps on render instead of being
// persisted as a counter. No new store state, no migration, and it can never
// drift out of sync with history (deleting logs correctly recomputes it).
// tripLogs is capped at 500 entries, so the scan is trivially cheap.
//
// RULES
// - Multiple trips on the same calendar day count once.
// - "Current" streak isn't broken until a full day is missed: a run ending
//   YESTERDAY still counts (you haven't failed today until today ends).
// - Days are compared in the device's local calendar. Mapping local Y/M/D
//   through Date.UTC gives clean integer day numbers immune to DST offsets.
// ─────────────────────────────────────────────────────────────────────────────

function dayNum(d: Date): number {
  return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000;
}

export function computeStreak(
  timestamps: string[],
  now: Date = new Date()
): { current: number; best: number } {
  // Unique local days, newest first.
  const days = [...new Set(timestamps.map((t) => dayNum(new Date(t))))].sort(
    (a, b) => b - a
  );
  if (days.length === 0) return { current: 0, best: 0 };

  // Longest consecutive run anywhere in history.
  let best = 1;
  let run = 1;
  for (let i = 1; i < days.length; i++) {
    run = days[i - 1] - days[i] === 1 ? run + 1 : 1;
    if (run > best) best = run;
  }

  // Current streak: the run ending today or yesterday.
  const today = dayNum(now);
  let current = 0;
  if (days[0] === today || days[0] === today - 1) {
    current = 1;
    for (let i = 1; i < days.length && days[i - 1] - days[i] === 1; i++) {
      current++;
    }
  }

  return { current, best };
}
