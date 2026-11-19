// Synthetic-only checks for the "next up" countdown and the small transport helpers.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveDays } from './tripLogic.ts';
import { countdownText, nextUp } from './nextUp.ts';
import { routeSearchUrl, terminalText } from './segments.ts';

const at = (iso) => Date.parse(`${iso}:00`); // wall-clock, like the helper
const day = { city: 'Synthetic City', country: 'JP', highlight: 'x', flights: [], hotels: 'same', acts: ['x'] };
const train = (departISO, extra = {}) => ({ who: 'all', route: 'Synthetic A → Synthetic B', mode: 'train', status: 'booked', segments: [{ from: 'Synthetic A', to: 'Synthetic B', carrier: 'Rail', depart: departISO, arrive: departISO.slice(0, 11) + '23:00' }], ...extra });
const days = (rows, hotels = 'same') =>
  resolveDays({ days: [
    { ...day, date: '2040-01-02', flights: rows, hotels: hotels === 'same' ? [] : hotels },
    { ...day, date: '2040-01-03', hotels: 'same' },
    { ...day, date: '2040-01-04', hotels: 'same' },
  ] });

test('the next up is the soonest booked departure or check-in after now, only while the trip is under way', () => {
  const d = days([train('2040-01-02T10:00'), train('2040-01-02T18:00', { route: 'Synthetic B → Synthetic C' })]);
  assert.equal(nextUp(d, at('2040-01-02T08:00')).at, '2040-01-02T10:00');
  assert.equal(nextUp(d, at('2040-01-02T12:00')).at, '2040-01-02T18:00'); // the first has left
  assert.equal(nextUp(d, at('2040-01-02T19:00')), null); // nothing with a time is left
  assert.equal(nextUp(d, at('2039-12-31T08:00')), null); // before the trip
  assert.equal(nextUp(d, at('2040-01-05T08:00')), null); // after it
});

test('an unbooked or maybe-less row and a time-less hop are never next up; a check-in with a time is', () => {
  const needed = days([train('2040-01-02T10:00', { status: 'needed' })]);
  assert.equal(nextUp(needed, at('2040-01-02T08:00')), null);
  const dayOnly = days([train('2040-01-02')]);
  assert.equal(nextUp(dayOnly, at('2040-01-02T08:00')), null);
  const stay = days([], [{ who: 'all', name: 'Synthetic Hotel', address: 'x', status: 'booked', checkInTime: '15:00' }]);
  const up = nextUp(stay, at('2040-01-02T08:00'));
  assert.deepEqual({ kind: up.kind, at: up.at }, { kind: 'checkin', at: '2040-01-02T15:00' });
  assert.equal(up.id, stay[0].hotels[0].src);
});

test('the countdown reads in minutes, hours and days', () => {
  const dep = { id: 'x', kind: 'depart', at: '2040-01-02T10:00' };
  assert.equal(countdownText(dep, at('2040-01-02T09:15')), 'Departs in 45 min');
  assert.equal(countdownText(dep, at('2040-01-02T07:50')), 'Departs in 2 h 10 min');
  assert.equal(countdownText(dep, at('2040-01-02T08:00')), 'Departs in 2 h');
  assert.equal(countdownText(dep, at('2039-12-31T10:00')), 'Departs in 2 days');
  assert.equal(countdownText(dep, at('2040-01-02T10:00')), 'Departs now');
  assert.equal(countdownText({ ...dep, kind: 'checkin' }, at('2040-01-02T09:00')), 'Check-in in 1 h');
});

test('a bare platform, pier or stop is labelled by mode; worded text is left alone', () => {
  assert.equal(terminalText('train', '4'), 'Platform 4');
  assert.equal(terminalText('ferry', '2B'), 'Pier 2B');
  assert.equal(terminalText('bus', '7'), 'Stop 7');
  assert.equal(terminalText('train', 'Platform 4'), 'Platform 4');
  assert.equal(terminalText('train', 'Upper level'), 'Upper level');
});

test('the route search link is Google Maps transit directions between the two places', () => {
  const u = new URL(routeSearchUrl('Synthetic A', 'Synthetic B'));
  assert.equal(u.origin + u.pathname, 'https://www.google.com/maps/dir/');
  assert.equal(u.searchParams.get('origin'), 'Synthetic A');
  assert.equal(u.searchParams.get('destination'), 'Synthetic B');
  assert.equal(u.searchParams.get('travelmode'), 'transit');
});
