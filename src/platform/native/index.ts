import { Capacitor } from '@capacitor/core';
import type { StreamData } from '@core/streaming';

type SearchResultPage = {
  items: (YTItem | YTListItem)[];
  hasMore: boolean;
};

export const isNativeApp = Capacitor.isNativePlatform();

export async function requestRequiredPermissions() {
  if (!isNativeApp) return;
}

export async function getNativeSearchSuggestions(q: string, music: boolean) {
  const { default: getSearchSuggestions } = await import('../../backend/getSearchSuggestions.js');
  return getSearchSuggestions({ q, music }) as Promise<string[]>;
}

export async function getNativeSearchResults(params: {
  q: string;
  f?: string;
  page?: number;
}): Promise<SearchResultPage> {
  const { default: getSearch } = await import('../../backend/getSearch.js');
  return getSearch(params);
}

export async function getNativeListData(
  type: 'playlist' | 'channel' | 'album' | 'artist',
  id: string,
  options: { all?: boolean; page?: number } = {}
): Promise<YTPlaylistItem | YTChannelItem | YTAlbumItem | YTArtistItem> {
  switch (type) {
    case 'playlist': {
      const { default: getPlaylist } = await import('../../backend/getPlaylist.js');
      return getPlaylist(id, options.all);
    }
    case 'channel': {
      const { default: getChannel } = await import('../../backend/getChannel.js');
      return getChannel(id, options.page);
    }
    case 'album': {
      const { default: getAlbum } = await import('../../backend/getAlbum.js');
      return getAlbum(id);
    }
    case 'artist': {
      const { default: getArtist } = await import('../../backend/getArtist.js');
      return getArtist(id);
    }
  }
}

export async function getNativeTrending() {
  const { default: getTrending } = await import('../../backend/getTrending.js');
  return getTrending() as Promise<(YTItem | YTListItem)[]>;
}

export async function getNativeSubfeed(ids: string[]) {
  const { default: getSubFeed } = await import('../../backend/getSubFeed.js');
  return getSubFeed(ids) as Promise<YTItem[]>;
}

export async function getNativeGallery(ids: string[]) {
  const { default: getGallery } = await import('../../backend/getGallery.js');
  return getGallery(ids) as Promise<{
    userArtists: Channel[];
    relatedArtists: Channel[];
    relatedPlaylists: Playlist[];
  }>;
}

export async function getNativeSimilar(params: {
  title: string;
  artist: string;
  limit?: string;
}) {
  const { default: getSimilar } = await import('../../backend/getSimilar.js');
  return getSimilar(params) as Promise<TrackItem[]>;
}

export async function getNativeStreamData(videoId: string): Promise<StreamData> {
  const { getYoutubeStream } = await import('../../backend/getYoutubeStream.js');
  return getYoutubeStream(videoId, { proxyMedia: false });
}
