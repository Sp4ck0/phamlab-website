// Synthetic-only checks for where the Today / Now button lands.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost' });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
dom.window.matchMedia = () => ({ matches: true }); // reduced motion: "instant"
const { scrollToNow } = await import('./nowScroll.ts');

// A day with a pinned-or-not heading and one marker; rects are stubbed (jsdom has no layout).
function setup({ markup, rects, headingCss = '', headingHeight = 0, markerCss = '' }) {
  document.body.innerHTML = `<section id="d"><h2 class="day-heading" style="${headingCss}"></h2><ol>${markup}</ol></section>`;
  for (const [sel, top] of Object.entries(rects)) {
    document.querySelector(sel).getBoundingClientRect = () => ({ top });
  }
  Object.defineProperty(document.querySelector('.day-heading'), 'offsetHeight', { value: headingHeight });
  const marker = document.querySelector('.tl-now, .tl-entry--now');
  if (marker && markerCss) marker.setAttribute('style', markerCss);
  window.scrollY = 1000;
  const calls = [];
  window.scrollTo = (opts) => calls.push(opts);
  return calls;
}

test('lands the tile under way with its time chip below a pinned day header and its fade', () => {
  const calls = setup({
    markup: '<li class="tl-entry tl-entry--now"><div class="tl-pins"></div></li>',
    rects: { '.tl-entry--now': 500, '.tl-pins': 490 },
    headingCss: 'position:sticky;top:100px', headingHeight: 150, markerCss: 'scroll-margin-top:200px',
  });
  assert.equal(scrollToNow('d'), true);
  // chip top 490, cleared by 100 + 150 + 24 fade (more than the 200px margin), plus 8px of air.
  assert.deepEqual(calls, [{ top: 1000 + 490 - 274 - 8, behavior: 'instant' }]);
});

test('without a pinned header, the now line uses its own scroll margin', () => {
  const calls = setup({
    markup: '<li class="tl-now"></li>',
    rects: { '.tl-now': 300 },
    headingHeight: 150, markerCss: 'scroll-margin-top:66px',
  });
  assert.equal(scrollToNow('d'), true);
  assert.deepEqual(calls, [{ top: 1000 + 300 - 66 - 8, behavior: 'instant' }]);
});

test('a day showing no current time is left alone', () => {
  const calls = setup({ markup: '<li class="tl-entry"></li>', rects: {} });
  assert.equal(scrollToNow('d'), false);
  assert.equal(scrollToNow('missing'), false);
  assert.deepEqual(calls, []);
});
