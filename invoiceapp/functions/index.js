const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');

admin.initializeApp();

// Store the OpenAI key as a Firebase Secret (encrypted at rest).
// Set it once with: firebase functions:secrets:set OPENAI_KEY
// Then redeploy:    firebase deploy --only functions
const OPENAI_KEY = defineSecret('OPENAI_KEY');

// ─── Stamp Scanner ────────────────────────────────────────────────────────────
// Receives a base64 image of a rubber stamp and returns a clean SVG string.
// The OpenAI key never leaves this server-side environment.

exports.scanStamp = onCall({ secrets: [OPENAI_KEY] }, async (request) => {
  // Require authenticated app users only — rejects unauthenticated callers.
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'You must be signed in to use the stamp scanner.');
  }

  const { image } = request.data;
  if (!image || typeof image !== 'string') {
    throw new HttpsError('invalid-argument', 'A base64-encoded image is required.');
  }
  // Reject images over ~4 MB (base64 ~= 1.33× raw bytes)
  if (image.length > 5_500_000) {
    throw new HttpsError('invalid-argument', 'Image is too large. Please use a smaller photo.');
  }

  const { default: OpenAI } = await import('openai');
  const openai = new OpenAI({ apiKey: OPENAI_KEY.value() });

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `You are an SVG artist. The image shows a rubber stamp impression.
Reproduce it as a clean, minimal SVG:
- Use only black (#000) or dark ink colors on a transparent background.
- Return ONLY the raw SVG markup starting with <svg …> — no markdown, no explanation.
- The SVG viewBox should be "0 0 200 200" unless the stamp is very rectangular.
- Simplify rough edges; keep text and design elements accurate.`,
          },
          {
            type: 'image_url',
            image_url: { url: `data:image/jpeg;base64,${image}`, detail: 'high' },
          },
        ],
      },
    ],
  });

  const svg = response.choices?.[0]?.message?.content?.trim() ?? '';
  if (!svg.startsWith('<svg')) {
    throw new HttpsError('internal', 'Stamp scanner did not return a valid SVG.');
  }

  return { svg };
});

// ─── MTN MoMo Payments ────────────────────────────────────────────────────────
// These functions proxy requests to the MTN MoMo API.
// Configure credentials with:
//   firebase functions:config:set momo.subscription_key="..." momo.api_user="..." momo.api_key="..."

exports.initMoMoPayment = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Authentication required.');
  }

  const { amount, currency, phone, invoiceId, invoiceNumber } = request.data;
  if (!amount || !phone || !invoiceId) {
    throw new HttpsError('invalid-argument', 'amount, phone, and invoiceId are required.');
  }
  if (typeof amount !== 'number' || amount <= 0 || amount > 10_000_000) {
    throw new HttpsError('invalid-argument', 'Invalid payment amount.');
  }

  // TODO: replace with real MTN MoMo API call using functions.config().momo.*
  // See: https://momodeveloper.mtn.com/
  // Return format: { referenceId: string, status: 'PENDING' }
  throw new HttpsError('unimplemented', 'MTN MoMo integration not yet configured.');
});

exports.checkMoMoPayment = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Authentication required.');
  }

  const { referenceId } = request.data;
  if (!referenceId || typeof referenceId !== 'string') {
    throw new HttpsError('invalid-argument', 'referenceId is required.');
  }

  // TODO: replace with real MTN MoMo status check
  // Return format: { status: 'SUCCESSFUL' | 'FAILED' | 'PENDING' }
  throw new HttpsError('unimplemented', 'MTN MoMo integration not yet configured.');
});
