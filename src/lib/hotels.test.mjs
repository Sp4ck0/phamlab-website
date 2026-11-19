// Synthetic-only checks for stay-level hotel facts, the stay's calendar link and the "Missing details" gap helpers.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mergeHotelsByName, resolveDays } from './tripLogic.ts';
import { hotelUrl } from './calendar.ts';
import { dayGaps, gapDates, kindLabel } from './tasks.ts';
import { fmtHm } from './segments.ts';

const stayDay = (date, hotels) => ({ date, city: 'Tokyo', country: 'JP', flights: [], hotels, acts: ['Synthetic activity'], highlight: 'x' });
const H = (extra = {}) => ({ who: 'all', name: 'Synthetic Hotel', address: 'Synthetic street', status: 'booked', ...extra });

// Night 1 (facts typed here), a carried night, the check-out day (its own entry), a gap, then a separate later stay at the same name.
const trip = { days: [
  stayDay('2040-01-02', [H({ checkInTime: '15:00', room: 'Synthetic twin' })]),
  stayDay('2040-01-03', 'same'),
  stayDay('2040-01-04', [H({ checkOutTime: '11:00', confirmation: 'SYNTH1' })]),
  stayDay('2040-01-05', []),
  stayDay('2040-01-06', [H({ checkInTime: '12:00' })]),
] };

test('a stay shares its facts across every entry of the run, whichever day they were typed on', () => {
  const [d1, d2, d3] = resolveDays(trip).map((d) => d.hotels[0]);
  for (const h of [d1, d2, d3]) {
    assert.equal(h.checkInTime, '15:00');
    assert.equal(h.checkOutTime, '11:00');
    assert.equal(h.room, 'Synthetic twin');
    assert.equal(h.confirmation, 'SYNTH1'); // typed on the last day, found by the first
  }
  assert.equal(d2.carried, true);
});

test('a later stay at the same hotel name is a separate run and keeps its own facts', () => {
  const [d1, , , , d5] = resolveDays(trip).map((d) => d.hotels[0]);
  assert.equal(d5.checkInTime, '12:00');
  assert.equal(d5.confirmation, undefined);
  assert.equal(d1.checkInTime, '15:00');
});

test('the merged tile carries the facts and the first confirmation found', () => {
  const day = resolveDays(trip)[0];
  const [g] = mergeHotelsByName([day.hotels[0], { ...day.hotels[0], who: 'tony', src: 'b', confirmation: undefined }], {});
  assert.equal(g.checkInTime, '15:00');
  assert.equal(g.room, 'Synthetic twin');
  assert.equal(g.confirmation, 'SYNTH1');
});

test('the stay is a timed calendar event when both times are known, else all-day', () => {
  const days = resolveDays(trip);
  const timed = new URL(hotelUrl('Synthetic Hotel', 'Synthetic street', days, 0)).searchParams;
  assert.equal(timed.get('dates'), '20400102T150000/20400104T110000'); // 15:00 on the 2nd to 11:00 on the 4th, in Tokyo
  const noTimes = resolveDays({ days: [stayDay('2040-01-02', [H()]), stayDay('2040-01-03', 'same'), stayDay('2040-01-04', [H()])] });
  assert.equal(new URL(hotelUrl('Synthetic Hotel', 'Synthetic street', noTimes, 0)).searchParams.get('dates'), '20400102/20400105');
});

test('hotel times are shown in 24-hour time', () => {
  assert.equal(fmtHm('15:00'), '15:00');
  assert.equal(fmtHm('00:05'), '00:05');
  assert.equal(fmtHm('9:30'), '09:30'); // zero-padded so columns of times line up
});

test('a "Missing details" task marks its day as a gap until it is dismissed, and lists on its tile', () => {
  const task = (refsDone) => ({ kind: 'details', key: 'details:2040-01-02|f|Synthetic route|all', refs: ['details:2040-01-02|f|Synthetic route|all'], refsDone, done: refsDone[0], scope: { kind: 'day', date: '2040-01-02' } });
  assert.deepEqual([...gapDates([task([false])])], ['2040-01-02']);
  assert.deepEqual([...gapDates([task([true])])], []);
  assert.equal(dayGaps([task([false])])['2040-01-02'].details.length, 1);
  assert.equal(dayGaps([task([true])])['2040-01-02'], undefined);
  assert.equal(kindLabel(task([false])), 'Missing details');
});

test('an unbooked hotel stay is a gap on every night, including the carried ones between its entries', () => {
  const stay = (refsDone) => ({ kind: 'booking', mode: 'hotel', key: 'booking:2040-01-02|h|Synthetic|all', refs: ['booking:2040-01-02|h|Synthetic|all', 'booking:2040-01-05|h|Synthetic|all'], refsDone, done: refsDone.every(Boolean), scope: { kind: 'range', start: '2040-01-02', end: '2040-01-05' } });
  assert.deepEqual([...gapDates([stay([false, false])])].sort(), ['2040-01-02', '2040-01-03', '2040-01-04', '2040-01-05']);
  assert.deepEqual([...gapDates([stay([true, true])])], []);
  assert.deepEqual([...gapDates([stay([true, false])])], ['2040-01-05']); // only the open night
});
