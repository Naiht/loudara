import { createSignal, For, onMount, Show } from 'solid-js';
import { getList, setListStore, store, t } from '@stores';
import { generateImageUrl } from '@utils';
import StreamItem from '@components/StreamItem';

export default function Trending() {
  const [items, setItems] = createSignal<(YTItem | YTListItem)[]>([]);
  const [isLoading, setIsLoading] = createSignal(false);

  const isTrack = (item: YTItem | YTListItem): item is YTItem => item.type === 'video' || item.type === 'song';
  const featuredItems = () => items().filter((item): item is YTListItem => !isTrack(item));
  const trackItems = () => items().filter(isTrack);

  function openList(item: YTListItem) {
    setListStore('img', item.img);
    getList(item.id, item.type);
  }

  onMount(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${store.api}/trending`);
      if (!res.ok) throw new Error('Could not load trending music');
      setItems(await res.json());
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  });

  return (
    <div class="trending-view">
      <header class="trending-view__header">
        <p>Tendencias cerca de ti</p>
        <span>Actualizado desde YouTube Music</span>
      </header>

      <Show when={!isLoading()} fallback={<i class="ri-loader-3-line loading-spinner"></i>}>
        <div class="searchlist">
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
                    id: 'trending'
                  }
                }}
              />
            )}
          </For>
        </div>

        <Show when={!items().length}>
          <p class="trending-view__empty">{t('loading')}</p>
        </Show>
      </Show>
    </div>
  );
}
