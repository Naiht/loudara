import { getClient, streamMapper } from './utils.js';
import { getRuntimeFetch } from '@platform/tauri/fetch';

interface LastFmTrack {
  name: string;
  artist: {
    name: string;
  };
}

interface LastFmSimilarTracksResponse {
  similartracks?: {
    track?: LastFmTrack[];
  };
  error?: number;
  message?: string;
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildQueryCandidates(title: string, artist: string) {
  const cleanArtist = artist.replace(/\s*-\s*topic$/i, '').trim();
  return [
    `${title} ${cleanArtist}`,
    `${cleanArtist} ${title}`,
    cleanArtist,
    title
  ].filter(Boolean);
}

function extractArtistAliases(artist: string) {
  const normalized = normalizeText(artist.replace(/\s*-\s*topic$/i, ''));

  return normalized
    .split(/\s+(?:feat|ft|featuring|x|y|con|and)\s+|,|&/)
    .map(part => part.trim())
    .filter(part => part.length >= 2);
}

function countSharedWords(a: string, b: string) {
  const wordsA = new Set(a.split(' ').filter(word => word.length >= 3));
  const wordsB = new Set(b.split(' ').filter(word => word.length >= 3));
  let count = 0;

  for (const word of wordsA) {
    if (wordsB.has(word)) count += 1;
  }

  return count;
}

function scoreFallbackCandidate(
  item: YTItem,
  seedTitle: string,
  seedArtist: string,
  queryIndex: number
) {
  const normalizedTitle = normalizeText(item.title);
  const normalizedArtist = normalizeText(item.author.replace(/\s*-\s*topic$/i, ''));
  const normalizedSeedTitle = normalizeText(seedTitle);
  const aliases = extractArtistAliases(seedArtist);
  const primaryArtist = aliases[0] || normalizeText(seedArtist);

  let score = 0;

  if (normalizedArtist === primaryArtist) score += 120;
  else if (normalizedArtist.includes(primaryArtist)) score += 80;

  for (const alias of aliases) {
    if (!alias) continue;

    if (normalizedArtist === alias) score += 36;
    else if (normalizedArtist.includes(alias)) score += 24;

    if (normalizedTitle.includes(alias)) score += 12;
  }

  const sharedTitleWords = countSharedWords(normalizedTitle, normalizedSeedTitle);
  score += Math.min(sharedTitleWords * 8, 24);

  if (normalizedTitle === normalizedSeedTitle) score -= 80;

  score += Math.max(0, 18 - (queryIndex * 4));

  return score;
}

async function searchSongsByQuery(
  queries: string[],
  limit: number,
  seedTitle: string,
  seedArtist: string
) {
  const yt = await getClient();
  const candidates = new Map<string, YTItem & { _score: number }>();
  const normalizedSeedTitle = normalizeText(seedTitle);
  const normalizedSeedArtist = normalizeText(seedArtist);

  for (const [queryIndex, query] of queries.entries()) {
    if (candidates.size >= limit * 3) break;

    try {
      const res = await yt.music.search(query, { type: 'song' });
      const contents = res.songs?.contents || [];

      for (const song of contents) {
        const mapped = streamMapper(song);
        if (!mapped) continue;

        const normalizedTitle = normalizeText(mapped.title);
        const normalizedArtist = normalizeText(mapped.author.replace(/\s*-\s*topic$/i, ''));
        const isSameTrack = normalizedTitle === normalizedSeedTitle && normalizedArtist === normalizedSeedArtist;

        if (isSameTrack) continue;

        const score = scoreFallbackCandidate(mapped, seedTitle, seedArtist, queryIndex);
        const existing = candidates.get(mapped.id);

        if (!existing || score > existing._score) {
          candidates.set(mapped.id, {
            ...mapped,
            _score: score
          });
        }
      }
    } catch {
      continue;
    }
  }

  return [...candidates.values()]
    .sort((a, b) => b._score - a._score)
    .slice(0, limit)
    .map(({ _score, ...item }) => item);
}

export default async function(params: { title: string, artist: string, limit?: string }) {
  const { title, artist, limit = '5' } = params;
  const maxItems = Math.max(1, Number.parseInt(limit, 10) || 5);
  const apiKey = '0867bcb6f36c879398969db682a7b69b';
  const url = `https://ws.audioscrobbler.com/2.0/?method=track.getsimilar&artist=${encodeURIComponent(artist)}&track=${encodeURIComponent(title)}&api_key=${apiKey}&limit=${limit}&format=json`;
  let lastFmTracks: LastFmTrack[] = [];

  try {
    const response = await getRuntimeFetch()(url);
    const data = (await response.json()) as LastFmSimilarTracksResponse;

    if (!data.error) {
      lastFmTracks = data.similartracks?.track || [];
    } else if (!/track not found/i.test(data.message || '')) {
      throw new Error(data.message);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/track not found/i.test(message)) {
      throw error;
    }
  }

  const yt = await getClient();
  const seen = new Set<string>();

  const results = await Promise.all(
    lastFmTracks.slice(0, maxItems * 2).map((track) => {
      const query = `${track.name} ${track.artist.name}`;
      return yt.music.search(query, { type: 'song' })
        .then(res => {
          const song = res.songs?.contents?.[0];
          return song ? streamMapper(song) : null;
        })
        .catch(() => null);
    })
  );

  const mappedResults = results
    .filter((item): item is YTItem => item !== null)
    .filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });

  if (mappedResults.length < maxItems) {
    const fallbackResults = await searchSongsByQuery(
      buildQueryCandidates(title, artist),
      maxItems,
      title,
      artist
    );

    for (const item of fallbackResults) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      mappedResults.push(item);
      if (mappedResults.length >= maxItems) break;
    }
  }

  return mappedResults
    .slice(0, maxItems)
    .map(({ subtext, albumId, img, ...rest }) => rest);
}
