import { LikeButton, PlayButton, PlayNextButton, PlayPrevButton } from "@components/MediaPartials";
import { params, playerStore, queueStore, setPlayerStore, updateParam, t } from "@stores";
import { convertSStoHHMMSS, setConfig } from "@utils";
import { isNativeApp } from "@platform/native";
import { seekNativePlayback, setNativePlaybackLoop, setNativePlaybackRate } from "@platform/native/playback";
import { Accessor, createSignal, onMount, Setter, Show } from "solid-js";

export default function(_: {
  showLyrics: Accessor<boolean>,
  setShowLyrics: Setter<boolean>
}) {

  const [isPointed, setPointed] = createSignal(params.has('t'));
  let slider!: HTMLInputElement;


  onMount(() => {
    ['touchstart', 'touchmove', 'touchend'].forEach(type => {
      slider.addEventListener(type, (e) => e.stopPropagation());
    });
  })

  function updatePositionState() {
    if ('mediaSession' in navigator)
      import('@modules/mediaSession').then(m => m.updateMediaSessionPosition());
  }

  const useNativePlayback = () => isNativeApp && !playerStore.isWatching;

  return (
    <>
      <span class="slider">
        <input
          type="range"
          value={playerStore.currentTime}
          max={playerStore.fullDuration}
          ref={slider}
          onchange={async (e) => {
            const position = parseInt(e.target.value);
            if (useNativePlayback())
              await seekNativePlayback(position);
            else
              playerStore.audio.currentTime = position;
          }}
        />
        <div>
          <p id="currentDuration">{convertSStoHHMMSS(playerStore.currentTime)}</p>
          <p id="fullDuration">{convertSStoHHMMSS(playerStore.fullDuration)}</p>
        </div>
      </span>

      <div class="mainShelf">

        <PlayPrevButton disabled={!queueStore.history.length} />

        <button
          aria-label={t('player_seek_backward')}
          class="ri-replay-15-line"
          id="seekBwdButton"
          onclick={async () => {
            const position = Math.max(0, playerStore.currentTime - 15);
            if (useNativePlayback())
              await seekNativePlayback(position);
            else
              playerStore.audio.currentTime = position;
          }}
        ></button>

        <PlayButton />

        <button
          aria-label={t('player_seek_forward')}
          class="ri-forward-15-line"
          id="seekFwdButton"
          onclick={async () => {
            const position = Math.min(
              playerStore.fullDuration || Infinity,
              playerStore.currentTime + 15
            );
            if (useNativePlayback())
              await seekNativePlayback(position);
            else
              playerStore.audio.currentTime = position;
          }}
        ></button>
        <PlayNextButton disabled={!queueStore.list.length} />

      </div>

      <div class="bottomShelf">

        <select
          id="playSpeed"
          value={playerStore.playbackRate.toFixed(2)}
          onchange={async e => {
            const ref = e.target;
            const speed = parseFloat(ref.value);
            if (useNativePlayback())
              await setNativePlaybackRate(speed);
            else
              playerStore.audio.playbackRate = speed;
            setPlayerStore('playbackRate', speed);
            updatePositionState();
            ref.blur();
          }}
        >
          <option value="0.25">0.25x</option>
          <option value="0.33">0.33x</option>
          <option value="0.50">0.50x</option>
          <option value="0.75">0.75x</option>
          <option value="0.87">0.87x</option>
          <option value="1.00">1.00x</option>
          <option value="1.25">1.25x</option>
          <option value="1.50">1.50x</option>
          <option value="1.75">1.75x</option>
          <option value="2.00">2.00x</option>
          <option value="2.50">2.50x</option>
          <option value="3.00">3.00x</option>
          <option value="3.50">3.50x</option>
          <option value="4.00">4.00x</option>
        </select>

        <Show when={playerStore.isMusic}>
          <i
            aria-label={t('player_lyrics')}
            class="ri-music-2-line"
            classList={{
              on: _.showLyrics()
            }}
            onclick={() => _.setShowLyrics(!_.showLyrics())}
          ></i>
        </Show>


        <LikeButton />

        <i
          aria-label={t("player_loop")}
          class="ri-repeat-fill"
          classList={{ on: playerStore.loop }}
          onclick={async () => {
            const newLoopState = !playerStore.loop;
            if (useNativePlayback())
              await setNativePlaybackLoop(newLoopState);
            else
              playerStore.audio.loop = newLoopState;
            setPlayerStore('loop', newLoopState);
          }}
        ></i>
        <Show when={!playerStore.isMusic}>
          <i
            aria-label={t('player_save_progress')}
            class={`ri-signpost-${isPointed() ? 'fill' : 'line'}`}
            onclick={() => {
              if (isPointed()) {
                updateParam('t');
                setPointed(false);
              }
              else {
                updateParam('t', playerStore.currentTime.toString());
                setPointed(true);
              }
            }}
          ></i>
        </Show>

        <Show when={!useNativePlayback()}>
          <label class="volumeControl" aria-label="Volumen">
            <i class="ri-volume-down-line" aria-hidden="true"></i>
            <input
              id="volumeChanger"
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={playerStore.volume}
              onInput={e => {
                const ref = e.currentTarget;
                const vol = parseFloat(ref.value);

                playerStore.audio.volume = vol;
                setConfig('volume', (vol * 100).toString());
                setPlayerStore('volume', vol);
              }}
              onchange={e => {
                const ref = e.currentTarget;
                const vol = parseFloat(ref.value);

                playerStore.audio.volume = vol;
                setConfig('volume', (vol * 100).toString());
                setPlayerStore('volume', vol);
                ref.blur();
              }}
            />
          </label>
        </Show>

      </div>

    </>
  );
}
