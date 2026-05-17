'use strict';

const functions = require('firebase-functions');
const admin     = require('firebase-admin');
const fetch     = require('node-fetch');
const { v4: uuidv4 } = require('uuid');

admin.initializeApp();
const db = admin.firestore();

// ── MTN MoMo helpers ──────────────────────────────────────────────────────────

function cfg()      { return functions.config().momo ?? {}; }
function momoBase() {
  return (cfg().environment ?? 'sandbox') === 'sandbox'
    ? 'https://sandbox.momoapi.mtn.com'
    : 'https://proxy.momoapi.mtn.com';
}

async function getMoMoToken() {
  const creds = Buffer.from(`${cfg().api_user}:${cfg().api_key}`).toString('base64');
  const res = await fetch(`${momoBase()}/collection/token/`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${creds}`,
      'Ocp-Apim-Subscription-Key': cfg().subscription_key,
    },
  });
  if (!res.ok) throw new Error(`Token error: ${res.status}`);
  const { access_token } = await res.json();
  return access_token;
}

// Normalize Rwanda phone numbers: 0788... → 250788..., +250788... → 250788...
function normalizePhone(raw) {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('250')) return digits;
  if (digits.startsWith('0')) return '250' + digits.slice(1);
  return digits;
}

// ── Cloud Functions ───────────────────────────────────────────────────────────

/**
 * Initiate MTN MoMo "Request to Pay".
 * Client receives a USSD prompt on their phone and approves.
 *
 * Called from the React Native app via httpsCallable('initMoMoPayment')
 * Payload: { amount, currency, phone, invoiceId, invoiceNumber }
 * Returns: { referenceId, status: 'PENDING' }
 */
exports.initMoMoPayment = functions.https.onCall(async (data) => {
  const { amount, currency = 'RWF', phone, invoiceId, invoiceNumber } = data;

  if (!amount || !phone || !invoiceId) {
    throw new functions.https.HttpsError('invalid-argument', 'amount, phone and invoiceId are required');
  }

  const referenceId   = uuidv4();
  const token         = await getMoMoToken();
  const env           = cfg().environment ?? 'sandbox';
  const callbackUrl   = `https://us-central1-${process.env.GCLOUD_PROJECT}.cloudfunctions.net/momoCallback`;

  const payload = {
    amount:       String(Math.round(Number(amount))),
    currency,
    externalId:   invoiceId,
    payer:        { partyIdType: 'MSISDN', partyId: normalizePhone(phone) },
    payerMessage: `Payment for invoice ${invoiceNumber}`,
    payeeNote:    `Invoice ${invoiceNumber}`,
  };

  const res = await fetch(`${momoBase()}/collection/v1_0/requesttopay`, {
    method: 'POST',
    headers: {
      Authorization:                `Bearer ${token}`,
      'Ocp-Apim-Subscription-Key':  cfg().subscription_key,
      'Content-Type':               'application/json',
      'X-Reference-Id':             referenceId,
      'X-Target-Environment':       env,
      'X-Callback-Url':             callbackUrl,
    },
    body: JSON.stringify(payload),
  });

  if (res.status !== 202) {
    const errText = await res.text();
    functions.logger.error('MoMo initiate failed', { status: res.status, body: errText });
    throw new functions.https.HttpsError('internal', 'Could not initiate payment. Check your MoMo credentials.');
  }

  await db.collection('momoPayments').doc(referenceId).set({
    referenceId,
    invoiceId,
    invoiceNumber,
    amount: Number(amount),
    currency,
    phone: normalizePhone(phone),
    status: 'PENDING',
    environment: env,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { referenceId, status: 'PENDING' };
});

/**
 * Poll payment status for a referenceId.
 * Called from the app every 5 seconds while waiting.
 * Returns: { status: 'PENDING' | 'SUCCESSFUL' | 'FAILED', reason }
 */
exports.checkMoMoPayment = functions.https.onCall(async (data) => {
  const { referenceId } = data;
  if (!referenceId) throw new functions.https.HttpsError('invalid-argument', 'referenceId required');

  const token = await getMoMoToken();
  const env   = cfg().environment ?? 'sandbox';

  const res = await fetch(`${momoBase()}/collection/v1_0/requesttopay/${referenceId}`, {
    headers: {
      Authorization:               `Bearer ${token}`,
      'Ocp-Apim-Subscription-Key': cfg().subscription_key,
      'X-Target-Environment':      env,
    },
  });

  if (!res.ok) throw new functions.https.HttpsError('internal', 'Status check failed');
  const { status, reason } = await res.json();

  await db.collection('momoPayments').doc(referenceId).update({
    status,
    reason: reason ?? null,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { status, reason: reason ?? null };
});

/**
 * MTN webhook — MTN calls this URL after the payment is processed.
 * Always respond 200 quickly; MTN retries if it times out.
 */
exports.momoCallback = functions.https.onRequest(async (req, res) => {
  try {
    const { referenceId, status, reason } = req.body ?? {};
    if (referenceId) {
      await db.collection('momoPayments').doc(referenceId).update({
        status,
        reason:     reason ?? null,
        callbackAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      functions.logger.info(`MoMo callback: ${referenceId} → ${status}`);
    }
  } catch (err) {
    functions.logger.error('Callback error', err);
  }
  res.status(200).send('OK');
});
