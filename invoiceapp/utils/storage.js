import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { cache } from './cache';

const KEYS = {
  INVOICES:         'invoices',
  CLIENTS:          'clients',
  SETTINGS:         'settings',
  PROFILES:         'businessProfiles',
  ACTIVE_PROFILE:   'activeProfileId',
  PRODUCTS:         'products',
};

async function get(key) {
  const raw = await AsyncStorage.getItem(key);
  return raw ? JSON.parse(raw) : null;
}

async function set(key, value) {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

// ── Business Logo (file-based, not cached — always load fresh for PDF) ─────────

const LOGO_FILE = FileSystem.documentDirectory + 'business_logo.jpg';

export async function getBusinessLogo() {
  try {
    const info = await FileSystem.getInfoAsync(LOGO_FILE);
    if (!info.exists) return null;
    const b64 = await FileSystem.readAsStringAsync(LOGO_FILE, { encoding: 'base64' });
    return `data:image/jpeg;base64,${b64}`;
  } catch { return null; }
}

export async function saveBusinessLogo(base64DataUri) {
  if (!base64DataUri) {
    try { await FileSystem.deleteAsync(LOGO_FILE, { idempotent: true }); } catch {}
    return;
  }
  const b64 = base64DataUri.replace(/^data:image\/\w+;base64,/, '');
  await FileSystem.writeAsStringAsync(LOGO_FILE, b64, { encoding: 'base64' });
}

// ── Stamp — SVG from AI scanner (legacy) ──────────────────────────────────────

const STAMP_FILE = FileSystem.documentDirectory + 'business_stamp.svg';

export async function getStamp() {
  try {
    const info = await FileSystem.getInfoAsync(STAMP_FILE);
    if (!info.exists) return null;
    return await FileSystem.readAsStringAsync(STAMP_FILE);
  } catch { return null; }
}

export async function getStampDataUri() {
  const svg = await getStamp();
  if (!svg) return null;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

export async function saveStamp(svgText) {
  if (!svgText) {
    try { await FileSystem.deleteAsync(STAMP_FILE, { idempotent: true }); } catch {}
    return;
  }
  await FileSystem.writeAsStringAsync(STAMP_FILE, svgText);
}

// ── Stamp — PNG from remove.bg (photo-based) ──────────────────────────────────
// Stored separately so both SVG and photo stamps can co-exist.
// The photo stamp takes priority in invoice rendering.

const STAMP_PHOTO_FILE = FileSystem.documentDirectory + 'business_stamp_photo.png';

export async function getStampPhoto() {
  try {
    const info = await FileSystem.getInfoAsync(STAMP_PHOTO_FILE);
    if (!info.exists) return null;
    const b64 = await FileSystem.readAsStringAsync(STAMP_PHOTO_FILE, { encoding: 'base64' });
    return `data:image/png;base64,${b64}`;
  } catch { return null; }
}

export async function saveStampPhoto(base64png) {
  if (!base64png) {
    try { await FileSystem.deleteAsync(STAMP_PHOTO_FILE, { idempotent: true }); } catch {}
    return;
  }
  // Accept either raw base64 or a data URI
  const raw = base64png.replace(/^data:image\/png;base64,/, '');
  await FileSystem.writeAsStringAsync(STAMP_PHOTO_FILE, raw, { encoding: 'base64' });
}

// ── Business Profiles ─────────────────────────────────────────────────────────

export async function getProfiles() {
  const cached = cache.get(KEYS.PROFILES);
  if (cached !== undefined) return cached;
  const raw = await AsyncStorage.getItem(KEYS.PROFILES);
  const data = raw ? JSON.parse(raw) : [];
  cache.set(KEYS.PROFILES, data);
  return data;
}

export async function saveProfile(profile) {
  const profiles = await getProfiles();
  const idx = profiles.findIndex(p => p.id === profile.id);
  if (idx >= 0) profiles[idx] = profile; else profiles.push(profile);
  await AsyncStorage.setItem(KEYS.PROFILES, JSON.stringify(profiles));
  cache.set(KEYS.PROFILES, profiles);
  import('./sync').then(m => m.syncBusinessProfile(profile)).catch(() => {});
}

export async function deleteProfile(id) {
  const profiles = await getProfiles();
  const updated = profiles.filter(p => p.id !== id);
  await AsyncStorage.setItem(KEYS.PROFILES, JSON.stringify(updated));
  cache.set(KEYS.PROFILES, updated);
  import('./sync').then(m => m.deleteBusinessProfileRemote(id)).catch(() => {});
}

export async function getActiveProfileId() {
  const cached = cache.get(KEYS.ACTIVE_PROFILE);
  if (cached !== undefined) return cached;
  const id = await AsyncStorage.getItem(KEYS.ACTIVE_PROFILE);
  cache.set(KEYS.ACTIVE_PROFILE, id);
  return id;
}

export async function setActiveProfileId(id) {
  if (id) await AsyncStorage.setItem(KEYS.ACTIVE_PROFILE, id);
  else await AsyncStorage.removeItem(KEYS.ACTIVE_PROFILE);
  cache.set(KEYS.ACTIVE_PROFILE, id ?? null);
}

// ── Invoices ──────────────────────────────────────────────────────────────────

export async function getInvoices() {
  const cached = cache.get(KEYS.INVOICES);
  if (cached !== undefined) return cached;
  const data = (await get(KEYS.INVOICES)) ?? [];
  cache.set(KEYS.INVOICES, data);
  return data;
}

export async function saveInvoice(invoice) {
  const invoices = await getInvoices();
  const idx = invoices.findIndex((i) => i.id === invoice.id);
  if (idx >= 0) {
    invoices[idx] = invoice;
  } else {
    invoices.unshift(invoice);
  }
  await set(KEYS.INVOICES, invoices);
  cache.set(KEYS.INVOICES, invoices);
  import('./sync').then(m => m.syncInvoice(invoice)).catch(() => {});
  return invoice;
}

export async function deleteInvoice(id) {
  const invoices = await getInvoices();
  const updated = invoices.filter((i) => i.id !== id);
  await set(KEYS.INVOICES, updated);
  cache.set(KEYS.INVOICES, updated);
  import('./sync').then(m => m.deleteInvoiceRemote(id)).catch(() => {});
}

export async function archiveInvoice(id) {
  const invoices = await getInvoices();
  const idx = invoices.findIndex((i) => i.id === id);
  if (idx >= 0) {
    invoices[idx] = { ...invoices[idx], archived: !invoices[idx].archived };
    await set(KEYS.INVOICES, invoices);
    cache.set(KEYS.INVOICES, invoices);
    import('./sync').then(m => m.syncInvoice(invoices[idx])).catch(() => {});
  }
}

export async function getRecentInvoices(days = 7) {
  const invoices = await getInvoices();
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return invoices.filter((i) => !i.archived && new Date(i.createdAt).getTime() >= cutoff);
}

// ── Clients ───────────────────────────────────────────────────────────────────

export async function getClients() {
  const cached = cache.get(KEYS.CLIENTS);
  if (cached !== undefined) return cached;
  const data = (await get(KEYS.CLIENTS)) ?? [];
  cache.set(KEYS.CLIENTS, data);
  return data;
}

export async function saveClient(client) {
  const clients = await getClients();
  const idx = clients.findIndex((c) => c.id === client.id);
  if (idx >= 0) {
    clients[idx] = client;
  } else {
    clients.unshift(client);
  }
  await set(KEYS.CLIENTS, clients);
  cache.set(KEYS.CLIENTS, clients);
  import('./sync').then(m => m.syncClient(client)).catch(() => {});
  return client;
}

export async function deleteClient(id) {
  const clients = await getClients();
  const updated = clients.filter((c) => c.id !== id);
  await set(KEYS.CLIENTS, updated);
  cache.set(KEYS.CLIENTS, updated);
  import('./sync').then(m => m.deleteClientRemote(id)).catch(() => {});
}

// ── Settings ──────────────────────────────────────────────────────────────────

export async function getSettings() {
  const cached = cache.get(KEYS.SETTINGS);
  if (cached !== undefined) return cached;
  const data = (await get(KEYS.SETTINGS)) ?? {
    name: '',
    address: '',
    tin: '',
    phone: '',
    language: 'en',
    currency: 'RWF',
    momoNumber: '',
    momoCode: '',
    notificationsEnabled: true,
  };
  cache.set(KEYS.SETTINGS, data);
  return data;
}

export async function saveSettings(settings) {
  await set(KEYS.SETTINGS, settings);
  cache.set(KEYS.SETTINGS, settings);
  import('./sync').then(m => m.syncSettings(settings)).catch(() => {});
}

// ── Products Catalog ──────────────────────────────────────────────────────────

export async function getProducts() {
  const cached = cache.get(KEYS.PRODUCTS);
  if (cached !== undefined) return cached;
  const data = (await get(KEYS.PRODUCTS)) ?? [];
  cache.set(KEYS.PRODUCTS, data);
  return data;
}

export async function saveProduct(product) {
  const products = await getProducts();
  const idx = products.findIndex(p => p.id === product.id);
  if (idx >= 0) products[idx] = product; else products.unshift(product);
  await set(KEYS.PRODUCTS, products);
  cache.set(KEYS.PRODUCTS, products);
}

export async function deleteProduct(id) {
  const products = await getProducts();
  const updated = products.filter(p => p.id !== id);
  await set(KEYS.PRODUCTS, updated);
  cache.set(KEYS.PRODUCTS, updated);
}

// ── Formatters ────────────────────────────────────────────────────────────────

export function formatCurrency(amount, currency = 'RWF') {
  if (currency === 'RWF') return `${Math.round(amount).toLocaleString()} RWF`;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
}
