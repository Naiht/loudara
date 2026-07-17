# Environment Variables

Only public client configuration should use the `VITE_*` prefix.

## Public Client Variables

- `VITE_APP_NAME`: display name for the app.
- `VITE_STREAM_API_BASE`: public API base used by the web stream provider. Defaults to `/api`.
- `VITE_ENABLE_STREAM_DEBUG`: optional development flag for stream diagnostics.

## Private Variables

Never expose private keys through `VITE_*`.

Do not create variables such as:

- `VITE_RAPIDAPI_KEY`
- `VITE_SECRET`
- `VITE_PRIVATE_TOKEN`

Provider secrets belong only on the server side or in a future Tauri backend layer.

### YouTube session

The internal stream resolver supports these optional server-only values:

- `YOUTUBE_COOKIE`: an authenticated YouTube cookie string. It can be used by itself.
- `YOUTUBE_VISITOR_DATA`: the visitor data associated with the backend session.
- `YOUTUBE_PO_TOKEN`: a session-bound Proof-of-Origin token. When configured, it must match `YOUTUBE_VISITOR_DATA`.

For local Vite development, place them in `.env.local` and restart `pnpm dev`. Vite passes only these selected values to the local backend adapter; they are not defined in the frontend bundle.

For Cloudflare, configure them as encrypted Worker secrets instead of adding them to `wrangler.toml`:

```sh
pnpm dlx wrangler secret put YOUTUBE_COOKIE
pnpm dlx wrangler secret put YOUTUBE_VISITOR_DATA
pnpm dlx wrangler secret put YOUTUBE_PO_TOKEN
```

`YOUTUBE_PO_TOKEN` without `YOUTUBE_VISITOR_DATA` is rejected as an invalid configuration. Tokens and cookies can expire or be revoked by YouTube, so they must be replaceable without rebuilding the frontend.
