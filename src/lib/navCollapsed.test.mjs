// The desktop menu stays collapsed across reloads, and a browser that blocks storage
// just keeps it open.
import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { loadNavCollapsed, saveNavCollapsed } from './navCollapsed.ts';

const store = new Map();
function install(storage) {
  globalThis.localStorage = storage;
  globalThis.window = { dispatchEvent() {} };
  globalThis.Event = class {};
}
afterEach(() => {
  store.clear();
  delete globalThis.localStorage;
  delete globalThis.window;
});

test('open by default, collapsed once saved, open again once cleared', () => {
  install({
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, v),
    removeItem: (k) => store.delete(k),
  });
  assert.equal(loadNavCollapsed(), false);
  saveNavCollapsed(true);
  assert.equal(loadNavCollapsed(), true);
  saveNavCollapsed(false);
  assert.equal(loadNavCollapsed(), false);
});

test('blocked storage leaves the menu open and does not throw', () => {
  const blocked = () => {
    throw new Error('blocked');
  };
  install({ getItem: blocked, setItem: blocked, removeItem: blocked });
  assert.equal(loadNavCollapsed(), false);
  assert.doesNotThrow(() => saveNavCollapsed(true));
});
