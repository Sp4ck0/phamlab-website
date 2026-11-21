import { test } from 'node:test';
import assert from 'node:assert/strict';
import { batchedPhotos, PHOTO_BATCH } from './cityPhoto.ts';

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
