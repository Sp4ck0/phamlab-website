// Synthetic-only checks for the "now" marker: it follows the destination's clock, not the viewer's.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isDestToday, nowPosition, untilText, viewerHint } from './nowMarker.ts';

const bkk = (hhmm) => Date.parse(`2040-01-10T${hhmm}:00+07:00`); // a Bangkok wall-clock instant
const day = (acts, country = 'TH') => ({ date: '2040-01-10', city: 'Synthetic City', country, acts });
const acts = [
  { tag: 'Food', time: '09:00', text: 'a' }, // 90 min -> 10:30
  { tag: 'Sightsee', time: '12:00', text: 'b' }, // 120 min -> 14:00
  { tag: 'Activity', time: '16:00', text: 'c' }, // 120 min -> 18:00
  'plain, untimed',
];

test('before, during, between and after, read from the destination clock', () => {
  const d = day(acts);
  assert.deepEqual(nowPosition(d, bkk('07:10')), { kind: 'before', beforeKey: 'act:0', hhmm: '07:10', next: { hhmm: '09:00', inMin: 110 } });
  assert.deepEqual(nowPosition(d, bkk('09:30')), { kind: 'during', key: 'act:0', hhmm: '09:30', progress: 1 / 3 });
  assert.deepEqual(nowPosition(d, bkk('15:00')), { kind: 'between', beforeKey: 'act:2', hhmm: '15:00', next: { hhmm: '16:00', inMin: 60 } });
  assert.deepEqual(nowPosition(d, bkk('22:00')), { kind: 'after', afterKey: 'act:2', hhmm: '22:00' });
});

test('an activity ends exactly at its end: that minute is between, not during', () => {
  assert.equal(nowPosition(day(acts), bkk('10:30')).kind, 'between');
});

test('an explicit endTime is honoured', () => {
  const d = day([{ tag: 'Food', time: '09:00', endTime: '11:00', text: 'a' }, { time: '12:00', text: 'b' }]);
  assert.equal(nowPosition(d, bkk('10:45')).kind, 'during');
});

test('progress runs from 0 at the start toward 1 at the end', () => {
  assert.equal(nowPosition(day(acts), bkk('09:00')).progress, 0);
  assert.equal(nowPosition(day(acts), bkk('09:45')).progress, 0.5);
});

test('a day with no timed activities still gets a line; no known zone gets none', () => {
  assert.deepEqual(nowPosition(day(['x', { text: 'y' }]), bkk('10:00')), { kind: 'untimed', hhmm: '10:00' });
  assert.deepEqual(nowPosition(day([]), bkk('10:00')), { kind: 'untimed', hhmm: '10:00' });
  assert.equal(nowPosition(day(acts, 'ZZ'), bkk('10:00')), null);
});

test('today is the destination date, whatever the viewer\'s zone', () => {
  // 03:00 on Jan 10 in Bangkok is still Jan 9 in Los Angeles.
  assert.equal(isDestToday(day(acts), bkk('03:00')), true);
  assert.equal(isDestToday(day(acts), bkk('03:00') - 8 * 3600_000), false); // Jan 9 19:00 Bangkok
});

test('a day with no zone falls back to the viewer\'s date', () => {
  const noon = new Date(2040, 0, 10, 12, 0).getTime(); // viewer-local noon
  assert.equal(isDestToday(day(acts, 'ZZ'), noon), true);
});

test('viewerHint is null for no zone and a clock string otherwise', () => {
  assert.equal(viewerHint(bkk('12:00'), null), null);
  const mine = Intl.DateTimeFormat().resolvedOptions().timeZone;
  assert.equal(viewerHint(bkk('12:00'), mine), null); // same zone: nothing to add
  // Honolulu is 5-17 hours from any viewer except one in Honolulu itself, whose clock matches.
  if (mine !== 'Pacific/Honolulu') assert.match(viewerHint(bkk('12:00'), 'Pacific/Honolulu'), /^\d{1,2}:\d{2} [ap]m$/);
});

test('untilText', () => {
  assert.equal(untilText(110), '1h 50m');
  assert.equal(untilText(120), '2h');
  assert.equal(untilText(28), '28m');
});

test('spans other than activities place "now" too: a transport tile under way is during, keyed by its own key', () => {
  const d = day(acts);
  const spans = [{ key: 'act:0', start: 9 * 60, end: 10 * 60 + 30 }, { key: 'ferry', start: 11 * 60, end: 11 * 60 + 45 }, { key: 'act:1', start: 12 * 60, end: 14 * 60 }];
  assert.deepEqual(nowPosition(d, bkk('11:15'), spans), { kind: 'during', key: 'ferry', hhmm: '11:15', progress: 1 / 3 });
  assert.deepEqual(nowPosition(d, bkk('10:45'), spans).beforeKey, 'ferry');
  // A moment (no arrival known) is never "during": just a point to be before or after.
  const point = [{ key: 'train', start: 8 * 60, end: 8 * 60 }];
  assert.deepEqual(nowPosition(d, bkk('08:00'), point), { kind: 'after', afterKey: 'train', hhmm: '08:00' });
  assert.deepEqual(nowPosition(d, bkk('07:00'), [...point].reverse()).kind, 'before');
  assert.deepEqual(nowPosition(d, bkk('10:00'), []), { kind: 'untimed', hhmm: '10:00' });
});
