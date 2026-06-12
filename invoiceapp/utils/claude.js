// Stamp scanner — calls the `scan-stamp` Supabase Edge Function, which in turn
// calls the OpenAI GPT-4o Vision API server-side.
//
// The OpenAI API key lives ONLY in Supabase Edge Function secrets (set via
// Supabase dashboard → Edge Functions → Secrets → OPENAI_KEY).
//
// Do not rename this file — it is imported by name throughout the codebase.

import { supabase } from './supabase';

/**
 * Sends a base64-encoded photo of a rubber stamp to the `scan-stamp` Edge
 * Function and returns a clean SVG string.
 *
 * @param {string} base64Image  Raw base64 (no data URI prefix)
 * @returns {Promise<string>}   SVG markup for the stamp
 */
export async function scanStampWithClaude(base64Image) {
  const { data, error } = await supabase.functions.invoke('scan-stamp', {
    body: { image: base64Image },
  });
  if (error) throw error;
  if (!data?.svg) throw new Error('Stamp scanner returned an empty response.');
  return data.svg;
}
