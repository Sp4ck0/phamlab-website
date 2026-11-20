// Synthetic-only checks for which timeline tiles are open: defaults, saved choices, Only gaps, reveals.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
const require = createRequire(import.meta.url);
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost' });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.localStorage = dom.window.localStorage;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { useTileOpen } = await import('./useTileOpen.ts');

// Mounts the hook and hands back a live view of it.
function mount(slug, gapsView = false) {
  const container = document.createElement('div');
  const root = createRoot(container);
  const out = { tiles: null };
  function Probe(props) {
    out.tiles = useTileOpen(props.slug, props.gapsView);
    return null;
  }
  const render = (s, g) => act(() => root.render(React.createElement(Probe, { slug: s, gapsView: g })));
  render(slug, gapsView);
  return { out, render, close: () => act(() => root.unmount()) };
}
const saved = (slug = 'synthetic') => JSON.parse(localStorage.getItem(`tiles:${slug}`) ?? 'null');
test.beforeEach(() => localStorage.clear());

test('a tile with no saved choice follows its default', () => {
  const v = mount('synthetic');
  assert.equal(v.out.tiles.isOpen('d#a', true), true);
  assert.equal(v.out.tiles.isOpen('d#a', false), false);
  v.close();
});

test('a toggle overrides the default in either direction and is saved', () => {
  const v = mount('synthetic');
  act(() => v.out.tiles.toggle('d#closed', false));
  act(() => v.out.tiles.toggle('d#open', true)); // any tile can be closed, even an unresolved one
  assert.equal(v.out.tiles.isOpen('d#closed', false), true);
  assert.equal(v.out.tiles.isOpen('d#open', true), false);
  assert.deepEqual(saved(), { 'd#closed': true, 'd#open': false });
  v.close();
});

test('choices come back after a reload, per trip', () => {
  const first = mount('synthetic');
  act(() => first.out.tiles.toggle('d#a', false));
  first.close();
  const again = mount('synthetic');
  assert.equal(again.out.tiles.isOpen('d#a', false), true);
  again.close();
  const other = mount('another');
  assert.equal(other.out.tiles.isOpen('d#a', false), false);
  other.close();
});

test('several tiles can be open at once, and setMany touches only the ids given', () => {
  const v = mount('synthetic');
  act(() => v.out.tiles.setMany(['d#a', 'd#b'], true));
  act(() => v.out.tiles.toggle('d#c', false));
  assert.deepEqual(['d#a', 'd#b', 'd#c', 'e#a'].map((id) => v.out.tiles.isOpen(id, false)), [true, true, true, false]);
  act(() => v.out.tiles.setMany(['d#a', 'd#b', 'd#c'], false));
  assert.deepEqual(['d#a', 'd#b', 'd#c'].map((id) => v.out.tiles.isOpen(id, true)), [false, false, false]);
  v.close();
});

test('Only gaps ignores saved choices, saves nothing, and starts afresh each time', () => {
  const v = mount('synthetic');
  act(() => v.out.tiles.toggle('d#a', false)); // saved: open
  v.render('synthetic', true);
  assert.equal(v.out.tiles.isOpen('d#a', false), false); // the saved choice is ignored here
  act(() => v.out.tiles.toggle('d#b', false));
  assert.equal(v.out.tiles.isOpen('d#b', false), true);
  assert.deepEqual(saved(), { 'd#a': true }); // the gaps-view toggle was not saved
  v.render('synthetic', false);
  assert.equal(v.out.tiles.isOpen('d#a', false), true); // back to what the reader saved
  assert.equal(v.out.tiles.isOpen('d#b', false), false);
  v.render('synthetic', true);
  assert.equal(v.out.tiles.isOpen('d#b', false), false); // the earlier gaps-view choice is gone
  v.close();
});

test('a reveal opens a tile for this visit only, and never closes anything', () => {
  const v = mount('synthetic');
  act(() => v.out.tiles.toggle('d#other', true)); // the reader closed this one
  act(() => v.out.tiles.reveal('d#target'));
  assert.equal(v.out.tiles.isOpen('d#target', false), true);
  assert.equal(v.out.tiles.isOpen('d#other', true), false);
  assert.deepEqual(saved(), { 'd#other': false }); // the reveal was not saved
  v.render('synthetic', true); // a reveal survives the filter being turned off
  assert.equal(v.out.tiles.isOpen('d#target', false), true);
  act(() => v.out.tiles.toggle('d#target', false)); // and the reader can still close it
  assert.equal(v.out.tiles.isOpen('d#target', false), false);
  v.close();
});

test('storage that throws or holds junk is tolerated', () => {
  localStorage.setItem('tiles:synthetic', '{not json');
  const v = mount('synthetic');
  assert.equal(v.out.tiles.isOpen('d#a', true), true);
  localStorage.setItem('tiles:junk', JSON.stringify({ 'd#a': 'yes', 'd#b': true }));
  const j = mount('junk');
  assert.equal(j.out.tiles.isOpen('d#a', false), false); // a non-boolean is dropped
  assert.equal(j.out.tiles.isOpen('d#b', false), true);
  const real = dom.window.Storage.prototype.setItem;
  dom.window.Storage.prototype.setItem = () => { throw new Error('blocked'); };
  act(() => v.out.tiles.toggle('d#a', true)); // must not throw
  assert.equal(v.out.tiles.isOpen('d#a', true), false); // and still lasts for this visit
  dom.window.Storage.prototype.setItem = real;
  v.close();
  j.close();
});
