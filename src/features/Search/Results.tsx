import { createEffect, For, onCleanup, Show, untrack } from 'solid-js';
import { getList, getSearchResults, searchStore, setListStore, setSearchStore } from '@stores';
import { generateImageUrl } from '@utils';
import StreamItem from '@components/StreamItem';

export default function SearchResults() {
  let sentinel!: HTMLDivElement;

  const isTrack = (item: YTItem | YTListItem): item is YTItem => item.type === 'video' || item.type === 'song';
  const featuredItems = () => searchStore.results.filter((item): item is YTListItem => !isTrack(item));
  const trackItems = () => searchStore.results.filter(isTrack);

  function openList(item: YTListItem) {
    setListStore('img', item.img);
    getList(item.id, item.type);
  }

  createEffect(() => {
    const canObserve = Boolean(
      sentinel &&
      searchStore.query &&
      searchStore.hasMore &&
      !searchStore.isLoading &&
      !searchStore.isLoadingMore
    );

    searchStore.results.length;

    untrack(() => searchStore.observer.disconnect());

    if (!canObserve) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          getSearchResults({ append: true });
        }
      },
      {
        root: document.querySelector('.app-main__scroller'),
        rootMargin: '420px 0px',
        threshold: 0.01
      }
    );

    observer.observe(sentinel);
    setSearchStore('observer', observer);
  });

  onCleanup(() => {
    searchStore.observer.disconnect();
  });

  return (
    <div class="searchlist">
      <Show when={searchStore.isLoading && searchStore.results.length === 0}>
        <i class="ri-loader-3-line loading-spinner"></i>
      </Show>

      <For each={featuredItems()}>
        {(item) => (
          <button
            class="search-featured-entity"
            type="button"
            onClick={() => openList(item)}
          >
            <img src={generateImageUrl(item.img, '')} alt="" />
            <span>
              <strong>{item.name}</strong>
              <small>
                {item.type === 'artist' || item.type === 'channel' ? 'Artista / canal' : item.type}
                {'subscribers' in item && item.subscribers ? ` • ${item.subscribers}` : ''}
              </small>
            </span>
          </button>
        )}
      </For>

      <For each={trackItems()}>
        {(item) => (
          <StreamItem
            {...{
              ...item,
              context: {
                src: 'search',
                id: searchStore.query
              }
            }}
          />
        )}
      </For>

      <div ref={sentinel} class="searchlist__sentinel" aria-hidden="true">
        <Show when={searchStore.isLoadingMore}>
          <i class="ri-loader-3-line loading-spinner"></i>
        </Show>
      </div>
    </div>
  );
}
