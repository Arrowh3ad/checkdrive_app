// ─────────────────────────────────────────────────────────────────────────────
// constants.ts  -  App-wide constants shared across screens and the store.
// ─────────────────────────────────────────────────────────────────────────────

// Free-tier checklist cap. Pro (lifetime unlock) removes this. Defined once so
// the creation gate (HomeScreen) and any other reference stay in sync.
export const FREE_CHECKLIST_LIMIT = 3;
