// The pinned map's divider: how far it can be dragged.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MAP_MIN_H, clampMapHeight, maxMapHeight } from './pinMap.ts';

test('the map keeps at least a short strip and leaves room for the itinerary under it', () => {
  assert.equal(clampMapHeight(500, 1000), 500);
  assert.equal(clampMapHeight(40, 1000), MAP_MIN_H);
  assert.equal(clampMapHeight(2000, 1000), 740);
  assert.equal(maxMapHeight(1000), 740);
  assert.equal(clampMapHeight(321.6, 1000), 322);
});

test('in a very short window the minimum wins', () => {
  assert.equal(clampMapHeight(300, 300), MAP_MIN_H);
  assert.equal(maxMapHeight(300), MAP_MIN_H);
});
