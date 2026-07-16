import {
  StreamUnavailableError,
  normalizeStreamData,
  type StreamAttempt,
  type StreamData,
  type StreamProvider
} from '@core/streaming';
import { fetchStreamJson } from './fetchStreamJson';
import { getInvidiousInstances } from './instances';

type InvidiousStreamProviderOptions = {
  instances?: string[];
  preferredInstance?: string;
  timeoutMs?: number;
};

export class InvidiousStreamProvider implements StreamProvider {
  private readonly instances: string[];
  private readonly timeoutMs: number;

  constructor(options: InvidiousStreamProviderOptions = {}) {
    const instances = options.instances || getInvidiousInstances();
    this.instances = options.preferredInstance
      ? [options.preferredInstance, ...instances.filter(instance => instance !== options.preferredInstance)]
      : instances;
    this.timeoutMs = options.timeoutMs || 8_000;
  }

  async getStreamData(videoId: string, signal?: AbortSignal): Promise<StreamData> {
    const attempts: StreamAttempt[] = [];

    for (const instance of this.instances) {
      if (signal?.aborted) throw signal.reason || new DOMException('Aborted', 'AbortError');

      try {
        const data = await fetchStreamJson(
          `${instance}/api/v1/videos/${encodeURIComponent(videoId)}`,
          { signal, timeoutMs: this.timeoutMs }
        );

        return normalizeStreamData(videoId, data, 'invidious', instance);
      } catch (error) {
        const status = typeof error === 'object' && error && 'status' in error
          ? Number((error as { status: number }).status)
          : undefined;
        const message = error instanceof Error ? error.message : String(error);

        attempts.push({ provider: instance, message, status });

        if (import.meta.env.DEV) {
          console.warn(`Stream provider ${instance} failed: ${message}`);
        }
      }
    }

    throw new StreamUnavailableError(videoId, attempts);
  }
}
