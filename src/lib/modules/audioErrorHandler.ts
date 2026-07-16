import { setStore, playerStore, setPlayerStore } from '@stores';
import { proxyHandler, streamCache } from '@utils';
import type { AudioStream } from '@core/streaming';

export default function(
  audio: HTMLAudioElement | HTMLVideoElement,
  prefetch = ''
) {
  audio.pause();
  const { proxy } = playerStore;

  if (!audio.src || audio.src === location.href) return;

  const url = new URL(audio.src);
  const isFallback = audio.src.endsWith('&fallback');
  const isAlreadyProxy = url.origin === proxy || audio.dataset.retried === 'true';

  const id = prefetch || playerStore.stream.id;

  const candidates = parseCandidates(audio.dataset.streamCandidates);
  const index = Number.parseInt(audio.dataset.streamIndex || '0', 10);
  const next = candidates[index + 1];

  if (next) {
    const attempts = parseAttempts(audio.dataset.streamAttempts);
    attempts.push({
      url: audio.src,
      message: 'media element error'
    });
    audio.dataset.streamAttempts = JSON.stringify(attempts);
    audio.dataset.streamIndex = String(index + 1);
    delete audio.dataset.retried;
    audio.src = proxyHandler(next.url, Boolean(prefetch));
    return;
  }

  if (isFallback) {
    if (!playerStore.isWatching && !prefetch) {
      setStore('snackbar', 'Error 403 : Unauthenticated Stream');
      setPlayerStore('playbackState', 'none');
    }
    streamCache.remove(id);
    return;
  }

  if (!proxy || isAlreadyProxy) {
    if (!prefetch) {
      setPlayerStore({
        playbackState: 'none',
        status: 'Streaming Failed EA'
      });
      setStore('snackbar', 'Streaming Failed EA');
      console.log(audio.src);
    }
    streamCache.remove(id);
    return;
  }

  console.log('ErrorHandler: Switching to proxy ' + proxy);
  const newSrc = audio.src.replace(url.origin, proxy);

  if (newSrc !== audio.src) {
    audio.dataset.retried = 'true';
    audio.src = newSrc;
  } else if (!prefetch) {
    setPlayerStore({
      playbackState: 'none',
      status: 'Streaming Failed EB'
    });
    streamCache.remove(id);
  }
}

function parseCandidates(raw?: string): AudioStream[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as AudioStream[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseAttempts(raw?: string): Array<{ url: string; message: string }> {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as Array<{ url: string; message: string }>;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
