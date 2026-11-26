import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ConvexError } from 'convex/values';
import { blockedWhileOffline, clearSaved, getSaved, pickView, putSaved, removeSaved, setOfflineKv, OFFLINE_MESSAGE } from './offline.ts';

function memoryKv() {
  const m = new Map();
  return {
    get: async (k) => m.get(k),
    set: async (k, v) => void m.set(k, structuredClone(v)),
    remove: async (k) => void m.delete(k),
    clear: async () => m.clear(),
  };
}
const broken = {
  get: async () => { throw new Error('blocked'); },
  set: async () => { throw new Error('blocked'); },
  remove: async () => { throw new Error('blocked'); },
  clear: async () => { throw new Error('blocked'); },
};

test('a copy is kept with the time it was saved, replaced by newer ones, and removed', async () => {
  setOfflineKv(memoryKv());
  assert.equal(await getSaved('trip:a'), null);
  await putSaved('trip:a', { title: 'A' }, 1000);
  assert.deepEqual(await getSaved('trip:a'), { value: { title: 'A' }, savedAt: 1000 });
  await putSaved('trip:a', { title: 'A2' }, 2000);
  assert.deepEqual(await getSaved('trip:a'), { value: { title: 'A2' }, savedAt: 2000 });
  await removeSaved('trip:a');
  assert.equal(await getSaved('trip:a'), null);
});

test('clearing drops every copy (another access code, or logging out)', async () => {
  setOfflineKv(memoryKv());
  await putSaved('trip:a', 1);
  await putSaved('trips', [1]);
  await clearSaved();
  assert.equal(await getSaved('trip:a'), null);
  assert.equal(await getSaved('trips'), null);
});

test('storage that fails is no copy, never an error', async () => {
  setOfflineKv(broken);
  await putSaved('trip:a', 1);
  await removeSaved('trip:a');
  await clearSaved();
  assert.equal(await getSaved('trip:a'), null);
});

test('the live answer wins whenever there is one, online or not', () => {
  const saved = { value: 'old', savedAt: 5 };
  assert.deepEqual(pickView('live', saved, false), { value: 'live', savedAt: null, missing: false });
  assert.deepEqual(pickView('live', saved, true), { value: 'live', savedAt: null, missing: false });
  assert.deepEqual(pickView(null, saved, true), { value: null, savedAt: null, missing: false });
});

test('online with no answer yet is just loading: the copy is not shown', () => {
  assert.deepEqual(pickView(undefined, { value: 'old', savedAt: 5 }, false), { value: undefined, savedAt: null, missing: false });
});

test('offline with no answer: the copy and when it was saved, or "missing" when there is none', () => {
  assert.deepEqual(pickView(undefined, { value: 'old', savedAt: 5 }, true), { value: 'old', savedAt: 5, missing: false });
  assert.deepEqual(pickView(undefined, null, true), { value: undefined, savedAt: null, missing: true });
  // Still looking it up.
  assert.deepEqual(pickView(undefined, undefined, true), { value: undefined, savedAt: null, missing: false });
});

test('offline, edits are refused with a message the editors show; online they go through', async () => {
  let calls = 0;
  const handlers = { save: (x) => { calls += x; return Promise.resolve('saved'); } };
  assert.equal(blockedWhileOffline(handlers, false), handlers);
  const blocked = blockedWhileOffline(handlers, true);
  await assert.rejects(blocked.save(1), (e) => e instanceof ConvexError && e.data === OFFLINE_MESSAGE);
  assert.equal(calls, 0);
  // A caller that doesn't wait on it gets no unhandled rejection (the test runner would fail on one).
  blocked.save(1);
  await new Promise((r) => setTimeout(r, 10));
});
