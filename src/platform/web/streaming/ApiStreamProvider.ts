import type { StreamProvider } from '@core/streaming';
import { normalizeStreamData, type StreamData } from '@core/streaming';
import { fetchStreamJson } from './fetchStreamJson';
import { getYoutubeSessionHeaders } from '../streamingCredentials';

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

  private resolveUrl(url: string): string {
    if (!url || /^https?:\/\//i.test(url)) return url;

    const baseOrigin = /^https?:\/\//i.test(this.baseUrl)
      ? this.baseUrl
      : new URL(this.baseUrl, window.location.origin).toString();

    return new URL(url, baseOrigin).toString();
  }

  async getStreamData(videoId: string, signal?: AbortSignal): Promise<StreamData> {
    const headers = await getYoutubeSessionHeaders();
    const data = await fetchStreamJson(
      `${this.baseUrl.replace(/\/$/, '')}/stream/${encodeURIComponent(videoId)}`,
      { headers, signal, timeoutMs: this.timeoutMs }
    );

    const normalized = normalizeStreamData(videoId, data, 'api');

    return {
      ...normalized,
      streams: normalized.streams.map((stream) => ({
        ...stream,
        url: this.resolveUrl(stream.url)
      })),
      videoStreams: normalized.videoStreams?.map((stream) => ({
        ...stream,
        url: this.resolveUrl(stream.url)
      })) || [],
      captions: normalized.captions?.map((caption) => ({
        ...caption,
        url: this.resolveUrl(caption.url)
      })) || []
    };
  }
}
