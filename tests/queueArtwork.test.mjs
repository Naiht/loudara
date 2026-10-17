import assert from 'node:assert/strict';
import { test } from 'node:test';
import vm from 'node:vm';
import { build } from 'esbuild';

const bundle = await build({
  entryPoints: ['src/lib/stores/player.ts'],
  bundle: true,
  write: false,
  format: 'cjs',
  platform: 'browser',
  conditions: ['browser'],
  plugins: [{
    name: 'queue-fixtures',
    setup(build) {
      build.onResolve({ filter: /^solid-js$/ }, args => args.importer.endsWith('/stores/player.ts')
        ? { path: 'solid-root', namespace: 'fixture' } : null);
      build.onResolve({ filter: /^(@stores|@utils|@modules\/.*|@platform\/.*|\.\.\/modules\/.*)$/ }, args => ({ path: args.path, namespace: 'fixture' }));
      build.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({
        contents: args.path === 'solid-root'
          ? 'export function createRoot() {}'
          : args.path === '@stores'
            ? 'export const { navStore, params, updateParam, addToQueue, queueStore, setQueueStore, setStore, store, groupQueueByAuthor } = globalThis.fixture;'
            : args.path === '@utils'
              ? 'export const { config, cssVar, themer, addToCollection, player, shuffle, streamCache } = globalThis.fixture;'
              : args.path === '@platform/native'
                ? 'export const isNativeApp = false;'
                : 'export const isQueuePrefetchActive = () => false, getEmbeddedSimilar = () => {}, hasEmbeddedBackend = false, addNativePlaybackListener = () => {}, addNativeTransportListener = () => {}, getNativePlaybackState = () => {}, cancelAutoRadio = () => {}, scheduleAutoRadio = () => {}; export default () => {};',
        loader: 'js'
      }));
    }
  }]
});

test('next and previous select their own artwork, including tracks without an image', () => {
  const queueStore = { list: [], history: [] };
  const played = [];
  const fixture = {
    queueStore,
    setQueueStore(key, value) { queueStore[key] = typeof value === 'function' ? value(queueStore[key]) : value; },
    config: { volume: '100' },
    player(id) { played.push({ id, image: context.module.exports.playerStore.stream.img }); }
  };
  const context = vm.createContext({
    fixture, module: { exports: {} }, console,
    Audio: class {},
    navigator: { mediaCapabilities: { decodingInfo: async () => ({ supported: true }) } }
  });
  vm.runInContext(bundle.outputFiles[0].text, context);
  const { setPlayerStore, playerStore, playNext, playPrev } = context.module.exports;
  const first = { id: 'first', title: 'First', author: 'A', authorId: '', duration: '1:00', img: 'first-cover' };
  const second = { id: 'second', title: 'Second', author: 'B', authorId: '', duration: '1:00' };
  const third = { id: 'third', title: 'Third', author: 'C', authorId: '', duration: '1:00', img: 'third-cover' };
  setPlayerStore('stream', first);
  queueStore.list = [second, third];

  playNext();
  assert.equal(playerStore.stream.img, undefined);
  playNext();
  assert.equal(playerStore.stream.img, 'third-cover');
  playPrev();
  assert.equal(playerStore.stream.img, undefined);
  playPrev();
  assert.equal(playerStore.stream.img, 'first-cover');
  assert.deepEqual(played, [
    { id: 'second', image: undefined }, { id: 'third', image: 'third-cover' },
    { id: 'second', image: undefined }, { id: 'first', image: 'first-cover' }
  ]);
});
