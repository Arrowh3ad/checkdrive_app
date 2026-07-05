import { computeStreak } from '../streaks';

// Fixed "now" so tests never depend on the wall clock. Local-time ISO strings
// (no Z) parse in the device's zone, matching how computeStreak buckets days.
const NOW = new Date('2026-07-04T12:00:00');

describe('computeStreak', () => {
  it('returns zeros with no trips', () => {
    expect(computeStreak([], NOW)).toEqual({ current: 0, best: 0 });
  });

  it('counts consecutive days ending today', () => {
    const ts = ['2026-07-04T08:00:00', '2026-07-03T09:30:00', '2026-07-02T22:00:00'];
    expect(computeStreak(ts, NOW)).toEqual({ current: 3, best: 3 });
  });

  it('keeps the streak alive when the last trip was yesterday', () => {
    const ts = ['2026-07-03T18:00:00', '2026-07-02T08:00:00'];
    expect(computeStreak(ts, NOW)).toEqual({ current: 2, best: 2 });
  });

  it('resets current after a missed day but remembers the best', () => {
    // 3-day run in June, then a gap, then a single trip today.
    const ts = [
      '2026-07-04T08:00:00',
      '2026-06-22T08:00:00',
      '2026-06-21T08:00:00',
      '2026-06-20T08:00:00',
    ];
    expect(computeStreak(ts, NOW)).toEqual({ current: 1, best: 3 });
  });

  it('drops current to zero when the last trip is 2+ days old', () => {
    const ts = ['2026-07-01T08:00:00', '2026-06-30T08:00:00'];
    expect(computeStreak(ts, NOW)).toEqual({ current: 0, best: 2 });
  });

  it('counts multiple trips on the same day once', () => {
    const ts = ['2026-07-04T08:00:00', '2026-07-04T12:00:00', '2026-07-04T18:00:00'];
    expect(computeStreak(ts, NOW)).toEqual({ current: 1, best: 1 });
  });

  it('buckets by calendar day, not 24h windows', () => {
    // 23:59 and 00:01 are 2 minutes apart but different days - consecutive.
    const ts = ['2026-07-04T00:01:00', '2026-07-03T23:59:00'];
    expect(computeStreak(ts, NOW)).toEqual({ current: 2, best: 2 });
  });
});
