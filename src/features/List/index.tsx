import { createSignal, For, onMount, Show, onCleanup } from 'solid-js';
import './List.css';
import { addToQueue, listStore, resetList, setNavStore, t, setQueueStore, setStore } from '@stores';
import { fetchCollection, removeFromCollection, setConfig, config, generateImageUrl, setDrawer, getCollectionItems, resyncImportedPlaylist } from '@utils';
import Dropdown from './Dropdown';
import Results from './Results';
import CollectionSelector from '@components/ActionsMenu/CollectionSelector';
import ListItem from '@components/ListItem';
import StreamItem from '@components/StreamItem';

type SortBy = 'modified' | 'name' | 'artist' | 'duration';

export default function() {
  let listSection!: HTMLElement;

  const [markMode, setMarkMode] = createSignal(false);
  const [isSearching, setIsSearching] = createSignal(false);
  const [markList, setMarkList] = createSignal<string[]>([]);
  const [showStreamsNumber, setShowStreamsNumber] = createSignal(false);
  const [localSortBy, setLocalSortBy] = createSignal<SortBy>(config.sortBy);
  const [localSortOrder, setLocalSortOrder] = createSignal<'asc' | 'desc'>(config.sortOrder);
  const [showSortable, setShowSortable] = createSignal(false);
  const [searchQuery, setSearchQuery] = createSignal('');
  const [isResyncing, setIsResyncing] = createSignal(false);

  const isArtistView = () => listStore.name.startsWith('Artist');
  const isChannelView = () => listStore.type === 'channels';
  const profileName = () => listStore.name.replace(/^Artist - /, '');
  const profileBadge = () => t(isArtistView() ? 'list_profile_artist' : 'list_profile_channel');
  const profileMeta = () => {
    const details = [t('list_streams_count', listStore.list.length.toString())];

    if (!isArtistView() && listStore.author && listStore.author !== listStore.name) {
      details.push(listStore.author);
    }

    return details.join(' | ');
  };

  const filteredItems = () => {
    const query = searchQuery().normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
    if (!query) return listStore.list;

    const source = listStore.type === 'collection' && !listStore.isShared
      ? getCollectionItems(listStore.id)
      : listStore.list;

    return source.filter(item => {
      const normalize = (str: string) => str.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
      return normalize(item.title).includes(query) || normalize(item.author).includes(query);
    });
  };

  onMount(() => {
    setNavStore('list', 'ref', listSection);
    listSection.scrollIntoView();
  });

  onCleanup(() => {
    if (listStore.id) {
      setDrawer('lastList', {
        id: listStore.id,
        type: listStore.type === 'playlists' ? 'playlist' : (listStore.type === 'channels' ? 'channel' : listStore.type),
        shared: listStore.isShared
      });
    }
    resetList();
  });

  const MarkBar = () => (
    <div class="markBar">
      <i
        aria-label={t('list_mark_all')}
        class={'ri-checkbox-multiple-fill'}
        onclick={() => {
          if (markList().length === listStore.list.length) setMarkList([]);
          else setMarkList(listStore.list.map(v => v.id));
        }}
      ></i>
      <Show when={markList().length}>
        <Show when={listStore.type === 'collection'}>
          <i
            aria-label={t('list_remove_marked')}
            class="ri-indeterminate-circle-line"
            onclick={() => {
              removeFromCollection(listStore.name, markList());
            }}
          ></i>
        </Show>
        <i
          aria-label={t('list_enqueue_marked')}
          class="ri-list-check-2"
          onclick={() => {
            const listToEnqueue = markList().map(id => listStore.list.find(v => v.id === id)).filter(Boolean) as TrackItem[];

            if (listToEnqueue.length) {
              setQueueStore('history', []);
              addToQueue(listToEnqueue);
              setNavStore('queue', 'state', false);
              setNavStore('queue', 'state', true);
            }
          }}
        ></i>

        <i aria-label={t('collection_selector_add_to')}>
          <CollectionSelector data={markList().map(id => listStore.list.find(v => v.id === id)).filter(Boolean) as TrackItem[]} />
        </i>
      </Show>
    </div>
  );

  return (
    <section ref={listSection} id="listSection">
      <header class="sticky-bar">
        <Show when={!markMode()} fallback={<MarkBar />}>
          <Show
            when={!isSearching()}
            fallback={
              <input
                autofocus
                type="text"
                class="listSearchInput"
                placeholder="Search within List"
                oninput={(e) => {
                  setSearchQuery((e.target as HTMLInputElement).value.toLowerCase());
                }}
                onkeydown={(e) => {
                  if (e.key === 'Escape') {
                    setIsSearching(false);
                    setSearchQuery('');
                  }
                }}
              />
            }
          >
            <p
              onclick={() => setShowStreamsNumber(!showStreamsNumber())}
              id="listTitle"
            >{
              showStreamsNumber()
                ? t('list_streams_count', listStore.length.toString())
                : listStore.name
            }</p>
          </Show>
        </Show>

        <div class="right-group">
          <Show when={listStore.type === 'collection' && listStore.syncSource && !markMode()}>
            <i
              aria-label={t(isResyncing() ? 'list_resyncing_playlist' : 'list_resync_playlist')}
              class={isResyncing() ? 'ri-loader-3-line loading-spinner' : 'ri-refresh-line'}
              onclick={async () => {
                if (isResyncing()) return;

                setIsResyncing(true);
                try {
                  const { addedCount } = await resyncImportedPlaylist(listStore.id);
                  setStore('snackbar', addedCount > 0 ? t('list_resync_success', addedCount.toString()) : t('list_resync_no_changes'));
                } catch (error) {
                  setStore('snackbar', error instanceof Error ? error.message : t('library_youtube_playlist_fetch_error'));
                } finally {
                  setIsResyncing(false);
                }
              }}
            ></i>
          </Show>
          <i
            aria-label={t('list_mark_mode')}
            aria-checked={markMode()}
            class={markMode() ? 'ri-checkbox-fill' : 'ri-checkbox-line'}
            onclick={() => {
              setMarkMode(!markMode());
              if (!markMode()) setMarkList([]);
            }}
          ></i>
          <i
            aria-label={t('nav_search')}
            class="ri-search-2-line"
            onclick={() => {
              setIsSearching(!isSearching());
              if (!isSearching()) setSearchQuery('');
            }}
          ></i>
        </div>
        <Dropdown />
      </header>

      <Show when={listStore.type === 'collection' && listStore.id && !listStore.reservedCollections.includes(listStore.id)}>
        <span class="sortBar">
          <label for="sortMenu">{t('list_sort_order')} :</label>
          <select id="sortMenu" onchange={(e) => {
            const newSortBy = e.target.value as SortBy;
            setLocalSortBy(newSortBy);
            setConfig('sortBy', newSortBy);
            fetchCollection(listStore.id);
          }} value={localSortBy()}>
            <option value="modified">{t('list_sort_modified')}</option>
            <option value="name">{t('list_sort_name')}</option>
            <option value="artist">{t('list_sort_artist')}</option>
            <option value="duration">{t('list_sort_duration')}</option>
          </select>
          <Show when={localSortBy() === 'modified' && !listStore.reservedCollections.includes(listStore.id)}>
            <i
              class="ri-draggable"
              classList={{ active: showSortable() }}
              onclick={() => setShowSortable(!showSortable())}
            ></i>
          </Show>
          <i
            class={localSortOrder() === 'asc' ? 'ri-sort-asc' : 'ri-sort-desc'}
            onclick={() => {
              const newOrder = config.sortOrder === 'asc' ? 'desc' : 'asc';
              setConfig('sortOrder', newOrder);
              setLocalSortOrder(newOrder);
              fetchCollection(listStore.id);
            }}
          ></i>
        </span>
      </Show>

      <Show when={isChannelView() && listStore.img}>
        <section class="list-hero">
          <Show when={config.loadImage}>
            <div
              class="list-hero__backdrop"
              style={{ 'background-image': `url(${generateImageUrl(listStore.img, '720')})` }}
              aria-hidden="true"
            ></div>
          </Show>
          <div class="list-hero__content">
            <Show when={config.loadImage}>
              <img
                class="list-hero__media"
                src={generateImageUrl(listStore.img, '')}
                alt={profileName()}
              />
            </Show>
            <div class="list-hero__copy">
              <span class="list-hero__badge">{profileBadge()}</span>
              <p>{profileName()}</p>
              <span class="list-hero__meta">{profileMeta()}</span>
            </div>
          </div>
        </section>
      </Show>

      <Show when={isChannelView() && listStore.topTracks.length}>
        <section class="list-section">
          <header class="list-section__header">
            <span class="list-section__eyebrow">{t('list_top_ten')}</span>
            <h2>{t('list_most_listened')}</h2>
          </header>
          <div class="list-top-tracks">
            <For each={listStore.topTracks}>
              {(track) => (
                <StreamItem
                  {...track}
                  context={{ src: 'channels', id: `top-tracks:${listStore.id}` }}
                />
              )}
            </For>
          </div>
        </section>
      </Show>

      <Show when={(isChannelView() || isArtistView()) && listStore.artistAlbums?.length}>
        <section class="list-section">
          <header class="list-section__header">
            <span class="list-section__eyebrow">{t('list_album_section')}</span>
            <h2>{t('library_albums')}</h2>
          </header>
          <div class="list-carousel">
            <For each={listStore.artistAlbums}>
              {(album) => (
                <ListItem
                  name={album.name}
                  year={album.year}
                  img={album.img}
                  author={album.author}
                  id={album.id}
                  type='album'
                />
              )}
            </For>
          </div>
        </section>
      </Show>

      <Show when={config.loadImage && listStore.type === 'album' && listStore.img}>
        <img src={generateImageUrl(listStore.img, '720')} alt={listStore.name} class="list-thumbnail" />
      </Show>

      <Show when={isChannelView()}>
        <section class="list-section">
          <header class="list-section__header">
            <span class="list-section__eyebrow">{t('list_video_section_eyebrow')}</span>
            <h2>{t('list_video_section')}</h2>
          </header>
        </section>
      </Show>

      <Results
        items={filteredItems()}
        draggable={showSortable() && localSortBy() === 'modified' && !listStore.reservedCollections.includes(listStore.id)}
        mark={{
          mode: markMode,
          set: (id: string) => {
            setMarkList((prev) =>
              prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
            );
          },
          get: (id: string) => markList().includes(id)
        }}
      />
    </section>
  );
}
