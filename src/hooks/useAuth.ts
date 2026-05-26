// ─────────────────────────────────────────────────────────────────────────────
// hooks/useAuth.ts  —  Bridges Firebase auth state into the Zustand store.
//
// WHY A SYNC HOOK?
// Firebase's `onAuthStateChanged` is the single source of truth for "who is
// logged in". Rather than have every screen subscribe to Firebase directly, we
// subscribe ONCE near the app root (App.tsx calls `useAuthSync()`), and mirror
// the result into the store's `user` field. Screens then read `user` from the
// store like any other piece of state — no Firebase imports needed in the UI.
//
// The listener also handles session restoration on cold start: because the
// session is persisted to AsyncStorage (see services/firebase.ts), Firebase
// re-emits the signed-in user shortly after launch, and this hook pushes it
// into the store so the UI reflects the logged-in state automatically.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { subscribeToAuth } from '../services/firebase';

export function useAuthSync(): void {
  // Select just the setter so this hook never re-runs when `user` changes.
  const setUser = useAppStore((s) => s.setUser);

  useEffect(() => {
    // Returns the Firebase unsubscribe function directly, so React tears the
    // listener down on unmount.
    const unsubscribe = subscribeToAuth((fbUser) => {
      setUser(fbUser ? { uid: fbUser.uid, email: fbUser.email } : null);
    });
    return unsubscribe;
  }, [setUser]);
}
