import assert from 'node:assert/strict';
import { test } from 'node:test';
import vm from 'node:vm';
import { build } from 'esbuild';

const bundle = await build({
  entryPoints: ['src/lib/modules/autoRadio.ts'],
  bundle: true,
  write: false,
  format: 'cjs',
  platform: 'node',
  plugins: [{
    name: 'radio-fixtures',
    setup(build) {
      build.onResolve({ filter: /^(@stores|@utils|\.\/getRadio)$/ }, args => ({ path: args.path, namespace: 'fixture' }));
      build.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({
        contents: args.path === '@stores'
          ? 'export const { addToQueue, playerStore, queueStore } = globalThis.fixture;'
          : args.path === '@utils'
            ? 'export const { config } = globalThis.fixture;'
            : 'export default (...args) => globalThis.fixture.getRadio(...args);',
        loader: 'js'
      }));
    }
  }]
});

function setup() {
  let now = 0;
  let nextId = 0;
  const timers = new Map();
  const fixture = {
    config: { autoRadio: true },
    playerStore: { stream: { id: 'one', title: 'One', author: 'Artist' }, playbackState: 'playing' },
    queueStore: { list: [{ id: 'manual' }], isLoading: false, isSession: false },
    calls: [],
    async getRadio(seed) {
      fixture.calls.push(seed.id);
      return [{ id: 'suggested' }];
    },
    addToQueue(items) { fixture.queueStore.list.push(...items); }
  };
  const context = vm.createContext({
    fixture,
    module: { exports: {} },
    console,
    window: {
      setTimeout(fn, delay) {
        const id = ++nextId;
        timers.set(id, { fn, at: now + delay });
        return id;
      },
      clearTimeout(id) { timers.delete(id); }
    }
  });
  vm.runInContext(bundle.outputFiles[0].text, context);
  return {
    fixture,
    radio: context.module.exports,
    async advance(ms) {
      now += ms;
      for (const [id, timer] of timers) {
        if (timer.at <= now) {
          timers.delete(id);
          await timer.fn();
        }
      }
    }
  };
}

test('waits for playback and ten seconds, then preserves the existing queue', async () => {
  const { fixture, radio, advance } = setup();
  radio.scheduleAutoRadio();
  await advance(20_000);
  assert.equal(fixture.calls.length, 0);
  radio.prepareAutoRadio(true);
  await advance(9_999);
  assert.equal(fixture.calls.length, 0);
  await advance(1);
  assert.deepEqual(fixture.calls, ['one']);
  assert.deepEqual(fixture.queueStore.list.map(item => item.id), ['manual', 'suggested']);
  assert.equal(fixture.queueStore.list[1].context.id, 'Radio: One');
});

test('track changes and disabling invalidate timers and in-flight requests', async () => {
  const { fixture, radio, advance } = setup();
  radio.prepareAutoRadio(true);
  radio.resetAutoRadio();
  fixture.playerStore.stream = { id: 'two', title: 'Two', author: 'Artist' };
  await advance(10_000);
  assert.equal(fixture.calls.length, 0);

  let resolveRadio;
  fixture.getRadio = () => new Promise(resolve => { resolveRadio = resolve; });
  radio.prepareAutoRadio(true);
  const pending = advance(10_000);
  // The lazy import must resolve before the mocked request starts.
  for (let i = 0; i < 10 && !resolveRadio; i++) await Promise.resolve();
  assert.ok(resolveRadio);
  fixture.config.autoRadio = false;
  radio.cancelAutoRadio();
  resolveRadio([{ id: 'stale' }]);
  await pending;
  assert.deepEqual(fixture.queueStore.list.map(item => item.id), ['manual']);
});

test('respects pauses and avoids replacing a manually started radio', async () => {
  const { fixture, radio, advance } = setup();
  radio.prepareAutoRadio(true);
  radio.cancelAutoRadio();
  await advance(10_000);
  assert.equal(fixture.calls.length, 0);
  radio.scheduleAutoRadio();
  fixture.queueStore.list.push({ id: 'manual-radio', context: { src: 'queue', id: 'Radio: Manual' } });
  await advance(10_000);
  assert.equal(fixture.calls.length, 0);
  assert.deepEqual(fixture.queueStore.list.map(item => item.id), ['manual', 'manual-radio']);
});

test('discards a late response after selecting another song', async () => {
  const { fixture, radio, advance } = setup();
  let resolveRadio;
  fixture.getRadio = () => new Promise(resolve => { resolveRadio = resolve; });
  radio.prepareAutoRadio(true);
  const pending = advance(10_000);
  for (let i = 0; i < 10 && !resolveRadio; i++) await Promise.resolve();
  assert.ok(resolveRadio);
  radio.resetAutoRadio();
  fixture.playerStore.stream = { id: 'two', title: 'Two', author: 'Artist' };
  resolveRadio([{ id: 'stale' }]);
  await pending;
  assert.deepEqual(fixture.queueStore.list.map(item => item.id), ['manual']);
});
