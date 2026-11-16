/**
 * Replaces the browser's localStorage with an in-memory store so nothing the app
 * writes is ever persisted to disk. Imported as the very first line of main.tsx,
 * before any other module runs, so every `localStorage` / `window.localStorage`
 * access across the app lands here instead of the real browser store.
 *
 * Reads return what was written earlier in the same page session and nothing more;
 * on refresh or a new tab the store starts empty — by design. Supabase auth uses
 * sessionStorage (see supabaseClient.ts), so sign-in still survives an in-tab
 * refresh; only cross-tab and cross-session persistence is dropped.
 */
const memory = new Map<string, string>();

const memoryStorage: Storage = {
  get length() {
    return memory.size;
  },
  clear() {
    memory.clear();
  },
  getItem(key: string) {
    const k = String(key);
    return memory.has(k) ? (memory.get(k) as string) : null;
  },
  key(index: number) {
    return Array.from(memory.keys())[index] ?? null;
  },
  removeItem(key: string) {
    memory.delete(String(key));
  },
  setItem(key: string, value: string) {
    memory.set(String(key), String(value));
  },
};

if (typeof window !== 'undefined') {
  try {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: memoryStorage,
    });
  } catch {
    try {
      window.localStorage.clear();
    } catch {
      // Storage is locked down entirely (some private modes); nothing to override.
    }
  }
}

export {};
