import { playerStore, setPlayerStore, t } from "@stores";
import { proxyHandler } from "@utils";
import { selectPlayableAudioStreams, type AudioStream } from "@core/streaming";

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
  const candidates = selectPlayableAudioStreams(audioStreams, target);

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

}
