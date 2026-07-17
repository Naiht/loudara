import { StreamHttpError, StreamTimeoutError } from '@core/streaming';

type FetchStreamJsonOptions = {
  headers?: HeadersInit;
  signal?: AbortSignal;
  timeoutMs: number;
};

function createTimeoutSignal(
  timeoutMs: number,
  signal?: AbortSignal
): { signal: AbortSignal; cleanup: () => void } {
  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(() => {
    controller.abort(new StreamTimeoutError());
  }, timeoutMs);

  const onAbort = () => controller.abort(signal?.reason);
  signal?.addEventListener('abort', onAbort, { once: true });

  return {
    signal: controller.signal,
    cleanup: () => {
      globalThis.clearTimeout(timeoutId);
      signal?.removeEventListener('abort', onAbort);
    }
  };
}

export async function fetchStreamJson(
  url: string,
  options: FetchStreamJsonOptions
): Promise<unknown> {
  const timeout = createTimeoutSignal(options.timeoutMs, options.signal);
  const headers = new Headers(options.headers);
  headers.set('Accept', 'application/json');

  try {
    const res = await fetch(url, {
      headers,
      signal: timeout.signal
    });

    if (!res.ok) {
      throw new StreamHttpError(`HTTP error! status: ${res.status}`, res.status);
    }

    return await res.json();
  } catch (error) {
    if (error instanceof StreamHttpError) throw error;
    if (error instanceof StreamTimeoutError) throw error;
    if (timeout.signal.aborted && timeout.signal.reason instanceof StreamTimeoutError) {
      throw timeout.signal.reason;
    }
    throw error;
  } finally {
    timeout.cleanup();
  }
}
