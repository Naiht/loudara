import type { JSXElement } from 'solid-js';
import type en from './locales/en.json';

declare global {

  type TranslationKeys = keyof typeof en;
  type SyncState = 'synced' | 'syncing' | 'dirty' | 'error';
  type Features = 'search' | 'library' | 'player' | 'list' | 'settings' | 'queue';
  type Context = '' | 'search' | 'playlists' | 'collection' | 'channels' | 'queue' | 'album';

  interface YTImage {
    url: string;
    width: number;
    height: number;
  }
  // For Library Usage
  interface TrackItem {
    id: string;
    title: string;
    duration: string;
    author: string;
    authorId: string;
    img?: string;
    modified?: number;
    context?: {
      src: Context;
      id: string;
    };
  }
  // For Network Usage
  interface YTItem extends TrackItem {
    img?: string;
    albumId?: string;
    subtext?: string;
    type: 'video' | 'song';
  }

  interface ListItem {
    id: string;
    name: string;
    img: string;
  }

  interface YTChannelItem extends ListItem {
    type: 'channel';
    subscribers?: string;
    videoCount?: string;
    description?: string;
    items?: YTItem[];
    hasContinuation?: boolean;
  }

  interface YTPlaylistItem extends ListItem {
    type: 'playlist';
    author?: string;
    videoCount?: string;
    items?: YTItem[];
    hasContinuation?: boolean;
  }

  interface YTArtistItem extends ListItem {
    type: 'artist';
    subscribers?: string;
    items?: YTItem[];
    albums?: YTAlbumItem[];
  }

  interface YTAlbumItem extends ListItem {
    type: 'album';
    author: string;
    year?: string;
    playlistId?: string;
    items?: YTItem[];
  }

  type YTListItem = YTChannelItem | YTPlaylistItem | YTArtistItem | YTAlbumItem;

  type Collection = { [index: string]: TrackItem };

  type Channel = ListItem;
  type Playlist = ListItem & {
    author: string
  };
  type Album = Playlist;
  interface ImportedPlaylistSource {
    sourceId: string;
    sourceUrl: string;
    sourceName: string;
    author?: string;
    img?: string;
    lastSyncedAt: number;
  }
  type ImportedPlaylistSources = Record<string, ImportedPlaylistSource>;

  type LibraryAlbums = Album[];

  interface Meta {
    version: number,
    tracks: number,
    [index: string]: number
  }

}

export { };
