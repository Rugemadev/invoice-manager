import { initializeApp, getApps } from 'firebase/app';

// ─── REPLACE THESE with your Firebase project values ─────────────────────────
// Firebase Console → Project Settings → Your apps → Web app → SDK setup
const firebaseConfig = {
  apiKey:            'YOUR_API_KEY',
  authDomain:        'YOUR_PROJECT_ID.firebaseapp.com',
  projectId:         'YOUR_PROJECT_ID',
  storageBucket:     'YOUR_PROJECT_ID.appspot.com',
  messagingSenderId: 'YOUR_SENDER_ID',
  appId:             'YOUR_APP_ID',
};
// ─────────────────────────────────────────────────────────────────────────────

export const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
