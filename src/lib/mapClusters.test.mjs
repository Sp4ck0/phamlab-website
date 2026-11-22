// Trip map clustering: which pins share a bubble at which zoom.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CLUSTER_MAX_ZOOM, clusterCenter, clusterPoints } from './mapClusters.ts';

const bangkokA = { lat: 13.7563, lng: 100.5018 };
const bangkokB = { lat: 13.7465, lng: 100.5348 }; // ~3.6 km away
const saigon = { lat: 10.7769, lng: 106.7009 };
const singapore = { lat: 1.3521, lng: 103.8198 };

test('zoomed out to the region, pins in one city share a bubble and other cities stay apart', () => {
  assert.deepEqual(clusterPoints([bangkokA, saigon, bangkokB, singapore], 5), [[0, 2], [1], [3]]);
});

test('zoomed in on the city, its pins split apart', () => {
  assert.deepEqual(clusterPoints([bangkokA, bangkokB], 13), [[0], [1]]);
});

test('zoomed all the way out, the whole region becomes one bubble', () => {
  assert.deepEqual(clusterPoints([bangkokA, saigon, bangkokB, singapore], 1), [[0, 1, 2, 3]]);
});

test('from the max zoom in, every pin shows alone, even two at the same spot', () => {
  assert.deepEqual(clusterPoints([bangkokA, bangkokA], CLUSTER_MAX_ZOOM), [[0], [1]]);
  assert.deepEqual(clusterPoints([bangkokA, bangkokA], CLUSTER_MAX_ZOOM - 1), [[0, 1]]);
});

test('a fractional zoom (mid-flight) clusters like its whole zoom', () => {
  assert.deepEqual(clusterPoints([bangkokA, bangkokB], 5.9), clusterPoints([bangkokA, bangkokB], 5));
});

test('pins either side of the date line are close, not a world apart', () => {
  assert.deepEqual(clusterPoints([{ lat: 0, lng: 179.99 }, { lat: 0, lng: -179.99 }], 8), [[0, 1]]);
});

test('no pins, no groups', () => {
  assert.deepEqual(clusterPoints([], 5), []);
});

test('a bubble sits in the middle of its pins', () => {
  assert.deepEqual(clusterCenter([{ lat: 10, lng: 100 }, { lat: 12, lng: 104 }]), { lat: 11, lng: 102 });
});
