import { createEffect, createSignal, on, onCleanup } from "solid-js";
import { setPlayerStore, playerStore } from "@stores";
import { getArtworkCandidates } from "@utils";

export default function() {
  let imgRef!: HTMLImageElement;
  const [isWideArtwork, setIsWideArtwork] = createSignal(false);
  let retryTimeout: number | undefined;
  let lastRetriedSource = '';

  function artworkCandidates() {
    return getArtworkCandidates(
      playerStore.mediaArtworkSource,
      playerStore.mediaArtworkTrackId,
      playerStore.stream.title || playerStore.stream.author || 'L',
      'maxres'
    );
  }

  function recoverArtwork() {
    const candidates = artworkCandidates();
    const currentIndex = candidates.indexOf(playerStore.mediaArtwork);
    const nextIndex = Math.min(currentIndex + 1, candidates.length - 1);
    const nextSource = candidates[nextIndex];
    if (!nextSource || nextSource === playerStore.mediaArtwork) return;

    setPlayerStore({
      mediaArtwork: nextSource,
      mediaArtworkFallback: nextIndex === candidates.length - 1
    });
  }

  createEffect(on([() => playerStore.mediaArtworkSource, () => playerStore.mediaArtworkTrackId], () => {
    window.clearTimeout(retryTimeout);
    lastRetriedSource = '';
  }));

  createEffect(() => {
    const source = playerStore.mediaArtworkSource;
    if (!playerStore.mediaArtworkFallback || !source || !playerStore.stream.id) return;
    if (playerStore.playbackState !== 'playing' && playerStore.playbackState !== 'paused') return;
    if (lastRetriedSource === source) return;

    window.clearTimeout(retryTimeout);
    retryTimeout = window.setTimeout(() => {
      lastRetriedSource = source;
      setPlayerStore({
        mediaArtwork: artworkCandidates()[0],
        mediaArtworkFallback: false
      });
    }, 1500);
    onCleanup(() => window.clearTimeout(retryTimeout));
  });

  onCleanup(() => window.clearTimeout(retryTimeout));

  return (
    <img
      class="mediaArtwork"
      classList={{ 'mediaArtwork--wide': isWideArtwork() }}
      ref={imgRef}
      src={playerStore.mediaArtwork}
      alt={"Media Artwork for " + playerStore.stream.title}
      onclick={() => {
        if (playerStore.isMusic)
          setPlayerStore('immersive', !playerStore.immersive);
        else
          setPlayerStore('isWatching', !playerStore.isWatching);
      }}
      onload={() => {
        const ratio = imgRef.naturalHeight ? imgRef.naturalWidth / imgRef.naturalHeight : 1;
        setIsWideArtwork(ratio > 1.2);
        if (/i\.ytimg\.com\/vi(?:_webp)?\//.test(imgRef.src) && imgRef.naturalWidth === 120)
          recoverArtwork();
      }}
      onerror={recoverArtwork}
    />
  )
}
