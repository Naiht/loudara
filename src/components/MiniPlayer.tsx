import { lazy, Show } from "solid-js";
import { config } from "@utils";
import { LikeButton, MediaDetails, PlayButton, PlayNextButton } from "./MediaPartials";
import { playerStore, setNavStore, queueStore, setPlayerStore } from "@stores";


const MediaArtwork = lazy(() => import('@components/MediaPartials/MediaArtwork'))

export default function() {
  const progress = () => {
    if (!playerStore.fullDuration) return 0;
    return Math.min(100, Math.max(0, (playerStore.currentTime / playerStore.fullDuration) * 100));
  };

  const seek = (value: number) => {
    if (!Number.isFinite(value) || !playerStore.fullDuration) return;

    playerStore.audio.currentTime = value;
    setPlayerStore('currentTime', value);
  };

  return (
    <div
      class='miniplayer'
      style={`--mini-player-progress: ${progress()}%;`}
      onclick={(e) => {
      if (!e.target.matches('button'))
        setNavStore('player', 'state', true);
      }}
    >
      <span class="miniplayer__progress-fill" aria-hidden="true"></span>
      <input
        class="miniplayer__seek"
        type="range"
        min="0"
        max={Math.max(playerStore.fullDuration || 0, 1)}
        step="1"
        value={playerStore.currentTime || 0}
        disabled={!playerStore.fullDuration}
        aria-label="Mover posicion de la cancion"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        onInput={(e) => seek(parseFloat(e.currentTarget.value))}
      />
      <Show when={config.loadImage}>
        <MediaArtwork />
      </Show>
      <MediaDetails />
      <PlayButton />
      <Show when={queueStore.list.length} fallback={<LikeButton />}>
        <PlayNextButton />
      </Show>
    </div>
  )
}
