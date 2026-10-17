import { createEffect, createSignal, lazy, onCleanup, onMount, Show } from "solid-js"
import './Player.css'
import { MediaDetails } from "@components/MediaPartials";
import { config, cssVar, player, streamCache } from "@utils";
import { playerStore, setNavStore, setStore, t, updateParam } from "@stores";

const MediaArtwork = lazy(() => import('../../components/MediaPartials/MediaArtwork'));
const Lyrics = lazy(() => import('./Lyrics'));
const Video = lazy(() => import('./Video'));
const Controls = lazy(() => import('./Controls'));

export default function() {
  let playerSection!: HTMLDivElement;


  const [showLyrics, setShowLyrics] = createSignal(false);

  onMount(() => {
    setNavStore('player', 'ref', playerSection);
    playerSection.scrollIntoView();
  });

  createEffect(() => {
    if (playerStore.stream.id)
      updateParam('s', playerStore.stream.id);
  });

  onCleanup(() => {
    updateParam('s');
  });


  createEffect(() => {
    const { immersive, mediaArtwork } = playerStore;
    if (immersive)
      cssVar('--player-bg', `url(${mediaArtwork})`);
  });

  function canReloadStream() {
    return Boolean(
      playerStore.stream.id &&
      playerStore.status &&
      playerStore.playbackState === 'none'
    );
  }

  function reloadStream() {
    const id = playerStore.stream.id;
    if (!id) return;

    streamCache.remove(id);
    playerStore.audio.pause();
    playerStore.audio.removeAttribute('src');
    playerStore.audio.load();
    player(id);
  }

  function returnToMain() {
    setNavStore('player', 'state', false);
    setNavStore('queue', 'state', false);
  }


  return (
    <section
      id="playerSection"
      ref={playerSection}>

      <Show when={playerStore.immersive} >
        <div class="bg-pane" />
        <div class="bg-image" />
      </Show>

      <header class="topShelf">
        <button
          type="button"
          class="playerTopButton"
          aria-label={t('close')}
          title={t('close')}
          onclick={returnToMain}
        >
          <i class="ri-arrow-down-s-line" aria-hidden="true"></i>
        </button>

        <div class="playerIdentity" aria-label="Loudara now playing">
          <span><i class="ri-sound-module-line" aria-hidden="true"></i> Loudara</span>
          <small>Now playing</small>
        </div>

        <div class="right-group">
          <Show when={playerStore.stream.id}>
            <button
              type="button"
              class="playerTopButton"
              aria-label={t('player_reload')}
              title={t('player_reload')}
              onclick={reloadStream}
            >
              <i class="ri-refresh-line" aria-hidden="true"></i>
            </button>
          </Show>

          <button
            type="button"
            class="playerTopButton"
            aria-label={t('player_more')}
            title={t('player_more')}
            onclick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              setStore('actionsMenu', {
                ...playerStore.stream,
                menuPosition: {
                  x: rect.right,
                  y: rect.bottom + 8
                }
              });
            }}
          >
            <i class="ri-more-2-fill" aria-hidden="true"></i>
          </button>
        </div>
      </header>
      <article>

        <Show when={playerStore.isWatching && !playerStore.isMusic}>
          <Video />
        </Show>

        <Show when={showLyrics()}>
          <Lyrics onClose={() => setShowLyrics(false)} />
        </Show>

        <Show when={(!playerStore.isWatching || playerStore.isMusic) && config.loadImage && !showLyrics()}>
          <div class="playerArtworkFrame">
            <MediaArtwork />
          </div>
        </Show>


        <MediaDetails />

        <Show when={canReloadStream()}>
          <div class="playerReload">
            <p>{playerStore.status}</p>
            <button
              type="button"
              class="playerReload__button"
              onClick={reloadStream}
            >
              <i class="ri-refresh-line" aria-hidden="true"></i>
              Reintentar cancion
            </button>
          </div>
        </Show>

        <Show when={!playerStore.isWatching || playerStore.isMusic}>
          <Controls showLyrics={showLyrics} setShowLyrics={setShowLyrics} />
        </Show>

      </article>
    </section>
  )
}
