import { InvalidStreamResponseError, NoAudioStreamsError } from './errors';
import type { AudioStream, StreamData } from './types';

type RawFormat = {
  url?: string;
  type?: string;
  mimeType?: string;
  bitrate?: string | number;
  itag?: string | number;
  quality?: string;
  resolution?: string;
};

type RawInvidiousData = Partial<Invidious> & {
  videoId?: string;
  id?: string;
  adaptiveFormats?: RawFormat[];
};

type RawStreamData = Partial<StreamData> & {
  videoId?: string;
  id?: string;
  streams?: AudioStream[];
};

const toBitrate = (value: string | number | undefined): number | undefined => {
  if (typeof value === 'number') return value;
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
};

export function normalizeAudioStream(format: RawFormat): AudioStream | null {
  const mimeType = format.mimeType || format.type;
  if (!format.url || !mimeType) return null;

  return {
    url: format.url,
    mimeType,
    itag: toBitrate(format.itag),
    bitrate: toBitrate(format.bitrate),
    quality: format.quality || format.resolution
  };
}

function isNormalizedStreamData(data: unknown): data is RawStreamData & { streams: AudioStream[] } {
  const raw = data as RawStreamData | undefined;
  return Boolean(raw && Array.isArray(raw.streams));
}

function normalizeExistingStream(stream: AudioStream): AudioStream | null {
  if (!stream.url || !stream.mimeType) return null;

  return {
    url: stream.url,
    mimeType: stream.mimeType,
    itag: stream.itag,
    bitrate: stream.bitrate,
    quality: stream.quality
  };
}

export function normalizeStreamData(
  videoId: string,
  data: unknown,
  source: string,
  proxy?: string
): StreamData {
  if (isNormalizedStreamData(data)) {
    const streams = data.streams
      .map(normalizeExistingStream)
      .filter((stream): stream is AudioStream => Boolean(stream))
      .filter(stream => stream.mimeType.startsWith('audio'));

    if (!streams.length) throw new NoAudioStreamsError();

    return {
      videoId: data.videoId || data.id || videoId,
      title: data.title,
      author: data.author,
      authorId: data.authorId,
      duration: data.duration,
      streams,
      videoStreams: data.videoStreams || [],
      captions: data.captions || [],
      recommended: data.recommended || [],
      source: data.source || source,
      proxy: data.proxy || proxy
    };
  }

  const raw = data as RawInvidiousData | undefined;

  if (!raw || !Array.isArray(raw.adaptiveFormats)) {
    throw new InvalidStreamResponseError('adaptiveFormats missing or not an array');
  }

  const formats = raw.adaptiveFormats
    .map(normalizeAudioStream)
    .filter((stream): stream is AudioStream => Boolean(stream));

  const streams = formats.filter(stream => stream.mimeType.startsWith('audio'));
  if (!streams.length) throw new NoAudioStreamsError();

  return {
    videoId: raw.videoId || raw.id || videoId,
    title: raw.title,
    author: raw.author,
    authorId: raw.authorId,
    duration: raw.lengthSeconds,
    streams,
    videoStreams: formats.filter(stream => stream.mimeType.startsWith('video')),
    captions: (raw.captions || []).map(caption => ({
      url: caption.url,
      label: caption.label,
      languageCode: caption.language_code
    })),
    recommended: (raw.recommendedVideos || []).map(video => ({
      videoId: video.videoId,
      title: video.title,
      author: video.author,
      authorId: video.authorId,
      duration: video.lengthSeconds
    })),
    source,
    proxy
  };
}
