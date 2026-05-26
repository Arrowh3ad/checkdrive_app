// ─────────────────────────────────────────────────────────────────────────────
// services/firebase.ts  —  Firebase app + Auth initialization and helpers.
//
// WHAT THIS FILE DOES
//   • Boots the Firebase app from the keys in firebaseConfig.ts.
//   • Initializes Firebase Authentication with AsyncStorage persistence so the
//     user stays signed in across app restarts (without it, every cold start
//     would log the user out).
//   • Exposes small async helper functions (signUp / signIn / signOut / reset)
//     and an auth-state subscriber, so screens never import Firebase directly.
//
// WHY initializeAuth + getReactNativePersistence?
// In a browser, Firebase persists the session in IndexedDB automatically. React
// Native has no IndexedDB, so we must explicitly hand Firebase an AsyncStorage-
// backed persistence layer. `getReactNativePersistence` lives in Firebase's
// React Native build, which Metro resolves via the package's "react-native"
// export condition. (Node resolves a different build where it's absent — that's
// why a plain `node -e require` won't see it, but the app bundle will.)
//
// WHY THE try/catch AROUND initializeAuth?
// `initializeAuth` throws if it's called twice on the same app instance — which
// happens during Fast Refresh in development. The catch falls back to `getAuth`,
// which returns the already-initialized instance instead of crashing.
// ─────────────────────────────────────────────────────────────────────────────

import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  initializeAuth,
  getAuth,
  // Present only in Firebase's React Native build (see file header). The
  // TypeScript types resolve to the browser build where this is absent, so we
  // suppress the type error — it exists at runtime inside the app bundle.
  // @ts-ignore
  getReactNativePersistence,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  onAuthStateChanged,
  type Auth,
  type User,
} from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { firebaseConfig } from './firebaseConfig';

// Reuse an existing app instance if one already exists (Fast Refresh safety).
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

let auth: Auth;
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch {
  // Already initialized (e.g. Fast Refresh re-ran this module) — grab it.
  auth = getAuth(app);
}

export { auth };

// ── Auth-state subscription ─────────────────────────────────────────────────
// Returns an unsubscribe function. Used once near the app root (useAuthSync)
// to mirror Firebase's auth state into the Zustand store.
export function subscribeToAuth(cb: (user: User | null) => void) {
  return onAuthStateChanged(auth, cb);
}

// ── Auth actions ────────────────────────────────────────────────────────────
// Thin wrappers so screens stay decoupled from the Firebase SDK surface.
// Emails are trimmed because mobile keyboards love to append a trailing space.

export async function signUpWithEmail(email: string, password: string): Promise<void> {
  await createUserWithEmailAndPassword(auth, email.trim(), password);
}

export async function signInWithEmail(email: string, password: string): Promise<void> {
  await signInWithEmailAndPassword(auth, email.trim(), password);
}

export async function signOutUser(): Promise<void> {
  await signOut(auth);
}

export async function sendPasswordReset(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email.trim());
}

// ── Error mapping ───────────────────────────────────────────────────────────
// Firebase throws errors with machine-readable `.code` strings. Translate the
// common ones into plain language the user can act on. Anything unmapped falls
// back to a generic message so we never surface a raw Firebase error code.
export function authErrorMessage(code: string): string {
  switch (code) {
    case 'auth/invalid-email':
      return 'That email address looks invalid.';
    case 'auth/missing-password':
      return 'Please enter your password.';
    case 'auth/weak-password':
      return 'Password should be at least 6 characters.';
    case 'auth/email-already-in-use':
      return 'An account with this email already exists. Try signing in instead.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Incorrect email or password.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a moment and try again.';
    case 'auth/network-request-failed':
      return 'Network error. Check your connection and try again.';
    case 'auth/configuration-not-found':
    case 'auth/api-key-not-valid':
    case 'auth/invalid-api-key':
    case 'auth/operation-not-allowed':
      return 'Sign-in is not set up yet. Add your Firebase keys in src/services/firebaseConfig.ts and enable Email/Password in the Firebase console.';
    default:
      return 'Something went wrong. Please try again.';
  }
}
