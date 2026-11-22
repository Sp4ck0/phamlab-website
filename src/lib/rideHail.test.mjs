// Synthetic-only checks for the Grab / Uber ride links and where each app is offered.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { grabUrl, rideAppsFor, uberUrl } from './rideHail.ts';

const spot = { lat: 1.5, lng: 103.25, name: 'Synthetic Cafe & Bar', address: '1 Test Road' };

test('Grab is offered where it runs and not elsewhere', () => {
  assert.deepEqual(rideAppsFor(['TH']), ['grab']);
  assert.ok(!rideAppsFor(['US']).includes('grab'));
  assert.ok(!rideAppsFor(['FR']).includes('grab'));
});

test('Uber is offered where it runs and not elsewhere', () => {
  assert.deepEqual(rideAppsFor(['US']), ['uber']);
  assert.ok(!rideAppsFor(['VN']).includes('uber'));
});

test('China offers DiDi, which has no link of its own', () => {
  assert.deepEqual(rideAppsFor(['CN']), ['didi']);
  assert.deepEqual(rideAppsFor(['US', 'CN']), ['didi', 'uber']);
});

test('a travel day offers the apps of both its countries, and codes are case-insensitive', () => {
  assert.deepEqual(rideAppsFor(['us', 'TH']), ['grab', 'uber']);
  assert.deepEqual(rideAppsFor([undefined, 'sg']), ['grab']);
  assert.deepEqual(rideAppsFor([]), []);
  assert.deepEqual(rideAppsFor(['ZZ']), []);
});

test('the Grab link is the tested booking link: a drop-off only, with spaces as %20', () => {
  const url = grabUrl(spot);
  assert.ok(url.startsWith('grab://open?'));
  assert.ok(url.includes('%20') && !url.includes('+'));
  const q = new URL(url).searchParams;
  assert.equal(q.get('screenType'), 'BOOKING');
  assert.equal(q.get('dropOffLatitude'), '1.5');
  assert.equal(q.get('dropOffLongitude'), '103.25');
  assert.equal(q.get('dropOffKeywords'), 'Synthetic Cafe & Bar');
  assert.ok(![...q.keys()].some((k) => k.startsWith('pickUp') || k.startsWith('pickup')));
});

test('the Uber link picks you up where you are and drops off at the place', () => {
  const u = new URL(uberUrl(spot));
  assert.equal(u.origin + u.pathname, 'https://m.uber.com/ul/');
  assert.equal(u.searchParams.get('action'), 'setPickup');
  assert.equal(u.searchParams.get('pickup'), 'my_location');
  assert.equal(u.searchParams.get('dropoff[latitude]'), '1.5');
  assert.equal(u.searchParams.get('dropoff[longitude]'), '103.25');
  assert.equal(u.searchParams.get('dropoff[nickname]'), 'Synthetic Cafe & Bar');
  assert.equal(u.searchParams.get('dropoff[formatted_address]'), '1 Test Road');
  assert.equal(new URL(uberUrl({ ...spot, address: undefined })).searchParams.get('dropoff[formatted_address]'), null);
});
