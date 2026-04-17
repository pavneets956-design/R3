/**
 * Chrome Storage Adapter
 *
 * Provides a synchronous-read API backed by chrome.storage.local.
 * On init(), all v1:* keys are loaded into an in-memory Map.
 * Reads hit the Map (instant). Writes go to both Map and chrome.storage.local.
 *
 * This keeps extension data PRIVATE — unlike localStorage, which any page
 * script on reddit.com can read.
 */

const cache = new Map<string, string>();
let initialized = false;

/**
 * Load all extension data from chrome.storage.local into the in-memory cache.
 * MUST be called once before any storage read/write.
 */
export async function initChromeStore(): Promise<void> {
  if (initialized) return;
  try {
    const data = await chrome.storage.local.get(null);
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'string') {
        cache.set(key, value);
      }
    }
  } catch {
    // If chrome.storage is unavailable (e.g. in tests), fail silently.
  }
  initialized = true;
}

/**
 * Drop-in replacement for window.localStorage with the same sync interface,
 * but backed by chrome.storage.local for security.
 */
export const chromeStore = {
  getItem(key: string): string | null {
    return cache.get(key) ?? null;
  },

  setItem(key: string, value: string): void {
    cache.set(key, value);
    // Fire-and-forget async write to chrome.storage.local
    try {
      chrome.storage.local.set({ [key]: value });
    } catch {
      // Swallow — never break the extension for a storage write.
    }
  },

  removeItem(key: string): void {
    cache.delete(key);
    try {
      chrome.storage.local.remove(key);
    } catch {
      // Swallow
    }
  },

  get length(): number {
    return cache.size;
  },

  key(index: number): string | null {
    const keys = [...cache.keys()];
    return keys[index] ?? null;
  },

  /** Returns all keys matching a prefix. Used for clearAllData(). */
  keysWithPrefix(prefix: string): string[] {
    return [...cache.keys()].filter((k) => k.startsWith(prefix));
  },
};
