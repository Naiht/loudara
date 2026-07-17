import type { StreamData } from '@core/streaming';

const STREAM_CACHE_TTL_MS = 10 * 60 * 1000;

type StreamCacheEntry = {
  savedAt: number;
  data: StreamData;
};

function isStreamCacheEntry(value: unknown): value is StreamCacheEntry {
  return Boolean(
    value &&
    typeof value === 'object' &&
    'savedAt' in value &&
    'data' in value
  );
}

export const streamCache = {
  get: (id: string): StreamData | null => {
    try {
      if (typeof sessionStorage === 'undefined') return null;
      const data = sessionStorage.getItem(`streamData_${id}`);
      if (!data) return null;

      const parsed = JSON.parse(data) as StreamData | StreamCacheEntry;

      if (isStreamCacheEntry(parsed)) {
        if ((Date.now() - parsed.savedAt) > STREAM_CACHE_TTL_MS) {
          sessionStorage.removeItem(`streamData_${id}`);
          return null;
        }

        return parsed.data;
      }

      return parsed;
    } catch (e) {
      console.error('Failed to parse stream data from cache', e);
      return null;
    }
  },
  set: (id: string, data: StreamData) => {
    try {
      if (typeof sessionStorage === 'undefined') return;
      sessionStorage.setItem(`streamData_${id}`, JSON.stringify({
        savedAt: Date.now(),
        data
      } satisfies StreamCacheEntry));
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
