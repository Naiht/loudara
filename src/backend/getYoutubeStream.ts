import { Innertube, UniversalCache } from 'youtubei.js';
import type { StreamData } from '../core/streaming/types.js';

export type YoutubeSessionConfig = {
  cookie?: string;
  visitorData?: string;
  poToken?: string;
};

export class YoutubeBotChallengeError extends Error {
  readonly code = 'youtube_bot_challenge';

  constructor(message: string) {
    super(message);
    this.name = 'YoutubeBotChallengeError';
  }
}

export class YoutubeSessionConfigurationError extends Error {
  readonly code = 'youtube_session_configuration';

  constructor(message: string) {
    super(message);
    this.name = 'YoutubeSessionConfigurationError';
  }
}

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

const ANONYMOUS_CLIENTS = ['ANDROID', 'IOS', 'TV'] as const;
const SESSION_CLIENTS = ['WEB'] as const;
const INITIAL_DOWNLOAD_CHUNK_SIZE = 1024 * 1024;
const FOLLOWUP_DOWNLOAD_CHUNK_SIZE = 16 * 1024;
const MAX_CACHED_AUDIO_BYTES = 32 * 1024 * 1024;
const MAX_CACHED_AUDIO_FILES = 1;
const MEDIA_CACHE_TTL_MS = 10 * 60 * 1000;
const VIDEO_SESSION_TTL_MS = 30 * 60 * 1000;

let innertubePromise: Promise<Innertube> | undefined;
let innertubeSessionKey = '';
const mediaUrlCache = new Map<string, CachedMedia>();
const videoSessionCache = new Map<string, {
  expiresAt: number;
  session: YoutubeSessionConfig;
}>();

function cleanSessionConfig(config: YoutubeSessionConfig): YoutubeSessionConfig {
  return {
    cookie: config.cookie?.trim() || undefined,
    visitorData: config.visitorData?.trim() || undefined,
    poToken: config.poToken?.trim() || undefined
  };
}

function getSessionKey(config: YoutubeSessionConfig): string {
  return [config.cookie || '', config.visitorData || '', config.poToken || ''].join('\u0000');
}

function hasSessionCredentials(config: YoutubeSessionConfig): boolean {
  return Boolean(config.cookie || config.visitorData || config.poToken);
}

function rememberVideoSession(videoId: string, session: YoutubeSessionConfig) {
  if (!hasSessionCredentials(session)) return;
  videoSessionCache.set(videoId, {
    expiresAt: Date.now() + VIDEO_SESSION_TTL_MS,
    session
  });
}

function getVideoSession(videoId: string): YoutubeSessionConfig {
  const cached = videoSessionCache.get(videoId);
  if (!cached) return {};
  if (cached.expiresAt > Date.now()) return cached.session;
  videoSessionCache.delete(videoId);
  return {};
}

function getInnertube(sessionConfig: YoutubeSessionConfig = {}): Promise<Innertube> {
  const config = cleanSessionConfig(sessionConfig);
  if (config.poToken && !config.visitorData) {
    throw new YoutubeSessionConfigurationError(
      'YOUTUBE_PO_TOKEN requires the matching YOUTUBE_VISITOR_DATA value'
    );
  }

  const sessionKey = getSessionKey(config);
  if (innertubeSessionKey !== sessionKey) {
    innertubePromise = undefined;
    innertubeSessionKey = sessionKey;
  }

  innertubePromise ||= Innertube.create({
    cache: new UniversalCache(false),
    cookie: config.cookie,
    generate_session_locally: true,
    po_token: config.poToken,
    retrieve_player: true,
    visitor_data: config.visitorData,
    fetch: fetch.bind(globalThis)
  });
  return innertubePromise;
}

export function resetYoutubeSession() {
  innertubePromise = undefined;
}

export function isYoutubeBotChallenge(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return error instanceof YoutubeBotChallengeError ||
    /sign in to confirm you(?:'|’)?re not a bot|confirm you are not a bot/i.test(message);
}

export function isYoutubeSessionConfigurationError(error: unknown): boolean {
  return error instanceof YoutubeSessionConfigurationError;
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
  options: { proxyMedia?: boolean; session?: YoutubeSessionConfig } = {}
): Promise<StreamData> {
  const session = cleanSessionConfig(options.session || {});
  const innertube = await getInnertube(session);
  const errors: string[] = [];
  const proxyMedia = options.proxyMedia ?? true;
  const clients = session.cookie || session.poToken ? SESSION_CLIENTS : ANONYMOUS_CLIENTS;

  for (const client of clients) {
    try {
      let info: YoutubeInfo;

      try {
        info = await innertube.getBasicInfo(videoId, { client }) as YoutubeInfo;
      } catch (error) {
        if (isYoutubeBotChallenge(error)) throw error;
        info = await innertube.getInfo(videoId, { client }) as YoutubeInfo;
      }

      const data = toStreamData(videoId, info, client, { proxyMedia });
      rememberVideoSession(videoId, session);
      return data;
    } catch (error) {
      errors.push(`${client}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const message = errors.join(' | ') || 'YouTube.js did not return audio streams';
  if (errors.some(error => isYoutubeBotChallenge(error))) {
    throw new YoutubeBotChallengeError(message);
  }
  throw new Error(message);
}

export async function getYoutubeMedia(
  videoId: string,
  itag: number,
  request: MediaRequest,
  session: YoutubeSessionConfig = {}
): Promise<Response> {
  const configuredSession = cleanSessionConfig(session);
  const activeSession = hasSessionCredentials(configuredSession)
    ? configuredSession
    : getVideoSession(videoId);
  let response: Response;

  try {
    response = await fetchYoutubeMedia(videoId, itag, request, activeSession);
  } catch (error) {
    if (isYoutubeBotChallenge(error) || isYoutubeSessionConfigurationError(error)) throw error;
    clearCachedMedia(videoId, itag);
    resetYoutubeSession();
    response = await fetchYoutubeMedia(videoId, itag, request, activeSession, { forceRefresh: true });
  }

  if (!isRejectedMediaStatus(response.status)) return response;

  clearCachedMedia(videoId, itag);
  resetYoutubeSession();
  let retry: Response;
  try {
    retry = await fetchYoutubeMedia(videoId, itag, request, activeSession, { forceRefresh: true });
  } catch (error) {
    if (isYoutubeBotChallenge(error) || isYoutubeSessionConfigurationError(error)) throw error;
    const media = await resolveMedia(videoId, itag, activeSession, true);
    retry = media
      ? await fetchResolvedMedia(media, request)
      : response;
  }
  if (!isRejectedMediaStatus(retry.status)) return retry;

  const fallback = await fetchFallbackMedia(videoId, itag, request, activeSession);
  return fallback || retry;
}

async function resolveMedia(
  videoId: string,
  itag: number,
  session: YoutubeSessionConfig,
  forceRefresh = false
) {
  const cached = forceRefresh ? undefined : getCachedMedia(videoId, itag);
  if (cached) return cached;

  const data = await getYoutubeStream(videoId, { proxyMedia: false, session });
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
  session: YoutubeSessionConfig,
  options: { forceRefresh?: boolean } = {}
): Promise<Response> {
  const media = await resolveMedia(videoId, itag, session, options.forceRefresh);
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
  request: MediaRequest,
  session: YoutubeSessionConfig
): Promise<Response | undefined> {
  const data = await getYoutubeStream(videoId, { proxyMedia: false, session });
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
