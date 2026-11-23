// Synthetic-only checks for the trip page's Agenda / Map / Notes tabs.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
const require = createRequire(import.meta.url);
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost' });
globalThis.React = React;
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { TripTabs } = await import('./TripTabs.tsx');
const { tabFromHash, withTab } = await import('../../lib/tripTabs.ts');

function mount(element) {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  act(() => root.render(element));
  return { container, render: (next) => act(() => root.render(next)), close() { act(() => root.unmount()); container.remove(); } };
}

test('four tabs, the current one selected and the only one in the tab order; each names its panel', () => {
  const view = mount(React.createElement(TripTabs, { tab: 'map', onChange() {} }));
  try {
    const tabs = [...view.container.querySelectorAll('[role=tab]')];
    assert.deepEqual(tabs.map((t) => t.textContent), ['Agenda', 'Tasks', 'Map', 'Notes']);
    assert.deepEqual(tabs.map((t) => t.getAttribute('aria-selected')), ['false', 'false', 'true', 'false']);
    assert.deepEqual(tabs.map((t) => t.tabIndex), [-1, -1, 0, -1]);
    assert.equal(tabs[2].getAttribute('aria-controls'), 'trip-panel-map');
  } finally { view.close(); }
});

test('a click or the arrow keys change the tab, wrapping at the ends', () => {
  const picked = [];
  const view = mount(React.createElement(TripTabs, { tab: 'agenda', onChange: (t) => picked.push(t) }));
  try {
    const list = view.container.querySelector('[role=tablist]');
    const key = (k) => act(() => list.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: k, bubbles: true })));
    key('ArrowRight');
    key('ArrowLeft'); // from Agenda, wraps to Notes
    key('End');
    act(() => view.container.querySelectorAll('[role=tab]')[1].click());
    assert.deepEqual(picked, ['tasks', 'notes', 'notes', 'tasks']);
  } finally { view.close(); }
});

test('the tab lives in the hash route\'s query, other parameters kept; the agenda is the default and leaves no ?tab=', () => {
  assert.equal(tabFromHash('?tab=map&day=2040-01-02'), 'map');
  assert.equal(tabFromHash('?tab=bogus'), 'agenda');
  assert.equal(tabFromHash(''), 'agenda');
  const base = 'https://example.com/site/#/trip/synthetic?day=2040-01-02';
  assert.equal(withTab(base, 'notes'), 'https://example.com/site/#/trip/synthetic?day=2040-01-02&tab=notes');
  assert.equal(withTab(withTab(base, 'map'), 'agenda'), base);
  assert.equal(withTab('https://example.com/site/#/trip/synthetic', 'map'), 'https://example.com/site/#/trip/synthetic?tab=map');
});
