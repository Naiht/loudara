import {
  StreamUnavailableError,
  type StreamAttempt,
  type StreamData,
  type StreamProvider
} from '@core/streaming';
import { ApiStreamProvider } from './ApiStreamProvider';
import { InvidiousStreamProvider } from './InvidiousStreamProvider';

type WebStreamProviderOptions = {
  preferredProxy?: string;
};

class WebStreamProvider implements StreamProvider {
  private readonly providers: StreamProvider[];

  constructor(options: WebStreamProviderOptions = {}) {
    this.providers = [new ApiStreamProvider()];

    if (import.meta.env.DEV) {
      this.providers.push(
        new InvidiousStreamProvider({ preferredInstance: options.preferredProxy })
      );
    }
  }

  async getStreamData(videoId: string, signal?: AbortSignal): Promise<StreamData> {
    const attempts: StreamAttempt[] = [];

    for (const provider of this.providers) {
      try {
        return await provider.getStreamData(videoId, signal);
      } catch (error) {
        if (error instanceof StreamUnavailableError) {
          attempts.push(...error.attempts);
        } else {
          attempts.push({
            provider: provider.constructor.name,
            message: error instanceof Error ? error.message : String(error),
            status: typeof error === 'object' && error && 'status' in error
              ? Number((error as { status: number }).status)
              : undefined
          });
        }
      }
    }

    throw new StreamUnavailableError(videoId, attempts);
  }
}

export function createWebStreamProvider(options: WebStreamProviderOptions = {}): StreamProvider {
  return new WebStreamProvider(options);
}

export { ApiStreamProvider } from './ApiStreamProvider';
export { InvidiousStreamProvider } from './InvidiousStreamProvider';
export { getInvidiousInstances } from './instances';
