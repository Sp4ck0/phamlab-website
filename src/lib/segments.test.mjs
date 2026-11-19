// Synthetic-only checks for lib/segments.ts and segmentUrl. Run with node:test
// after bundling (the sources import each other without extensions):
//   esbuild src/lib/segments.test.mjs --bundle --platform=node --format=esm --outfile=/tmp/segments.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dayOffset, derivedSegments, durationMin, fmtClock, fmtDate, fmtDuration, fmtWindow, hasTime, layoverMin, routePlaces, segmentLabel, segmentLine } from './segments.ts';
import { segmentUrl } from './calendar.ts';
import { mergeFlightsByRoute } from './tripLogic.ts';

const overnight = { from: 'SEA', to: 'TPE', depart: '2026-11-04T00:10', arrive: '2026-11-05T05:20', airline: 'CI', number: '21' };
const onward = { from: 'TPE', to: 'BKK', depart: '2026-11-05T07:00', arrive: '2026-11-05T09:50', airline: 'CI', number: '833' };
const westbound = { from: 'TPE', to: 'SEA', depart: '2026-11-17T20:30', arrive: '2026-11-17T15:05' };

test('duration comes from the two airports\' zones, across the date line and between zones', () => {
  assert.equal(durationMin(overnight), 13 * 60 + 10); // PST -> +08, overnight
  assert.equal(durationMin(onward), 3 * 60 + 50); // +08 -> +07
  assert.equal(durationMin(westbound), 10 * 60 + 35); // lands "earlier" on the same date
});

test('a stated duration is the fallback only when a zone is unknown', () => {
  assert.equal(durationMin({ from: 'Thong Sala', to: 'Bangrak', depart: '2026-11-11T16:00', arrive: '2026-11-11T16:45', durationMin: 45 }), 45);
  assert.equal(durationMin({ from: 'Thong Sala', to: 'Bangrak' }), null);
  assert.equal(durationMin({ ...overnight, durationMin: 5 }), 13 * 60 + 10); // known zones win
});

test('day offset counts local calendar days, so an overnight flight is +1', () => {
  assert.equal(dayOffset(overnight), 1);
  assert.equal(dayOffset(onward), 0);
  assert.equal(dayOffset(westbound), 0);
  assert.equal(dayOffset({ from: 'A', to: 'B' }), 0);
});

test('layover is the wait between hops at the same airport only', () => {
  assert.equal(layoverMin(overnight, onward), 100);
  assert.equal(layoverMin(onward, overnight), null); // different airports
  assert.equal(layoverMin({ ...overnight, arrive: undefined }, onward), null);
});

test('formatting', () => {
  assert.equal(fmtClock('2026-11-04T00:10'), '00:10'); // 24-hour, zero-padded
  assert.equal(fmtClock('2026-11-04T12:00'), '12:00');
  assert.equal(fmtClock('2026-11-04T15:05'), '15:05');
  assert.equal(fmtClock('2026-11-04T05:20'), '05:20');
  assert.equal(fmtDate('2026-11-04'), 'Wed, Nov 4');
  assert.equal(fmtDuration(790), '13h 10m');
  assert.equal(fmtDuration(180), '3h');
  assert.equal(fmtDuration(45), '45m');
  assert.equal(segmentLabel(overnight), 'CI 21');
  assert.equal(segmentLabel({ from: 'A', to: 'B', carrier: 'Seatran' }), 'Seatran');
  assert.equal(segmentLine(overnight), 'CI 21 · SEA 00:10 → TPE 05:20 +1 · 13h 10m');
});

test('calendar link uses the exact instants of each end', () => {
  const day = { date: '2026-11-04', city: 'Seattle', country: 'US' };
  const url = segmentUrl(overnight, 'flight', day, 0, { first: true });
  const q = new URL(url).searchParams;
  assert.equal(q.get('dates'), '20261104T081000Z/20261104T212000Z');
  assert.equal(q.get('text'), '✈️ CI 21: SEA → TPE');
  assert.equal(segmentUrl({ from: 'Thong Sala', to: 'Bangrak', depart: '2026-11-11T16:00' }, 'ferry', day, 0), null); // no zone, no guess
  assert.equal(segmentUrl({ from: 'SEA', to: 'TPE' }, 'flight', day, 0), null); // no time
});

test('a ferry (own mode, no airport zones) takes its duration from the wall clock and names its operator', () => {
  const ferry = { from: 'Thong Sala', to: 'Bangrak Pier', mode: 'ferry', carrier: 'Seatran', depart: '2023-03-08T16:00', arrive: '2023-03-08T16:45' };
  assert.equal(durationMin(ferry), 45);
  assert.equal(durationMin({ ...ferry, mode: undefined }), null); // a flight with unknown zones is not guessed
  assert.equal(segmentLine(ferry), 'Seatran · Thong Sala 16:00 → Bangrak Pier 16:45 · 45m');
  const day = { date: '2023-03-08', city: 'Ko Pha Ngan', country: 'TH' };
  const q = new URL(segmentUrl(ferry, 'flight', day, 0, { first: true, last: true })).searchParams; // the segment's own mode wins
  assert.equal(q.get('text'), '⛴️ Seatran: Thong Sala → Bangrak Pier');
  assert.equal(q.get('dates'), '20230308T160000/20230308T164500');
});

test('a hop that is only partly planned: a day is not a time, and nothing is computed from it', () => {
  const dayOnly = { from: 'SEA', to: 'TPE', depart: '2026-11-04', arrive: '2026-11-05' };
  assert.equal(hasTime('2026-11-04T09:00'), true);
  assert.equal(hasTime('2026-11-04'), false);
  assert.equal(hasTime(undefined), false);
  assert.equal(durationMin(dayOnly), null);
  assert.equal(layoverMin(dayOnly, { ...dayOnly, from: 'TPE', to: 'BKK' }), null);
  assert.equal(segmentUrl(dayOnly, 'flight', { date: '2026-11-04', city: 'Seattle', country: 'US' }, 0, { first: true }), null); // no time, no calendar event
  assert.equal(segmentLine(dayOnly), 'SEA Wed, Nov 4 → TPE Thu, Nov 5');
  assert.equal(segmentLine({ from: 'VCE', to: 'OSL', window: { from: '2027-02-10', to: '2027-02-12' } }), 'VCE → OSL · any day Feb 10–12');
});

test('a place not decided yet is a question mark in text, and a flexible window reads naturally', () => {
  assert.equal(segmentLine({ from: 'Upper Engadin' }), 'Upper Engadin → ?');
  assert.equal(segmentLine({}), '? → ?');
  assert.equal(fmtWindow({ from: '2027-02-10', to: '2027-02-12' }), 'Feb 10–12');
  assert.equal(fmtWindow({ from: '2027-02-28', to: '2027-03-02' }), 'Feb 28 – Mar 2');
  assert.equal(fmtWindow({ from: '2027-02-10', to: '2027-02-10' }), 'Feb 10');
});

test('hops are built from a route when a row has no segments yet, so every row can be one tile', () => {
  assert.deepEqual(routePlaces('Narvik → Kiruna'), ['Narvik', 'Kiruna']);
  assert.deepEqual(routePlaces('OSL → EVE → Narvik'), ['OSL', 'EVE', 'Narvik']);
  assert.deepEqual(routePlaces('SPU-ZAG-DBV'), ['SPU', 'ZAG', 'DBV']);
  assert.deepEqual(routePlaces('Zamora → next destination TBD'), ['Zamora', undefined]); // a placeholder is "not decided", not a place
  assert.deepEqual(routePlaces('Thong Sala-BKK via ferry'), []); // not readable: no guess
  assert.deepEqual(derivedSegments('OSL → EVE → Narvik'), [{ from: 'OSL', to: 'EVE' }, { from: 'EVE', to: 'Narvik' }]);
  assert.deepEqual(derivedSegments('Upper Engadin → next destination TBD'), [{ from: 'Upper Engadin', to: undefined }]);
  assert.deepEqual(derivedSegments('Synthetic route'), [{}]); // one blank hop with no places
});

test('two different flights on the same route and day are not merged', () => {
  const f = (number, depart) => ({ who: 'tony', route: 'SEA → TPE', status: 'booked', segments: [{ ...overnight, number, depart }] });
  const groups = mergeFlightsByRoute([f('21', '2026-11-04T00:10'), f('23', '2026-11-04T13:00'), { ...f('21', '2026-11-04T00:10'), who: 'an' }], '2026-11-04', {});
  assert.equal(groups.length, 2);
  assert.deepEqual(groups[0].who, ['tony', 'an']);
});
