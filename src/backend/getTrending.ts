import { YTNodes } from 'youtubei.js';
import { getClient, getThumbnail, getThumbnailId, streamMapper } from './utils.js';

function mapExploreItem(item: any): YTItem | YTListItem | null {
  if (!item?.is?.(YTNodes.MusicTwoRowItem)) return null;

  const musicItem = item.as(YTNodes.MusicTwoRowItem);
  const title = musicItem.title?.toString() || '';
  const img = '/' + getThumbnailId(getThumbnail(musicItem.thumbnail || []));
  const subtitle = musicItem.subtitle?.toString?.() || '';
  const id = musicItem.id || '';

  if (!id || !title) return null;

  if (musicItem.item_type === 'song' || musicItem.item_type === 'video' || id.length === 11) {
    const artist = musicItem.artists?.[0]?.name || musicItem.author?.name || subtitle.split(' • ')[0] || 'Unknown';
    const authorId = musicItem.artists?.[0]?.channel_id || musicItem.author?.channel_id || '';

    return {
      id,
      title,
      author: artist.endsWith(' - Topic') ? artist : `${artist} - Topic`,
      authorId,
      duration: '00:00',
      img,
      subtext: subtitle,
      type: 'song'
    };
  }

  if (musicItem.item_type === 'artist') {
    return {
      id,
      name: title,
      img,
      subscribers: musicItem.subscribers || subtitle,
      type: 'artist'
    };
  }

  if (musicItem.item_type === 'album') {
    return {
      id,
      name: title,
      img,
      author: musicItem.artists?.[0]?.name || subtitle,
      year: musicItem.year || '',
      type: 'album'
    };
  }

  if (musicItem.item_type === 'playlist') {
    return {
      id,
      name: title,
      img,
      videoCount: musicItem.item_count || subtitle,
      type: 'playlist'
    };
  }

  return null;
}

export default async function() {
  const yt = await getClient();

  try {
    const explore = await yt.music.getExplore();
    const items = explore.sections
      .flatMap((section) => section.contents || [])
      .map(mapExploreItem)
      .filter((item): item is YTItem | YTListItem => Boolean(item));

    const seen = new Set<string>();
    const unique = items.filter((item) => {
      const id = item.id;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });

    if (unique.length) return unique.slice(0, 24);
  } catch (error) {
    console.error('Explore trending failed:', error);
  }

  const fallback = await yt.music.search('trending music', { type: 'song' });
  return (fallback.songs?.contents || [])
    .map(streamMapper)
    .filter((item): item is YTItem => Boolean(item))
    .slice(0, 24);
}
