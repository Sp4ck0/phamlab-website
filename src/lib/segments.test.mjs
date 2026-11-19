// Synthetic-only checks for lib/segments.ts and segmentUrl. Run with node:test
// after bundling (the sources import each other without extensions):
//   esbuild src/lib/segments.test.mjs --bundle --platform=node --format=esm --outfile=/tmp/segments.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dayOffset, durationMin, fmtClock, fmtDate, fmtDuration, layoverMin, segmentLabel, segmentLine } from './segments.ts';
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
  assert.equal(fmtClock('2026-11-04T00:10'), '12:10 AM');
  assert.equal(fmtClock('2026-11-04T12:00'), '12:00 PM');
  assert.equal(fmtClock('2026-11-04T15:05'), '3:05 PM');
  assert.equal(fmtDate('2026-11-04'), 'Wed, Nov 4');
  assert.equal(fmtDuration(790), '13h 10m');
  assert.equal(fmtDuration(180), '3h');
  assert.equal(fmtDuration(45), '45m');
  assert.equal(segmentLabel(overnight), 'CI 21');
  assert.equal(segmentLabel({ from: 'A', to: 'B', carrier: 'Seatran' }), 'Seatran');
  assert.equal(segmentLine(overnight), 'CI 21 · SEA 12:10 AM → TPE 5:20 AM +1 · 13h 10m');
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

test('two different flights on the same route and day are not merged', () => {
  const f = (number, depart) => ({ who: 'tony', route: 'SEA → TPE', status: 'booked', segments: [{ ...overnight, number, depart }] });
  const groups = mergeFlightsByRoute([f('21', '2026-11-04T00:10'), f('23', '2026-11-04T13:00'), { ...f('21', '2026-11-04T00:10'), who: 'an' }], '2026-11-04', {});
  assert.equal(groups.length, 2);
  assert.deepEqual(groups[0].who, ['tony', 'an']);
});
