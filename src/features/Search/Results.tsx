import { createEffect, For, onCleanup, Show, untrack } from 'solid-js';
import { getSearchResults, searchStore, setSearchStore, t } from '@stores';
import StreamItem from '@components/StreamItem';
import ListItem from '@components/ListItem';

export default function SearchResults() {
  let sentinel!: HTMLDivElement;

  const isTrack = (item: YTItem | YTListItem): item is YTItem => item.type === 'video' || item.type === 'song';
  const listItems = () => searchStore.results.filter((item): item is YTListItem => !isTrack(item));
  const featuredItem = () => {
    const items = listItems();
    return items.find(item => item.type === 'channel' || item.type === 'artist') || items[0];
  };
  const secondaryItems = () => {
    const featured = featuredItem();
    return listItems().filter(item => item !== featured);
  };
  const trackItems = () => searchStore.results.filter(isTrack);

  function getEntityLabel(item: YTListItem) {
    if (item.type === 'artist') return t('library_artists');
    if (item.type === 'channel') return t('library_channels');
    if (item.type === 'playlist') return t('library_playlists');
    return t('library_albums');
  }

  function getEntityMeta(item: YTListItem) {
    const secondary = item.type === 'artist' || item.type === 'channel'
      ? item.subscribers
      : item.type === 'playlist'
        ? item.videoCount
        : item.year;

    const author = item.type === 'album' || item.type === 'playlist' ? item.author : '';
    return [getEntityLabel(item), author, secondary].filter(Boolean).join(' • ');
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

      <Show when={featuredItem()}>
        {(item) => <ListItem {...item()} rowSubtitle={getEntityMeta(item())} />}
      </Show>

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

      <For each={secondaryItems()}>
        {(item) => <ListItem {...item} rowSubtitle={getEntityMeta(item)} />}
      </For>

      <div ref={sentinel} class="searchlist__sentinel" aria-hidden="true">
        <Show when={searchStore.isLoadingMore}>
          <i class="ri-loader-3-line loading-spinner"></i>
        </Show>
      </div>
    </div>
  );
}
