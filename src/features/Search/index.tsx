import { onMount, Show, lazy } from "solid-js";
import './Search.css';
import Results from './Results';
import { searchStore, setNavStore } from "@stores";

const Trending = lazy(() => import('./Trending'));

export default function() {
  let searchRef!: HTMLElement;

  onMount(() => {
    setNavStore('search', 'ref', searchRef);
    searchRef.scrollIntoView();
  });

  return (
    <section class="search" ref={searchRef}>
      <Show when={searchStore.query || searchStore.results.length > 0} fallback={<Trending />}>
        <Results />
      </Show>
    </section>
  );
}
