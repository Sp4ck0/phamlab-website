// The phone bars ride the page's own scrolling; these are the placements done at the hand-overs.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { headerOffset, releaseOffset, settleShown, stackOffsets } from './hideBars.ts';

test('released, a bar keeps exactly where it is on screen, and is never pulled above its place in the page', () => {
  assert.equal(releaseOffset(56, -200), 256); // pinned under the site bar, its place long scrolled by
  assert.equal(releaseOffset(56, 56), 0); // at the top of the page: already in its place
  assert.equal(releaseOffset(300, 340), 0); // still further down the page than the pin line
});

test('stacked just hidden behind the site bar, or fully shown under it', () => {
  const bars = [{ natural: -900, height: 56 }, { natural: -844, height: 67 }];
  assert.deepEqual(stackOffsets(bars, 56, 'bottom'), [56 - 123 + 900, 56 - 67 + 844]); // bottom at 56
  assert.deepEqual(stackOffsets(bars, 56, 'top'), [956, 956]); // tabs at 56, strip right under them
  // Near the top of the page the date strip is still in its place, lower down: it stays there.
  assert.deepEqual(stackOffsets([{ natural: 20, height: 56 }, { natural: 400, height: 67 }], 56, 'bottom'), [0, 0]);
});

test('when scrolling stops halfway they settle to the nearer end', () => {
  assert.equal(settleShown(40, 123), true);
  assert.equal(settleShown(80, 123), false);
});

test('a pinned day header sits under what is left of the bars, but never leaves its day or moves up', () => {
  assert.equal(headerOffset(56, 139, 900), 83); // bars partly shown: under the strip's bottom
  assert.equal(headerOffset(56, 56, 900), 0); // bars gone: at the site bar
  assert.equal(headerOffset(300, 139, 900), 0); // not pinned yet: left where it is
  assert.equal(headerOffset(40, 139, 100), 60); // its day is ending: pushed up with it
});
