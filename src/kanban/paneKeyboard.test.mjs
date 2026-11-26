// The card pane keeps the phone keyboard out of the way: down on open, away on scroll.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost' });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.Node = dom.window.Node;
const { guardPaneKeyboard, OPEN_GUARD_MS } = await import('./paneKeyboard.ts');

function pane() {
  const el = document.createElement('aside');
  el.innerHTML = '<textarea id="title"></textarea><p id="text">words</p><textarea id="reply"></textarea>';
  document.body.replaceChildren(el);
  el.scrollTop = 40;
  return { el, title: el.querySelector('#title'), reply: el.querySelector('#reply'), text: el.querySelector('#text') };
}
const touch = (target, type, y) => {
  const e = new window.Event(type, { bubbles: true });
  e.touches = type === 'touchend' ? [] : [{ clientY: y }];
  target.dispatchEvent(e);
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

test('a box that takes focus on its own as the card opens gives it back', () => {
  const p = pane();
  const stop = guardPaneKeyboard(p.el);
  p.title.focus();
  assert.notEqual(document.activeElement, p.title);
  assert.equal(p.el.scrollTop, 0);
  stop();
});

test('tapping a box right after opening still types in it', () => {
  const p = pane();
  const stop = guardPaneKeyboard(p.el);
  p.reply.dispatchEvent(new window.Event('pointerdown', { bubbles: true }));
  p.reply.focus();
  assert.equal(document.activeElement, p.reply);
  stop();
});

test('once the card has opened, focus is left alone', async () => {
  const p = pane();
  const stop = guardPaneKeyboard(p.el);
  await wait(OPEN_GUARD_MS + 50);
  p.reply.focus();
  assert.equal(document.activeElement, p.reply);
  stop();
});

test('dragging the pane while typing puts the keyboard away', async () => {
  const p = pane();
  const stop = guardPaneKeyboard(p.el);
  await wait(OPEN_GUARD_MS + 50);
  p.reply.focus();
  touch(p.text, 'touchstart', 300);
  touch(p.text, 'touchmove', 305);
  assert.equal(document.activeElement, p.reply, 'a small wobble is not a scroll');
  touch(p.text, 'touchmove', 250);
  assert.notEqual(document.activeElement, p.reply);
  stop();
});

test('a drag that starts in the box being typed in keeps the keyboard', async () => {
  const p = pane();
  const stop = guardPaneKeyboard(p.el);
  await wait(OPEN_GUARD_MS + 50);
  p.reply.focus();
  touch(p.reply, 'touchstart', 300);
  touch(p.reply, 'touchmove', 200);
  assert.equal(document.activeElement, p.reply);
  stop();
});
