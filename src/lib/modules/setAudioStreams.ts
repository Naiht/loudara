import { playerStore, setPlayerStore, t } from "@stores";
import { config, proxyHandler } from "@utils";
import { selectPlayableAudioStreams, type AudioStream } from "@core/streaming";
import { setStableVolumeNormalizer } from "./audioNormalizer";

function isDrcStream(stream: AudioStream) {
  return stream.url.includes('drc%3D1') || stream.url.includes('drc=1');
}

function isDubbedStream(stream: AudioStream) {
  return stream.url.includes('acont%3Ddubbed') || stream.url.includes('acont=dubbed');
}

function getSelectableStreams(audioStreams: AudioStream[]) {
  const originalStreams = audioStreams.filter(stream => !isDubbedStream(stream));
  const streams = originalStreams.length ? originalStreams : audioStreams;

  if (!config.stableVolume) {
    const nonDrcStreams = streams.filter(stream => !isDrcStream(stream));
    return nonDrcStreams.length ? nonDrcStreams : streams;
  }

  const drcStreams = streams.filter(isDrcStream);
  return drcStreams.length ? drcStreams : streams;
}

export function getAudioStreamCandidates(
  audioStreams: AudioStream[],
  audio?: HTMLAudioElement
) {
  const selectableStreams = getSelectableStreams(audioStreams);
  return selectPlayableAudioStreams(selectableStreams, audio);
}

export default async function(
  audioStreams: AudioStream[],
  prefetchNode?: HTMLAudioElement
) {

  if (!prefetchNode)
    setPlayerStore('status', t('player_audiostreams_setup'));

  const noOfBitrates = audioStreams.length;

  if (!noOfBitrates) {
    setPlayerStore('status', t('player_audiostreams_null'));
    setPlayerStore('playbackState', 'none');
    return;
  }


  const target = prefetchNode || playerStore.audio;
  const candidates = getAudioStreamCandidates(audioStreams, target);

  if (!candidates.length) {
    setPlayerStore('status', 'No browser-compatible audio streams found');
    setPlayerStore('playbackState', 'none');
    return;
  }

  const stream = candidates[0];
  delete target.dataset.retried;
  target.dataset.streamIndex = '0';
  target.dataset.streamAttempts = JSON.stringify([]);
  target.dataset.streamCandidates = JSON.stringify(candidates);
  target.src = proxyHandler(stream.url, Boolean(prefetchNode));

  if (!prefetchNode) {
    setStableVolumeNormalizer(target, config.stableVolume && !isDrcStream(stream));
  }

}
