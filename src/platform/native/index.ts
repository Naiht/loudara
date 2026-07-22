import { Capacitor } from '@capacitor/core';
import type { StreamData } from '@core/streaming';
import { requestNativePlaybackPermissions } from './playback';
import { ApiStreamProvider } from '../web/streaming/ApiStreamProvider';

type SearchResultPage = {
  items: (YTItem | YTListItem)[];
  hasMore: boolean;
};

export const isNativeApp = Capacitor.isNativePlatform();

type NetworkConnectionInfo = {
  type?: string;
  effectiveType?: string;
  saveData?: boolean;
};

function getConnectionInfo(): NetworkConnectionInfo | undefined {
  return (navigator as Navigator & {
    connection?: NetworkConnectionInfo;
    mozConnection?: NetworkConnectionInfo;
    webkitConnection?: NetworkConnectionInfo;
  }).connection
    || (navigator as Navigator & { mozConnection?: NetworkConnectionInfo }).mozConnection
    || (navigator as Navigator & { webkitConnection?: NetworkConnectionInfo }).webkitConnection;
}

function wait(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function isThrottleLikeMessage(message: string) {
  return /429|403|too many|rate limit|unusual traffic|temporar|bot|forbidden|confirm|saturated|timeout/i.test(message);
}

function getRemoteApiBase() {
  const value = import.meta.env.VITE_LOUDARA_API_URL?.trim();
  if (!value || !/^https?:\/\//i.test(value)) return undefined;
  return value;
}

async function getRemoteNativeStreamData(videoId: string, baseUrl: string) {
  const provider = new ApiStreamProvider({
    baseUrl,
    timeoutMs: isConstrainedMobileConnection() ? 18_000 : 12_000
  });

  return provider.getStreamData(videoId);
}

export function isConstrainedMobileConnection() {
  if (!isNativeApp) return false;

  const connection = getConnectionInfo();
  if (!connection) return false;

  return connection.type === 'cellular'
    || connection.saveData === true
    || ['slow-2g', '2g', '3g'].includes(connection.effectiveType || '');
}

export async function requestRequiredPermissions() {
  if (!isNativeApp) return;

  if (Capacitor.getPlatform() === 'android') {
    try {
      await requestNativePlaybackPermissions();
    } catch (error) {
      console.warn('Could not request Android playback permissions', error);
    }
  }
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
  const remoteApiBase = getRemoteApiBase();
  const preferRemote = Boolean(remoteApiBase && isConstrainedMobileConnection());
  let lastError: unknown;

  if (preferRemote && remoteApiBase) {
    try {
      return await getRemoteNativeStreamData(videoId, remoteApiBase);
    } catch (error) {
      lastError = error;
      console.warn('Remote native stream fallback failed, trying direct YouTube session', error);
    }
  }

  const {
    getYoutubeStream,
    isYoutubeBotChallenge,
    resetYoutubeSession
  } = await import('../../backend/getYoutubeStream.js');

  const maxDirectAttempts = isConstrainedMobileConnection() ? 3 : 2;

  for (let attempt = 1; attempt <= maxDirectAttempts; attempt += 1) {
    try {
      return await getYoutubeStream(videoId, { proxyMedia: false });
    } catch (error) {
      lastError = error;

      const message = error instanceof Error ? error.message : String(error);
      const shouldRetry = isYoutubeBotChallenge(error) || isThrottleLikeMessage(message);

      if (!shouldRetry || attempt === maxDirectAttempts) break;

      resetYoutubeSession();
      await wait(Math.min(1200 + (attempt * 900), 4_000));
    }
  }

  if (!preferRemote && remoteApiBase) {
    try {
      return await getRemoteNativeStreamData(videoId, remoteApiBase);
    } catch (error) {
      lastError = lastError || error;
    }
  }

  throw (lastError instanceof Error ? lastError : new Error('Failed to fetch native stream data'));
}
