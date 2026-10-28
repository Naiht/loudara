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

The web provider currently uses:

1. `ApiStreamProvider`, which calls `/api/stream/:videoId`.

Client-side Invidious fallback has been disabled. Provider resolution belongs behind the internal API route so the UI does not hang on public instances or expose provider details.

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

When YouTube returns `Sign in to confirm you're not a bot`, the backend reports the attempt as `youtubei:bot-challenge` and stops the outer retry loop. Repeating an attestation failure from the same session and IP does not make it transient and can increase unnecessary traffic.

The resolver can use a private authenticated or attested session through `YOUTUBE_COOKIE`, `YOUTUBE_VISITOR_DATA`, and `YOUTUBE_PO_TOKEN`. With a cookie or Proof-of-Origin token configured, the `WEB` client is attempted first, followed by the existing mobile/TV fallbacks. See `docs/environment.md` for configuration.

## YouTube Bot Challenge Notes

`glassy-music-nankill` avoids many bot challenges because it is primarily an Electron wrapper around the real `music.youtube.com` web app. Playback happens inside YouTube Music's own Chromium session, so YouTube receives normal browser cookies, headers, service-worker state, and player traffic.

Its downloader path still uses `youtubei.js`, but it strengthens that session by:

- reading cookies from Electron's `music.youtube.com` session;
- using Electron `net.fetch`, which behaves closer to Chromium networking than a serverless `fetch`;
- generating a session-bound Proof-of-Origin token from `visitorData` with `bgutils-js`;
- using `youtubei.js` 17.2.x.

Loudara resolves direct audio URLs from an API route/worker, so anonymous requests look much more like automation. The supported mitigation is to provide the same attestation material: cookie, matching `visitorData`, and matching `poToken`. The Settings screen can store these for the current browser tab and send them as internal headers to `/api/stream/:videoId`.

Android and desktop can resolve streams directly on the device without a deployed Worker. Android optionally prioritizes a configured `VITE_LOUDARA_API_URL`, falling back to the device resolver if the API is unreachable. Desktop always uses the device resolver. Android also refreshes a signed audio URL once after a recoverable HTTP/network failure instead of leaving the track stuck.

Automatic PO token generation is deliberately not bundled into the Cloudflare Worker path yet: the known approach evaluates YouTube challenge JavaScript and needs a DOM-like runtime, which is fragile or unavailable in some serverless environments. If we add it later, keep it behind a runtime-specific adapter rather than mixing it into stream selection.

## Secrets

No private provider key belongs in the frontend.

Do not add:

- `VITE_RAPIDAPI_KEY`
- `VITE_SECRET`
- `VITE_PRIVATE_TOKEN`

Server-only providers, Netlify Functions, Cloudflare Workers, Vercel Functions, a Node backend, or a future Tauri backend can own secrets later through provider-specific implementations.
