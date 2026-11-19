// Synthetic-only checks for lib/stay.ts: the stay a tile belongs to, per-night price, the gap on a move day, directions.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveDays } from './tripLogic.ts';
import { fmtMoney, gapMinutes, priceText, stayInfo } from './stay.ts';

const day = (date, hotels) => ({ date, city: 'Synthetic city', country: 'JP', flights: [], hotels, acts: ['x'], highlight: 'x' });
const H = (name, extra = {}) => ({ who: 'all', name, address: 'Synthetic street', status: 'booked', ...extra });

// Three nights: in on the 2nd, carried the 3rd and 4th, out on the 5th.
const days = resolveDays({ days: [day('2040-01-02', [H('Synthetic Hotel')]), day('2040-01-03', 'same'), day('2040-01-04', 'same'), day('2040-01-05', [H('Synthetic Hotel')])] });

test('every day of a stay knows the stay: its length, which night it is, and whether it is the first or last day', () => {
  const at = (i) => stayInfo(days, i, 'Synthetic Hotel');
  assert.deepEqual(at(0), { checkIn: '2040-01-02', checkOut: '2040-01-05', nights: 3, night: 1, isCheckInDay: true, isCheckOutDay: false });
  assert.equal(at(1).night, 2);
  assert.equal(at(2).night, 3);
  assert.deepEqual([at(3).night, at(3).isCheckOutDay, at(3).isCheckInDay], [3, true, false]); // the check-out day shows the whole stay done
  assert.ok([0, 1, 2, 3].every((i) => at(i).nights === 3 && at(i).checkIn === '2040-01-02'));
});

test('a same-day stay, an unnamed hotel and a missing day have no stay to show', () => {
  const single = resolveDays({ days: [day('2040-01-02', [H('Synthetic Hotel')])] });
  assert.equal(stayInfo(single, 0, 'Synthetic Hotel'), null);
  assert.equal(stayInfo(days, 0, ''), null);
  assert.equal(stayInfo(days, 9, 'Synthetic Hotel'), null);
});

test('price: the total and per-night figure when both are known, only what the source says otherwise', () => {
  assert.equal(fmtMoney(1098.92, 'USD'), '$1,098.92');
  assert.equal(fmtMoney(366.3067, 'USD', true), '$366');
  assert.ok(fmtMoney(5, 'ZZZ').includes('ZZZ') && fmtMoney(5, 'ZZZ').includes('5')); // an unknown code still shows, never throws
  assert.equal(priceText({ amount: 900, currency: 'USD', per: 'stay' }, 3), '$900.00 total · $300 / night');
  assert.equal(priceText({ amount: 300, currency: 'USD', per: 'night' }, 3), '$300.00 / night · $900.00 total');
  assert.equal(priceText({ amount: 900, currency: 'USD', per: 'stay' }, undefined), '$900.00 total'); // no length, no per-night figure
  assert.equal(priceText({ amount: 109.05, currency: 'USD' }, 3), '$109.05'); // basis unknown: shown as given, never divided
});

test('the wait between leaving one hotel and getting into the next', () => {
  assert.equal(gapMinutes('11:00', '15:00'), 240);
  assert.equal(gapMinutes('11:00', '11:00'), 0);
  assert.equal(gapMinutes('15:00', '11:00'), null); // arriving before leaving is not a gap
  assert.equal(gapMinutes(undefined, '15:00'), null);
});
