import { z } from 'zod';
import { supabase } from './supabase';

// ─── Schemas ──────────────────────────────────────────────────────────────────
// Validate data shapes before writing to Supabase. Invalid data is dropped
// rather than stored — this prevents malformed blobs from corrupting the cloud
// copy and catches bugs introduced by future code changes early.

const ItemSchema = z.object({
  id:          z.string().max(64),
  type:        z.enum(['item', 'section']),
  description: z.string().max(500).optional().default(''),
  notes:       z.string().max(500).optional().default(''),
  extra:       z.string().max(200).optional().default(''),
  qty:         z.union([z.number(), z.string()]).optional(),
  unitPrice:   z.union([z.number(), z.string()]).optional(),
});

const InvoiceSchema = z.object({
  id:         z.string().min(1).max(64),
  number:     z.string().max(32),
  type:       z.enum(['invoice', 'proforma']),
  status:     z.enum(['draft', 'sent', 'paid', 'overdue']),
  total:      z.number().nonnegative().max(1_000_000_000),
  currency:   z.string().max(8),
  items:      z.array(ItemSchema).max(200).optional().default([]),
  from:       z.object({ name: z.string().max(200).optional() }).passthrough().optional(),
  to:         z.object({ name: z.string().max(200).optional() }).passthrough().optional(),
}).passthrough();

const ClientSchema = z.object({
  id:    z.string().min(1).max(64),
  name:  z.string().max(200),
  email: z.string().max(254).optional(),
  phone: z.string().max(32).optional(),
}).passthrough();

const ProfileSchema = z.object({
  id:   z.string().min(1).max(64),
  name: z.string().max(200).optional(),
}).passthrough();

const SettingsSchema = z.object({
  name:     z.string().max(200).optional(),
  currency: z.string().max(8).optional(),
  language: z.string().max(8).optional(),
}).passthrough();

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getUserId() {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

// ─── Invoices ─────────────────────────────────────────────────────────────────

export async function syncInvoice(invoice) {
  try {
    const parsed = InvoiceSchema.safeParse(invoice);
    if (!parsed.success) return;
    const userId = await getUserId();
    if (!userId) return;
    await supabase.from('invoices').upsert({
      id: parsed.data.id, user_id: userId,
      data: parsed.data, updated_at: new Date().toISOString(),
    });
  } catch {}
}

export async function deleteInvoiceRemote(id) {
  try {
    const userId = await getUserId();
    if (!userId) return;
    await supabase.from('invoices').delete().eq('id', id).eq('user_id', userId);
  } catch {}
}

// ─── Clients ──────────────────────────────────────────────────────────────────

export async function syncClient(client) {
  try {
    const parsed = ClientSchema.safeParse(client);
    if (!parsed.success) return;
    const userId = await getUserId();
    if (!userId) return;
    await supabase.from('clients').upsert({
      id: parsed.data.id, user_id: userId,
      data: parsed.data, updated_at: new Date().toISOString(),
    });
  } catch {}
}

export async function deleteClientRemote(id) {
  try {
    const userId = await getUserId();
    if (!userId) return;
    await supabase.from('clients').delete().eq('id', id).eq('user_id', userId);
  } catch {}
}

// ─── Business Profiles ────────────────────────────────────────────────────────

export async function syncBusinessProfile(profile) {
  try {
    const parsed = ProfileSchema.safeParse(profile);
    if (!parsed.success) return;
    const userId = await getUserId();
    if (!userId) return;
    await supabase.from('business_profiles').upsert({
      id: parsed.data.id, user_id: userId,
      data: parsed.data, updated_at: new Date().toISOString(),
    });
  } catch {}
}

export async function deleteBusinessProfileRemote(id) {
  try {
    const userId = await getUserId();
    if (!userId) return;
    await supabase.from('business_profiles').delete().eq('id', id).eq('user_id', userId);
  } catch {}
}

// ─── Settings ─────────────────────────────────────────────────────────────────

export async function syncSettings(settings) {
  try {
    const parsed = SettingsSchema.safeParse(settings);
    if (!parsed.success) return;
    const userId = await getUserId();
    if (!userId) return;
    await supabase.from('settings').upsert({
      user_id: userId,
      data: parsed.data, updated_at: new Date().toISOString(),
    });
  } catch {}
}

// ─── Cloud pull / push (used at login) ───────────────────────────────────────

export async function pullFromCloud() {
  try {
    const userId = await getUserId();
    if (!userId) return null;

    const [invoicesRes, clientsRes, profilesRes, settingsRes] = await Promise.all([
      supabase.from('invoices').select('data').eq('user_id', userId),
      supabase.from('clients').select('data').eq('user_id', userId),
      supabase.from('business_profiles').select('data').eq('user_id', userId),
      supabase.from('settings').select('data').eq('user_id', userId).maybeSingle(),
    ]);

    return {
      invoices:        invoicesRes.data?.map(r => r.data) ?? null,
      clients:         clientsRes.data?.map(r => r.data) ?? null,
      businessProfiles: profilesRes.data?.map(r => r.data) ?? null,
      settings:        settingsRes.data?.data ?? null,
    };
  } catch { return null; }
}

export async function pushLocalDataToCloud({ invoices = [], clients = [], businessProfiles = [], settings = null }) {
  try {
    const userId = await getUserId();
    if (!userId) return;

    const ts = new Date().toISOString();
    const ops = [];

    const validInvoices = invoices.filter(inv => InvoiceSchema.safeParse(inv).success);
    const validClients  = clients.filter(c  => ClientSchema.safeParse(c).success);
    const validProfiles = businessProfiles.filter(p => ProfileSchema.safeParse(p).success);

    if (validInvoices.length)
      ops.push(supabase.from('invoices').upsert(validInvoices.map(inv => ({ id: inv.id, user_id: userId, data: inv, updated_at: ts }))));
    if (validClients.length)
      ops.push(supabase.from('clients').upsert(validClients.map(c => ({ id: c.id, user_id: userId, data: c, updated_at: ts }))));
    if (validProfiles.length)
      ops.push(supabase.from('business_profiles').upsert(validProfiles.map(p => ({ id: p.id, user_id: userId, data: p, updated_at: ts }))));
    if (settings && SettingsSchema.safeParse(settings).success)
      ops.push(supabase.from('settings').upsert({ user_id: userId, data: settings, updated_at: ts }));

    await Promise.all(ops);
  } catch {}
}
