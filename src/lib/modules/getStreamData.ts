import { playerStore, setPlayerStore } from '@stores';
import { streamCache } from '@utils';
import { StreamUnavailableError, type StreamData } from '@core/streaming';
import { createWebStreamProvider } from '@platform/web/streaming';

export default async function(
  id: string,
  signal?: AbortSignal
): Promise<StreamData | Record<'error' | 'message', string>> {
  const cached = streamCache.get(id);

  try {
    const data = cached || await createWebStreamProvider({
      preferredProxy: playerStore.proxy
    }).getStreamData(id, signal);

    streamCache.set(id, data);
    setPlayerStore('proxy', data.proxy || '');
    return data;
  } catch (error) {
    const message = error instanceof StreamUnavailableError
      ? `${error.message}. Attempts: ${error.attempts.map(a => `${a.provider}${a.status ? ` ${a.status}` : ''}: ${a.message}`).join(' | ')}`
      : error instanceof Error ? error.message : 'Failed to fetch stream data';

    return { error: 'stream_unavailable', message };
  }
}
