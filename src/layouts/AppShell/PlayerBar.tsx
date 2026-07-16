import { lazy, Show } from 'solid-js';
import { navStore, playerStore } from '@stores';

const MiniPlayer = lazy(() => import('@components/MiniPlayer'));

export default function PlayerBar() {
  return (
    <Show when={!navStore.player.state && playerStore.playbackState !== 'none'}>
      <aside class="app-player-bar" aria-label="Now playing">
        <MiniPlayer />
      </aside>
    </Show>
  );
}
