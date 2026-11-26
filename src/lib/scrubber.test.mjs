import test from "node:test";
import assert from "node:assert/strict";
import { indexAtOffset, rampSpeed, steadyFinger } from "./scrubber.ts";

test("indexAtOffset picks the last day whose top is at or above the offset", () => {
  const tops = [0, 100, 3100];
  assert.equal(indexAtOffset(0, tops), 0);
  assert.equal(indexAtOffset(98, tops), 0);
  assert.equal(indexAtOffset(100, tops), 1);
  assert.equal(indexAtOffset(2000, tops), 1);
  assert.equal(indexAtOffset(3200, tops), 2);
  assert.equal(indexAtOffset(5, []), 0);
});

test("rampSpeed: still in the dead zone, faster the farther out, capped, signed", () => {
  assert.equal(rampSpeed(0, 1000), 0);
  assert.equal(rampSpeed(10, 1000), 0);
  assert.equal(rampSpeed(-10, 1000), 0);
  assert.ok(rampSpeed(40, 1000) > 0 && rampSpeed(40, 1000) < rampSpeed(100, 1000));
  assert.equal(rampSpeed(150, 1000), 1000);
  assert.equal(rampSpeed(900, 1000), 1000);
  assert.equal(rampSpeed(-900, 1000), -1000);
});

test("steadyFinger follows a moving finger, ignores a stray leap, and takes a leap that keeps reading the same", () => {
  let s = { y: 300, held: null, count: 0 };
  for (const y of [310, 330, 360]) s = steadyFinger(s, y);
  assert.equal(s.y, 360);
  // One stray reading 200px off, then back: the finger never left.
  s = steadyFinger(s, 160);
  assert.equal(s.y, 360);
  s = steadyFinger(s, 365);
  assert.deepEqual(s, { y: 365, held: null, count: 0 });
  // Two strays that disagree with each other: still held.
  s = steadyFinger(steadyFinger(s, 100), 600);
  assert.equal(s.y, 365);
  // Three readings together out there: it really is there.
  s = steadyFinger(steadyFinger(steadyFinger(s, 150), 155), 160);
  assert.equal(s.y, 160);
});
