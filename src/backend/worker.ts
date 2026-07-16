import getAlbum from './getAlbum.js';
import getArtist from './getArtist.js';
import getChannel from './getChannel.js';
import getGallery from './getGallery.js';
import getPlaylist from './getPlaylist.js';
import getSearch from './getSearch.js';
import getSearchSuggestions from './getSearchSuggestions.js';
import getSimilar from './getSimilar.js';
import getSubFeed from './getSubFeed.js';
import getTrending from './getTrending.js';
import { getStream } from './getStream.js';
import { getYoutubeMedia } from './getYoutubeStream.js';
import type { Request, ExecutionContext } from '@cloudflare/workers-types';

const ALLOWED_ORIGINS = [
  'https://loudara.app',
  'https://www.loudara.app',
  'http://localhost:3000',
  'http://localhost:5173'
];

export interface Env {
  ASSETS?: {
    fetch: (input: Request | string | URL, init?: RequestInit) => Promise<Response>;
  };
}

export default {
  async fetch(
    request: Request,
    env: Env,
    _ctx: ExecutionContext
  ): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin');
    const allowedOrigin = (origin && ALLOWED_ORIGINS.includes(origin)) ? origin : 'https://loudara.app';
    const pathname = url.pathname;

    const corsHeaders = {
      'Access-Control-Allow-Origin': allowedOrigin,
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
      'Vary': 'Origin'
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders
      });
    }

    if (pathname.startsWith('/s/')) {
      const sharedId = pathname.split('/')[2];
      if (sharedId) {
        return Response.redirect(`${url.origin}/?s=${sharedId}`, 302);
      }
    }

    const path = url.pathname.replace(/^\/api\//, '').replace(/^\//, '');
    const searchParams = url.searchParams;

    try {
      let data: unknown;

      switch (path) {
        case 'album': {
          const id = searchParams.get('id');
          if (!id) throw new Error('Missing id parameter');
          data = await getAlbum(id);
          break;
        }
        case 'artist': {
          const id = searchParams.get('id');
          if (!id) throw new Error('Missing id parameter');
          data = await getArtist(id);
          break;
        }
        case 'channel': {
          const id = searchParams.get('id');
          const page = Number(searchParams.get('page') || '1');
          if (!id) throw new Error('Missing id parameter');
          data = await getChannel(id, Number.isFinite(page) ? Math.max(1, page) : 1);
          break;
        }
        case 'gallery': {
          const id = searchParams.get('id');
          if (!id) throw new Error('Missing id parameter');
          data = await getGallery(id.split(','));
          break;
        }
        case 'playlist': {
          const id = searchParams.get('id');
          const all = searchParams.get('all') === 'true';
          if (!id) throw new Error('Missing id parameter');
          data = await getPlaylist(id, all);
          break;
        }
        case 'search': {
          const q = searchParams.get('q');
          const f = searchParams.get('f');
          const page = Number(searchParams.get('page') || '1');
          if (!q) throw new Error('Missing q parameter');
          data = await getSearch({ q, f: f || undefined, page });
          break;
        }
        case 'search-suggestions': {
          const q = searchParams.get('q');
          const music = searchParams.get('music') === 'true';
          if (!q) throw new Error('Missing q parameter');
          data = await getSearchSuggestions({ q, music });
          break;
        }
        case 'similar': {
          const title = searchParams.get('title');
          const artist = searchParams.get('artist');
          const limit = searchParams.get('limit');
          if (!title || !artist) throw new Error('Missing title or artist parameter');
          data = await getSimilar({ title, artist, limit: limit || undefined });
          break;
        }
        case 'subfeed': {
          const id = searchParams.get('id');
          if (!id) throw new Error('Missing id parameter');
          data = await getSubFeed(id.split(','));
          break;
        }
        case 'trending': {
          data = await getTrending();
          break;
        }
        default: {
          if (path.startsWith('media/')) {
            const [, id, itagValue] = path.match(/^media\/([a-zA-Z0-9_-]{11})\/(\d+)$/) || [];
            const itag = Number.parseInt(itagValue || '', 10);

            if (!id || !Number.isFinite(itag)) {
              return new Response(JSON.stringify({ error: 'Invalid media request' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
              });
            }

            const response = await getYoutubeMedia(id, itag, request);
            Object.entries(corsHeaders).forEach(([key, value]) => response.headers.set(key, value));
            return response;
          }

          if (path.startsWith('stream/')) {
            const id = path.slice('stream/'.length);
            const result = await getStream(id);
            if (!result.data) {
              return new Response(JSON.stringify({
                error: 'stream_unavailable',
                attempts: result.attempts
              }), {
                status: result.attempts[0]?.provider === 'validation' ? 400 : 502,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
              });
            }

            return new Response(JSON.stringify(result.data), {
              status: 200,
              headers: {
                ...corsHeaders,
                'Content-Type': 'application/json',
                'Cache-Control': 's-maxage=1800, stale-while-revalidate=300'
              }
            });
          }

          if (env.ASSETS) {
            return env.ASSETS.fetch(request);
          }

          return new Response(JSON.stringify({ error: 'Not Found' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }

      return new Response(JSON.stringify(data), {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Cache-Control': 's-maxage=86400, stale-while-revalidate=3600'
        }
      });
    } catch (err) {
      console.error(err);
      const message = err instanceof Error ? err.message : 'Unknown error';
      return new Response(JSON.stringify({ error: message }), {
        status: message.startsWith('Missing') ? 400 : 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }
};
