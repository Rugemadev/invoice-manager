// Firebase/MoMo helpers — lazily initialized so a missing config doesn't crash the app

let _fns = null;

async function getFns() {
  if (_fns) return _fns;
  const { getFunctions } = await import('firebase/functions');
  const { app } = await import('./firebase');
  _fns = getFunctions(app);
  return _fns;
}

/**
 * Initiate an MTN MoMo "Request to Pay".
 * The client receives a USSD prompt on their phone to approve.
 * Returns { referenceId, status: 'PENDING' }
 */
export async function requestMoMoPayment({ amount, currency, phone, invoiceId, invoiceNumber }) {
  const { httpsCallable } = await import('firebase/functions');
  const fns = await getFns();
  const fn = httpsCallable(fns, 'initMoMoPayment');
  const { data } = await fn({ amount, currency, phone, invoiceId, invoiceNumber });
  return data;
}

/**
 * Poll payment status until SUCCESSFUL, FAILED or maxAttempts exhausted.
 * onUpdate(status, attempt) is called after each poll.
 * Returns 'SUCCESSFUL' | 'FAILED' | 'TIMEOUT'
 */
export async function pollMoMoStatus(referenceId, { onUpdate, maxAttempts = 12, intervalMs = 5000 } = {}) {
  const { httpsCallable } = await import('firebase/functions');
  const fns = await getFns();
  const fn = httpsCallable(fns, 'checkMoMoPayment');
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, intervalMs));
    try {
      const { data } = await fn({ referenceId });
      onUpdate?.(data.status, i + 1);
      if (data.status === 'SUCCESSFUL') return 'SUCCESSFUL';
      if (data.status === 'FAILED')     return 'FAILED';
    } catch {
      // Network hiccup — keep polling
    }
  }
  return 'TIMEOUT';
}
