import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';

const KEYS = {
  INVOICES: 'invoices',
  CLIENTS: 'clients',
  SETTINGS: 'settings',
};

async function get(key) {
  const raw = await AsyncStorage.getItem(key);
  return raw ? JSON.parse(raw) : null;
}

async function set(key, value) {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

// ── Business Logo (file-based) ────────────────────────────────────────────────

const LOGO_FILE = FileSystem.documentDirectory + 'business_logo.jpg';

export async function getBusinessLogo() {
  try {
    const info = await FileSystem.getInfoAsync(LOGO_FILE);
    if (!info.exists) return null;
    const b64 = await FileSystem.readAsStringAsync(LOGO_FILE, { encoding: FileSystem.EncodingType.Base64 });
    return `data:image/jpeg;base64,${b64}`;
  } catch { return null; }
}

export async function saveBusinessLogo(base64DataUri) {
  if (!base64DataUri) {
    try { await FileSystem.deleteAsync(LOGO_FILE, { idempotent: true }); } catch {}
    return;
  }
  const b64 = base64DataUri.replace(/^data:image\/\w+;base64,/, '');
  await FileSystem.writeAsStringAsync(LOGO_FILE, b64, { encoding: FileSystem.EncodingType.Base64 });
}

// ── Business Profiles ─────────────────────────────────────────────────────────

const PROFILES_KEY = 'businessProfiles';
const ACTIVE_PROFILE_KEY = 'activeProfileId';

export async function getProfiles() {
  const raw = await AsyncStorage.getItem(PROFILES_KEY);
  return raw ? JSON.parse(raw) : [];
}

export async function saveProfile(profile) {
  const profiles = await getProfiles();
  const idx = profiles.findIndex(p => p.id === profile.id);
  if (idx >= 0) profiles[idx] = profile; else profiles.push(profile);
  await AsyncStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
}

export async function deleteProfile(id) {
  const profiles = await getProfiles();
  await AsyncStorage.setItem(PROFILES_KEY, JSON.stringify(profiles.filter(p => p.id !== id)));
}

export async function getActiveProfileId() {
  return await AsyncStorage.getItem(ACTIVE_PROFILE_KEY);
}

export async function setActiveProfileId(id) {
  if (id) await AsyncStorage.setItem(ACTIVE_PROFILE_KEY, id);
  else await AsyncStorage.removeItem(ACTIVE_PROFILE_KEY);
}

// ── Invoices ──────────────────────────────────────────────────────────────────

export async function getInvoices() {
  return (await get(KEYS.INVOICES)) ?? [];
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
  return invoice;
}

export async function deleteInvoice(id) {
  const invoices = await getInvoices();
  await set(KEYS.INVOICES, invoices.filter((i) => i.id !== id));
}

export async function archiveInvoice(id) {
  const invoices = await getInvoices();
  const idx = invoices.findIndex((i) => i.id === id);
  if (idx >= 0) {
    invoices[idx] = { ...invoices[idx], archived: !invoices[idx].archived };
    await set(KEYS.INVOICES, invoices);
  }
}

// Returns recent invoices (last N days), excluding archived — used on Dashboard
export async function getRecentInvoices(days = 7) {
  const invoices = await getInvoices();
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return invoices.filter((i) => !i.archived && new Date(i.createdAt).getTime() >= cutoff);
}

// ── Clients ───────────────────────────────────────────────────────────────────

export async function getClients() {
  return (await get(KEYS.CLIENTS)) ?? [];
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
  return client;
}

export async function deleteClient(id) {
  const clients = await getClients();
  await set(KEYS.CLIENTS, clients.filter((c) => c.id !== id));
}

// ── Settings ──────────────────────────────────────────────────────────────────

export async function getSettings() {
  return (await get(KEYS.SETTINGS)) ?? {
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
}

export async function saveSettings(settings) {
  await set(KEYS.SETTINGS, settings);
}
