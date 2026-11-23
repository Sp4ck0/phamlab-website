import test from "node:test";
import assert from "node:assert/strict";
import { fractionOfIndex, indexAtPointer, fractionAtPointer, offsetAtFraction, fractionAtOffset, indexAtOffset, smoothDamp } from "./scrubber.ts";

test("fractionOfIndex spans the track and stays inside it", () => {
  assert.equal(fractionOfIndex(0, 10), 0);
  assert.equal(fractionOfIndex(9, 10), 1);
  assert.equal(fractionOfIndex(-3, 10), 0);
  assert.equal(fractionOfIndex(40, 10), 1);
  assert.equal(fractionOfIndex(0, 1), 0);
});

test("indexAtPointer maps a position to the nearest item and clamps beyond the ends", () => {
  assert.equal(indexAtPointer(100, 100, 200, 11), 0);
  assert.equal(indexAtPointer(200, 100, 200, 11), 5);
  assert.equal(indexAtPointer(300, 100, 200, 11), 10);
  assert.equal(indexAtPointer(0, 100, 200, 11), 0);
  assert.equal(indexAtPointer(999, 100, 200, 11), 10);
  assert.equal(indexAtPointer(150, 100, 0, 11), 0);
  assert.equal(indexAtPointer(150, 100, 200, 1), 0);
});

test("fractionAtPointer is the share along the track and clamps beyond the ends", () => {
  assert.equal(fractionAtPointer(150, 100, 200), 0.25);
  assert.equal(fractionAtPointer(0, 100, 200), 0);
  assert.equal(fractionAtPointer(999, 100, 200), 1);
  assert.equal(fractionAtPointer(150, 100, 0), 0);
});

test("offsetAtFraction and fractionAtOffset are inverses over the scroll range", () => {
  assert.equal(offsetAtFraction(0, 100, 1100), 100);
  assert.equal(offsetAtFraction(0.5, 100, 1100), 600);
  assert.equal(offsetAtFraction(2, 100, 1100), 1100);
  assert.equal(offsetAtFraction(0.5, 500, 300), 500);
  assert.equal(fractionAtOffset(600, 100, 1100), 0.5);
  assert.equal(fractionAtOffset(0, 100, 1100), 0);
  assert.equal(fractionAtOffset(9999, 100, 1100), 1);
  assert.equal(fractionAtOffset(50, 500, 300), 0);
});

test("a tall day takes a proportionally long stretch of track, with no jump at its edges", () => {
  // Days at 0, 100 and (tall second day) 3100; page scrolls to 3200.
  const tops = [0, 100, 3100];
  const step = offsetAtFraction(0.5 + 0.01, 0, 3200) - offsetAtFraction(0.5, 0, 3200);
  assert.equal(step, 32); // 1% of the track is 32px, wherever it is
  assert.equal(indexAtOffset(0, tops), 0);
  assert.equal(indexAtOffset(98, tops), 0);
  assert.equal(indexAtOffset(100, tops), 1);
  assert.equal(indexAtOffset(2000, tops), 1);
  assert.equal(indexAtOffset(3100, tops), 2);
  assert.equal(indexAtOffset(3200, tops), 2);
  assert.equal(indexAtOffset(5, []), 0);
});

test("smoothDamp eases toward the target: slow start, no overshoot, arrives", () => {
  let x = 0, v = 0;
  const steps = [];
  for (let i = 0; i < 120; i++) {
    [x, v] = smoothDamp(x, 1000, v, 0.2, 1 / 60);
    steps.push(x);
    assert.ok(x <= 1000 + 1e-6);
  }
  assert.ok(steps[0] > 0, "moves forward");
  assert.ok(steps[1] - steps[0] > steps[0], "speeds up from rest");
  assert.ok(Math.abs(x - 1000) < 1);
  assert.equal(smoothDamp(5, 5, 0, 0.2, 1 / 60)[0], 5);
});
