import '@testing-library/jest-dom/vitest';

// jsdom in this project's config does not implement localStorage — polyfill
// a minimal in-memory version so components/hooks that rely on it are testable.
if (typeof window !== 'undefined' && !window.localStorage) {
  class MemoryStorage implements Storage {
    private store = new Map<string, string>();
    get length() { return this.store.size; }
    clear() { this.store.clear(); }
    getItem(key: string) { return this.store.has(key) ? this.store.get(key)! : null; }
    key(index: number) { return Array.from(this.store.keys())[index] ?? null; }
    removeItem(key: string) { this.store.delete(key); }
    setItem(key: string, value: string) { this.store.set(key, String(value)); }
  }
  Object.defineProperty(window, 'localStorage', { value: new MemoryStorage() });
}
