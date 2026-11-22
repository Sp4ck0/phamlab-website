// Synthetic-only checks for the map's pins: derivePoints (the plan, with each pin's days, which
// let a pinned map show one day) and deriveTaskPoints (ghost pins for what isn't in the plan yet).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { derivePoints, deriveTaskPoints } from './mapPoints.ts';

const hotel = { src: 'h1', name: 'Hotel A', placeId: 'P-hotel' };
const cafe = { name: 'Cafe', placeId: 'P-cafe' };
const days = [
  { date: '2030-01-01', city: 'Alpha', country: 'XX', hotels: [hotel], acts: [{ text: 'Coffee', places: [cafe] }] },
  { date: '2030-01-02', city: 'Alpha', country: 'XX', hotels: [hotel], acts: [{ text: 'Coffee again', places: [cafe] }, { text: 'Lunch', places: [{ name: 'Noodles', placeId: 'P-noodles' }] }] },
  { date: '2030-01-03', city: 'Beta', country: 'XX', hotels: [], acts: [] },
  { date: '2030-01-04', city: 'Beta', country: 'XX', hotels: [], acts: [] },
];
const byName = (points) => Object.fromEntries(points.map((p) => [p.name, p]));

test('a hotel over several nights carries every one of them', () => {
  assert.deepEqual(byName(derivePoints(days))['Hotel A'].dates, ['2030-01-01', '2030-01-02']);
});

test('an activity carries its day; the same place on another day adds that day to one pin', () => {
  const points = derivePoints(days);
  assert.deepEqual(byName(points).Noodles.dates, ['2030-01-02']);
  assert.equal(points.filter((p) => p.name === 'Cafe').length, 1);
  assert.deepEqual(byName(points).Cafe.dates, ['2030-01-01', '2030-01-02']);
});

test('a city with no place of its own gets a city pin for each of its days', () => {
  assert.deepEqual(byName(derivePoints(days)).Beta.dates, ['2030-01-03', '2030-01-04']);
});

test('every pin comes from an entry: removing the activity removes its pin', () => {
  const without = days.map((d) => (d.date === '2030-01-02' ? { ...d, acts: d.acts.filter((a) => a.text !== 'Lunch') } : d));
  assert.ok(byName(derivePoints(days)).Noodles);
  assert.equal(byName(derivePoints(without)).Noodles, undefined);
});

const item = (id, fields) => ({ key: `item:${id}`, kind: 'consider', scope: { kind: 'trip' }, title: `Idea ${id}`, refs: [], refsDone: [], done: false, dueDate: null, dueDateIsDefault: false, editable: true, ...fields });

test("an item's places and its draft hotel or activity are ghost pins, with the draft's category and the item's days", () => {
  const tasks = [
    item('a', { places: [{ name: 'Market', placeId: 'P-market' }], scope: { kind: 'day', date: '2030-01-03' } }),
    item('b', { proposes: { type: 'hotel', entry: { who: 'all', name: 'Hotel B', placeId: 'P-hotel-b', status: 'needed' } }, scope: { kind: 'range', start: '2030-01-03', end: '2030-01-04' } }),
    item('c', { kind: 'custom', proposes: { type: 'activity', entry: { text: 'Dinner', tag: 'Food', places: [{ name: 'Bistro', address: '1 Synthetic St' }] } } }),
  ];
  const ghosts = byName(deriveTaskPoints(tasks, derivePoints(days)));
  assert.deepEqual([ghosts.Market.category, ghosts.Market.candidate, ghosts.Market.dates], ['other', 'open', ['2030-01-03']]);
  assert.deepEqual([ghosts['Hotel B'].category, ghosts['Hotel B'].dates], ['hotel', ['2030-01-03', '2030-01-04']]);
  assert.deepEqual([ghosts.Bistro.category, ghosts.Bistro.dates], ['restaurant', undefined]);
  assert.equal(ghosts.Market.id, 'task|a|0');
});

test('a ghost never sits on a planned pin, a dropped idea has none, and a chosen idea or done to-do is marked chosen', () => {
  const tasks = [
    item('a', { places: [{ name: 'Cafe again', placeId: 'P-cafe' }] }),
    item('b', { places: [{ name: 'Gone', placeId: 'P-gone' }], outcome: 'dropped' }),
    item('c', { places: [{ name: 'Picked', placeId: 'P-picked' }], outcome: 'chosen' }),
    item('d', { kind: 'custom', places: [{ name: 'Done', placeId: 'P-done' }], done: true }),
    item('e', { places: [{ name: 'Nameless spot' }] }),
  ];
  const ghosts = byName(deriveTaskPoints(tasks, derivePoints(days)));
  assert.deepEqual(Object.keys(ghosts).sort(), ['Done', 'Picked']);
  assert.equal(ghosts.Picked.candidate, 'chosen');
  assert.equal(ghosts.Done.candidate, 'chosen');
});

test('a derived task (not a stored item) has no ghost pin', () => {
  assert.deepEqual(deriveTaskPoints([{ ...item('x', { places: [{ name: 'X', placeId: 'P-x' }] }), key: 'booking:x' }], []), []);
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
