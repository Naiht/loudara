import assert from 'node:assert/strict';
import { test } from 'node:test';
import vm from 'node:vm';
import { build } from 'esbuild';

async function bundle(entry, sources, define = {}) {
  const result = await build({
    entryPoints: [entry], bundle: true, write: false, format: 'cjs', platform: 'node', define,
    logLevel: 'silent',
    plugins: [{
      name: 'desktop-fixtures',
      setup(build) {
        build.onResolve({ filter: /.*/ }, args => {
          if (Object.hasOwn(sources, args.path)) return { path: args.path, namespace: 'fixture' };
        });
        build.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: sources[args.path], loader: 'js' }));
      }
    }]
  });
  return result.outputFiles[0].text;
}

test('desktop search and playback use the on-device resolver even when an API URL exists', async () => {
  const code = await bundle('src/platform/native/index.ts', {
    '@capacitor/core': 'export const Capacitor = { isNativePlatform: () => false };',
    './playback': 'export async function requestNativePlaybackPermissions() {}',
    '../tauri': 'export const isTauriRuntimeAvailable = () => true;',
    '../web/streaming/ApiStreamProvider': 'export class ApiStreamProvider { constructor() { throw new Error("Remote API was used"); } }',
    '../web/streamingCredentials': 'export const webStreamingCredentials = { get: async () => null };',
    '../../backend/getSearch.js': 'export default async params => ({ items: [params.q], hasMore: false });',
    '../../backend/getYoutubeStream.js': 'export async function getYoutubeStream(id, options) { return { videoId: id, direct: !options.proxyMedia }; } export function isYoutubeBotChallenge() { return false; } export function resetYoutubeSession() {}'
  }, { 'import.meta.env.VITE_LOUDARA_API_URL': '"https://example.invalid"', 'import.meta.env.VITE_STREAM_API_BASE': '""' });
  const context = vm.createContext({ module: { exports: {} }, console, navigator: {}, window: {} });
  vm.runInContext(code, context);
  const native = context.module.exports;
  assert.equal((await native.getNativeSearchResults({ q: 'Loudara' })).items[0], 'Loudara');
  const stream = await native.getNativeStreamData('track');
  assert.equal(stream.videoId, 'track');
  assert.equal(stream.direct, true);
});

test('media controls remain registered when a WebView rejects optional seek actions', async () => {
  const code = await bundle('src/lib/modules/mediaSession.ts', {
    '@stores': 'export const { playerStore, queueStore, playNext, playPrev } = globalThis.fixture;',
    '@platform/native': 'export const isNativeApp = false;',
    '@platform/native/playback': 'export async function pauseNativePlayback() {} export async function playNativePlayback() {} export async function seekNativePlayback() {} export async function stopNativePlayback() {}'
  });
  const handlers = {};
  const calls = [];
  const fixture = {
    playerStore: { audio: { currentTime: 5, play: () => calls.push('play'), pause: () => calls.push('pause') } },
    queueStore: { list: [{}], history: [{}] },
    playNext: () => calls.push('next'), playPrev: () => calls.push('previous')
  };
  const context = vm.createContext({ fixture, module: { exports: {} }, console: { debug() {} }, navigator: { mediaSession: {
    setActionHandler(action, handler) {
      if (action === 'seekbackward') throw new Error('unsupported');
      handlers[action] = handler;
    }
  } } });
  vm.runInContext(code, context);
  context.module.exports.initMediaSession();
  handlers.play(); handlers.pause(); handlers.nexttrack(); handlers.previoustrack(); handlers.stop();
  assert.deepEqual(calls, ['play', 'pause', 'next', 'previous', 'pause']);
  assert.equal(fixture.playerStore.audio.currentTime, 0);
});

test('desktop HTTP bridge forwards request overrides and supports empty responses', async () => {
  const code = await bundle('src/platform/tauri/fetch.ts', {
    '@tauri-apps/api/core': 'export const invoke = (...args) => globalThis.fixtureInvoke(...args);',
    './index': 'export const isTauriRuntimeAvailable = () => true;'
  });
  const calls = [];
  const context = vm.createContext({
    module: { exports: {} }, Request, Response, Headers, URL, Uint8Array,
    fixtureInvoke: async (command, payload) => {
      calls.push({ command, payload });
      return { status: 204, headers: {}, body: [] };
    }
  });
  vm.runInContext(code, context);
  const request = new Request('https://example.com/search', { method: 'POST', body: 'original' });
  const response = await context.module.exports.tauriFetch(request, { method: 'POST', body: 'updated' });
  assert.equal(response.status, 204);
  assert.equal(await response.text(), '');
  assert.equal(calls[0].command, 'http_fetch');
  assert.equal(Buffer.from(calls[0].payload.body).toString(), 'updated');
});

test('Tauri selects the embedded search and streaming routes', async () => {
  const code = await bundle('src/platform/embedded/index.ts', {
    '../tauri': 'export const isTauriRuntimeAvailable = () => true;',
    '../native': `
      export const isNativeApp = false;
      export const getNativeSearchResults = async ({q}) => ({items: [q]});
      export const getNativeStreamData = async id => ({videoId: id});
      export const getNativeGallery = () => {};
      export const getNativeListData = () => {};
      export const getNativeSearchSuggestions = () => {};
      export const getNativeSimilar = () => {};
      export const getNativeSubfeed = () => {};
      export const getNativeTrending = () => {};
    `
  });
  const context = vm.createContext({ module: { exports: {} } });
  vm.runInContext(code, context);
  const embedded = context.module.exports;
  assert.equal(embedded.hasEmbeddedBackend, true);
  assert.equal((await embedded.getEmbeddedSearchResults({ q: 'song' })).items[0], 'song');
  assert.equal((await embedded.getEmbeddedStreamData('track')).videoId, 'track');
});
