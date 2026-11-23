// Synthetic-only checks for the shared timeline tile: one accordion for every kind of entry.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import React, { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
const require = createRequire(import.meta.url);
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost' });
globalThis.React = React;
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { TimelineTile } = await import('./TimelineTile.tsx');

function mount(element) {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  act(() => root.render(element));
  return { container, close() { act(() => root.unmount()); container.remove(); } };
}
const h = React.createElement;

// A tile that owns its open state, the way DayCard will through useTileOpen.
function Probe({ initial = false, onInner, ...rest }) {
  const [open, setOpen] = useState(initial);
  return h(TimelineTile, {
    icon: '🏨', title: 'Synthetic stay', meta: 'Night 1 of 3', time: 'All day', ...rest, open, onToggle: () => setOpen((o) => !o),
    headerEnd: h('button', { type: 'button', className: 'end-btn', onClick: onInner }, 'status'),
  }, h('button', { type: 'button', className: 'body-btn', onClick: onInner }, 'inside'), h('span', null, 'Synthetic body text'));
}
const toggle = (c) => c.querySelector('.tl-toggle');
const body = (c) => c.querySelector('.tl-body');

test('the title button toggles, with aria-expanded and aria-controls pointing at the body', () => {
  const view = mount(h('ol', null, h(Probe)));
  assert.equal(toggle(view.container).getAttribute('aria-expanded'), 'false');
  assert.equal(toggle(view.container).getAttribute('aria-controls'), body(view.container).id);
  act(() => toggle(view.container).click());
  assert.equal(toggle(view.container).getAttribute('aria-expanded'), 'true');
  assert.equal(body(view.container).hasAttribute('hidden'), false);
  act(() => toggle(view.container).click());
  assert.equal(toggle(view.container).getAttribute('aria-expanded'), 'false');
  view.close();
});

test('a closed body stays in the page and is hidden until found, so its text is searchable', () => {
  const view = mount(h('ol', null, h(Probe)));
  assert.equal(body(view.container).getAttribute('hidden'), 'until-found');
  assert.match(view.container.textContent, /Synthetic body text/);
  view.close();
});

test('a find-in-page match (beforematch) opens a closed tile once, and does nothing to an open one', () => {
  const view = mount(h('ol', null, h(Probe)));
  act(() => body(view.container).dispatchEvent(new dom.window.Event('beforematch')));
  assert.equal(toggle(view.container).getAttribute('aria-expanded'), 'true');
  act(() => body(view.container).dispatchEvent(new dom.window.Event('beforematch')));
  assert.equal(toggle(view.container).getAttribute('aria-expanded'), 'true');
  view.close();
});

test('the header\'s plain parts toggle, but controls inside the header and the body never do', () => {
  let inner = 0;
  const view = mount(h('ol', null, h(Probe, { onInner: () => inner++ })));
  act(() => view.container.querySelector('.tl-chev').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })));
  assert.equal(toggle(view.container).getAttribute('aria-expanded'), 'true');
  act(() => view.container.querySelector('.end-btn').click());
  act(() => view.container.querySelector('.body-btn').click());
  assert.equal(inner, 2);
  assert.equal(toggle(view.container).getAttribute('aria-expanded'), 'true'); // neither closed it
  view.close();
});

test('the warning dot stays on an unresolved tile whether it is closed or open', () => {
  const view = mount(h('ol', null, h(Probe, { warn: true })));
  assert.ok(view.container.querySelector('.tl-warn'));
  act(() => toggle(view.container).click());
  assert.ok(view.container.querySelector('.tl-warn'));
  view.close();
});

test('independent tiles: opening one leaves the others as they were', () => {
  const view = mount(h('ol', null, h(Probe, { key: 1 }), h(Probe, { key: 2, initial: true }), h(Probe, { key: 3 })));
  const states = () => [...view.container.querySelectorAll('.tl-toggle')].map((b) => b.getAttribute('aria-expanded'));
  assert.deepEqual(states(), ['false', 'true', 'false']);
  act(() => view.container.querySelectorAll('.tl-toggle')[0].click());
  assert.deepEqual(states(), ['true', 'true', 'false']);
  view.close();
});

test('the entry owns the element id, shows the time label, and a ghost is inert with no id', () => {
  const view = mount(h('ol', null, h(Probe, { domId: 'synthetic-tile', time: '09:30' }), h(Probe, { change: 'gone' })));
  const [first, ghost] = view.container.querySelectorAll('li.tl-entry');
  assert.equal(first.id, 'synthetic-tile');
  assert.equal(first.querySelector('.tl-time').textContent, '09:30');
  assert.ok(ghost.hasAttribute('inert'));
  assert.equal(ghost.id, '');
  assert.match(ghost.querySelector('.tl-tile').className, /chg-gone/);
  view.close();
});

test('the next-up line stays in the header while the tile is closed', () => {
  const view = mount(h('ol', null, h(Probe, { nextUpLine: 'Departs in 2 h' })));
  assert.match(toggle(view.container).textContent, /Departs in 2 h/);
  assert.ok(view.container.querySelector('li.next-up'));
  view.close();
});

test('every ⋯ menu has the same order, whatever order the card lists its actions in, with a line between groups', async () => {
  const { TileMenu } = await import('./TileMenu.tsx');
  const items = [
    { label: 'Copy link', icon: 'link', onSelect() {} },
    { label: 'See photo credit', icon: 'photo', href: 'https://example.com/p' },
    { label: 'Add to Google Calendar', icon: 'calendar', href: 'https://example.com/cal' },
    { label: 'Open in Google Maps', icon: 'pin', href: 'https://example.com/maps' },
    { label: 'Call', icon: 'phone', href: 'tel:0' },
    { label: 'Show on the trip map', icon: 'map', onSelect() {} },
    { label: 'Open in list', icon: 'list', onSelect() {} },
    { label: 'Mark as booked', icon: 'check', onSelect() {} },
    { label: 'Ticket', icon: 'ticket', href: 'https://example.com/t' },
  ];
  const view = mount(h(TileMenu, { label: 'Synthetic', items }));
  try {
    act(() => view.container.querySelector('.tl-menu-btn').click());
    const list = view.container.querySelector('[role=menu]');
    const rows = [...list.children].map((el) => (el.getAttribute('role') === 'separator' ? '—' : el.textContent));
    assert.deepEqual(rows, [
      'Mark as booked', '—',
      'Call', 'Ticket', '—', // the card's own order kept within a group
      'Show on the trip map', 'Open in Google Maps', '—',
      'Add to Google Calendar', '—',
      'Open in list', 'Copy link', '—',
      'See photo credit',
    ]);
    // The first action has focus, and the arrow keys skip the lines.
    assert.equal(document.activeElement.textContent, 'Mark as booked');
    act(() => list.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })));
    assert.equal(document.activeElement.textContent, 'Call');
  } finally { view.close(); }
});
