# Environment Variables

Only public client configuration should use the `VITE_*` prefix.

## Public Client Variables

- `VITE_APP_NAME`: display name for the app.
- `VITE_STREAM_API_BASE`: public API base used by the web stream provider. Defaults to `/api`.
- `VITE_ENABLE_STREAM_DEBUG`: optional development flag for stream diagnostics.
- `VITE_INVIDIOUS_INSTANCES`: comma-separated Invidious instances for development fallback only.

`VITE_INVIDIOUS_INSTANCES` is not the recommended production architecture. Production web builds should prefer a backend route such as `/api/stream/:videoId` so providers can be hidden, normalized and rate-limited server-side.

## Private Variables

Never expose private keys through `VITE_*`.

Do not create variables such as:

- `VITE_RAPIDAPI_KEY`
- `VITE_SECRET`
- `VITE_PRIVATE_TOKEN`

Provider secrets belong only on the server side or in a future Tauri backend layer.
