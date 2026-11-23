import test from "node:test";
import assert from "node:assert/strict";
import { fractionOfIndex, indexAtPointer } from "./scrubber.ts";

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
