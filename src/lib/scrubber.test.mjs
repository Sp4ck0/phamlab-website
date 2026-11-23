import test from "node:test";
import assert from "node:assert/strict";
import { fractionOfIndex, indexAtPointer, positionAtPointer, offsetAtPosition } from "./scrubber.ts";

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

test("positionAtPointer keeps the fraction between items", () => {
  assert.equal(positionAtPointer(150, 100, 200, 11), 2.5);
  assert.equal(positionAtPointer(0, 100, 200, 11), 0);
  assert.equal(positionAtPointer(999, 100, 200, 11), 10);
  assert.equal(positionAtPointer(150, 100, 0, 11), 0);
});

test("offsetAtPosition moves smoothly between item offsets and stops at the last", () => {
  const offsets = [0, 100, 400];
  assert.equal(offsetAtPosition(0, offsets), 0);
  assert.equal(offsetAtPosition(0.5, offsets), 50);
  assert.equal(offsetAtPosition(1.5, offsets), 250);
  assert.equal(offsetAtPosition(2, offsets), 400);
  assert.equal(offsetAtPosition(9, offsets), 400);
  assert.equal(offsetAtPosition(0, []), 0);
});
