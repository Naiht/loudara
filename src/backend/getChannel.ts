import { YTNodes } from 'youtubei.js';
import { getClient, getThumbnail, formatDuration, getThumbnailId, normalizeThumbnailUrl } from './utils.js';

function getRawItems(source: any): any[] {
  if (!source) return [];
  if (source.videos && source.videos.length > 0) return source.videos;
  if (source.page?.contents_memo) {
    const memo = source.page.contents_memo;
    const videos = memo.get('Video') || [];
    if (videos.length > 0) return Array.from(videos);

    const gridVideos = memo.get('GridVideo') || [];
    if (gridVideos.length > 0) return Array.from(gridVideos);

    const richItems = memo.get('RichItem') || [];
    if (richItems.length > 0) return Array.from(richItems);

    return Array.from(memo.get('LockupView') || []);
  }
  return [];
}

function asText(value: any): string {
  return value?.toString?.() || value?.text || '';
}

export default async function(id: string, page = 1) {
  const yt = await getClient();
  const channel = await yt.getChannel(id);
  const metadata = channel.metadata;

  let videoTab;
  try {
    videoTab = await channel.getTabByURL('videos');
  } catch (e) {
    videoTab = await channel.getVideos();
  }

  for (let index = 1; index < page; index++) {
    if (!videoTab?.has_continuation) {
      return {
        id,
        name: metadata.title?.toString() || '',
        img: '/' + getThumbnailId(getThumbnail(metadata.avatar || [])),
        items: [],
        hasContinuation: false,
        type: 'channel' as const
      };
    }

    videoTab = await videoTab.getContinuation();
  }

  const name = metadata.title?.toString() || '';
  const img = '/' + getThumbnailId(getThumbnail(metadata.avatar || []));
  const rawItems = getRawItems(videoTab);

  const items = rawItems.map((rawItem) => {
    const item = rawItem.type === 'RichItem' ? rawItem.content : rawItem;

    if (item?.is && item.is(YTNodes.Video)) {
      const video = item.as(YTNodes.Video);
      const views = video.short_view_count?.toString() || video.view_count?.toString();
      const published = video.published?.toString()?.replace('Streamed ', '');
      const subtext = (views || '') + (published ? ' • ' + published : '');
      return {
        id: video.id,
        title: video.title?.toString() || '',
        author: name,
        authorId: id,
        duration: formatDuration(video.duration?.text?.toString()),
        img: normalizeThumbnailUrl(getThumbnail(video.thumbnails || [])),
        subtext,
        type: 'video' as const
      };
    }

    if (item?.type === 'LockupView') {
      const lockup = item;
      const metadataParts = lockup.metadata?.metadata?.metadata_rows?.[0]?.metadata_parts || [];
      const views = metadataParts[0]?.text?.text || '';
      const published = metadataParts[1]?.text?.text?.replace('Streamed ', '') || '';
      const subtext = (views || '') + (published ? ' • ' + published : '');
      
      let duration = '';
      const overlays = lockup.content_image?.overlays || [];
      for (const overlay of overlays) {
        if (overlay.type === 'ThumbnailBottomOverlayView') {
          duration = overlay.badges?.[0]?.text || '';
          break;
        }
      }
      
      return {
        id: lockup.content_id,
        title: lockup.metadata?.title?.text || '',
        author: name,
        authorId: id,
        duration: formatDuration(duration),
        img: normalizeThumbnailUrl(getThumbnail(lockup.content_image?.primary_thumbnail?.image || [])),
        subtext,
        type: 'video' as const
      };
    }

    // Some channels expose regular uploads as GridVideo instead of Video.
    // Their fields are compatible enough to retain them without a music-only API.
    const videoId = item?.id || item?.video_id || item?.videoId;
    const title = asText(item?.title);
    if (videoId && title) {
      const views = asText(item.short_view_count || item.view_count || item.view_count_text);
      const published = asText(item.published || item.published_time_text).replace('Streamed ', '');
      const thumbnail = getThumbnail(item.thumbnails || item.thumbnail?.contents || []);
      const duration = asText(item.duration?.text || item.duration || item.length_text);

      return {
        id: videoId,
        title,
        author: item.author?.name || name,
        authorId: item.author?.id || id,
        duration: formatDuration(duration),
        img: normalizeThumbnailUrl(thumbnail),
        subtext: (views || '') + (published ? ` • ${published}` : ''),
        type: 'video' as const
      };
    }

    return null;
  }).filter((item): item is NonNullable<typeof item> => item !== null);

  return {
    id,
    name,
    img,
    items,
    hasContinuation: Boolean(videoTab?.has_continuation),
    type: 'channel' as const
  };
}
