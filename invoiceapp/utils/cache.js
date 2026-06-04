// In-memory cache — lives for the app's process lifetime.
// All reads hit the cache first; all writes invalidate the relevant key.
// This removes AsyncStorage round-trips on every screen focus.

const store = new Map();

export const cache = {
  get:   (key)         => store.get(key),
  set:   (key, value)  => store.set(key, value),
  del:   (key)         => store.delete(key),
  clear: ()            => store.clear(),
  has:   (key)         => store.has(key),
};

// Pre-load all frequently accessed keys at app startup so the first
// screen render is instant. Import storage lazily to avoid circular deps.
export async function preloadCache() {
  try {
    const {
      getInvoices, getClients, getSettings, getProfiles, getProducts,
    } = await import('./storage');
    await Promise.all([
      getInvoices(),
      getClients(),
      getSettings(),
      getProfiles(),
      getProducts(),
    ]);
  } catch {}
}
