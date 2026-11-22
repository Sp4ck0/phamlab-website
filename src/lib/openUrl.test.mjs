import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hashToOpen } from './openUrl.ts';

const ORIGIN = 'https://example.com';
const LINK = `${ORIGIN}/site/#/trip/synthetic?task=item%3Asynthetic`;

test('a notification link goes to its hash', () => {
  assert.equal(hashToOpen(LINK, ORIGIN, '#/trip/synthetic'), '#/trip/synthetic?task=item%3Asynthetic');
});

test('tapping the same link again is a new visit (a timestamp), so the page scrolls to it again', () => {
  assert.equal(hashToOpen(LINK, ORIGIN, '#/trip/synthetic?task=item%3Asynthetic', 123), '#/trip/synthetic?task=item%3Asynthetic&at=123');
  assert.equal(hashToOpen(`${ORIGIN}/site/#/trip/synthetic`, ORIGIN, '#/trip/synthetic', 5), '#/trip/synthetic?at=5');
  // A third tap: the page is at the timestamped address; the timestamp is replaced, not stacked.
  assert.equal(hashToOpen(LINK, ORIGIN, '#/trip/synthetic?task=item%3Asynthetic&at=123', 456), '#/trip/synthetic?task=item%3Asynthetic&at=456');
});

test('another site, no hash or a broken link: stay put', () => {
  assert.equal(hashToOpen('https://evil.example/#/trip/x', ORIGIN, ''), null);
  assert.equal(hashToOpen(`${ORIGIN}/site/`, ORIGIN, ''), null);
  assert.equal(hashToOpen('not a url', ORIGIN, ''), null);
});
