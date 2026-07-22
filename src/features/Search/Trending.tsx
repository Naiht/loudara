import { createMemo, createSignal, For, onMount, Show } from 'solid-js';
import { navStore, playerStore, setNavStore, setPlayerStore, setQueueStore, store, t } from '@stores';
import { config, drawer, generateImageUrl, getCollection, getTracksMap, player } from '@utils';
import { getEmbeddedTrending, hasEmbeddedBackend } from '@platform/embedded';

type ShelfTrack = TrackItem & {
  img?: string;
  albumId?: string;
  type?: 'video' | 'song';
  subtext?: string;
};

export default function Trending() {
  const [items, setItems] = createSignal<(YTItem | YTListItem)[]>([]);
  const [isLoading, setIsLoading] = createSignal(false);

  const isTrack = (item: YTItem | YTListItem): item is YTItem => item.type === 'video' || item.type === 'song';

  const recentItems = createMemo<ShelfTrack[]>(() => {
    const historyIds = getCollection('history');
    const tracksMap = getTracksMap();
    const recentPool: (ShelfTrack & { recency: number, plays: number })[] = [];
    const seen = new Set<string>();

    for (let index = 0; index < historyIds.length; index += 1) {
      const id = historyIds[index];
      if (seen.has(id) || !tracksMap[id]) continue;

      seen.add(id);
      recentPool.push({
        ...tracksMap[id],
        img: id,
        type: 'video',
        recency: index,
        plays: drawer.libraryPlays[id] || 1
      });

      if (recentPool.length >= 28) break;
    }

    return recentPool
      .sort((a, b) => (b.plays - a.plays) || (a.recency - b.recency))
      .slice(0, 14)
      .map(({ recency, plays, ...track }) => track);
  });

  const trendTracks = createMemo<ShelfTrack[]>(() =>
    items()
      .filter(isTrack)
      .slice(0, 18)
  );

  function playFromShelf(item: ShelfTrack, shelf: ShelfTrack[], shelfId: string) {
    const currentIndex = shelf.findIndex(track => track.id === item.id);
    if (currentIndex === -1) return;

    setQueueStore('history', shelf.slice(0, currentIndex).reverse());
    setQueueStore('list', shelf.slice(currentIndex + 1));

    setPlayerStore('stream', {
      id: item.id,
      title: item.title,
      author: item.author || '',
      duration: item.duration,
      authorId: item.authorId || '',
      img: item.img
    });

    if ('albumId' in item && item.albumId) {
      setPlayerStore('stream', 'albumId', item.albumId);
    } else if (playerStore.stream.albumId) {
      setPlayerStore('stream', 'albumId', undefined);
    }

    setPlayerStore('context', {
      src: 'search',
      id: shelfId
    });

    const isPortrait = matchMedia('(orientation:portrait)').matches;
    if (isPortrait) {
      setNavStore('player', 'state', Boolean(config.watchMode));

      if (config.watchMode) {
        navStore.player.ref?.scrollIntoView();
      }
    }

    player(item.id);
  }

  onMount(async () => {
    setIsLoading(true);
    try {
      const data = hasEmbeddedBackend
        ? await getEmbeddedTrending()
        : await fetch(`${store.api}/trending`).then(res => {
          if (!res.ok) throw new Error('Could not load trending music');
          return res.json() as Promise<(YTItem | YTListItem)[]>;
        });
      setItems(data);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  });

  return (
    <div class="trending-view">
      <header class="trending-view__header">
        <p>{t('search_home_title')}</p>
        <span>{t('search_home_subtitle')}</span>
      </header>

      <Show when={!isLoading()} fallback={<i class="ri-loader-3-line loading-spinner"></i>}>
        <section class="trending-view__section">
          <div class="trending-view__section-header">
            <h2>{t('hub_recently_listened')}</h2>
            <span>{t('search_recent_priority_hint')}</span>
          </div>

          <Show when={recentItems().length} fallback={<p class="trending-view__empty">{t('hub_recently_listened_fallback')}</p>}>
            <div class="trending-view__rail">
              <For each={recentItems()}>
                {(item) => (
                  <button
                    class="trending-track-card"
                    type="button"
                    onClick={() => playFromShelf(item, recentItems(), 'recent-blend')}
                  >
                    <span class="trending-track-card__art">
                      <img src={generateImageUrl(item.img || item.id, 'mq')} alt="" />
                    </span>
                    <span class="trending-track-card__meta">
                      <strong>{item.title}</strong>
                      <small>{item.author?.replace(' - Topic', '')}</small>
                    </span>
                  </button>
                )}
              </For>
            </div>
          </Show>
        </section>

        <section class="trending-view__section">
          <div class="trending-view__section-header">
            <h2>{t('search_trending_section')}</h2>
            <span>{t('search_trending_hint')}</span>
          </div>

          <Show when={trendTracks().length} fallback={<p class="trending-view__empty">{t('search_trending_empty')}</p>}>
            <div class="trending-view__rail">
              <For each={trendTracks()}>
                {(item) => (
                  <button
                    class="trending-track-card"
                    type="button"
                    onClick={() => playFromShelf(item, trendTracks(), 'trending')}
                  >
                    <span class="trending-track-card__art">
                      <img src={generateImageUrl(item.img || item.id, 'mq')} alt="" />
                    </span>
                    <span class="trending-track-card__meta">
                      <strong>{item.title}</strong>
                      <small>{item.author?.replace(' - Topic', '')}</small>
                    </span>
                  </button>
                )}
              </For>
            </div>
          </Show>
        </section>
      </Show>
    </div>
  );
}
