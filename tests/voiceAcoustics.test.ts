// Unit tests for the browser-side frame features (src/lib/voiceAcoustics.ts).
// Run with `npm test` (Node's built-in test runner strips the types).
import { test } from "node:test";
import assert from "node:assert/strict";
import { analyzeSamples, clipPeaks, HOP_MS } from "../src/lib/voiceAcoustics.ts";

const RATE = 8000;
function tone(seconds: number, hz: (t: number) => number, amplitude = 0.5): Float32Array {
  const out = new Float32Array(Math.round(seconds * RATE));
  let phase = 0;
  for (let i = 0; i < out.length; i++) {
    phase += (2 * Math.PI * hz(i / RATE)) / RATE;
    out[i] = amplitude * Math.sin(phase);
  }
  return out;
}
const frames = (samples: Float32Array) => {
  const out = analyzeSamples(samples, RATE);
  return Array.from({ length: out.length / 2 }, (_, i) => ({ db: out[2 * i], f0: out[2 * i + 1] }));
};
const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

test("one frame per 10 ms hop", () => {
  assert.equal(HOP_MS, 10);
  assert.equal(frames(tone(1, () => 150)).length, 100);
});

for (const hz of [100, 220]) {
  test(`YIN tracks a steady ${hz} Hz tone within 2%`, () => {
    const voiced = frames(tone(1, () => hz)).map((f) => f.f0).filter((f) => f > 0);
    assert.ok(voiced.length > 80, `voiced frames: ${voiced.length}`);
    assert.ok(Math.abs(median(voiced) - hz) / hz < 0.02, `median ${median(voiced)}`);
  });
}

test("YIN follows rising and falling glides", () => {
  const quarterMedians = (f0: number[]) => {
    const q = Math.floor(f0.length / 4);
    return [median(f0.slice(0, q).filter((f) => f > 0)), median(f0.slice(-q).filter((f) => f > 0))];
  };
  const [riseStart, riseEnd] = quarterMedians(frames(tone(1, (t) => 150 + 100 * t)).map((f) => f.f0));
  assert.ok(riseEnd > riseStart * 1.3, `${riseStart} → ${riseEnd}`);
  const [fallStart, fallEnd] = quarterMedians(frames(tone(1, (t) => 250 - 100 * t)).map((f) => f.f0));
  assert.ok(fallEnd < fallStart / 1.3, `${fallStart} → ${fallEnd}`);
});

test("level is RMS in dBFS; silence is unvoiced at the floor", () => {
  // A 0.5-amplitude sine has RMS 0.5/√2 ≈ -9.03 dBFS.
  assert.ok(Math.abs(median(frames(tone(0.5, () => 200)).map((f) => f.db)) + 9.03) < 0.2);
  const silent = frames(new Float32Array(RATE / 2));
  assert.ok(silent.every((f) => f.db === -120 && f.f0 === 0));
});

test("pitch is skipped on quiet frames far below the recording's loud end", () => {
  const samples = new Float32Array(RATE);
  samples.set(tone(0.5, () => 200, 0.5));
  samples.set(tone(0.5, () => 200, 0.001), RATE / 2); // ~-54 dB below the loud half
  const out = frames(samples);
  assert.ok(out.slice(60, 100).every((f) => f.f0 === 0));
});

test("noise and unpitched sound read as unvoiced", () => {
  let seed = 1;
  const noise = Float32Array.from({ length: RATE / 2 }, () => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5) * 0.6);
  const voiced = frames(noise).filter((f) => f.f0 > 0).length;
  assert.ok(voiced < 5, `voiced noise frames: ${voiced}`);
});

test("waveform peaks cover only the requested slice, normalized to its loudest bar", () => {
  // 1 s of silence, then 1 s of a quarter-amplitude tone.
  const samples = new Float32Array(2 * RATE);
  samples.set(tone(1, () => 200, 0.25), RATE);
  const whole = clipPeaks(samples, RATE, 0, 2, 20);
  assert.equal(whole.length, 20);
  assert.ok(whole.slice(0, 10).every((p) => p === 0));
  assert.ok(whole.slice(10).every((p) => p > 0.9)); // quiet tone still fills the height
  assert.ok(clipPeaks(samples, RATE, 1, 2, 10).every((p) => p > 0.9));
  assert.deepEqual(clipPeaks(samples, RATE, 0, 1, 5), [0, 0, 0, 0, 0]); // silence: no NaN
});
