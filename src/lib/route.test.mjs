// Synthetic-only checks for deriveRoute: stops, the days spent at each, and who is there.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { byStay, deriveRoute } from './tripLogic.ts';

const g = (id, from, to) => ({ id, name: id.toUpperCase(), members: 1, color: '#000', from, to });
const A = g('a');
const B = g('b', undefined, '2030-01-03'); // goes home from Beta on the 3rd
const C = g('c', '2030-01-05');            // joins at Gamma
const groups = [A, B, C];

// Home → Alpha → Beta → Gamma → Home. On the 3rd B flies home while A flies on to Gamma.
const days = [
  { date: '2030-01-01', city: 'Home', to: 'Alpha', hotels: [] },
  { date: '2030-01-02', city: 'Alpha', to: 'Beta', hotels: [{ name: 'x' }] },
  { date: '2030-01-03', city: 'Beta', to: 'Gamma' },
  { date: '2030-01-04', city: 'Gamma' },
  { date: '2030-01-05', city: 'Gamma', to: 'Home' },
];

const names = (gs) => gs.map((x) => x.id).join(',');

test('stops follow the days and merge an arrival into the next day there', () => {
  const stops = deriveRoute(days, [], groups);
  assert.deepEqual(stops.map((s) => s.label), ['Home', 'Alpha', 'Beta', 'Gamma', 'Home']);
  assert.deepEqual(stops.map((s) => s.dates.length), [0, 1, 1, 2, 0]);
});

test('departure from home and the final arrival have no headcount', () => {
  const stops = deriveRoute(days, [], groups);
  assert.equal(stops[0].who.length, 0);
  assert.equal(stops[4].who.length, 0);
});

test('who is at each stop, and who joined or left since the last one', () => {
  const [, alpha, beta, gamma] = deriveRoute(days, [], groups);
  assert.equal(names(alpha.who), 'a,b');
  assert.equal(names(alpha.joined) + names(alpha.left), '');
  assert.equal(names(beta.who), 'a,b');
  assert.equal(names(gamma.who), 'a,c');
  assert.equal(names(gamma.joined), 'c');
  assert.equal(names(gamma.left), 'b');
});

test('a trip that starts away from home keeps its first stop counted', () => {
  const [first] = deriveRoute(days.slice(1), [], groups);
  assert.equal(first.label, 'Alpha');
  assert.equal(names(first.who), 'a,b');
});

test('without dates or groups it is just the labels (print view)', () => {
  const stops = deriveRoute(days.map(({ city, to }) => ({ city, to })), []);
  assert.deepEqual(stops.map((s) => s.label), ['Home', 'Alpha', 'Beta', 'Gamma', 'Home']);
  assert.ok(stops.every((s) => s.who.length === 0));
});

test('whole-trip travelers first, then by join date, leave date and name', () => {
  const people = [g('late', '2030-01-05'), g('zed'), g('mid', '2030-01-02', '2030-01-04'), g('early', undefined, '2030-01-03'), g('amy')];
  assert.equal(names(people.sort(byStay)), 'amy,zed,early,mid,late');
});
