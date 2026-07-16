import { Show } from 'solid-js';
import { navStore, playerStore, setNavStore } from '@stores';
import SearchInput from '@features/Search/Input';
import SearchFilters from '@features/Search/Filters';

export default function Header() {
  return (
    <header class="app-header">
      <div class="app-header__logo-slot" aria-label="Loudara">
        <span aria-hidden="true">L</span>
      </div>

      <form class="app-header__search" onSubmit={(e) => e.preventDefault()}>
        <i class="ri-search-2-line" aria-hidden="true" />
        <SearchInput class="app-header__search-input" />
        <SearchFilters />
      </form>

      <div class="app-header__actions">
        <Show when={playerStore.playbackState !== 'none'}>
          <button
            aria-label="Player"
            class="app-header__icon"
            classList={{ 'is-active': navStore.player.state }}
            type="button"
            onClick={() => setNavStore('player', 'state', !navStore.player.state)}
          >
            <i class="ri-disc-fill" aria-hidden="true" />
          </button>
        </Show>
      </div>
    </header>
  );
}
