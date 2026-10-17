import { addToQueue, playerStore, queueStore } from '@stores';
import { config } from '@utils';

const RADIO_DELAY_MS = 10_000;
let timer: number | undefined;
let generation = 0;
let prepared = false;
let attempted = false;
let inFlight = false;

function hasQueuedRadio() {
  return queueStore.list.some(item => item.context?.src === 'queue' && item.context.id.startsWith('Radio: '));
}

// Invalidate both a pending timer and any radio request already in flight.
export function cancelAutoRadio() {
  generation += 1;
  if (timer !== undefined) window.clearTimeout(timer);
  timer = undefined;
  if (inFlight) attempted = false;
  inFlight = false;
}

export function resetAutoRadio() {
  cancelAutoRadio();
  prepared = false;
  attempted = false;
}

export function prepareAutoRadio(isPlaying: boolean) {
  prepared = true;
  if (isPlaying) scheduleAutoRadio();
}

export function scheduleAutoRadio() {
  if (!prepared || !config.autoRadio || attempted || timer !== undefined || !playerStore.stream.id) return;

  const seed = { ...playerStore.stream };
  const currentGeneration = generation;
  timer = window.setTimeout(async () => {
    timer = undefined;
    if (currentGeneration !== generation || !config.autoRadio || playerStore.stream.id !== seed.id
      || playerStore.playbackState !== 'playing' || queueStore.isLoading || queueStore.isSession || hasQueuedRadio()) return;

    attempted = true;
    inFlight = true;
    try {
      const { default: getRadio } = await import('./getRadio');
      if (currentGeneration !== generation || !config.autoRadio || playerStore.stream.id !== seed.id) return;
      const tracks = await getRadio(seed);
      if (currentGeneration !== generation || !config.autoRadio || playerStore.stream.id !== seed.id
        || queueStore.isLoading || queueStore.isSession || hasQueuedRadio()) return;

      addToQueue(tracks.map(item => ({
        ...item,
        context: { src: 'queue', id: `Radio: ${seed.title}` }
      })));
    } catch (error) {
      // Automatic radio should not interrupt playback when recommendations fail.
      console.warn('Could not start automatic radio', error);
    } finally {
      if (currentGeneration === generation) inFlight = false;
    }
  }, RADIO_DELAY_MS);
}
