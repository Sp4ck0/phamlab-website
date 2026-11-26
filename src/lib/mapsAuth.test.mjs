// Google calls window.gm_authFailure when it refuses the site's key; the map then shows our note.
import assert from 'node:assert/strict';
import { test } from 'node:test';

globalThis.window ??= {};
const { mapsAuthFailed, onMapsAuthFailure, watchMapsAuthFailure } = await import('./mapsAuth.ts');

test('a refused key is remembered and tells whoever is listening', () => {
  watchMapsAuthFailure();
  let heard = 0;
  let stopped = 0;
  onMapsAuthFailure(() => heard++);
  const stop = onMapsAuthFailure(() => stopped++);
  stop();
  assert.equal(mapsAuthFailed(), false);
  window.gm_authFailure();
  assert.equal(mapsAuthFailed(), true);
  assert.equal(heard, 1);
  assert.equal(stopped, 0);
});
