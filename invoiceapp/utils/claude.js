// Stamp scanner — calls the `scanStamp` Firebase Cloud Function, which in turn
// calls the OpenAI GPT-4o Vision API server-side.
//
// The OpenAI API key lives ONLY in Firebase Functions config (set with
// `firebase functions:config:set openai.key="sk-..."`) and is never bundled
// into the app binary. Do not add the key here.
//
// Do not rename this file — it is imported by name throughout the codebase.

import { isFirebaseConfigured } from './firebase';

let _fns = null;

async function getFns() {
  if (_fns) return _fns;
  const { getFunctions } = await import('firebase/functions');
  const { app } = await import('./firebase');
  _fns = getFunctions(app);
  return _fns;
}

/**
 * Sends a base64-encoded photo of a rubber stamp to the `scanStamp` Cloud
 * Function and returns a clean SVG string.
 *
 * @param {string} base64Image  Raw base64 (no data URI prefix)
 * @returns {Promise<string>}   SVG markup for the stamp
 */
export async function scanStampWithClaude(base64Image) {
  if (!isFirebaseConfigured) {
    throw new Error(
      'Firebase is not configured. Fill in utils/firebase.js before using the stamp scanner.',
    );
  }

  const { httpsCallable } = await import('firebase/functions');
  const fns = await getFns();
  const scanStamp = httpsCallable(fns, 'scanStamp');
  const { data } = await scanStamp({ image: base64Image });

  if (!data?.svg) throw new Error('Stamp scanner returned an empty response.');
  return data.svg;
}
