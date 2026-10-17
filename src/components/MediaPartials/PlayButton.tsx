import { playerStore, t } from "@stores";
import { isNativeApp } from "@platform/native";
import { pauseNativePlayback, playNativePlayback } from "@platform/native/playback";

export default function() {

  const icons = {
    playing: 'ri-pause-fill',
    none: 'ri-play-fill',
    paused: 'ri-play-fill',
    loading: 'ri-loader-3-line loading-spinner'
  }

  return (
    <button
      type="button"
      id="playButton"
      onclick={async () => {
        const { stream, playbackState, audio } = playerStore;
        const useNativePlayback = isNativeApp && !playerStore.isWatching;
        if (
          stream.id &&
          playbackState === 'playing'
        )
          useNativePlayback ? await pauseNativePlayback() : audio.pause();
        else
          useNativePlayback ? await playNativePlayback() : audio.play();
      }}
      aria-label={t('player_play_button')}
    >
      <i class={icons[playerStore.playbackState]} aria-hidden="true"></i>
    </button>
  );
}
