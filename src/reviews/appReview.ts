// ─────────────────────────────────────────────────────────────────────────────
// reviews/appReview.ts  -  One-time in-app "rate this app" prompt.
//
// Uses the OS-native review prompt (SKStoreReviewController on iOS, In-App
// Review on Android) via expo-store-review. We fire it once, after the user has
// completed enough trips to have formed an opinion, at a natural break (trip
// completion) - and never while an interstitial ad is showing (the caller gates
// on that). The OS itself also rate-limits the prompt, so this is best-effort:
// requestReview() may silently do nothing, which is expected and fine.
// ─────────────────────────────────────────────────────────────────────────────

import * as StoreReview from 'expo-store-review';
import { useAppStore } from '../store/useAppStore';

// Ask only after the user has some history with the app - enough trips to have
// an opinion worth leaving.
const REVIEW_TRIP_THRESHOLD = 15;

// Request the native review prompt if the user is eligible and we haven't asked
// before. Safe to call on every trip completion: it self-gates and only ever
// fires once. Never throws into the caller's flow.
export async function maybeRequestReview(): Promise<void> {
  const { settings, updateSettings } = useAppStore.getState();

  if (settings.reviewRequested) return;
  if (settings.totalTrips < REVIEW_TRIP_THRESHOLD) return;

  try {
    if (!(await StoreReview.isAvailableAsync())) return;
    // Mark BEFORE requesting so a throw (or repeated completions) can't re-prompt.
    updateSettings({ reviewRequested: true });
    await StoreReview.requestReview();
  } catch {
    /* a review prompt must never disrupt the user's flow */
  }
}
