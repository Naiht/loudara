import { DEFAULT_INVIDIOUS_INSTANCES } from '../core/streaming/invidiousInstances.js';
import { normalizeStreamData } from '../core/streaming/normalizeStreamData.js';
import { getYoutubeStream } from './getYoutubeStream.js';

type StreamResult = {
  data?: unknown;
  attempts: Array<{
    provider: string;
    message: string;
    status?: number;
  }>;
};

const STREAM_TIMEOUT_MS = 8_000;

function isValidVideoId(videoId: string): boolean {
  return /^[a-zA-Z0-9_-]{11}$/.test(videoId);
}

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), STREAM_TIMEOUT_MS);

  try {
    return await fetch(url, {
      headers: { 'Accept': 'application/json' },
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function getStream(videoId: string): Promise<StreamResult> {
  const attempts: StreamResult['attempts'] = [];

  if (!isValidVideoId(videoId)) {
    return {
      attempts: [{
        provider: 'validation',
        message: 'Invalid video id'
      }]
    };
  }

  try {
    const data = await getYoutubeStream(videoId);
    return { data, attempts };
  } catch (error) {
    attempts.push({
      provider: 'youtubei',
      message: error instanceof Error ? error.message : String(error)
    });
  }

  for (const instance of DEFAULT_INVIDIOUS_INSTANCES) {
    try {
      const response = await fetchWithTimeout(`${instance}/api/v1/videos/${videoId}`);
      if (!response.ok) {
        attempts.push({
          provider: instance,
          message: `HTTP error ${response.status}`,
          status: response.status
        });
        continue;
      }

      const raw = await response.json();
      const data = normalizeStreamData(videoId, raw, 'api:invidious', instance);
      return { data, attempts };
    } catch (error) {
      attempts.push({
        provider: instance,
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }

  return { attempts };
}
