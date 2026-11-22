// The phone bars follow the reader's scrolling: the shift is how far they have slid up under the site bar.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { nextShift, settleTarget } from './hideBars.ts';

const H = 120; // tabs + date strip

test('they move 1:1 with the scroll, both ways, and a partial scroll leaves them partly shown', () => {
  let s = nextShift(0, 30, 530, H); // down 30
  assert.equal(s, 30);
  s = nextShift(s, 45, 575, H); // down 45 more
  assert.equal(s, 75);
  s = nextShift(s, -20, 555, H); // up 20: 20px of them comes back
  assert.equal(s, 55);
});

test('they stop at fully shown and fully hidden', () => {
  assert.equal(nextShift(100, 80, 900, H), H);
  assert.equal(nextShift(10, -80, 800, H), 0);
});

test('never hidden further than the page has been scrolled, so at the top they are all there', () => {
  assert.equal(nextShift(0, 40, 40, H), 40);
  assert.equal(nextShift(90, -60, 30, H), 30);
  assert.equal(nextShift(50, -70, 0, H), 0);
  assert.equal(nextShift(50, -90, -30, H), 0); // iOS bounces past the top
});

test('when scrolling stops halfway they settle to the nearer end', () => {
  assert.equal(settleTarget(40, H), 0);
  assert.equal(settleTarget(70, H), H);
  assert.equal(settleTarget(0, H), 0);
  assert.equal(settleTarget(H, H), H);
  assert.equal(settleTarget(90, 50), 50); // near the top, fully hidden is only as far as scrolled
});
