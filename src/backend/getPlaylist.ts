import { YTNodes, type Helpers } from 'youtubei.js';
import { getClient, getThumbnail, formatDuration, getVideoId, normalizeThumbnailUrl } from './utils.js';

export default async function(id: string, all?: boolean): Promise<YTPlaylistItem> {
  const yt = await getClient();
  let playlist: any;
  let items: Helpers.YTNode[] = [];
  let name = 'Unknown Playlist';
  let author = 'Unknown';
  let img = '';

  async function loadMusicPlaylist() {
    try {
      const musicPlaylist = await yt.music.getPlaylist(id);
      if (!musicPlaylist.contents?.length) return false;

      playlist = musicPlaylist;
      items = musicPlaylist.contents;
      const header = musicPlaylist.header;
      if (header?.is(YTNodes.MusicDetailHeader)) {
        const detailHeader = header.as(YTNodes.MusicDetailHeader);
        name = detailHeader.title.text || name;
        author = detailHeader.author?.name || author;
        img = normalizeThumbnailUrl(getThumbnail(detailHeader.thumbnails || []));
      } else if (header?.is(YTNodes.MusicResponsiveHeader)) {
        const responsiveHeader = header.as(YTNodes.MusicResponsiveHeader);
        name = responsiveHeader.title.text || name;
        img = normalizeThumbnailUrl(getThumbnail((responsiveHeader as any).thumbnail?.contents || []));
      }

      return true;
    } catch (error) {
      console.error('Error fetching music playlist fallback:', error);
      return false;
    }
  }

  try {
    playlist = await yt.getPlaylist(id);
    items = playlist.items || playlist.contents || [];
    name = playlist.info?.title || name;
    author = playlist.info?.author?.name || author;
    img = normalizeThumbnailUrl(getThumbnail(playlist.info?.thumbnails || []));
  } catch {
    playlist = undefined;
  }

  if (!playlist) await loadMusicPlaylist();

  if (!playlist) throw new Error('Could not load playlist');

  const allItems: YTItem[] = [];

  const mapItems = (items: Helpers.YTNode[]) => {
    items.forEach((item) => {
      if (item.is(YTNodes.PlaylistVideo)) {
        const v = item.as(YTNodes.PlaylistVideo);
        const subtext = v.video_info?.toString() || '';
        allItems.push({
          id: v.id,
          title: v.title.toString(),
          author: v.author.name,
          authorId: v.author.id,
          duration: formatDuration(v.duration.text),
          subtext,
          type: 'video' as const
        });
      } else if (item.is(YTNodes.MusicResponsiveListItem)) {
        const song = item.as(YTNodes.MusicResponsiveListItem);
        const videoId = getVideoId(song);
        if (videoId) {
          const itemAuthor = song.authors?.[0]?.name || song.author?.name || author || 'Unknown';
          const itemAuthorId = song.authors?.[0]?.channel_id || song.author?.channel_id || '';
          allItems.push({
            id: videoId,
            title: song.title?.toString() || 'Unknown',
            author: itemAuthor,
            authorId: itemAuthorId,
            duration: formatDuration(song.duration?.text),
            subtext: song.album?.name || name || '',
            type: 'song' as const
          });
        }
      }
    });
  };

  mapItems(items);

  // Mixes and radio playlists expose LockupView entries to the standard client.
  // Use the Music representation when that shape does not yield playable tracks.
  if (allItems.length === 0 && await loadMusicPlaylist()) {
    allItems.length = 0;
    mapItems(items);
  }

  if (all) {
    let continuationCount = 0;
    while (playlist.has_continuation && continuationCount < 100) {
      playlist = await playlist.getContinuation();
      mapItems(playlist.items || playlist.contents || []);
      continuationCount += 1;
    }
  }

  return {
    id: id,
    name,
    author,
    img,
    type: 'playlist' as const,
    items: allItems,
    hasContinuation: playlist.has_continuation
  };
}
