import { createStore } from "solid-js/store";
import { setNavStore, updateParam, setStore, store, navStore } from "@stores";
import { getLibraryAlbums, drawer } from "@utils";
import { getNativeListData, isNativeApp } from "@platform/native";

const initialState = () => ({
  isLoading: false,
  isLoadingMore: false,
  isSubscribed: false,
  isSortable: false,
  isReversed: false,
  isShared: false,
  list: [] as YTItem[],
  length: 0,
  reservedCollections: ['history', 'favorites', 'liked', 'listenLater', 'channels', 'playlists'],
  name: '',
  url: '',
  type: 'collection' as 'channels' | 'playlists' | 'collection' | 'album',
  id: '',
  page: 1,
  author: '',
  img: '',
  syncSource: null as ImportedPlaylistSource | null,
  hasContinuation: false,
  topTracks: [] as YTItem[],
  artistAlbums: [] as YTAlbumItem[],
  observer: { disconnect() { } } as IntersectionObserver
});

export const [listStore, setListStore] = createStore(initialState());

function extractViewScore(subtext = '') {
  const match = subtext.match(/(\d+(?:[.,]\d+)?)\s*([KMB])?\s*(?:views|reproducciones)/i);
  if (!match) return 0;

  const value = Number.parseFloat(match[1].replace(',', '.'));
  if (!Number.isFinite(value)) return 0;

  const suffix = (match[2] || '').toUpperCase();
  const multiplier = suffix === 'B' ? 1_000_000_000 : suffix === 'M' ? 1_000_000 : suffix === 'K' ? 1_000 : 1;
  return value * multiplier;
}

function rankTopTracks(items: YTItem[]) {
  return [...items]
    .sort((a, b) => extractViewScore(b.subtext) - extractViewScore(a.subtext))
    .slice(0, 10);
}

function mergeUniqueItems(current: YTItem[], next: YTItem[]) {
  const seen = new Set(current.map((item) => item.id));
  return [
    ...current,
    ...next.filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    })
  ];
}

export async function getList(
  id: string,
  type: 'playlist' | 'channel' | 'album' | 'artist',
  all?: boolean
) {

  setListStore('hasContinuation', false);

  setListStore('isLoading', true);
  setNavStore('active', 'list');

  if (!all) updateParam(type, id);

  // Special case for saved albums
  if (!all && type === 'playlist' && id.startsWith('OLAK5uy')) {
    const libraryAlbums = getLibraryAlbums();
    const savedAlbum = libraryAlbums.find(a => a.id === id);
    if (savedAlbum) {
      setListStore({
        img: savedAlbum.img,
        id: id,
        url: id,
        type: 'playlists',
        name: savedAlbum.name,
        author: savedAlbum.author,
        list: []
      });
      // Continue to fetch from API to get fresh tracks
    }
  }

  try {
    const fetchListData = async (requestType: 'playlist' | 'channel' | 'album' | 'artist', page = 1) => {
      if (isNativeApp) {
        return getNativeListData(requestType, id, { all, page }) as Promise<YTListItem>;
      }

      const pageQuery = requestType === 'channel' && page > 1 ? `&page=${page}` : '';
      const res = await fetch(`${store.api}/${requestType}?id=${id}${all ? '&all=true' : ''}${pageQuery}`);
      if (!res.ok) throw new Error(`Failed to fetch ${requestType}`);
      return res.json() as Promise<YTListItem>;
    };

    let data = await fetchListData(type);

    if (data.type === 'artist') {
      const artist = data as YTArtistItem;
      const contextId = 'Artist - ' + artist.name;
      setListStore({
        name: contextId,
        id: id,
        type: 'channels',
        url: id,
        img: artist.img,
        page: 1,
        topTracks: rankTopTracks((artist.items || []) as YTItem[]),
        list: (artist.items || []).map(v => ({
          ...v,
          author: v.author.endsWith(' - Topic') ? v.author : `${v.author} - Topic`,
          context: { src: 'channels' as const, id: contextId }
        }) as YTItem),
        hasContinuation: false,
        artistAlbums: artist.albums
      });
    } else {
      const listData = data as (YTPlaylistItem | YTChannelItem | YTAlbumItem);
      const isChannel = data.type === 'channel';
      const listType = isChannel ? 'channels' : (data.type === 'album' ? 'album' : 'playlists');
      let displayName = listData.name;
      let topTracks: YTItem[] = [];
      let artistAlbums: YTAlbumItem[] = [];

      if (type === 'channel') {
        try {
          const artistData = await fetchListData('artist');
          if (artistData.type === 'artist') {
            topTracks = rankTopTracks((artistData.items || []) as YTItem[]);
            artistAlbums = artistData.albums || [];

            if (displayName.trim().endsWith(' - Topic')) {
              displayName = artistData.name || displayName.replace(/\s*-\s*Topic$/, '');
            }
          }
        } catch {
          if (displayName.trim().endsWith(' - Topic')) {
            displayName = displayName.replace(/\s*-\s*Topic$/, '');
          }
        }
      }

      setListStore({
        name: displayName,
        img: listData.img,
        id: id,
        author: 'author' in listData ? (listData as YTPlaylistItem | YTAlbumItem).author || '' : listData.name,
        type: listType,
        url: id,
        page: 1,
        hasContinuation: 'hasContinuation' in listData ? Boolean(listData.hasContinuation) : false,
        topTracks,
        artistAlbums,
        list: (listData.items || []).map(v => ({
          ...v,
          author: (data.type === 'album' && !v.author.endsWith(' - Topic')) ? `${v.author} - Topic` : v.author,
          img: data.type === 'album' ? (v.img || listData.img) : v.img,
          context: { src: listType as Context, id: displayName }
        }) as YTItem)
      });
    }
  } catch (e) {
    setStore('snackbar', e instanceof Error ? e.message : 'Unknown error');
    resetList();
  }

  setListStore('isLoading', false);
}

export function resetList() {
  if (navStore.active === 'list') {
    setNavStore('active', drawer.lastMainFeature as 'search' | 'library');
  }
  listStore.observer.disconnect();

  updateParam('collection');
  updateParam('playlist');
  updateParam('channel');
  updateParam('artist');
  updateParam('album');
  setListStore(initialState());
}

export function loadAll() {
  const { id, type } = listStore;
  if (type === 'playlists') {
    getList(id, 'playlist', true);
  }
}

export async function loadMoreList() {
  if (listStore.type !== 'channels' || !listStore.hasContinuation || listStore.isLoading || listStore.isLoadingMore) return;

  const nextPage = listStore.page + 1;
  setListStore('isLoadingMore', true);

  try {
    const data = isNativeApp
      ? await getNativeListData('channel', listStore.id, { page: nextPage }) as YTChannelItem
      : await fetch(`${store.api}/channel?id=${listStore.id}&page=${nextPage}`)
        .then(res => {
          if (!res.ok) throw new Error('Failed to fetch channel');
          return res.json() as Promise<YTChannelItem>;
        });

    setListStore('page', nextPage);
    setListStore('hasContinuation', Boolean(data.hasContinuation));
    setListStore('list', current => mergeUniqueItems(current as YTItem[], (data.items || []) as YTItem[]).map((item) => ({
      ...item,
      context: { src: 'channels' as const, id: listStore.name || listStore.id }
    })));
  } catch (e) {
    setStore('snackbar', e instanceof Error ? e.message : 'Unknown error');
    setListStore('hasContinuation', false);
  } finally {
    setListStore('isLoadingMore', false);
  }
}
