// Synthetic-only checks for derivePoints' day dates, which let a pinned map show one day.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { derivePoints } from './mapPoints.ts';

const hotel = { src: 'h1', name: 'Hotel A', placeId: 'P-hotel' };
const cafe = { name: 'Cafe', placeId: 'P-cafe' };
const days = [
  { date: '2030-01-01', city: 'Alpha', country: 'XX', hotels: [hotel], acts: [{ text: 'Coffee', places: [cafe] }] },
  { date: '2030-01-02', city: 'Alpha', country: 'XX', hotels: [hotel], acts: [{ text: 'Coffee again', places: [cafe] }, { text: 'Lunch', places: [{ name: 'Noodles', placeId: 'P-noodles' }] }] },
  { date: '2030-01-03', city: 'Beta', country: 'XX', hotels: [], acts: [] },
  { date: '2030-01-04', city: 'Beta', country: 'XX', hotels: [], acts: [] },
];
const curated = [{ id: 'poi', name: 'Viewpoint', placeId: 'P-poi', category: 'attraction' }];
const byName = (points) => Object.fromEntries(points.map((p) => [p.name, p]));

test('a hotel over several nights carries every one of them', () => {
  assert.deepEqual(byName(derivePoints(days, curated))['Hotel A'].dates, ['2030-01-01', '2030-01-02']);
});

test('an activity carries its day; the same place on another day adds that day to one pin', () => {
  const points = derivePoints(days, curated);
  assert.deepEqual(byName(points).Noodles.dates, ['2030-01-02']);
  assert.equal(points.filter((p) => p.name === 'Cafe').length, 1);
  assert.deepEqual(byName(points).Cafe.dates, ['2030-01-01', '2030-01-02']);
});

test('a city with no place of its own gets a city pin for each of its days', () => {
  assert.deepEqual(byName(derivePoints(days, curated)).Beta.dates, ['2030-01-03', '2030-01-04']);
});

test('a curated point is not tied to a day', () => {
  assert.equal(byName(derivePoints(days, curated)).Viewpoint.dates, undefined);
});
