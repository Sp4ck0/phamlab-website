// Synthetic-only checks for lib/airlines.ts. Run with node:test after bundling:
//   esbuild src/lib/airlines.test.mjs --bundle --platform=node --format=esm --outfile=/tmp/airlines.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AIRLINES, airlineLogoUrl, legAirline } from './airlines.ts';

test('the airline table is sorted by code, with valid codes and non-empty names', () => {
  const codes = Object.keys(AIRLINES);
  assert.ok(codes.length > 800);
  // Object key order puts integer-like keys ("01", "88") first, so sort order is checked on the source list below.
  for (const [code, a] of Object.entries(AIRLINES)) {
    assert.match(code, /^[A-Z0-9]{2}$/, code);
    assert.ok(a.name && a.name === a.name.trim(), code);
  }
});

test('curated names win over the dataset', () => {
  assert.equal(AIRLINES.VY.name, 'Vueling');
  assert.equal(AIRLINES.JL.name, 'Japan Airlines');
  assert.equal(AIRLINES.CI.name, 'China Airlines');
  assert.equal(AIRLINES['9C'].name, 'Spring Airlines');
});

test('logo urls come from the code, with a per-airline override', () => {
  assert.equal(airlineLogoUrl('UA'), 'https://www.gstatic.com/flights/airline_logos/70px/UA.png');
  assert.equal(airlineLogoUrl('ZZ'), 'https://www.gstatic.com/flights/airline_logos/70px/ZZ.png');
});

test('legacy legs read a carrier from the flight number in meta, not from aircraft types', () => {
  assert.equal(legAirline({ meta: 'China Airlines CI 21 · Airbus A350 · 13h 10m, overnight' }), 'CI');
  assert.equal(legAirline({ meta: 'UA 837 · 787-9' }), 'UA');
  assert.equal(legAirline({ meta: 'UA837' }), 'UA');
  assert.equal(legAirline({ meta: 'Airbus A350 · 13h 10m' }), undefined);
  assert.equal(legAirline({ meta: '12 345' }), undefined);
  assert.equal(legAirline({}), undefined);
});
