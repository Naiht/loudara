import { setStore, t, listStore, setListStore, navStore, setNavStore, updateParam, store } from '@stores';
import { config, drawer, setDrawer, parseDuration, playlistIdFromURL } from '@utils';

export const syncLibrary = (action: 'add' | 'remove' | 'schedule' | 'init', id?: string) => {
  if (config.dbsync)
    import('@modules/cloudSync')
      .then(m => {
        if (action === 'add' && id) m.addDirtyTrack(id);
        else if (action === 'remove' && id) m.removeDirtyTrack(id);
        else if (action === 'schedule') m.scheduleSync();
        else if (action === 'init') m.runSync(config.dbsync);
      });
};

const PLAYLIST_SOURCES_KEY = 'library_playlist_sources';


// New Library V2 utils

export const getMeta = (): Meta => {
  const meta = localStorage.getItem('library_meta');
  if (meta) {
    return JSON.parse(meta);
  }

  const newMeta: Meta = { version: 5, tracks: 0 };
  const now = Date.now();

  const tracks = getTracksMap();
  if (Object.keys(tracks).length > 0) {
    newMeta.tracks = now;
  }

  const collections = getCollectionsKeys();
  for (const key of collections) {
    const items = getCollection(key);
    if (items.length > 0) {
      newMeta[key] = now;
    } else {
      newMeta[key] = 0;
    }
  }

  const channels = getLists('channels');
  if (channels.length > 0) {
    newMeta.channels = now;
  }

  const playlists = getLists('playlists');
  if (playlists.length > 0) {
    newMeta.playlists = now;
  }

  const playlistSources = getImportedPlaylistSources();
  if (Object.keys(playlistSources).length > 0) {
    newMeta.playlist_sources = now;
  }

  const albums = getLibraryAlbums();
  if (Object.keys(albums).length > 0) {
    newMeta.albums = now;
  }

  return newMeta;
};


export const getCollectionsKeys = () => {
  const allKeys = Object
    .keys(localStorage)
    .filter(key => key.startsWith('library_'))
    .map(key => key.slice(8))
    .filter(key => !['channels', 'playlists', 'tracks', 'meta', 'albums', 'playlist_sources']
      .includes(key));

  const reservedOrder = ['history', 'favorites', 'liked', 'listenLater'];
  const meta = JSON.parse(localStorage.getItem('library_meta') || '{}');

  return [
    ...reservedOrder.filter(key => allKeys.includes(key)),
    ...allKeys.filter(key => !reservedOrder.includes(key)).sort((a, b) => (meta[a] || 0) - (meta[b] || 0))
  ];
};

export const getTracksMap = (): Collection =>
  JSON.parse(localStorage.getItem('library_tracks') || '{}');

export const getCollection = (name: string) => JSON.parse(localStorage.getItem('library_' + name) || '[]') as string[];

export const getLists = <T extends 'channels' | 'playlists'>(type: T): T extends 'channels' ? Channel[] : Playlist[] => JSON.parse(localStorage.getItem('library_' + type) || '[]');

export const getLibraryAlbums = (): LibraryAlbums => JSON.parse(localStorage.getItem('library_albums') || '[]');

export const getImportedPlaylistSources = (): ImportedPlaylistSources =>
  JSON.parse(localStorage.getItem(PLAYLIST_SOURCES_KEY) || '{}');

export function getImportedPlaylistSource(name: string): ImportedPlaylistSource | null {
  const sources = getImportedPlaylistSources();
  return sources[name] || null;
}

function saveImportedPlaylistSources(sources: ImportedPlaylistSources) {
  localStorage.setItem(PLAYLIST_SOURCES_KEY, JSON.stringify(sources));
  metaUpdater('playlist_sources');
}

export function saveImportedPlaylistSource(name: string, source: ImportedPlaylistSource) {
  const sources = getImportedPlaylistSources();
  sources[name] = source;
  saveImportedPlaylistSources(sources);
}

export function removeImportedPlaylistSource(name: string) {
  const sources = getImportedPlaylistSources();
  if (!sources[name]) return;

  delete sources[name];

  if (Object.keys(sources).length === 0) {
    localStorage.removeItem(PLAYLIST_SOURCES_KEY);
    metaUpdater('playlist_sources', true);
    return;
  }

  saveImportedPlaylistSources(sources);
}

export function renameImportedPlaylistSource(oldName: string, newName: string) {
  const sources = getImportedPlaylistSources();
  if (!sources[oldName]) return;

  sources[newName] = sources[oldName];
  delete sources[oldName];
  saveImportedPlaylistSources(sources);
}

export function isImportedPlaylist(name: string) {
  return Boolean(getImportedPlaylistSource(name));
}

export function createUniquePlaylistTitle(baseTitle: string) {
  const cleanTitle = baseTitle.trim() || t('library_youtube_playlist_fallback_name');
  const existing = new Set(getCollectionsKeys());

  if (!existing.has(cleanTitle)) return cleanTitle;

  let suffix = 2;
  let nextTitle = `${cleanTitle} (${suffix})`;
  while (existing.has(nextTitle)) {
    suffix += 1;
    nextTitle = `${cleanTitle} (${suffix})`;
  }

  return nextTitle;
}

async function fetchPlaylistSnapshot(playlistId: string) {
  const response = await fetch(`${store.api}/playlist?id=${encodeURIComponent(playlistId)}&all=true`);
  if (!response.ok) {
    throw new Error(t('library_youtube_playlist_fetch_error'));
  }

  const data = await response.json() as YTPlaylistItem;
  if (data.type !== 'playlist') {
    throw new Error(t('library_youtube_playlist_invalid_url'));
  }

  return data;
}

export async function importYoutubePlaylist(url: string) {
  const playlistId = playlistIdFromURL(url);
  if (!playlistId) {
    throw new Error(t('library_youtube_playlist_invalid_url'));
  }

  const playlist = await fetchPlaylistSnapshot(playlistId);
  const playlistTitle = createUniquePlaylistTitle(playlist.name || t('library_youtube_playlist_fallback_name'));
  const items = playlist.items || [];

  createCollection(playlistTitle);
  addToCollection(playlistTitle, items);
  saveImportedPlaylistSource(playlistTitle, {
    sourceId: playlistId,
    sourceUrl: url,
    sourceName: playlist.name || playlistTitle,
    author: playlist.author || '',
    img: playlist.img || '',
    lastSyncedAt: Date.now()
  });

  return {
    title: playlistTitle,
    addedCount: items.length
  };
}

export async function resyncImportedPlaylist(name: string) {
  const source = getImportedPlaylistSource(name);
  if (!source) {
    throw new Error(t('list_resync_unavailable'));
  }

  const playlist = await fetchPlaylistSnapshot(source.sourceId);
  const existingIds = new Set(getCollection(name));
  const newItems = (playlist.items || []).filter(item => !existingIds.has(item.id));

  if (newItems.length > 0) {
    addToCollection(name, newItems);
  }

  saveImportedPlaylistSource(name, {
    ...source,
    sourceName: playlist.name || source.sourceName,
    author: playlist.author || source.author || '',
    img: playlist.img || source.img || '',
    lastSyncedAt: Date.now()
  });

  return {
    addedCount: newItems.length
  };
}

export function getCollectionItems(collectionId: string): TrackItem[] {
  const collectionIds = getCollection(collectionId);
  const tracksMap = getTracksMap();
  return collectionIds.map((id: string) => ({
    ...tracksMap[id],
    context: { src: 'collection' as const, id: collectionId }
  })).filter(item => item.id) as TrackItem[];
}

export function saveTracksMap(tracks: Collection) {
  localStorage.setItem('library_tracks', JSON.stringify(tracks))
};

export function saveCollection(
  name: string,
  collection: string[]
) {
  localStorage.setItem('library_' + name, JSON.stringify(collection));
}

export function saveLists<T extends 'channels' | 'playlists'>(type: T, data: T extends 'channels' ? Channel[] : Playlist[]) {
  localStorage.setItem(`library_${type}`, JSON.stringify(data));
  metaUpdater(type);
  rehydrateStores();
};

export function saveLibraryAlbums(albums: LibraryAlbums) {
  localStorage.setItem('library_albums', JSON.stringify(albums));
}

export function saveAlbumToLibrary(albumId: string, albumData: Album) {
  const albums = getLibraryAlbums();
  if (!albums.find(a => a.id === albumId)) {
    albums.push(albumData);
    saveLibraryAlbums(albums);
  }
  metaUpdater('albums');
  rehydrateStores();
}

export function removeAlbumFromLibrary(albumId: string) {
  const albums = getLibraryAlbums();
  const newAlbums = albums.filter(a => a.id !== albumId);
  saveLibraryAlbums(newAlbums);
  metaUpdater('albums');
  rehydrateStores();
}


export function addToCollection(
  name: string,
  data: TrackItem[]
) {
  const collection = getCollection(name);
  const tracks = getTracksMap();
  const prepend = ['history', 'favorites', 'liked'].includes(name);
  const { libraryPlays } = drawer;

  for (const item of data) {
    if (!item?.id) continue;
    const { id } = item;
    const idx = collection.indexOf(id);

    if (idx !== -1)
      collection.splice(idx, 1);

    if (prepend)
      collection.unshift(id);
    else collection.push(id);

    if (id in tracks) {
      libraryPlays[id] = (libraryPlays[id] || 1) + 1;
      setDrawer('libraryPlays', libraryPlays);
    } else {
      tracks[id] = item;
    }

    if (config.dbsync) {
      tracks[id].modified = Date.now();
    }

    syncLibrary('add', id);
  }

  saveCollection(name, collection);
  saveTracksMap(tracks);
  metaUpdater(name);

  if (listStore.id === name)
    rehydrateStores();
}

export function removeFromCollection(
  name: string,
  ids: string[]
) {
  const collection = getCollection(name);
  const collections = getCollectionsKeys().filter(k => k !== name);;
  const tracks = getTracksMap();

  for (const id of ids) {
    const idx = collection.indexOf(id);
    if (idx !== -1)
      collection.splice(idx, 1);

    let isReferenced = false;
    for (const key of collections)
      if (getCollection(key).includes(id)) {
        isReferenced = true;
        break;
      }

    if (!isReferenced) {
      delete tracks[id];
      syncLibrary('remove', id);
    }
  }

  saveCollection(name, collection);
  saveTracksMap(tracks);
  metaUpdater(name);

  if (listStore.id === name)
    rehydrateStores();
}

export function deleteCollection(name: string) {
  const ids = getCollection(name);
  const collections = getCollectionsKeys().filter(k => k !== name);;
  const tracks = getTracksMap();

  for (const id of ids) {
    let isReferenced = false;
    for (const key of collections)
      if (getCollection(key).includes(id)) {
        isReferenced = true;
        break;
      }

    if (!isReferenced) {
      delete tracks[id];
      syncLibrary('remove', id);
    }
  }

  localStorage.removeItem('library_' + name);
  removeImportedPlaylistSource(name);
  saveTracksMap(tracks);
  metaUpdater(name, true);
  rehydrateStores();
}


export const metaUpdater = (key: string, remove?: boolean) => {
  const meta = getMeta();
  const timestamp = Date.now();

  if (remove)
    delete meta[key];
  else
    meta[key] = timestamp;

  localStorage.setItem('library_meta', JSON.stringify(meta));
  setStore('syncState', 'dirty');
  syncLibrary('schedule');
}



export function createCollection(title: string) {
  const exists = getCollectionsKeys().includes(title);
  if (exists) {
    setStore('snackbar', t('list_already_exists'));
    return;
  }

  metaUpdater(title);
  rehydrateStores();
}

export function renameCollection(oldName: string, newName: string) {
  if (oldName === newName) return;

  const collections = getCollectionsKeys();
  if (collections.includes(newName)) {
    setStore('snackbar', t('list_already_exists'));
    return;
  }

  const collectionItems = getCollection(oldName);
  saveCollection(newName, collectionItems);
  localStorage.removeItem('library_' + oldName);
  renameImportedPlaylistSource(oldName, newName);
  metaUpdater(oldName, true);
  metaUpdater(newName);
  rehydrateStores();
}

export function rehydrateStores() {
  if (listStore.type === 'collection' && listStore.id) {
    fetchCollection(listStore.id);
  }

  if (navStore.active === 'library') {
    setNavStore('active', '' as 'library');
    setTimeout(() => setNavStore('active', 'library'), 10);
  }
}

export async function fetchCollection(
  id: string | null,
  shared: boolean = false
) {
  if (!id) return;

  setNavStore('active', 'list');

  setListStore('isLoading', true);

  const display = shared ? 'Shared Playlist' : id;
  const { reservedCollections } = listStore;
  const isReserved = reservedCollections.includes(id);
  const syncSource = shared ? null : getImportedPlaylistSource(id);

  setListStore({
    name: decodeURIComponent(display),
    type: 'collection',
    isReversed: isReserved,
    isShared: shared,
    syncSource,
    author: syncSource?.author || '',
    img: syncSource?.img || ''
  });

  if (shared) {
    await getSharedCollection(id);
    updateParam('si', id);
  }
  else {
    getLocalCollection(id);
    updateParam('collection', id);
  }

  setListStore('isLoading', false);

  document.title = display + ' - Loudara';

}

function setObserver(callback: () => number) {
  const ref = document.querySelector(`.listContainer > :last-child`) as HTMLElement;
  if (!ref) return;
  const obs = new IntersectionObserver((entries, observer) =>
    entries.forEach(e => {
      if (e.isIntersecting) {
        observer.disconnect();
        const itemsLeft = callback();
        if (itemsLeft)
          setObserver(callback);

      }
    }));
  obs.observe(ref);
  setListStore('observer', obs);
}


function getLocalCollection(
  collection: string,
) {

  let ids = getCollection(decodeURI(collection));
  if (ids.length === 0) {
    setStore('snackbar', 'No items found');
    setListStore({ list: [], length: 0, name: collection });
    return;
  }

  const tracks = getTracksMap();
  const syncSource = getImportedPlaylistSource(decodeURI(collection));

  let sortedIds = ids;
  const isReserved = listStore.reservedCollections.includes(decodeURI(collection));
  if (!isReserved && (config.sortBy !== 'modified' || config.sortOrder === 'asc')) {
    const items = ids.map(id => tracks[id]);
    const sortedItems = sortCollection(items, config.sortBy, config.sortOrder);
    sortedIds = sortedItems.map(item => item.id);
  }

  const usePagination = sortedIds.length > 10;

  setListStore({
    name: collection,
    length: sortedIds.length,
    syncSource,
    author: syncSource?.author || '',
    img: syncSource?.img || ''
  });

  if (usePagination) {
    let loadedCount = 20;
    setListStore('list', sortedIds.slice(0, loadedCount).map(id => ({
      ...tracks[id],
      type: 'video' as const,
      context: { src: 'collection' as const, id: collection }
    })));

    const observerCallback = () => {
      if (loadedCount >= sortedIds.length) return 0;

      const nextBatch = sortedIds.slice(loadedCount, loadedCount + 20);
      loadedCount += 20;

      setListStore('list', (l) => [...l, ...nextBatch.map(id => ({
        ...tracks[id],
        type: 'video' as const,
        context: { src: 'collection' as const, id: collection }
      }))]);
      return sortedIds.length - loadedCount;
    };

    setTimeout(() => setObserver(observerCallback), 100);

  } else {
    setListStore('list', sortedIds.map(id => ({
      ...tracks[id],
      type: 'video' as const,
      context: { src: 'collection' as const, id: collection }
    })));
  }

  setListStore('id', decodeURI(collection));
}

async function getSharedCollection(
  id: string
) {

  setListStore('isLoading', true);
  const data = await fetch(`${location.origin}/ss/${id}`)
    .then(res => res.json())
    .catch(() => '');

  if (data) {
    if (Array.isArray(data)) {
      setListStore('list', data);
    } else if (typeof data === 'object' && data.tracks) {
      setListStore({
        name: data.collection || 'Shared Playlist',
        list: data.tracks
      });
    }
  }
  else
    setStore('snackbar', `Playlist does not exist`);

  setListStore('isLoading', false);
}

export type SortBy = 'modified' | 'name' | 'artist' | 'duration';

export function sortCollection(list: TrackItem[], sortBy: SortBy, sortOrder: 'asc' | 'desc'): TrackItem[] {

  const listToSort = [...list];

  if (sortBy === 'modified') {
    // If modified and desc, we just return the list (it's already in the order we want for manual/time)
    // Actually, if it's 'asc', we reverse it. 
    // Manual order is usually newest first for reserved, but for non-reserved it's oldest first.
    return sortOrder === 'asc' ? listToSort.reverse() : listToSort;
  }


  listToSort.sort((a, b) => {
    let result = 0;
    switch (sortBy) {
      case 'name':
        result = a.title.localeCompare(b.title);
        break;
      case 'artist':
        result = (a.author || '').localeCompare(b.author || '');
        break;
      case 'duration':
        result = parseDuration(a.duration) - parseDuration(b.duration);
        break;
    }
    return sortOrder === 'asc' ? result : -result;
  });

  return listToSort;
}

export function cleanseLibraryData() {

  // 1. Get all tracks from library_tracks
  const rawTracks = JSON.parse(localStorage.getItem('library_tracks') || '{}') as Collection;

  // 2. Identify all valid track IDs by checking all collections
  const collections = getCollectionsKeys();
  const referencedTrackIds = new Set<string>();

  collections.forEach(c => {
    const ids = getCollection(c);
    ids.forEach(tId => referencedTrackIds.add(tId));
  });

  // 3. Cleanse library_tracks: Only keep tracks that are referenced and strip extra properties
  const cleanedTracks: Collection = {};
  let tracksCleaned = false;

  for (const id in rawTracks) {
    if (id && referencedTrackIds.has(id)) {
      const track = rawTracks[id];
      const cleanedTrack: TrackItem = {
        id: track.id,
        title: track.title,
        duration: track.duration,
        author: track.author,
        authorId: track.authorId || '',
      };

      if (config.dbsync && track.modified) {
        cleanedTrack.modified = track.modified;
      }

      cleanedTracks[id] = cleanedTrack;

      if (!tracksCleaned && Object.keys(track).length !== Object.keys(cleanedTrack).length) {
        tracksCleaned = true;
      }
    } else {
      tracksCleaned = true;
      syncLibrary('remove', id);
    }
  }

  if (tracksCleaned)
    saveTracksMap(cleanedTracks);

  // 4. Cleanse all other collections from empty or missing IDs
  for (const key of collections) {
    const collection = JSON.parse(localStorage.getItem('library_' + key) || '[]') as string[];
    const validCollection = collection.filter(id => id && rawTracks[id]);
    if (validCollection.length < collection.length) {
      console.log(`Found and removed ${collection.length - validCollection.length} invalid entries from '${key}' collection.`);
      saveCollection(key, validCollection);
    }
  }
}

export function hasLegacyLibrary(): boolean {
  return Boolean(localStorage.getItem('library'));
}

export function ensureReservedCollections(collections: Record<string, unknown>) {
  if (getCollectionsKeys().length !== 0) return;

  for (const collection in collections) {
    localStorage.setItem('library_' + collection, '[]');
  }
}

export function importLibraryData(importedData: Record<string, unknown>) {
  if (importedData.meta) {
    for (const key in importedData) {
      if (Object.prototype.hasOwnProperty.call(importedData, key)) {
        localStorage.setItem('library_' + key, JSON.stringify(importedData[key]));
      }
    }
    return 'v2';
  }

  localStorage.setItem('library', JSON.stringify(importedData));
  return 'v1';
}

export function exportLibraryData(): Record<string, unknown> {
  const exportedData: Record<string, unknown> = {};

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('library_')) {
      exportedData[key.slice(8)] = JSON.parse(localStorage.getItem(key)!);
    }
  }

  return exportedData;
}

export function clearLibraryData() {
  const keysToRemove: string[] = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('library')) {
      keysToRemove.push(key);
    }
  }

  for (const key of keysToRemove) {
    localStorage.removeItem(key);
  }
}
