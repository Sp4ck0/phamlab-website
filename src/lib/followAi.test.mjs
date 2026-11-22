// Follow AI edits acts only on signals that arrive while the page is open: the AI's marks and
// jumps are never replayed after a reload.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { activityGlow, GLOW_AFTER_MS, GLOW_MAX_MS, newSignal } from './followAi.ts';

test('the first signal after a page load is only a baseline, so a reload does not bring marks back', () => {
  assert.deepEqual(newSignal(undefined, 'n1'), { seen: 'n1', act: false });
  assert.deepEqual(newSignal(undefined, null), { seen: null, act: false });
});

test('a new signal is acted on once; the same one again is not', () => {
  assert.deepEqual(newSignal('n1', 'n2'), { seen: 'n2', act: true });
  assert.deepEqual(newSignal('n2', 'n2'), { seen: 'n2', act: false });
  assert.deepEqual(newSignal(null, 'n1'), { seen: 'n1', act: true });
});

test('no signal changes nothing, so the last one is not replayed when it comes back', () => {
  assert.deepEqual(newSignal('n1', null), { seen: 'n1', act: false });
  assert.deepEqual(newSignal('n1', 'n1'), { seen: 'n1', act: false });
});

test('the AI button glows for a call that starts or ends while the page is open, never for one from before', () => {
  const running = { startedAt: 100, endedAt: null };
  const ended = { startedAt: 100, endedAt: 150 };
  assert.deepEqual(activityGlow(undefined, running, 1000), { seen: '100:null', glowUntil: null });
  assert.deepEqual(activityGlow('none', running, 1000), { seen: '100:null', glowUntil: 1000 + GLOW_MAX_MS });
  assert.deepEqual(activityGlow('100:null', ended, 2000), { seen: '100:150', glowUntil: 2000 + GLOW_AFTER_MS });
  assert.deepEqual(activityGlow('100:150', ended, 3000), { seen: '100:150', glowUntil: null });
  assert.deepEqual(activityGlow('100:150', null, 3000), { seen: 'none', glowUntil: null });
});
