// Synthetic-only checks for who is joining an activity: the label, the pill's list, and the editor's picker.
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
const { participants, participantLabel } = await import('../../lib/tripLogic.ts');
const { ParticipantPill } = await import('./ParticipantPill.tsx');
const { ActivityEditor } = await import('./ActivityEditor.tsx');

const h = React.createElement;
function mount(element) {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  act(() => root.render(element));
  return { container, close() { act(() => root.unmount()); container.remove(); } };
}

const g = (id, name, extra = {}) => ({ id, name, members: 1, color: '#336699', ...extra });
const GROUPS = [g('a', 'Alpha'), g('b', 'Bravo'), g('c', 'Charlie'), g('d', 'Delta'), g('e', 'Echo', { from: '2040-01-05' })];
const DATE = '2040-01-02';
const label = (who, date = DATE, groups = GROUPS) => participantLabel(participants(who, groups, date));

test('no who, "all" or a stale id reads as Everyone', () => {
  assert.equal(label(undefined), 'Everyone');
  assert.equal(label('all'), 'Everyone');
  assert.equal(label(['gone']), 'Everyone');
  assert.deepEqual(participants(undefined, GROUPS, DATE).people.map((x) => x.name), ['Alpha', 'Bravo', 'Charlie', 'Delta']);
});

test('one or two names, then a count for the rest, in the trip order', () => {
  assert.equal(label('b'), 'Bravo');
  assert.equal(label(['c', 'a']), 'Alpha, Charlie');
  assert.equal(label(['a', 'b', 'c']), 'Alpha, Bravo +1');
});

test('picking everyone present that day reads as Everyone; someone joining later is not counted', () => {
  assert.equal(label(['a', 'b', 'c', 'd']), 'Everyone');
  assert.equal(label(['a', 'b', 'c', 'd'], '2040-01-06'), 'Alpha, Bravo +2');
});

test('a trip with no travelers shows no pill', () => {
  assert.equal(participants(undefined, [], DATE), null);
  const view = mount(h(ParticipantPill, { groups: [], date: DATE }));
  assert.equal(view.container.innerHTML, '');
  view.close();
});

test('tapping the pill lists everyone joining, and a tap outside or Escape closes it', () => {
  let cardClicks = 0;
  const view = mount(h('div', { onClick: () => cardClicks++ }, h(ParticipantPill, { who: ['a', 'b', 'c'], groups: GROUPS, date: DATE })));
  const btn = view.container.querySelector('.who-join-btn');
  assert.equal(btn.textContent, 'Alpha, Bravo +1');
  act(() => btn.click());
  assert.equal(btn.getAttribute('aria-expanded'), 'true');
  const items = [...view.container.querySelectorAll('.who-join-list li')].map((li) => li.textContent);
  assert.deepEqual(items, ['Alpha', 'Bravo', 'Charlie']);
  act(() => view.container.querySelector('.who-join-list').click());
  assert.equal(cardClicks, 0, 'a tap on the pill or its list never reaches the card');
  act(() => document.body.dispatchEvent(new dom.window.Event('pointerdown', { bubbles: true })));
  assert.equal(view.container.querySelector('.who-join-list'), null);
  act(() => btn.click());
  act(() => document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape' })));
  assert.equal(view.container.querySelector('.who-join-list'), null);
  view.close();
});

function editor(props) {
  const saved = [];
  const view = mount(h(ActivityEditor, {
    initial: 'Synthetic lunch', groups: GROUPS.slice(0, 3), onCancel() {},
    onSave: async (text, places, timing) => void saved.push(timing), ...props,
  }));
  const chip = (name) => [...view.container.querySelectorAll('.ai-who .ai-chip')].find((b) => b.textContent === name);
  const save = async () => { await act(async () => view.container.querySelector('form').dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }))); };
  return { view, chip, save, saved };
}

test('the editor sends who only when it changed, and Everyone as null', async () => {
  const e = editor({});
  assert.equal(e.chip('Everyone').getAttribute('aria-pressed'), 'true');
  await e.save();
  assert.equal(e.saved[0].who, undefined);
  e.view.close();

  // A saved editor is closed by its card, so each save is a fresh one.
  const p = editor({});
  act(() => p.chip('Bravo').click());
  assert.equal(p.chip('Everyone').getAttribute('aria-pressed'), 'false');
  await p.save();
  assert.deepEqual(p.saved[0].who, ['b']);
  p.view.close();

  const f = editor({ initialWho: ['a', 'c'] });
  assert.equal(f.chip('Alpha').getAttribute('aria-pressed'), 'true');
  act(() => f.chip('Everyone').click());
  await f.save();
  assert.equal(f.saved[0].who, null);
  f.view.close();
});

test('the editor has no Who row on a trip with no travelers', () => {
  const view = mount(h(ActivityEditor, { initial: 'Synthetic lunch', onCancel() {}, onSave: async () => {} }));
  assert.equal(view.container.querySelector('.ai-who'), null);
  view.close();
});
