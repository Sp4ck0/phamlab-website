// Synthetic-only checks for the day timeline's ordering: hotels first, then untimed
// transport, then activities in stored order, with timed transport slotted among them.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildTimeline, departureTime, timelineSpans } from './timeline.ts';

const DATE = '2040-01-10';
const same = (item) => ({ item, state: 'same' });
const hotel = (name, extra = {}) => same({ name, srcs: [`${DATE}|h|${name}|a`], checkIn: true, checkOut: false, statuses: ['booked'], who: ['a'], ...extra });
const flight = (id, depart, extra = {}) =>
  same({ route: id, ids: [`${DATE}|f|${id}|a`], statuses: ['booked'], who: ['a'], segments: depart === undefined ? undefined : [{ depart }], ...extra });
const acts = (...list) => list.map((item, ai) => ({ item, state: 'same', ai }));
const build = (input) => buildTimeline({ date: DATE, hotels: [], flights: [], acts: [], gaps: [], tour: false, ...input });
const keys = (entries) => entries.map((e) => e.key);

test('departureTime only counts a time on this day', () => {
  assert.equal(departureTime({ segments: [{ depart: `${DATE}T09:30` }] }, DATE), '09:30');
  assert.equal(departureTime({ segments: [{ depart: DATE }] }, DATE), undefined); // a bare day: no time known
  assert.equal(departureTime({ segments: [{ depart: '2040-01-11T09:30' }] }, DATE), undefined); // another day
  assert.equal(departureTime({ legs: [{ time: '09:30' }] }, DATE), undefined); // legacy free text
  assert.equal(departureTime({}, DATE), undefined);
});

test('hotels come first, the hotel being left before the others', () => {
  const stay = hotel('Stay A', { checkIn: false, checkOut: true });
  const incoming = hotel('Stay B');
  const out = build({ hotels: [incoming, stay], flights: [flight('F1')], acts: acts({ text: 'x' }) });
  assert.deepEqual(keys(out), [stay.item.srcs[0], incoming.item.srcs[0], `${DATE}|f|F1|a`, 'act:0']);
});

test('a day with no times keeps today\'s order: transport, then activities, in data order', () => {
  const out = build({ flights: [flight('F1'), flight('F2')], acts: acts('plain', { text: 'b' }, { text: 'c' }) });
  assert.deepEqual(keys(out), [`${DATE}|f|F1|a`, `${DATE}|f|F2|a`, 'act:0', 'act:1', 'act:2']);
});

test('untimed activities never move, even next to timed ones', () => {
  const out = build({ acts: acts({ time: '09:00', text: 'a' }, 'untimed one', { time: '12:00', text: 'b' }, 'untimed two') });
  assert.deepEqual(keys(out), ['act:0', 'act:1', 'act:2', 'act:3']);
});

test('timed transport slots in before the first activity that starts later', () => {
  const out = build({
    flights: [flight('F1', `${DATE}T11:00`)],
    acts: acts({ time: '09:00', text: 'a' }, { time: '13:00', text: 'b' }),
  });
  assert.deepEqual(keys(out), ['act:0', `${DATE}|f|F1|a`, 'act:1']);
  assert.equal(out[1].time, '11:00');
});

test('timed transport after the last timed activity goes before trailing untimed ones', () => {
  const out = build({
    flights: [flight('F1', `${DATE}T20:00`)],
    acts: acts({ time: '09:00', text: 'a' }, 'untimed'),
  });
  assert.deepEqual(keys(out), ['act:0', `${DATE}|f|F1|a`, 'act:1']);
});

test('an equal time sorts the transport after the activity', () => {
  const out = build({ flights: [flight('F1', `${DATE}T13:00`)], acts: acts({ time: '13:00', text: 'a' }, { time: '15:00', text: 'b' }) });
  assert.deepEqual(keys(out), ['act:0', `${DATE}|f|F1|a`, 'act:1']);
});

test('timed transport with no timed activity closes the transport block, after untimed transport', () => {
  const out = build({
    flights: [flight('Late', `${DATE}T18:00`), flight('Open'), flight('Early', `${DATE}T08:00`)],
    acts: acts('plain'),
  });
  assert.deepEqual(keys(out), [`${DATE}|f|Open|a`, `${DATE}|f|Early|a`, `${DATE}|f|Late|a`, 'act:0']);
});

test('transport departing on another day, or with only a legacy time, is untimed and stays put', () => {
  const out = build({
    flights: [flight('Next', '2040-01-11T07:00'), flight('Legacy', undefined, { legs: [{ route: 'x', time: '07:00' }] })],
    acts: acts({ time: '09:00', text: 'a' }),
  });
  assert.deepEqual(keys(out), [`${DATE}|f|Next|a`, `${DATE}|f|Legacy|a`, 'act:0']);
});

test('placeholders and the tour close the day', () => {
  const out = build({ acts: acts({ text: 'a' }), gaps: [{ key: 'transport:x' }], tour: true });
  assert.deepEqual(keys(out), ['act:0', 'gap:transport:x', 'tour']);
});

test('a removed ghost keeps its place but has no element id, and its key cannot clash', () => {
  const gone = { item: { name: 'Old', srcs: [`${DATE}|h|Old|a`], checkIn: true, checkOut: false }, state: 'gone' };
  const out = build({ hotels: [gone, hotel('New')], acts: [{ item: { text: 'old' }, state: 'gone', ai: -1 }, ...acts({ text: 'new' })] });
  assert.equal(out[0].domKey, undefined);
  assert.equal(out[0].key, 'gone:hotel:0');
  const ghostAct = out.find((e) => e.key.startsWith('gone:act'));
  assert.equal(ghostAct.domKey, undefined);
  assert.equal(new Set(keys(out)).size, out.length);
});

test('spans: activities by their window, transport from departure to arrival, untimed and ghosts left out', () => {
  const dayActs = [{ tag: 'Food', time: '09:00', text: 'a' }, 'untimed'];
  const out = build({
    flights: [
      flight('Ferry', `${DATE}T11:00`, { segments: [{ depart: `${DATE}T11:00`, arrive: `${DATE}T11:45` }] }),
      flight('Night', `${DATE}T22:00`, { segments: [{ depart: `${DATE}T22:00`, arrive: '2040-01-11T06:00' }] }),
      flight('Open', `${DATE}T20:00`),
      flight('Untimed'),
    ],
    acts: acts(...dayActs),
  });
  const spans = timelineSpans(out, { date: DATE, acts: dayActs });
  assert.deepEqual(spans.map((s) => [s.key, s.start, s.end]), [
    ['act:0', 540, 630], // Food: 90 minutes
    [`${DATE}|f|Ferry|a`, 660, 705],
    [`${DATE}|f|Open|a`, 1200, 1200], // no arrival: a moment
    [`${DATE}|f|Night|a`, 1320, 1440], // lands tomorrow: to the end of today
  ]);
});

test('to-dos and considerations: a timed one slots in by time like transport; untimed ones follow the activities', () => {
  const items = [{ id: 'late', time: '21:00' }, { id: 'open' }, { id: 'noon', time: '12:00' }];
  const out = build({ flights: [flight('F1', `${DATE}T12:00`)], acts: acts({ time: '09:00', text: 'a' }, { time: '15:00', text: 'b' }, 'untimed'), items, tour: true });
  assert.deepEqual(keys(out), ['act:0', `${DATE}|f|F1|a`, 'item:noon', 'act:1', 'item:late', 'act:2', 'item:open', 'tour']);
  assert.equal(out.find((e) => e.key === 'item:noon').time, '12:00');
  // With no timed activity, timed items still come after the activities, in time order.
  const flat = build({ acts: acts('plain'), items: [{ id: 'b', time: '18:00' }, { id: 'a', time: '08:00' }, { id: 'c' }] });
  assert.deepEqual(keys(flat), ['act:0', 'item:a', 'item:b', 'item:c']);
});

test('a day with nothing planned gets a placeholder where the activities would be: after transport, before untimed items', () => {
  const out = build({ hotels: [hotel('Stay')], flights: [flight('F1')], items: [{ id: 'later' }], plan: true, tour: true });
  assert.deepEqual(keys(out), [`${DATE}|h|Stay|a`, `${DATE}|f|F1|a`, 'plan', 'item:later', 'tour']);
});

test('all-day activities come right after the hotels, before untimed transport, in data order', () => {
  const stay = hotel('Stay A');
  const out = build({ hotels: [stay], flights: [flight('F1')], acts: acts({ time: '09:00', text: 'a' }, { allDay: true, text: 'whole' }, 'untimed', { allDay: true, text: 'fest' }) });
  assert.deepEqual(keys(out), [stay.item.srcs[0], 'act:1', 'act:3', `${DATE}|f|F1|a`, 'act:0', 'act:2']);
});

