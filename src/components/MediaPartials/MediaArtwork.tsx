import { createSignal } from "solid-js";
import { setPlayerStore, playerStore } from "@stores";

export default function() {

  let imgRef!: HTMLImageElement;
  const [isWideArtwork, setIsWideArtwork] = createSignal(false);

  function handler() {
    setPlayerStore('mediaArtwork',
      imgRef.src
        .replace('maxres', 'mq')
        .replace('.webp', '.jpg')
        .replace('vi_webp', 'vi')
    );
  }

  function updateArtworkShape() {
    const ratio = imgRef.naturalHeight ? imgRef.naturalWidth / imgRef.naturalHeight : 1;
    setIsWideArtwork(ratio > 1.2);
  }

  return (
    <img
      class="mediaArtwork"
      classList={{ 'mediaArtwork--wide': isWideArtwork() }}
      ref={imgRef}
      src={playerStore.mediaArtwork}
      crossorigin="anonymous"
      alt={"Media Artwork for " + playerStore.stream.title}
      onclick={() => {
        if (playerStore.isMusic)
          setPlayerStore('immersive', !playerStore.immersive);
        else
          setPlayerStore('isWatching', !playerStore.isWatching);
      }}
      onload={() => {
        updateArtworkShape();
        if (imgRef.naturalWidth === 120)
          handler();
      }}
      onerror={() => {
        if (imgRef.src.includes('max'))
          handler();
      }}
    />
  )
}
