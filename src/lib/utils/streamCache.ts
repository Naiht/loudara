import type { StreamData } from '@core/streaming';

export const streamCache = {
  get: (id: string): StreamData | null => {
    try {
      if (typeof sessionStorage === 'undefined') return null;
      const data = sessionStorage.getItem(`streamData_${id}`);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      console.error('Failed to parse stream data from cache', e);
      return null;
    }
  },
  set: (id: string, data: StreamData) => {
    try {
      if (typeof sessionStorage === 'undefined') return;
      sessionStorage.setItem(`streamData_${id}`, JSON.stringify(data));
    } catch (e) {
      console.warn('Failed to save stream data to cache (possibly storage limit reached)', e);
    }
  },
  remove: (id: string) => {
    if (typeof sessionStorage === 'undefined') return;
    sessionStorage.removeItem(`streamData_${id}`);
  },
  clear: () => {
    if (typeof sessionStorage === 'undefined') return;
    Object.keys(sessionStorage).forEach(key => {
      if (key.startsWith('streamData_')) {
        sessionStorage.removeItem(key);
      }
    });
  }
};
