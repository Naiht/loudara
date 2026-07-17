# Loudara

![Loudara](img/md.png)

Loudara is a modern music player built with SolidJS, TypeScript, CSS and Vite.
The current goal is to keep the web app fully functional while preparing the same frontend to run inside Tauri.

## Status

Loudara is evolving progressively from an existing music-player codebase. The current work focuses on:

- A web-first player experience.
- A decoupled streaming provider layer.
- A reusable app shell and UI system.
- A frontend architecture that can be shared by web and desktop builds.

## Features

- Music search.
- Queue management.
- Local library, history and favorites.
- Player controls with a floating player bar.
- Synced lyrics support through LRCLIB.
- PWA support.
- Backend-assisted stream resolution for development and production deployments.

## Development

Install dependencies with the package manager used by the repository:

```sh
pnpm install
```

Start the development server:

```sh
pnpm dev
```

Run verification:

```sh
pnpm exec tsc --noEmit
pnpm build
```

Desktop development with Tauri:

```sh
pnpm desktop:dev
pnpm desktop:build
```

Tauri requires a Rust toolchain installed locally before the desktop commands can run.

## Environment

Copy `.env.example` when you need local overrides. Public `VITE_*` variables must not contain private keys or secrets.

## Architecture Notes

See:

- `docs/current-state.md`
- `docs/architecture.md`
- `docs/streaming.md`
- `docs/environment.md`

## License

This project is distributed under the GPL-3.0 license included in `LICENSE`.
