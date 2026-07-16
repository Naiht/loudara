import { shuffle } from '@utils';

type StreamSource = {
  baseUrl: string;
  path: '/api/v1/videos/' | '/s/';
};

type StreamProviderOptions = {
  id: string;
  preferredProxy?: string;
  signal?: AbortSignal;
};

const invidiousSources: StreamSource[] = shuffle([
  "https://inv.zoomerville.com",
  "https://yt.chocolatemoo53.com",
  "https://yt.omada.cafe",
  "https://invidious.schenkel.eti.br",
  "https://invidious.kemonomimi.nl"
]).map(baseUrl => ({
  baseUrl,
  path: '/api/v1/videos/'
}));

const localStreamSource: StreamSource = {
  baseUrl: '',
  path: '/s/'
};

function validateStreamData(data: unknown): asserts data is Invidious {
  const candidate = data as Partial<Invidious> | undefined;

  if (!candidate || !Array.isArray(candidate.adaptiveFormats)) {
    const error = data && typeof data === 'object' && 'error' in data
      ? String((data as { error: unknown }).error)
      : 'Invalid response: adaptiveFormats missing or not an array';
    throw new Error(error);
  }

  if (!candidate.adaptiveFormats.every(format => typeof format.type === 'string')) {
    throw new Error('Invalid response: formats missing type property');
  }

  if (!candidate.adaptiveFormats.some(format => format.type.startsWith('audio'))) {
    throw new Error('Invalid response: no audio streams found');
  }
}

async function fetchFromSource(
  source: StreamSource,
  id: string,
  signal?: AbortSignal
): Promise<Invidious> {
  const res = await fetch(source.baseUrl + source.path + id, {
    headers: { 'Accept': 'application/json' },
    signal
  });

  if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);

  const data = await res.json();
  validateStreamData(data);

  return {
    ...data,
    proxy: source.baseUrl
  };
}

export async function getWebStreamData({
  id,
  preferredProxy,
  signal
}: StreamProviderOptions): Promise<Invidious | null> {
  const preferredSource = preferredProxy
    ? { baseUrl: preferredProxy, path: '/api/v1/videos/' as const }
    : undefined;

  if (preferredSource) {
    try {
      return await fetchFromSource(preferredSource, id, signal);
    } catch (e) {
      console.warn(`Prefetch failed with error ${(e as Error).message} on ${preferredProxy}, starting retries...`);
    }
  }

  for (const source of invidiousSources) {
    if (source.baseUrl === preferredProxy) continue;

    try {
      return await fetchFromSource(source, id, signal);
    } catch {
      console.warn(`Proxy ${source.baseUrl} failed, trying next...`);
    }
  }

  try {
    console.warn('All proxies failed, attempting emergency fallback...');
    return await fetchFromSource(localStreamSource, id, signal);
  } catch (e) {
    console.error('Emergency fallback failed:', e);
    return null;
  }
}
