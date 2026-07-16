# Architecture Proposal

Date: 2026-07-15 America/Managua (2026-07-16 UTC)

This proposal describes the target architecture for Loudara before moving files. It intentionally avoids a migration-by-folder exercise. The existing app should keep working while boundaries are introduced gradually.

## Goals

- Keep SolidJS, TypeScript, CSS and Vite.
- Preserve the currently useful features: search, library, queue, player, PWA and metadata fetching.
- Make player logic independent from visual components.
- Make stream resolution replaceable.
- Keep web as the first working target.
- Prepare the same frontend to run inside Tauri without importing Tauri APIs from UI components.
- Avoid a broad rewrite.

## Proposed Shape

```text
src/
├── app/
│   ├── App.tsx
│   ├── bootstrap.ts
│   ├── providers/
│   └── routes/
├── core/
│   ├── audio/
│   ├── player/
│   ├── queue/
│   ├── library/
│   ├── playlists/
│   ├── search/
│   ├── streaming/
│   └── contracts/
├── features/
│   ├── home/
│   ├── search/
│   ├── library/
│   ├── playlists/
│   ├── settings/
│   └── player/
├── layouts/
│   ├── AppShell/
│   ├── Sidebar/
│   ├── Header/
│   └── PlayerBar/
├── ui/
│   ├── components/
│   ├── primitives/
│   ├── feedback/
│   └── icons/
├── platform/
│   ├── contracts/
│   ├── web/
│   ├── tauri/
│   └── index.ts
├── styles/
│   ├── tokens.css
│   ├── reset.css
│   ├── global.css
│   └── utilities.css
├── assets/
│   ├── branding/
│   ├── icons/
│   └── images/
└── main.tsx
```

## Adaptation To The Current Repo

The current project already has some useful organization:

- `src/features` exists and should not be moved all at once.
- `src/lib/stores` centralizes state but currently mixes domain and UI concerns.
- `src/lib/modules` contains use cases and side effects.
- `src/lib/platform` has started with stream-provider logic.
- `src/components` contains reusable UI-ish components but also domain-aware components.

Because of that, the migration should be incremental:

1. Introduce new folders only for new boundaries.
2. Move code when a file is already being changed for behavior.
3. Keep compatibility exports during transition.
4. Avoid renaming all feature folders in one pass.

## Current To Target Map

| Current location | Target location | Notes |
| --- | --- | --- |
| `src/index.tsx` | `src/main.tsx`, `src/app/bootstrap.ts`, `src/app/App.tsx` | Split bootstrap, app shell and render entry. |
| `src/components/NavBar.tsx` | `src/layouts/Sidebar` or `src/layouts/PlayerBar` | Depends on final desktop layout. |
| `src/components/StreamItem.tsx` | `src/ui/components/TrackRow` plus feature wrapper | It currently mixes UI, queue, navigation and player side effects. |
| `src/components/MediaPartials/*` | `src/features/player` and `src/ui/components` | Buttons can become UI; player-specific behavior stays in feature/core. |
| `src/features/Search` | `src/features/search` | Keep as feature; move store/API logic to `core/search`. |
| `src/features/Library` | `src/features/library` | Keep UI in feature; move local storage and sync to `core/library`. |
| `src/features/Player` | `src/features/player` | UI only; playback commands move to `core/player`. |
| `src/features/Queue` | `src/features/player` or `src/features/queue` | Store logic moves to `core/queue`. |
| `src/lib/stores/player.ts` | `src/core/player`, `src/core/audio` | Split state, actions and audio element events. |
| `src/lib/stores/queue.ts` | `src/core/queue` | Domain logic should not import player UI state directly. |
| `src/lib/stores/search.ts` | `src/core/search` | Keep UI state separate from API client. |
| `src/lib/utils/player.ts` | `src/core/player/usePlayer.ts` | Main playback use case. |
| `src/lib/modules/getStreamData.ts` | `src/core/streaming/getStreamData.ts` | Keep cache orchestration, provider selection. |
| `src/lib/platform/streamProvider.ts` | `src/platform/web/streamProvider.ts` and `src/core/streaming/contracts` | Separate platform implementation from stream contract. |
| `netlify/edge-functions/stream.ts` | `server/netlify/stream` or keep in `netlify` | Keep deployment convention but document contract. |
| `src/styles/*` | `src/styles/*` | Add tokens/reset/utilities; migrate screen CSS over time. |
| `public/*` | `src/assets` and `public` | Runtime public files can remain public; source assets move to `src/assets`. |

## Core Boundaries

### `core/audio`

Owns the audio element or audio adapter. It should expose methods like:

- `load(url)`
- `play()`
- `pause()`
- `seek(seconds)`
- `setVolume(value)`
- `on(event, callback)`

The UI should not access `HTMLAudioElement` directly.

### `core/player`

Owns playback use cases:

- play track by id
- play next/previous
- update metadata
- react to stream errors
- synchronize with queue

It can depend on `core/audio`, `core/streaming`, `core/queue` and platform contracts.

### `core/streaming`

Owns stream resolution:

- accepts a track/video id
- returns normalized stream data
- handles cache
- exposes typed errors
- does not know about Solid components

### `platform`

Provides environment-specific implementations:

- Web fetch provider
- Future Tauri command provider
- Storage provider if localStorage becomes insufficient
- Clipboard/share implementations

UI and core should depend on platform contracts, not concrete Tauri APIs.

## Stream Provider Decision

The immediate stream contract should remain compatible with current `adaptiveFormats` to reduce risk. The first replacement should normalize providers into a type like:

```ts
type StreamResolution = {
  id: string;
  title: string;
  author: string;
  durationSeconds: number;
  audio: AudioStream[];
  video: AudioStream[];
  captions: CaptionTrack[];
  recommended: RecommendedTrack[];
  source: 'invidious' | 'netlify' | 'tauri' | 'saavn';
};
```

`Invidious` can stay as an adapter input, not as the central domain model.

## Migration Order

1. Stabilize web playback fallback in dev.
2. Introduce `core/audio` adapter while keeping `playerStore.audio` compatibility.
3. Move `player(id)` to `core/player`.
4. Move queue domain helpers to `core/queue`.
5. Move stream provider contracts to `core/streaming/contracts`.
6. Add `platform/web` and a placeholder `platform/tauri` implementation.
7. Migrate UI components from `src/components` to `src/ui` as screens are restyled.
8. Split `src/index.tsx` into `src/main.tsx`, `src/app/bootstrap.ts` and `src/app/App.tsx`.

## What Not To Do Yet

- Do not move all files in one commit.
- Do not rewrite the player UI before playback is stable.
- Do not add Tauri APIs inside visual components.
- Do not introduce secrets through `VITE_*`.
- Do not remove old components until their flow is covered by the new structure.
