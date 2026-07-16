import type { StreamProvider } from '@core/streaming';
import { normalizeStreamData, type StreamData } from '@core/streaming';
import { fetchStreamJson } from './fetchStreamJson';

type ApiStreamProviderOptions = {
  baseUrl?: string;
  timeoutMs?: number;
};

export class ApiStreamProvider implements StreamProvider {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(options: ApiStreamProviderOptions = {}) {
    this.baseUrl = options.baseUrl || import.meta.env.VITE_STREAM_API_BASE || '/api';
    this.timeoutMs = options.timeoutMs || 10_000;
  }

  async getStreamData(videoId: string, signal?: AbortSignal): Promise<StreamData> {
    const data = await fetchStreamJson(
      `${this.baseUrl.replace(/\/$/, '')}/stream/${encodeURIComponent(videoId)}`,
      { signal, timeoutMs: this.timeoutMs }
    );

    return normalizeStreamData(videoId, data, 'api');
  }
}
