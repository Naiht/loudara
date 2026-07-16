import { YTNodes } from 'youtubei.js';
import { getClient, streamMapper, listMapper, parsePublished } from './utils.js';

type Feature = 'hd' | 'subtitles' | 'creative_commons' | '3d' | 'live' | 'purchased' | '4k' | '360' | 'location' | 'hdr' | 'vr180';

type SearchFilters = {
  upload_date?: 'all' | 'today' | 'week' | 'month' | 'year';
  type?: 'all' | 'video' | 'shorts' | 'channel' | 'playlist' | 'movie';
  duration?: 'all' | 'over_twenty_mins' | 'under_three_mins' | 'three_to_twenty_mins';
  prioritize?: 'relevance' | 'popularity';
  features?: Feature[];
};

type SearchResultPage = {
  items: (YTItem | YTListItem)[];
  hasMore: boolean;
};

function mapSearchItems(nodes: Iterable<any>, f?: string): (YTItem | YTListItem)[] {
  return Array.from(nodes)
    .map((node) => (f === 'song' ? streamMapper(node) : streamMapper(node) || listMapper(node)))
    .filter((item): item is YTItem | YTListItem => item !== null);
}

export default async function(params: { q: string, f?: string, page?: number }): Promise<SearchResultPage> {
  const { q, f } = params;
  const page = Number.isFinite(params.page) ? Math.max(1, params.page || 1) : 1;
  const yt = await getClient();

  if (f === 'song' || f === 'artist' || f === 'album') {
    const results = await yt.music.search(q, { type: f });

    if (page > 1) {
      if (!results.has_continuation) {
        return { items: [], hasMore: false };
      }

      let continuation = await results.getContinuation();

      for (let index = 2; index < page; index++) {
        if (!continuation.has_continuation) {
          return { items: [], hasMore: false };
        }

        continuation = await continuation.getContinuation();
      }

      return {
        items: mapSearchItems(continuation.contents?.contents || [], f),
        hasMore: continuation.has_continuation
      };
    }

    const shelf = results.songs || results.artists || results.albums;

    return {
      items: mapSearchItems(shelf?.contents || [], f),
      hasMore: results.has_continuation
    };
  }

  const filters: SearchFilters = {};

  if (f === 'relevance' || f === 'upload_date' || f === 'view_count') {
    filters.type = 'video';
    if (f === 'relevance') filters.prioritize = 'relevance';
    else if (f === 'upload_date') filters.upload_date = 'all';
    else if (f === 'view_count') filters.prioritize = 'popularity';
  } else if (f === 'playlist' || f === 'channel')
    filters.type = f;

  let results = await yt.search(q, filters);

  for (let index = 1; index < page; index++) {
    if (!results.has_continuation) {
      return { items: [], hasMore: false };
    }

    results = await results.getContinuation();
  }

  const contents = (filters.type === 'video' ? results.videos : results.results) || [];

  if (f === 'upload_date') {
    contents.sort((a, b) => {
      const timeA = a.is(YTNodes.Video) ? parsePublished(a.as(YTNodes.Video).published?.toString() || '') : 0;
      const timeB = b.is(YTNodes.Video) ? parsePublished(b.as(YTNodes.Video).published?.toString() || '') : 0;
      return timeB - timeA;
    });
  }

  return {
    items: mapSearchItems(contents, f),
    hasMore: results.has_continuation
  };
}
