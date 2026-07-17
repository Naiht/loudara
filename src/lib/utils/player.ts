import { playerStore, setPlayerStore, setStore } from "@stores";
import { config, convertSStoHHMMSS } from "@utils";
import { isQueuePrefetchActive } from "../modules/queuePrefetch";
import type { StreamData } from "@core/streaming";
import { isNativeApp } from "@platform/native";
import { prepareNativePlaybackTrack } from "@platform/native/playback";

const RAPID_SWITCH_WINDOW_MS = 1_500;
const RAPID_SWITCH_BASE_DELAY_MS = 450;
const RAPID_SWITCH_MAX_DELAY_MS = 1_200;

let playerAbortController: AbortController;
let activePlaybackRequestId = 0;
let lastPlaybackRequestAt = 0;
let rapidPlaybackSwitches = 0;

function isAbortError(error: unknown) {
  return (
    error instanceof DOMException && error.name === 'AbortError'
  ) || (
    error instanceof Error && error.name === 'AbortError'
  );
}

function ensureActivePlaybackRequest(requestId: number, signal: AbortSignal) {
  if (signal.aborted || requestId !== activePlaybackRequestId) {
    throw signal.reason ?? new DOMException('Aborted', 'AbortError');
  }
}

function getPlaybackRequestDelay() {
  const now = Date.now();

  if ((now - lastPlaybackRequestAt) <= RAPID_SWITCH_WINDOW_MS)
    rapidPlaybackSwitches += 1;
  else
    rapidPlaybackSwitches = 0;

  lastPlaybackRequestAt = now;

  if (rapidPlaybackSwitches === 0) return 0;

  return Math.min(
    RAPID_SWITCH_BASE_DELAY_MS + ((rapidPlaybackSwitches - 1) * 200),
    RAPID_SWITCH_MAX_DELAY_MS
  );
}

async function waitForPlaybackConfirmation(delayMs: number, signal: AbortSignal) {
  if (delayMs <= 0) return;

  await new Promise<void>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, delayMs);

    const onAbort = () => {
      window.clearTimeout(timeoutId);
      signal.removeEventListener('abort', onAbort);
      reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
    };

    signal.addEventListener('abort', onAbort, { once: true });
  });
}

export async function player(id?: string) {

  if (playerAbortController)
    playerAbortController.abort();

  playerAbortController = new AbortController();
  const requestId = ++activePlaybackRequestId;
  const requestSignal = playerAbortController.signal;

  if (!id) return;

  const enforceVideo = !playerStore.isMusic && playerStore.isWatching;
  const useNativePlayback = isNativeApp && !playerStore.isWatching;
  const requestDelay = getPlaybackRequestDelay();

  if (!enforceVideo)
    setPlayerStore({
      playbackState: 'loading',
      status: 'Loading Audio...'
    });

  try {
    await waitForPlaybackConfirmation(requestDelay, requestSignal);
    ensureActivePlaybackRequest(requestId, requestSignal);

    const getStreamData = await import('@modules/getStreamData').then(mod => mod.default);
    ensureActivePlaybackRequest(requestId, requestSignal);

    const data = await getStreamData(id, requestSignal);
    ensureActivePlaybackRequest(requestId, requestSignal);

    if (data && 'streams' in data)
      setPlayerStore({
        data,
        fullDuration: data.duration || 0
      });
    else {
      const errorData = data as Record<'error' | 'message', string>;
      setPlayerStore({
        playbackState: 'none',
        status: errorData.message || errorData.error || 'Loading Audio Failed'
      });
      setStore('snackbar', {
        message: errorData.message || errorData.error || 'Loading Audio Failed',
        type: 'error'
      });
      return;
    }

    const streamData = data as StreamData;
    setPlayerStore('currentTime', 0);

    const setMetadata = await import('../modules/setMetadata').then(mod => mod.default);
    ensureActivePlaybackRequest(requestId, requestSignal);

    await setMetadata({
      id,
      title: streamData.title || playerStore.stream.title,
      author: streamData.author || playerStore.stream.author,
      duration: convertSStoHHMMSS(streamData.duration || 0),
      authorId: streamData.authorId || playerStore.stream.authorId,
      img: playerStore.stream.img
    });
    ensureActivePlaybackRequest(requestId, requestSignal);

    if (useNativePlayback) {
      const { getAudioStreamCandidates } = await import('../modules/setAudioStreams');
      ensureActivePlaybackRequest(requestId, requestSignal);

      const candidates = getAudioStreamCandidates(streamData.streams);
      const stream = candidates[0];

      if (!stream) {
        const message = 'Loading Audio Failed';
        setPlayerStore({
          playbackState: 'none',
          status: message
        });
        setStore('snackbar', {
          message,
          type: 'error'
        });
        return;
      }

      setPlayerStore('volume', 1);

      await prepareNativePlaybackTrack({
        id,
        url: stream.url,
        title: streamData.title || playerStore.stream.title,
        artist: streamData.author || playerStore.stream.author,
        artwork: playerStore.mediaArtwork,
        duration: streamData.duration || 0,
        position: 0,
        autoplay: true,
        loop: playerStore.loop,
        playbackRate: playerStore.playbackRate,
        volume: 1
      });
      ensureActivePlaybackRequest(requestId, requestSignal);
    } else {
      const setAudioStreams = await import('../modules/setAudioStreams').then(mod => mod.default);
      ensureActivePlaybackRequest(requestId, requestSignal);

      await setAudioStreams(streamData.streams);
      ensureActivePlaybackRequest(requestId, requestSignal);
    }

    if (config.similarContent && !enforceVideo && !isQueuePrefetchActive() && requestId === activePlaybackRequestId)
      import('../modules/enqueueRelatedStreams')
        .then(mod => mod.default(streamData.recommended || []));


    // related streams imported into discovery after 1min 40seconds, short streams are naturally filtered out

    if (config.discover && requestId === activePlaybackRequestId)
      import('../modules/setDiscoveries')
        .then(mod => {
          setTimeout(() => {
            if (requestId === activePlaybackRequestId)
              mod.default(id, streamData.recommended || []);
          }, 1e5);
        });
  } catch (error) {
    if (isAbortError(error))
      return;

    const message = error instanceof Error ? error.message : 'Loading Audio Failed';
    setPlayerStore({
      playbackState: 'none',
      status: message
    });
    setStore('snackbar', {
      message,
      type: 'error'
    });
  }

}
