import { InvalidStreamResponseError, NoAudioStreamsError } from './errors';
import type { AudioStream, StreamData } from './types';

type RawStreamData = Partial<StreamData> & {
  id?: string;
  streams?: AudioStream[];
};

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
  if (!isNormalizedStreamData(data)) {
    throw new InvalidStreamResponseError('streams missing or not an array');
  }

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
