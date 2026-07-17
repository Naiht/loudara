import { playerStore, t } from "@stores";
import { isNativeApp } from "@platform/native";
import { pauseNativePlayback, playNativePlayback } from "@platform/native/playback";

export default function() {

  const icons = {
    playing: 'ri-pause-circle-fill',
    none: 'ri-stop-circle-fill',
    paused: 'ri-play-circle-fill',
    loading: 'ri-loader-3-line loading-spinner'
  }

  return (
    <button
      class={icons[playerStore.playbackState]}
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
    ></button>
  );
}
