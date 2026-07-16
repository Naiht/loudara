import { createEffect, For, onCleanup, Show, untrack } from 'solid-js';
import { getList, getSearchResults, searchStore, setListStore, setSearchStore, t } from '@stores';
import { generateImageUrl } from '@utils';
import StreamItem from '@components/StreamItem';

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

    return secondary ? `${getEntityLabel(item)} • ${secondary}` : getEntityLabel(item);
  }

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

      <Show when={featuredItem()}>
        {(item) => (
          <button
            class="search-featured-entity"
            classList={{ 'search-featured-entity--channel': item().type === 'channel' || item().type === 'artist' }}
            style={{ '--entity-image': `url(${generateImageUrl(item().img, '720')})` }}
            type="button"
            onClick={() => openList(item())}
          >
            <img src={generateImageUrl(item().img, '')} alt="" />
            <span>
              <small class="search-featured-entity__eyebrow">{getEntityLabel(item())}</small>
              <strong>{item().name}</strong>
              <small class="search-featured-entity__meta">{getEntityMeta(item())}</small>
            </span>
          </button>
        )}
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
        {(item) => (
          <button
            class="search-featured-entity"
            classList={{ 'search-featured-entity--channel': item.type === 'channel' || item.type === 'artist' }}
            style={{ '--entity-image': `url(${generateImageUrl(item.img, '720')})` }}
            type="button"
            onClick={() => openList(item)}
          >
            <img src={generateImageUrl(item.img, '')} alt="" />
            <span>
              <small class="search-featured-entity__eyebrow">{getEntityLabel(item)}</small>
              <strong>{item.name}</strong>
              <small class="search-featured-entity__meta">{getEntityMeta(item)}</small>
            </span>
          </button>
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
