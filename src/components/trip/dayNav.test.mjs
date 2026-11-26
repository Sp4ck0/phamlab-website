// Synthetic-only checks for the date strip's pinned Today / Now button.
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
dom.window.matchMedia = () => ({ matches: false });
const { DayNav } = await import('./DayNav.tsx');

const day = (date) => ({ date, _d: new Date(`${date}T12:00:00`) });
const rows = [{ id: 'd1', day: day('2026-03-01') }, { id: 'd2', day: day('2026-03-02') }];

function mount(props) {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  act(() => root.render(React.createElement(DayNav, { rows, todayId: 'd2', ...props })));
  return { container, button: container.querySelector('.daynav-jump'), close() { act(() => root.unmount()); container.remove(); } };
}
const shown = (button) => button.querySelector('span:not(.daynav-jump-off)').textContent;

test('reads Today until the reader is on today with it open; both words stay laid out', () => {
  for (const [props, word] of [
    [{ currentId: 'd1', todayOpen: true }, '↩ Today'],
    [{ currentId: 'd2', todayOpen: false }, '↩ Today'],
    [{ currentId: 'd2', todayOpen: true }, '↩ Now'],
  ]) {
    const view = mount({ onJump() {}, onNow() {}, ...props });
    try {
      assert.equal(shown(view.button), word);
      assert.equal(view.button.querySelectorAll('span').length, 2);
    } finally { view.close(); }
  }
});

test('both words go to now; a date chip still jumps to its day', () => {
  for (const props of [{ currentId: 'd1', todayOpen: true }, { currentId: 'd2', todayOpen: true }, { currentId: 'd2', todayOpen: false }]) {
    const nows = [], jumps = [];
    const view = mount({ ...props, onNow: (id) => nows.push(id), onJump: (id) => jumps.push(id) });
    try {
      act(() => view.button.click());
      assert.deepEqual(nows, ['d2']);
      assert.deepEqual(jumps, []);
      act(() => view.container.querySelector('[data-row="d1"]').click());
      assert.deepEqual(jumps, ['d1']);
    } finally { view.close(); }
  }
});
