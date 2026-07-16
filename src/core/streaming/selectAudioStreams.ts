import type { AudioStream } from './types';

type RankedAudioStream = AudioStream & {
  supportRank: number;
};

function getSupportRank(stream: AudioStream, audio?: HTMLAudioElement): number {
  if (!audio || typeof audio.canPlayType !== 'function') return 1;

  const support = audio.canPlayType(stream.mimeType);
  if (support === 'probably') return 3;
  if (support === 'maybe') return 2;
  return 0;
}

export function selectPlayableAudioStreams(
  streams: AudioStream[],
  audio?: HTMLAudioElement
): AudioStream[] {
  const ranked = streams
    .filter(stream => stream.url && stream.mimeType.startsWith('audio'))
    .map(stream => ({
      ...stream,
      supportRank: getSupportRank(stream, audio)
    }));

  const playable = ranked.filter(stream => stream.supportRank > 0);
  const source = playable.length ? playable : ranked;

  return source
    .sort((a: RankedAudioStream, b: RankedAudioStream) =>
      b.supportRank - a.supportRank ||
      (b.bitrate || 0) - (a.bitrate || 0)
    )
    .map(({ supportRank: _supportRank, ...stream }) => stream);
}
