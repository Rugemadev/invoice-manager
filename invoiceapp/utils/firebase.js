import { initializeApp, getApps } from 'firebase/app';

// ─── REPLACE THESE with your Firebase project values ─────────────────────────
// Firebase Console → Project Settings → Your apps → Web app → SDK setup
// Then copy this file's values to .env (see .env.example) and read via
// process.env.EXPO_PUBLIC_FIREBASE_* once you add app.config.js.
const firebaseConfig = {
  apiKey:            'YOUR_API_KEY',
  authDomain:        'YOUR_PROJECT_ID.firebaseapp.com',
  projectId:         'YOUR_PROJECT_ID',
  storageBucket:     'YOUR_PROJECT_ID.appspot.com',
  messagingSenderId: 'YOUR_SENDER_ID',
  appId:             'YOUR_APP_ID',
};
// ─────────────────────────────────────────────────────────────────────────────

// Warn at startup if Firebase hasn't been configured yet. This surfaces
// misconfiguration early rather than letting MoMo payments silently fail.
if (firebaseConfig.apiKey === 'YOUR_API_KEY') {
  console.warn(
    '[Firebase] Config not set — MoMo payments and stamp scanner are disabled.\n' +
    'Fill in utils/firebase.js with your project values to activate these features.',
  );
}

export const isFirebaseConfigured = firebaseConfig.apiKey !== 'YOUR_API_KEY';

export const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
