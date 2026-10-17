import { Show } from 'solid-js';
import { navStore, playerStore, resetSearch, setNavStore } from '@stores';
import SearchInput from '@features/Search/Input';
import SearchFilters from '@features/Search/Filters';

export default function Header() {
  function openHome() {
    resetSearch();
    setNavStore('queue', 'state', false);
    setNavStore('player', 'state', false);
    setNavStore('active', 'search');
  }

  return (
    <header class="app-header">
      <button class="app-header__logo-slot" type="button" aria-label="Inicio" title="Inicio" onClick={openHome}>
        <img src="/icon.png" alt="" aria-hidden="true" />
        <span>Loudara</span>
      </button>

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
