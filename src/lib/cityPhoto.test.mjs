import { test } from 'node:test';
import assert from 'node:assert/strict';
import { batchedPhotos, KEEP_MS, PHOTO_BATCH } from './cityPhoto.ts';

const photo = (id) => ({ url: `https://example.com/${id}.jpg`, credit: null });
const tick = (ms = 5) => new Promise((r) => setTimeout(r, ms));

test('photos asked for together go in one call, each item once; later ones in the next call', async () => {
  const calls = [];
  const one = batchedPhotos((id) => id, async (ids) => { calls.push(ids); return ids.map(photo); }, 0);
  const got = await Promise.all([one('a'), one('b'), one('a')]);
  assert.deepEqual(got, [photo('a'), photo('b'), photo('a')]);
  assert.deepEqual(calls, [['a', 'b']]);
  assert.deepEqual(await one('a'), photo('a')); // remembered: no new call
  assert.deepEqual(await one('c'), photo('c'));
  assert.deepEqual(calls, [['a', 'b'], ['c']]);
});

test('a big batch is split at the backend\'s limit; a failed call is no photo for its items', async () => {
  const calls = [];
  const one = batchedPhotos((id) => id, async (ids) => {
    calls.push(ids.length);
    if (ids.includes('x0')) throw new Error('synthetic failure');
    return ids.map(photo);
  }, 0);
  const ids = Array.from({ length: PHOTO_BATCH + 3 }, (_, i) => `x${i}`);
  const got = await Promise.all(ids.map(one));
  assert.deepEqual(calls, [PHOTO_BATCH, 3]);
  assert.ok(got.slice(0, PHOTO_BATCH).every((p) => p === null)); // the failed call's items
  assert.deepEqual(got.slice(PHOTO_BATCH), ids.slice(PHOTO_BATCH).map(photo));
  await tick();
});

// ---- Kept in the browser across visits ---------------------------------------------------
// A stand-in localStorage, and an Image that loads only the links in `live`.
function fakeBrowser({ throws = false } = {}) {
  const store = new Map();
  const live = new Set();
  globalThis.localStorage = {
    getItem: (k) => { if (throws) throw new Error('blocked'); return store.has(k) ? store.get(k) : null; },
    setItem: (k, v) => { if (throws) throw new Error('blocked'); store.set(k, String(v)); },
    removeItem: (k) => { if (throws) throw new Error('blocked'); store.delete(k); },
  };
  globalThis.Image = class {
    set src(url) { setTimeout(() => (live.has(url) ? this.onload?.() : this.onerror?.()), 0); }
  };
  return { store, live };
}
const clearBrowser = () => { delete globalThis.localStorage; delete globalThis.Image; };
const counting = (calls, result = photo) => async (ids) => { calls.push(ids); return ids.map(result); };

test('a photo found is kept and used on the next visit with no backend call while its link loads', async (t) => {
  t.after(clearBrowser);
  const { store, live } = fakeBrowser();
  const calls = [];
  assert.deepEqual(await batchedPhotos((id) => id, counting(calls), 0, 'place')('a'), photo('a'));
  assert.equal(JSON.parse(store.get('photo:place:a')).url, photo('a').url);
  live.add(photo('a').url);
  const nextVisit = batchedPhotos((id) => id, counting(calls), 0, 'place');
  assert.deepEqual(await nextVisit('a'), photo('a'));
  assert.deepEqual(calls, [['a']]); // only the first visit asked
});

test('a kept link that no longer loads, or is over a week old, is asked for again and replaced', async (t) => {
  t.after(clearBrowser);
  const { store } = fakeBrowser();
  store.set('photo:city:x', JSON.stringify({ url: 'https://example.com/expired.jpg', credit: null, at: Date.now() }));
  store.set('photo:city:y', JSON.stringify({ url: 'https://example.com/old.jpg', credit: null, at: Date.now() - KEEP_MS - 1 }));
  const calls = [];
  const one = batchedPhotos((id) => id, counting(calls), 0, 'city');
  assert.deepEqual(await Promise.all([one('x'), one('y')]), [photo('x'), photo('y')]);
  assert.deepEqual(calls.flat().sort(), ['x', 'y']);
  assert.equal(JSON.parse(store.get('photo:city:x')).url, photo('x').url);
});

test('no photo is never kept, so it is asked for on the next visit (the daily budget may have been full)', async (t) => {
  t.after(clearBrowser);
  const { store } = fakeBrowser();
  const calls = [];
  assert.equal(await batchedPhotos((id) => id, counting(calls, () => null), 0, 'place')('a'), null);
  assert.equal(store.has('photo:place:a'), false);
  await batchedPhotos((id) => id, counting(calls), 0, 'place')('a');
  assert.deepEqual(calls, [['a'], ['a']]);
});

test('blocked storage, or none, works as before', async (t) => {
  t.after(clearBrowser);
  fakeBrowser({ throws: true });
  const calls = [];
  assert.deepEqual(await batchedPhotos((id) => id, counting(calls), 0, 'place')('a'), photo('a'));
  clearBrowser();
  assert.deepEqual(await batchedPhotos((id) => id, counting(calls), 0, 'place')('b'), photo('b'));
  assert.deepEqual(calls, [['a'], ['b']]);
});
