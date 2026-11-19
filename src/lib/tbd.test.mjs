// Synthetic-only. The table below is the same one as tests/rules.test.ts in the backend
// (missingTransportFields): the two implementations must give identical answers.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { missingHotelFields, missingTransportFields } from './tbd.ts';

const full = { from: 'SEA', to: 'TPE', airline: 'CI', number: '21', depart: '2026-11-04T00:10', arrive: '2026-11-05T05:20' };
const cases = [
  ['a flight with nothing structured', { segments: undefined }, ['route details']],
  ['an empty segments list', { segments: [] }, ['route details']],
  ['a complete flight', { segments: [full] }, []],
  ['a flight missing airline and number', { segments: [{ ...full, airline: undefined, number: undefined }] }, ['airline', 'flight number']],
  ['a flight missing both times', { segments: [{ ...full, depart: undefined, arrive: undefined }] }, ['depart time', 'arrive time']],
  ['a ferry with an operator and times (number optional)', { mode: 'ferry', segments: [{ from: 'A', to: 'B', carrier: 'Seatran', depart: '2023-03-06T09:30', arrive: '2023-03-06T10:15' }] }, []],
  ['a train without an operator', { mode: 'train', segments: [{ from: 'A', to: 'B', depart: '2023-03-06T09:30', arrive: '2023-03-06T10:15' }] }, ['operator']],
  ["a hop's own mode wins over the booking's", { segments: [{ from: 'A', to: 'B', mode: 'ferry', depart: '2023-03-06T09:30', arrive: '2023-03-06T10:15' }, full] }, ['operator']],
  ['the same gap on two hops is named once', { segments: [{ ...full, number: undefined }, { ...full, number: undefined }] }, ['flight number']],
];
for (const [name, flight, expected] of cases) {
  test(`missingTransportFields: ${name}`, () => assert.deepEqual(missingTransportFields(flight), expected));
}

test('a not-booked hotel is undecided until it has an address or place id', () => {
  assert.deepEqual(missingHotelFields({}), ['hotel']);
  assert.deepEqual(missingHotelFields({ address: 'Synthetic street' }), []);
  assert.deepEqual(missingHotelFields({ placeId: 'synthetic-id' }), []);
});
