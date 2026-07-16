# Streaming Strategy

Date: 2026-07-15 America/Managua (2026-07-16 UTC)

## Frontend Contract

The player should consume normalized `StreamData` from `src/core/streaming` and should not know about Invidious response shapes or legacy `/s/:id` internals.

The normalized response is:

```json
{
  "videoId": "abc123",
  "title": "Title",
  "author": "Artist",
  "duration": 240,
  "streams": [
    {
      "url": "https://...",
      "mimeType": "audio/webm; codecs=\"opus\"",
      "bitrate": 128000,
      "quality": "medium"
    }
  ]
}
```

The current implementation also keeps optional `videoStreams`, `captions` and `recommended` fields so existing watch mode, lyrics and discovery flows can keep working during migration.

## Web Route

The web frontend now attempts:

```text
/api/stream/:videoId
```

This route is served in local development by the existing Vite middleware through `src/backend/worker.ts` and `src/backend/getStream.ts`.

Goals of this route:

- hide provider details from UI code;
- normalize provider responses;
- validate video ids;
- return controlled JSON errors;
- apply provider timeouts;
- allow future rate limiting;
- avoid exposing private keys in the browser.

## Provider Order

The web provider currently tries:

1. `ApiStreamProvider`, which calls `/api/stream/:videoId`;
2. `InvidiousStreamProvider`, a temporary client-side compatibility fallback.

The Invidious fallback is development/transition support, not the final recommended production shape.

## Error Model

The streaming core differentiates:

- timeout;
- HTTP error;
- invalid response;
- no audio streams;
- total provider failure.

When all providers fail, `StreamUnavailableError` carries all attempts so the UI can show a controlled error and developers can inspect useful diagnostics.

## Local Development

`pnpm dev` now supports:

- `GET /api/stream/:videoId`: returns normalized stream JSON or a controlled error.
- `GET /s/:videoId`: redirects to `/?s=:videoId` instead of returning a dead 404 route.

If all public providers fail locally, `/api/stream/:videoId` returns `502` with an `attempts` array. That is expected until a more reliable local/server provider is configured.

## Secrets

No private provider key belongs in the frontend.

Do not add:

- `VITE_RAPIDAPI_KEY`
- `VITE_SECRET`
- `VITE_PRIVATE_TOKEN`

Server-only providers, Netlify Functions, Cloudflare Workers, Vercel Functions, a Node backend, or a future Tauri backend can own secrets later through provider-specific implementations.
