// ─────────────────────────────────────────────────────────────────────────────
// utils/icons.ts  -  Custom-photo checklist icon paths.
//
// Custom photos are copied into <documentDirectory>/checklist-icons/ and we
// store only the RELATIVE path ("checklist-icons/icon-123.jpg") in the
// checklist's `iconUri`. The absolute documentDirectory path embeds the iOS
// app-container UUID (.../Application/<UUID>/Documents/...), which changes on
// every app update/reinstall - so an absolute URI saved by one build is a dead
// path in the next, and the icon renders as a blank square. We resolve to an
// absolute uri at render time against the CURRENT documentDirectory.
// ─────────────────────────────────────────────────────────────────────────────

import * as FileSystem from 'expo-file-system/legacy';

export const ICON_DIR = 'checklist-icons/';

// Absolute uri for an <Image source>, rebuilt from the current documentDirectory.
// Accepts new relative paths AND legacy absolute file:// URIs (which embed an old
// container path) - both are normalized to the stable relative part first, so a
// photo saved by an older build still resolves after an update. Anything that
// doesn't look like one of our managed icons is returned unchanged.
export function resolveIconUri(iconUri?: string): string | undefined {
  if (!iconUri) return undefined;
  const i = iconUri.indexOf(ICON_DIR);
  if (i < 0) return iconUri;
  return (FileSystem.documentDirectory ?? '') + iconUri.slice(i);
}
