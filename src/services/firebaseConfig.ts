// ─────────────────────────────────────────────────────────────────────────────
// services/firebaseConfig.ts  —  Your Firebase project's connection keys.
//
// ┌─ IS IT SAFE TO COMMIT THESE KEYS? ────────────────────────────────────────┐
// │ YES. Firebase "web" config values (apiKey, authDomain, projectId, etc.)   │
// │ are NOT secrets — they only identify which Firebase project to talk to.    │
// │ Google designs them to ship inside client apps. Actual security comes from │
// │ Firebase Authentication rules + Firestore/Storage Security Rules, never    │
// │ from hiding these strings. So committing this file to GitHub is fine.      │
// └────────────────────────────────────────────────────────────────────────────┘
//
// HOW TO FILL THIS IN (one-time, ~3 minutes):
//   1. Go to https://console.firebase.google.com and create a project
//      (any name, e.g. "CheckDrive"). Google Analytics is optional — skip it.
//   2. In the project, click the "</>" (Web) icon to "Add app". Give it a
//      nickname (e.g. "CheckDrive Mobile"). You do NOT need Firebase Hosting.
//   3. Firebase shows you a `firebaseConfig = { ... }` object. Copy each value
//      into the matching field below.
//   4. In the left sidebar: Build → Authentication → Get started →
//      Sign-in method tab → enable "Email/Password" → Save.
//   5. Rebuild the app (see the chat instructions). That's it.
//
// Until you complete the steps above, the app still runs fine — only the
// sign-in / sign-up buttons will show a friendly "Auth not configured" message.
// ─────────────────────────────────────────────────────────────────────────────

export const firebaseConfig = {
  apiKey: 'PASTE_YOUR_API_KEY_HERE',
  authDomain: 'PASTE_YOUR_AUTH_DOMAIN_HERE',          // e.g. checkdrive-xxxxx.firebaseapp.com
  projectId: 'PASTE_YOUR_PROJECT_ID_HERE',            // e.g. checkdrive-xxxxx
  storageBucket: 'PASTE_YOUR_STORAGE_BUCKET_HERE',    // e.g. checkdrive-xxxxx.appspot.com
  messagingSenderId: 'PASTE_YOUR_MESSAGING_SENDER_ID_HERE',
  appId: 'PASTE_YOUR_APP_ID_HERE',
};

// Convenience flag: true once the placeholders above have been replaced with
// real values. The UI uses this to show a setup hint instead of a confusing
// network error when Firebase hasn't been configured yet.
export const isFirebaseConfigured =
  !firebaseConfig.apiKey.startsWith('PASTE_');
