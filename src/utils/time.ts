// ─────────────────────────────────────────────────────────────────────────────
// utils/time.ts  -  Human-readable relative timestamps.
//
// Used in HomeScreen's "Recent trips" list to display time-ago strings like
// "Today, 9:42am" or "Yesterday".
// ─────────────────────────────────────────────────────────────────────────────

// Converts an ISO timestamp string into a user-readable label.
// The function intentionally avoids internationalization libraries to keep
// the bundle light - this app targets a narrow set of English-language users.
export function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();

  // Pre-compute each granularity so the comparisons below stay readable.
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  // Helper to format a 12-hour clock string from an ISO date.
  function clockStr(d: Date): string {
    const h = d.getHours();
    const m = d.getMinutes();
    const ampm = h >= 12 ? 'pm' : 'am';
    const h12 = h % 12 || 12; // convert 0 → 12 for midnight
    return `${h12}:${m.toString().padStart(2, '0')}${ampm}`;
  }

  const date = new Date(iso);

  // Less than 60 minutes or less than 24 hours - both show as "Today, H:MMam".
  // We show the exact clock time rather than a fuzzy "2 hours ago" so the user
  // can relate the log entry to a specific part of their day.
  if (hours < 24) return `Today, ${clockStr(date)}`;

  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;

  // Anything older than a week shows the locale date (e.g. "5/1/2026").
  return date.toLocaleDateString();
}
