// ─────────────────────────────────────────────────────────────────────────────
// utils/ids.ts  -  Lightweight unique-ID generator.
//
// We use a base-36 combination of Math.random() and Date.now() instead of a
// UUID library to keep the bundle small. The IDs are used as React list keys
// and as Zustand-store primary keys (checklists, items, stops, trip logs).
//
// Collision risk: negligible for a local single-user app where the number of
// records is in the hundreds. If this ever needs server-side uniqueness, swap
// in `uuid` or `nanoid`.
// ─────────────────────────────────────────────────────────────────────────────
export function generateId(): string {
  // `Math.random().toString(36).slice(2, 10)` → 8 random base-36 chars
  // `Date.now().toString(36)`                 → monotonically increasing suffix
  // Combining both makes same-millisecond collisions practically impossible.
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}
