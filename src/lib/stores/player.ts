import { createRoot } from "solid-js";
import { createStore } from "solid-js/store";
import { navStore, params, updateParam, addToQueue, queueStore, setQueueStore, setStore, store, groupQueueByAuthor } from "@stores";
import { config, cssVar, themer, addToCollection, player, shuffle, streamCache } from "@utils";
import { isQueuePrefetchActive } from "@modules/queuePrefetch";
import { getEmbeddedSimilar, hasEmbeddedBackend } from "@platform/embedded";
import { isNativeApp } from "@platform/native";
import { addNativePlaybackListener, addNativeTransportListener, getNativePlaybackState, type NativePlaybackState } from "@platform/native/playback";

const blankImage = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

type PlayerStore = {
  stream: TrackItem & { albumId?: string },
  audio: HTMLAudioElement,
  context: {
    src: Context,
    id: string
  }
  currentTime: number,
  fullDuration: number,
  playbackRate: number,
  loop: boolean,
  volume: number,
  status: string,
  playbackState: 'none' | 'playing' | 'paused' | 'loading',
  mediaArtwork: string,
  mediaArtworkSource: string,
  mediaArtworkFallback: boolean,
  supportsOpus: Promise<boolean>,
  data: {},
  immersive: boolean,
  isMusic: boolean,
  audioURL: string,
  videoURL: string,
  isWatching: boolean,
  proxy: string,
  lrcSync?: (d: number) => void
};

const createInitialState = (): PlayerStore => ({
  audio: new Audio(),
  playbackState: 'none',
  context: { id: '', src: '' },
  status: '',
  currentTime: 0,
  fullDuration: 0,
  playbackRate: 1.0,
  loop: false,
  volume: isNativeApp ? 1 : parseFloat(config.volume) / 100,
  stream: {
    title: '',
    author: '',
    authorId: '',
    id: '',
    duration: ''
  },
  mediaArtwork: blankImage,
  mediaArtworkSource: '',
  mediaArtworkFallback: false,
  supportsOpus: navigator.mediaCapabilities.decodingInfo({
    type: 'file',
    audio: {
      contentType: 'audio/webm;codecs=opus'
    }
  }).then(res => res.supported),
  data: {},
  immersive: false,
  isMusic: true,
  audioURL: '',
  videoURL: '',
  isWatching: Boolean(config.watchMode),
  proxy: ''
});

export const [playerStore, setPlayerStore] = createStore(createInitialState());

export function playNext() {
  const { stream } = playerStore;
  const { list } = queueStore;
  const nextStream = list[0];

  if (!nextStream) return;

  if (stream.id) setQueueStore('history', h => [{ ...stream }, ...h]);

  setPlayerStore('stream', nextStream);
  setPlayerStore('context', {
    id: nextStream.context?.id || '',
    src: nextStream.context?.src || ''
  });
  setQueueStore('list', l => {
    let newList = l.slice(1);
    if (newList.length > 1) {
      if (config.persistentShuffle) newList = shuffle(newList);
      if (config.authorGrouping) newList = groupQueueByAuthor(newList);
    }
    return newList;
  });
  player(nextStream.id);
}
export function playPrev() {
  const { stream } = playerStore;
  const { history } = queueStore;

  const prevStream = history[0];
  if (!prevStream) return;

  setQueueStore('history', h => h.slice(1));
  if (stream.id) setQueueStore('list', l => [{ ...stream }, ...l]);

  setPlayerStore('stream', prevStream);
  setPlayerStore('context', {
    id: prevStream.context?.id || '',
    src: prevStream.context?.src || ''
  });
  player(prevStream.id);
}
createRoot(() => {

  let historyID: string | undefined = '';
  let historyTimeoutId = 0;
  let lastNativeError = '';
  let nativeEndedHandled = false;

  if ('mediaSession' in navigator)
    import('@modules/mediaSession').then(m => m.initMediaSession());

  playerStore.audio.volume = playerStore.volume;

  function handlePlaybackEnded() {
    if (queueStore.list.length)
      playNext();
    else {
      updateParam('s');
      setPlayerStore('playbackState', 'none');
      if ('mediaSession' in navigator)
        import('@modules/mediaSession').then(m => m.updateMediaSessionPlaybackState('none'));
    }
  }

  function handlePlaybackPlaying() {
    setPlayerStore('playbackState', 'playing');
    if ('mediaSession' in navigator)
      import('@modules/mediaSession').then(m => {
        m.updateMediaSessionPlaybackState('playing');
        m.updateMediaSessionPosition();
      });

    const { stream } = playerStore;
    const { id } = stream;

    if (config.history)
      historyTimeoutId = window.setTimeout(() => {
        if (historyID === id) {
          if (
            config.similarContent
            && playerStore.isMusic
            && !isQueuePrefetchActive()
          )
            getRecommendations();
          addToCollection('history', [playerStore.stream]);
        }
      }, 1e4);
  }

  function handlePlaybackPaused() {
    setPlayerStore('playbackState', 'paused');
    if ('mediaSession' in navigator)
      import('@modules/mediaSession').then(m => {
        m.updateMediaSessionPlaybackState('paused');
        m.updateMediaSessionPosition();
      });
    clearTimeout(historyTimeoutId);
  }

  function applyPlaybackPosition(seconds: number) {
    if (!Number.isFinite(seconds)) return;

    if (document.activeElement?.matches('input[type="range"]'))
      return;

    const { lrcSync, fullDuration, isMusic } = playerStore;

    if (lrcSync)
      lrcSync(seconds);

    setPlayerStore('currentTime', seconds);

    const { ref } = navStore.player;
    if (ref) {
      const { offsetHeight, offsetWidth } = ref;
      const diff = isMusic ? (offsetHeight - offsetWidth) : offsetWidth;
      const scale = fullDuration ? (seconds / fullDuration) : 0;
      const shift = Math.floor(scale * diff);
      cssVar('--player-bp', `-${shift}px 0`);
    }

    const t = params.get('t');

    if (t) {
      if (isMusic) updateParam('t');
      else if (seconds % 5 === 0) {
        const str = seconds.toString();
        if (t !== str)
          updateParam('t', str);
      }
    }
  }

  function syncNativePlaybackState(state: NativePlaybackState) {
    if (!isNativeApp || playerStore.isWatching) return;

    if (state.error && state.error !== lastNativeError) {
      lastNativeError = state.error;
      setPlayerStore({
        playbackState: 'none',
        status: state.error
      });
      setStore('snackbar', {
        message: state.error,
        type: 'error'
      });
      return;
    }

    if (!state.error)
      lastNativeError = '';

    if (state.ended) {
      if (nativeEndedHandled) return;
      nativeEndedHandled = true;
      handlePlaybackEnded();
      return;
    }

    nativeEndedHandled = false;

    const nextState = state.playbackState || 'none';
    const currentDuration = Math.floor(state.duration || 0);
    const nextTime = Math.floor(state.currentTime || 0);
    const previousState = playerStore.playbackState;

    setPlayerStore({
      playbackState: nextState,
      status: nextState === 'loading' ? 'Loading Audio...' : '',
      fullDuration: currentDuration || playerStore.fullDuration,
      volume: isNativeApp && !playerStore.isWatching
        ? 1
        : (Number.isFinite(state.volume) ? state.volume : playerStore.volume),
      playbackRate: Number.isFinite(state.playbackRate) ? state.playbackRate : playerStore.playbackRate,
      loop: typeof state.loop === 'boolean' ? state.loop : playerStore.loop
    });

    applyPlaybackPosition(nextTime);

    if (nextState === 'playing' && previousState !== 'playing')
      handlePlaybackPlaying();
    else if (nextState === 'paused' && previousState !== 'paused')
      handlePlaybackPaused();
    else if (nextState === 'none' && previousState !== 'none')
      clearTimeout(historyTimeoutId);
  }

  playerStore.audio.onended = handlePlaybackEnded;
  playerStore.audio.onplaying = handlePlaybackPlaying;
  playerStore.audio.onpause = handlePlaybackPaused;
  playerStore.audio.addEventListener('loadeddata', themer);


  let isPlayable = false;
  const playableCheckerID = setInterval(() => {
    if (queueStore.history.length || params.has('url') || params.has('text') || !params.has('s')) {
      isPlayable = true;
      clearInterval(playableCheckerID);
    }
  }, 500);

  playerStore.audio.onloadstart = () => {
    setPlayerStore('playbackState', 'paused');
    setPlayerStore('status', '');
    if (isPlayable) playerStore.audio.play();

    historyID = playerStore.stream.id;
    clearTimeout(historyTimeoutId);
    playerStore.audio.playbackRate = playerStore.playbackRate;
  }

  playerStore.audio.onwaiting = () => {
    setPlayerStore('playbackState', 'loading')
  };

  playerStore.audio.ontimeupdate = () => {
    applyPlaybackPosition(Math.floor(playerStore.audio.currentTime));
  }

  playerStore.audio.onloadedmetadata = () => {
    setPlayerStore({
      currentTime: 0,
      fullDuration: Math.floor(playerStore.audio.duration)
    });

    if ('mediaSession' in navigator)
      import('@modules/mediaSession').then(m => m.updateMediaSessionPosition());
  }

  playerStore.audio.oncanplaythrough = async function() {
    const nextItem = isQueuePrefetchActive() && queueStore.list[0]?.id;

    if (!nextItem) return;

    const prefetchRef = new Audio();
    prefetchRef.onerror = () =>
      import('@modules/audioErrorHandler').then(mod => mod.default(prefetchRef, nextItem));

    const data = streamCache.get(nextItem) || await import('@modules/getStreamData').then(mod => mod.default(nextItem));

    if (data && 'streams' in data) {
      import('../modules/setAudioStreams')
        .then(mod => mod.default(data.streams, prefetchRef));
    }

  }


  playerStore.audio.onerror = () => import('@modules/audioErrorHandler').then(mod => mod.default(playerStore.audio));

  if (isNativeApp) {
    addNativePlaybackListener(syncNativePlaybackState).catch(() => void 0);
    addNativeTransportListener(({ action }) => {
      if (action === 'previous') {
        if (queueStore.history.length)
          playPrev();
        return;
      }

      if (action === 'next' && queueStore.list.length)
        playNext();
    }).catch(() => void 0);

    window.setInterval(() => {
      if (!playerStore.stream.id || playerStore.isWatching)
        return;

      getNativePlaybackState()
        .then(syncNativePlaybackState)
        .catch(() => void 0);
    }, 1000);
  }

});

async function getRecommendations() {

  const currentTitle = playerStore.stream.title;
  const title = encodeURIComponent(currentTitle);
  const artist = encodeURIComponent(playerStore.stream.author?.slice(0, -8) ?? '');
  const request = hasEmbeddedBackend
    ? getEmbeddedSimilar({
      title: currentTitle,
      artist: playerStore.stream.author?.slice(0, -8) ?? '',
      limit: '10'
    })
    : fetch(`${store.api}/similar?title=${title}&artist=${artist}&limit=10`)
      .then(res => {
        if (!res.ok) throw new Error('Could not load similar tracks');
        return res.json();
      });

  request
    .then(data => addToQueue(data.map((item: TrackItem) => ({
      ...item,
      context: { src: 'queue', id: `Similar to ${currentTitle}` }
    }))))
    .catch(e => setStore('snackbar', `Could not get recommendations for the track: ${e.message}`));


}
