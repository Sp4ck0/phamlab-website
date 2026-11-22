// The phone bars' scroll rule: hide after a deliberate scroll down, show after any small scroll up.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { nextBars, HIDE_AFTER, SHOW_AFTER, TOP_ZONE } from './hideBars.ts';

const run = (ys, start = { hidden: false, lastY: ys[0], anchorY: ys[0] }) =>
  ys.slice(1).reduce((s, y) => nextBars(s, y), start);

test('a scroll down of HIDE_AFTER hides them; a shorter nudge does not', () => {
  assert.equal(run([200, 200 + HIDE_AFTER - 1]).hidden, false);
  assert.equal(run([200, 210, 200 + HIDE_AFTER]).hidden, true);
});

test('any scroll up of SHOW_AFTER brings them back, counted from where it turned', () => {
  const hidden = run([200, 400]);
  assert.equal(hidden.hidden, true);
  assert.equal(nextBars(hidden, 400 - SHOW_AFTER + 1).hidden, true); // a twitch
  assert.equal(run([400, 395, 400 - SHOW_AFTER], hidden).hidden, false);
});

test('after coming back, they hide again only after another full scroll down', () => {
  const shown = run([200, 400, 380]);
  assert.equal(shown.hidden, false);
  assert.equal(run([380, 380 + HIDE_AFTER - 1], shown).hidden, false);
  assert.equal(run([380, 380 + HIDE_AFTER], shown).hidden, true);
});

test('near the top of the page they always show', () => {
  const hidden = run([200, 400]);
  assert.equal(nextBars(hidden, TOP_ZONE).hidden, false);
  assert.equal(nextBars(hidden, -30).hidden, false); // iOS bounces past the top
});
