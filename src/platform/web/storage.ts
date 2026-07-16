import type { StoragePort } from '../contracts';

function getLocalStorage(): Storage | null {
  if (typeof window === 'undefined' || !('localStorage' in window)) return null;

  try {
    const testKey = '__loudara_storage_test__';
    window.localStorage.setItem(testKey, testKey);
    window.localStorage.removeItem(testKey);
    return window.localStorage;
  } catch {
    return null;
  }
}

export const webStorage: StoragePort = {
  async get<T>(key: string): Promise<T | null> {
    const storage = getLocalStorage();
    if (!storage) return null;

    const raw = storage.getItem(key);
    if (raw === null) return null;

    try {
      return JSON.parse(raw) as T;
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn(`Failed to parse localStorage item "${key}"`, error);
      }
      return null;
    }
  },

  async set<T>(key: string, value: T): Promise<void> {
    const storage = getLocalStorage();
    if (!storage) return;

    try {
      storage.setItem(key, JSON.stringify(value));
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn(`Failed to write localStorage item "${key}"`, error);
      }
    }
  },

  async remove(key: string): Promise<void> {
    const storage = getLocalStorage();
    if (!storage) return;
    storage.removeItem(key);
  },

  async clear(): Promise<void> {
    const storage = getLocalStorage();
    if (!storage) return;
    storage.clear();
  }
};
