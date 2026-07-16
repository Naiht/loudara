import { Innertube } from 'youtubei.js';
import type { StreamData } from '../core/streaming/types.js';

type YoutubeFormat = {
  url?: string;
  mime_type?: string;
  mimeType?: string;
  bitrate?: number;
  audio_quality?: string;
  quality?: string;
  itag?: number;
  has_audio?: boolean;
};

type YoutubeInfo = {
  basic_info?: {
    id?: string;
    title?: string;
    author?: string;
    channel_id?: string;
    duration?: number;
  };
  streaming_data?: {
    adaptive_formats?: YoutubeFormat[];
    formats?: YoutubeFormat[];
  };
  playability_status?: {
    status?: string;
    reason?: string;
  };
};

type MediaRequest = {
  headers: {
    get(name: string): string | null;
  };
};

type CachedMedia = {
  bytes?: Uint8Array;
  download?: Promise<CachedMedia>;
  expiresAt: number;
  itag: number;
  mimeType: string;
  size?: number;
  url: string;
};

const CLIENTS = ['ANDROID', 'IOS'] as const;
const INITIAL_DOWNLOAD_CHUNK_SIZE = 1024 * 1024;
const FOLLOWUP_DOWNLOAD_CHUNK_SIZE = 16 * 1024;
const MAX_CACHED_AUDIO_BYTES = 32 * 1024 * 1024;
const MAX_CACHED_AUDIO_FILES = 1;
const MEDIA_CACHE_TTL_MS = 10 * 60 * 1000;

let innertubePromise: Promise<Innertube> | undefined;
const mediaUrlCache = new Map<string, CachedMedia>();

function getInnertube(): Promise<Innertube> {
  innertubePromise ||= Innertube.create();
  return innertubePromise;
}

function isAudioFormat(format: YoutubeFormat): boolean {
  const mimeType = format.mime_type || format.mimeType || '';
  return Boolean(
    format.url &&
    (mimeType.startsWith('audio') || (format.has_audio && mimeType.includes('mp4a')))
  );
}

function normalizeMimeType(format: YoutubeFormat): string {
  const mimeType = format.mime_type || format.mimeType || 'audio/mp4';
  return mimeType.startsWith('audio') ? mimeType : 'audio/mp4; codecs="mp4a.40.2"';
}

function getMediaCacheKey(videoId: string, itag: number): string {
  return `${videoId}:${itag}`;
}

function setMediaCache(
  videoId: string,
  stream: { itag?: number; mimeType: string; url: string }
) {
  if (!stream.itag) return;
  mediaUrlCache.set(getMediaCacheKey(videoId, stream.itag), {
    expiresAt: Date.now() + MEDIA_CACHE_TTL_MS,
    itag: stream.itag,
    mimeType: stream.mimeType,
    url: stream.url
  });
}

function getCachedMedia(videoId: string, itag: number) {
  const cached = mediaUrlCache.get(getMediaCacheKey(videoId, itag));
  if (!cached) return undefined;
  if (cached.expiresAt > Date.now()) return cached;
  mediaUrlCache.delete(getMediaCacheKey(videoId, itag));
  return undefined;
}

function clearCachedMedia(videoId: string, itag: number) {
  mediaUrlCache.delete(getMediaCacheKey(videoId, itag));
}

function trimMediaCache() {
  const cachedAudio = [...mediaUrlCache.entries()]
    .filter(([, media]) => media.bytes)
    .sort(([, a], [, b]) => a.expiresAt - b.expiresAt);

  while (cachedAudio.length > MAX_CACHED_AUDIO_FILES) {
    const [key] = cachedAudio.shift() as [string, CachedMedia];
    mediaUrlCache.delete(key);
  }
}

function isRejectedMediaStatus(status: number): boolean {
  return [403, 404, 410].includes(status);
}

function toStreamData(
  videoId: string,
  info: YoutubeInfo,
  client: string,
  options: { proxyMedia: boolean }
): StreamData {
  const basic = info.basic_info || {};
  const formats = [
    ...(info.streaming_data?.adaptive_formats || []),
    ...(info.streaming_data?.formats || [])
  ];

  const streams = formats
    .filter(isAudioFormat)
    .map(format => ({
      url: format.url as string,
      mimeType: normalizeMimeType(format),
      itag: format.itag,
      bitrate: format.bitrate,
      quality: format.audio_quality || format.quality || (format.itag ? `itag ${format.itag}` : undefined)
    }))
    .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));

  if (!streams.length) {
    const reason = info.playability_status?.reason || info.playability_status?.status || 'No direct audio formats returned';
    throw new Error(reason);
  }

  streams.forEach(stream => setMediaCache(videoId, stream));

  return {
    videoId: basic.id || videoId,
    title: basic.title,
    author: basic.author,
    authorId: basic.channel_id,
    duration: basic.duration,
    streams: options.proxyMedia
      ? streams.map(stream => ({
        ...stream,
        url: stream.itag ? `/api/media/${videoId}/${stream.itag}` : stream.url
      }))
      : streams,
    videoStreams: [],
    captions: [],
    recommended: [],
    source: `youtubei:${client.toLowerCase()}`,
    proxy: ''
  };
}

export async function getYoutubeStream(
  videoId: string,
  options: { proxyMedia?: boolean } = {}
): Promise<StreamData> {
  const innertube = await getInnertube();
  const errors: string[] = [];
  const proxyMedia = options.proxyMedia ?? true;

  for (const client of CLIENTS) {
    try {
      const info = await innertube.getBasicInfo(videoId, { client }) as YoutubeInfo;
      return toStreamData(videoId, info, client, { proxyMedia });
    } catch (error) {
      errors.push(`${client}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  throw new Error(errors.join(' | ') || 'YouTube.js did not return audio streams');
}

export async function getYoutubeMedia(
  videoId: string,
  itag: number,
  request: MediaRequest
): Promise<Response> {
  let response: Response;

  try {
    response = await fetchYoutubeMedia(videoId, itag, request);
  } catch {
    clearCachedMedia(videoId, itag);
    response = await fetchYoutubeMedia(videoId, itag, request, { forceRefresh: true });
  }

  if (!isRejectedMediaStatus(response.status)) return response;

  clearCachedMedia(videoId, itag);
  let retry: Response;
  try {
    retry = await fetchYoutubeMedia(videoId, itag, request, { forceRefresh: true });
  } catch {
    const media = await resolveMedia(videoId, itag, true);
    retry = media
      ? await fetchResolvedMedia(media, request)
      : response;
  }
  if (!isRejectedMediaStatus(retry.status)) return retry;

  const fallback = await fetchFallbackMedia(videoId, itag, request);
  return fallback || retry;
}

async function resolveMedia(
  videoId: string,
  itag: number,
  forceRefresh = false
) {
  const cached = forceRefresh ? undefined : getCachedMedia(videoId, itag);
  if (cached) return cached;

  const data = await getYoutubeStream(videoId, { proxyMedia: false });
  const stream = data.streams.find(candidate => candidate.itag === itag);
  if (!stream) return undefined;

  const media = {
    expiresAt: Date.now() + MEDIA_CACHE_TTL_MS,
    itag,
    mimeType: stream.mimeType,
    url: stream.url
  };
  mediaUrlCache.set(getMediaCacheKey(videoId, itag), media);
  return media;
}

async function fetchYoutubeMedia(
  videoId: string,
  itag: number,
  request: MediaRequest,
  options: { forceRefresh?: boolean } = {}
): Promise<Response> {
  const media = await resolveMedia(videoId, itag, options.forceRefresh);
  if (!media) {
    return new Response(JSON.stringify({ error: 'media_stream_not_found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const cached = await ensureDownloadedMedia(media, request);
  return serveCachedMedia(cached, request);
}

async function fetchFallbackMedia(
  videoId: string,
  rejectedItag: number,
  request: MediaRequest
): Promise<Response | undefined> {
  const data = await getYoutubeStream(videoId, { proxyMedia: false });
  const alternatives = data.streams.filter(stream => stream.itag && stream.itag !== rejectedItag);

  for (const stream of alternatives) {
    const media: CachedMedia = {
      expiresAt: Date.now() + MEDIA_CACHE_TTL_MS,
      itag: stream.itag as number,
      mimeType: stream.mimeType,
      url: stream.url
    };
    mediaUrlCache.set(getMediaCacheKey(videoId, media.itag), media);

    const response = await fetchResolvedMedia(media, request);
    if (!isRejectedMediaStatus(response.status)) return response;
  }

  return undefined;
}

async function fetchResolvedMedia(
  media: CachedMedia,
  request: MediaRequest
): Promise<Response> {
  const upstreamHeaders = new Headers();
  const range = request.headers.get('Range');
  upstreamHeaders.set('Range', range || 'bytes=0-1048575');
  upstreamHeaders.set('Accept', request.headers.get('Accept') || '*/*');
  upstreamHeaders.set('User-Agent', request.headers.get('User-Agent') || 'Mozilla/5.0');

  const response = await fetch(media.url, { headers: upstreamHeaders });
  const headers = new Headers();
  const passthroughHeaders = [
    'Accept-Ranges',
    'Content-Length',
    'Content-Range',
    'Content-Type',
    'ETag',
    'Last-Modified'
  ];

  for (const header of passthroughHeaders) {
    const value = response.headers.get(header);
    if (value) headers.set(header, value);
  }

  if (!headers.has('Content-Type')) headers.set('Content-Type', media.mimeType);
  headers.set('Cache-Control', 'private, max-age=300');

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

async function ensureDownloadedMedia(
  media: CachedMedia,
  request: MediaRequest
): Promise<CachedMedia> {
  if (media.bytes) return media;
  if (media.download) return media.download;

  media.download = downloadMedia(media, request)
    .finally(() => {
      delete media.download;
    });

  return media.download;
}

async function downloadMedia(
  media: CachedMedia,
  request: MediaRequest
): Promise<CachedMedia> {
  const first = await fetchMediaRange(media, request, 0, INITIAL_DOWNLOAD_CHUNK_SIZE - 1);

  if (isRejectedMediaStatus(first.response.status)) {
    throw new Error(`Upstream rejected media download with ${first.response.status}`);
  }

  const totalSize = first.totalSize || first.bytes.length;
  if (totalSize > MAX_CACHED_AUDIO_BYTES) {
    throw new Error(`Audio file is too large to cache: ${totalSize}`);
  }

  const bytes = new Uint8Array(totalSize);
  bytes.set(first.bytes, 0);

  let offset = first.end + 1;
  while (offset < totalSize) {
    const chunkSize = media.itag === 18
      ? INITIAL_DOWNLOAD_CHUNK_SIZE
      : FOLLOWUP_DOWNLOAD_CHUNK_SIZE;
    const end = Math.min(offset + chunkSize - 1, totalSize - 1);
    const chunk = await fetchMediaRange(media, request, offset, end);

    if (isRejectedMediaStatus(chunk.response.status)) {
      throw new Error(`Upstream rejected media chunk with ${chunk.response.status}`);
    }

    bytes.set(chunk.bytes, offset);
    offset = chunk.end + 1;
  }

  media.bytes = bytes;
  media.expiresAt = Date.now() + MEDIA_CACHE_TTL_MS;
  media.size = totalSize;
  trimMediaCache();
  return media;
}

async function fetchMediaRange(
  media: CachedMedia,
  request: MediaRequest,
  start: number,
  end: number
) {
  const response = await fetch(media.url, {
    headers: createUpstreamHeaders(request, `bytes=${start}-${end}`)
  });

  const arrayBuffer = await response.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  const parsedRange = parseContentRange(response.headers.get('Content-Range'));

  return {
    bytes,
    end: parsedRange?.end ?? start + Math.max(bytes.length - 1, 0),
    response,
    totalSize: parsedRange?.totalSize || Number.parseInt(response.headers.get('Content-Length') || '', 10)
  };
}

function createUpstreamHeaders(request: MediaRequest, range: string): Headers {
  const headers = new Headers();
  headers.set('Range', range);
  headers.set('Accept', request.headers.get('Accept') || '*/*');
  headers.set('User-Agent', request.headers.get('User-Agent') || 'Mozilla/5.0');
  return headers;
}

function serveCachedMedia(media: CachedMedia, request: MediaRequest): Response {
  const bytes = media.bytes;
  if (!bytes) {
    return new Response(null, { status: 500 });
  }

  const range = parseRequestRange(request.headers.get('Range'), bytes.length);
  const headers = new Headers({
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'private, max-age=300',
    'Content-Type': media.mimeType
  });

  if (!range) {
    headers.set('Content-Length', String(bytes.length));
    return new Response(toBody(bytes), {
      status: 200,
      headers
    });
  }

  const chunk = bytes.slice(range.start, range.end + 1);
  headers.set('Content-Length', String(chunk.length));
  headers.set('Content-Range', `bytes ${range.start}-${range.end}/${bytes.length}`);

  return new Response(toBody(chunk), {
    status: 206,
    headers
  });
}

function toBody(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function parseContentRange(value: string | null) {
  const match = value?.match(/^bytes\s+(\d+)-(\d+)\/(\d+)$/i);
  if (!match) return undefined;

  return {
    end: Number.parseInt(match[2], 10),
    start: Number.parseInt(match[1], 10),
    totalSize: Number.parseInt(match[3], 10)
  };
}

function parseRequestRange(value: string | null, totalSize: number) {
  const match = value?.match(/^bytes=(\d*)-(\d*)$/i);
  if (!match) return undefined;

  const start = match[1] ? Number.parseInt(match[1], 10) : 0;
  const requestedEnd = match[2] ? Number.parseInt(match[2], 10) : totalSize - 1;
  const end = Math.min(requestedEnd, totalSize - 1);

  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= totalSize) {
    return undefined;
  }

  return { start, end };
}
