// Synthetic-only checks for where "Show in itinerary" takes a proposed item.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { itineraryTarget } from './itemTile.tsx';

const day = (date, extra = {}) => ({ date, flights: [], hotels: [], acts: [], ...extra });
const days = [day('2040-01-01'), day('2040-01-02'), day('2040-01-03')];
const proposal = (scope, extra = {}) => ({ key: 'item:p1', kind: 'proposed', title: 'Synthetic idea', scope, ...extra });

test('before it is added: its own tile on its day', () => {
  assert.deepEqual(itineraryTarget(proposal({ kind: 'day', date: '2040-01-02' }), days), { date: '2040-01-02', tile: 'item:p1' });
});

test('a range: the first trip day it covers', () => {
  assert.deepEqual(itineraryTarget(proposal({ kind: 'range', start: '2039-12-30', end: '2040-01-02' }), days), { date: '2040-01-01', tile: 'item:p1' });
});

test('nowhere to go: whole trip, dropped, or a day not on the trip', () => {
  assert.equal(itineraryTarget(proposal({ kind: 'trip' }), days), null);
  assert.equal(itineraryTarget(proposal({ kind: 'day', date: '2040-01-02' }, { outcome: 'dropped' }), days), null);
  assert.equal(itineraryTarget(proposal({ kind: 'day', date: '2040-02-01' }), days), null);
});

test('once added: the activity it became', () => {
  const d = day('2040-01-02', { acts: ['Synthetic walk', { text: 'Synthetic museum', fromItem: 'p1' }] });
  assert.deepEqual(itineraryTarget(proposal({ kind: 'day', date: '2040-01-02' }), [d], '2040-01-02'), { date: '2040-01-02', tile: 'act:1' });
});

test('once added: the hotel tile it is part of', () => {
  const h = (src, extra = {}) => ({ name: 'Synthetic inn', who: 'a', status: 'booked', src, ...extra });
  const d = day('2040-01-02', { hotels: [h('src-a'), h('src-b', { who: 'b', fromItem: 'p1' })] });
  assert.deepEqual(itineraryTarget(proposal({ kind: 'trip' }), [d], '2040-01-02'), { date: '2040-01-02', tile: 'src-a' });
});

test('once added: the transport tile, else just the day', () => {
  const d = day('2040-01-02', { flights: [{ route: 'AAA → BBB', who: 'a', status: 'booked', fromItem: 'p1' }] });
  assert.deepEqual(itineraryTarget(proposal({ kind: 'trip' }), [d], '2040-01-02'), { date: '2040-01-02', tile: '2040-01-02|f|AAA → BBB|a' });
  assert.deepEqual(itineraryTarget(proposal({ kind: 'trip' }), [day('2040-01-02')], '2040-01-02'), { date: '2040-01-02' });
});
