export function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 60) {
    const h = new Date(iso).getHours();
    const m = new Date(iso).getMinutes();
    const ampm = h >= 12 ? 'pm' : 'am';
    const h12 = h % 12 || 12;
    return `Today, ${h12}:${m.toString().padStart(2, '0')}${ampm}`;
  }
  if (hours < 24) {
    const h = new Date(iso).getHours();
    const m = new Date(iso).getMinutes();
    const ampm = h >= 12 ? 'pm' : 'am';
    const h12 = h % 12 || 12;
    return `Today, ${h12}:${m.toString().padStart(2, '0')}${ampm}`;
  }
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return new Date(iso).toLocaleDateString();
}
