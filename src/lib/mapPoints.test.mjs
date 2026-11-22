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

test('a day route runs hotel → activities in timeline order → that night\'s hotel; a moving day starts at the old hotel', async () => {
  const { deriveDayRoutes } = await import('./mapPoints.ts');
  const oldHotel = { src: 'o', name: 'Old Hotel', placeId: 'P-old', checkOut: true };
  const newHotel = { src: 'n', name: 'New Hotel', placeId: 'P-new', checkIn: true };
  const stay = { src: 's', name: 'Stay Hotel', placeId: 'P-stay' };
  const routes = deriveDayRoutes([
    // An all-day activity goes first, as on the timeline; the rest keep their stored order.
    { date: '2030-02-01', hotels: [stay], acts: [{ text: 'Lunch', places: [{ name: 'L', placeId: 'P-lunch' }] }, { text: 'Park', allDay: true, places: [{ name: 'Park', placeId: 'P-park' }] }] },
    { date: '2030-02-02', hotels: [newHotel, oldHotel], acts: ['No place here', { text: 'Museum', places: [{ name: 'M', address: 'Museum street' }] }] },
  ]);
  assert.deepEqual(routes, [
    { date: '2030-02-01', keys: ['id:P-stay', 'id:P-park', 'id:P-lunch', 'id:P-stay'] },
    { date: '2030-02-02', keys: ['id:P-old', 'addr:Museum street', 'id:P-new'] },
  ]);
});

test('a day route skips a hotel not chosen yet, merges a stop repeated right after itself, and needs two stops', async () => {
  const { deriveDayRoutes } = await import('./mapPoints.ts');
  const tbd = { src: 't', name: 'TBD hotel', placeId: 'P-tbd' };
  const hotel = { src: 'h', name: 'Hotel', placeId: 'P-h' };
  const routes = deriveDayRoutes([
    { date: '2030-03-01', hotels: [tbd], acts: [{ text: 'A', places: [{ name: 'A', placeId: 'P-a' }] }, { text: 'B', places: [{ name: 'B', placeId: 'P-b' }] }] },
    { date: '2030-03-02', hotels: [hotel], acts: [{ text: 'Breakfast at the hotel', places: [{ name: 'Hotel', placeId: 'P-h' }] }] }, // only one place
    { date: '2030-03-03', hotels: [], acts: [] },
  ]);
  assert.deepEqual(routes, [{ date: '2030-03-01', keys: ['id:P-a', 'id:P-b'] }]);
});
