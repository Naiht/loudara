# Loudara

![Loudara](img/md.png)

Loudara is a music player for desktop and Android, built with SolidJS, TypeScript, CSS and Vite. The same interface is also available as a web app.

## Downloads

Release files for version 1.0.0 are being prepared. Download links will be added here when the releases are published.

- Desktop: release link pending.
- Android: APK link pending.

The current Android build requires Android 7.0 or later and a 64-bit device (arm64-v8a or x86_64). The MP3 conversion library does not currently include 32-bit Android binaries.

## Features

- Music search and discovery.
- Playlists, queue management, history and favorites.
- Automatic radio based on the current song, with an option to turn it off.
- Synced lyrics through LRCLIB.
- Android background playback and media controls.
- Android downloads saved as MP3 in `Downloads/Loudara`.
- Web app with PWA support.

## Development

Install dependencies and start the development server:

```sh
pnpm install
pnpm dev
```

Build and run the radio tests:

```sh
pnpm build
node --test tests/*.test.mjs
```

Build the desktop app with Tauri (requires Rust and the [Tauri system prerequisites](https://v2.tauri.app/start/prerequisites/)):

```sh
pnpm desktop:dev
pnpm desktop:build
```

Build a debug APK (requires Android Studio, the Android SDK and Java 21):

```sh
pnpm build
pnpm exec cap sync android
cd android
./gradlew :app:assembleDebug
```

The debug APK is generated at `android/app/build/outputs/apk/debug/app-debug.apk`. A public release requires a separately signed release build.

## Configuration

Environment variables are optional for desktop and Android builds. Both can resolve streams on the device without a Loudara API; Android can optionally use a deployed API. Streaming availability can depend on the provider and its session requirements. Do not put private credentials in `VITE_*` variables.

See [environment configuration](docs/environment.md), [streaming](docs/streaming.md), and [architecture](docs/architecture.md) for details.

## License

Loudara is distributed under the GPL-3.0 license. See [LICENSE](LICENSE).
