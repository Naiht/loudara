import { setPlayerStore } from '@stores';
import { streamCache } from '@utils';
import { StreamUnavailableError, type StreamData } from '@core/streaming';
import { createWebStreamProvider } from '@platform/web/streaming';
import { getNativeStreamData, isNativeApp } from '@platform/native';

const STREAM_COOLDOWN_BASE_MS = 3_500;
const STREAM_COOLDOWN_MAX_MS = 12_000;

const inflightRequests = new Map<string, Promise<StreamData>>();

let cooldownUntil = 0;
let cooldownFailures = 0;

function isAbortError(error: unknown) {
  return (
    error instanceof DOMException && error.name === 'AbortError'
  ) || (
    error instanceof Error && error.name === 'AbortError'
  );
}

function isSaturationMessage(message: string) {
  return /429|403|too many|rate limit|unusual traffic|temporar|bot|forbidden|confirm|saturated|timeout/i.test(message);
}

async function waitForCooldown(signal?: AbortSignal) {
  const remaining = cooldownUntil - Date.now();
  if (remaining <= 0) return;

  setPlayerStore('status', 'Cooling down stream requests...');

  await new Promise<void>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, remaining);

    const onAbort = () => {
      window.clearTimeout(timeoutId);
      signal?.removeEventListener('abort', onAbort);
      reject(signal?.reason ?? new DOMException('Aborted', 'AbortError'));
    };

    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

async function resolveStreamData(id: string, signal?: AbortSignal): Promise<StreamData> {
  setPlayerStore('status', 'Obteniendo audio...');

  return isNativeApp
    ? getNativeStreamData(id)
    : createWebStreamProvider().getStreamData(id, signal);
}

export default async function(
  id: string,
  signal?: AbortSignal
): Promise<StreamData | Record<'error' | 'message', string>> {
  const cached = streamCache.get(id);
  if (signal?.aborted) {
    throw signal.reason ?? new DOMException('Aborted', 'AbortError');
  }

  try {
    if (cached) {
      cooldownFailures = 0;
      cooldownUntil = 0;
      setPlayerStore('proxy', cached.proxy || '');
      return cached;
    }

    await waitForCooldown(signal);

    const inflight = inflightRequests.get(id);
    const request = inflight || resolveStreamData(id, signal);

    if (!inflight) {
      inflightRequests.set(id, request);
    }

    const data = await request;

    streamCache.set(id, data);
    setPlayerStore('proxy', data.proxy || '');
    cooldownFailures = 0;
    cooldownUntil = 0;
    return data;
  } catch (error) {
    if (isAbortError(error) || signal?.aborted) {
      throw error;
    }

    const message = error instanceof StreamUnavailableError
      ? `${error.message}. Attempts: ${error.attempts.map(a => `${a.provider}${a.status ? ` ${a.status}` : ''}: ${a.message}`).join(' | ')}`
      : error instanceof Error ? error.message : 'Failed to fetch stream data';

    if (isSaturationMessage(message)) {
      cooldownFailures += 1;
      cooldownUntil = Date.now() + Math.min(
        STREAM_COOLDOWN_BASE_MS * cooldownFailures,
        STREAM_COOLDOWN_MAX_MS
      );
    }

    return { error: 'stream_unavailable', message };
  } finally {
    inflightRequests.delete(id);
  }
}
