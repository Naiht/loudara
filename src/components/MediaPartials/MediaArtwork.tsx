import { createEffect, createSignal, onCleanup } from "solid-js";
import { setPlayerStore, playerStore } from "@stores";
import { createFallbackArtworkUrl } from "@utils";

export default function() {

  let imgRef!: HTMLImageElement;
  const [isWideArtwork, setIsWideArtwork] = createSignal(false);
  let retryTimeout: number | undefined;
  let lastRetriedSource = '';

  function getFallbackArtwork() {
    return createFallbackArtworkUrl(playerStore.stream.title || playerStore.stream.author || 'L');
  }

  function getRecoveryArtwork(src: string) {
    return src
      .replace('maxres', 'mq')
      .replace('.webp', '.jpg')
      .replace('vi_webp', 'vi');
  }

  function isGeneratedVideoThumbnail(src: string) {
    return (
      src.includes('i.ytimg.com/vi/') ||
      src.includes('i.ytimg.com/vi_webp/') ||
      src.includes('/vi/') ||
      src.includes('/vi_webp/')
    );
  }

  function recoverArtwork() {
    const nextSource = getRecoveryArtwork(imgRef.src);

    if (nextSource !== imgRef.src) {
      setPlayerStore({
        mediaArtwork: nextSource,
        mediaArtworkFallback: false
      });
      return;
    }

    setPlayerStore({
      mediaArtwork: getFallbackArtwork(),
      mediaArtworkFallback: true
    });
    setIsWideArtwork(false);
  }

  function updateArtworkShape() {
    const ratio = imgRef.naturalHeight ? imgRef.naturalWidth / imgRef.naturalHeight : 1;
    setIsWideArtwork(ratio > 1.2);
  }

  createEffect(() => {
    const source = playerStore.mediaArtworkSource;

    if (source !== lastRetriedSource && source !== playerStore.mediaArtwork)
      lastRetriedSource = '';

    if (!playerStore.mediaArtworkFallback || !source || !playerStore.stream.id)
      return;

    if (playerStore.playbackState !== 'playing' && playerStore.playbackState !== 'paused')
      return;

    if (lastRetriedSource === source)
      return;

    window.clearTimeout(retryTimeout);
    retryTimeout = window.setTimeout(() => {
      lastRetriedSource = source;
      setPlayerStore({
        mediaArtwork: source,
        mediaArtworkFallback: false
      });
    }, 1500);
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
        updateArtworkShape();
        if (isGeneratedVideoThumbnail(imgRef.src) && imgRef.naturalWidth === 120) {
          recoverArtwork();
          return;
        }

        setPlayerStore('mediaArtworkFallback', false);
      }}
      onerror={() => {
        recoverArtwork();
      }}
    />
  )
}
