import { supabase } from './supabase';

/**
 * Initiate an MTN MoMo "Request to Pay".
 * The client receives a USSD prompt on their phone to approve.
 * Returns { referenceId, status: 'PENDING' }
 */
export async function requestMoMoPayment({ amount, currency, phone, invoiceId, invoiceNumber }) {
  const { data, error } = await supabase.functions.invoke('init-momo-payment', {
    body: { amount, currency, phone, invoiceId, invoiceNumber },
  });
  if (error) {
    let detail = error.message;
    try {
      const body = await error.context.json();
      if (body?.error) detail = body.error;
    } catch {}
    throw new Error(detail);
  }
  return data;
}

/**
 * Poll payment status until SUCCESSFUL, FAILED or maxAttempts exhausted.
 * onUpdate(status, attempt) is called after each poll.
 * Returns 'SUCCESSFUL' | 'FAILED' | 'TIMEOUT'
 */
export async function pollMoMoStatus(referenceId, { onUpdate, maxAttempts = 12, intervalMs = 5000 } = {}) {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, intervalMs));
    try {
      const { data, error } = await supabase.functions.invoke('check-momo-payment', {
        body: { referenceId },
      });
      if (error) continue; // network hiccup — keep polling
      onUpdate?.(data.status, i + 1);
      if (data.status === 'SUCCESSFUL') return 'SUCCESSFUL';
      if (data.status === 'FAILED')     return 'FAILED';
    } catch {
      // network hiccup — keep polling
    }
  }
  return 'TIMEOUT';
}
