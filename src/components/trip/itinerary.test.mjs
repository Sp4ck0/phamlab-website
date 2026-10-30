// Synthetic-only developer checks. See implementation handoff for invocation.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
const require = createRequire(process.env.ITINERARY_TEST_DEPS + '/package.json');
const { JSDOM } = require('jsdom');
const { DayCard } = await import('./DayCard.tsx');
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost' });
globalThis.React = React; // tsx's config-free classic JSX transform for this standalone probe.
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const day = { date: '2040-01-02', city: 'Synthetic stop', leg: 'synthetic', _d: new Date(2040, 0, 2), flights: [], hotels: [], acts: ['Synthetic activity'] };
const props = { day, dayNumber: 0, legColor: { color: '#333', tint: '#eee', label: 'Synthetic leg' }, groups: [], ticks: {}, onlyGaps: false, onToggle() {}, dayActionItems: [], actionItemsDone: {}, onToggleActionItem() {}, rowId: 'synthetic-row', expanded: false, onExpandedChange() {} };
// sanitizeHtml parses callouts/activities with these, so the page's DOM globals come from jsdom.
for (const name of ['DOMParser', 'Node', 'Element', 'NodeFilter', 'Text', 'Comment', 'DocumentFragment', 'Event', 'KeyboardEvent', 'MouseEvent', 'FocusEvent']) globalThis[name] = dom.window[name];
const { AiFocusProvider } = await import('../../hooks/useAiFocus.tsx');
const { Ctx: SettingsCtx } = await import('../../hooks/useSettings.tsx');
// The day cards read the AI-focus and settings contexts, so everything renders inside
// them (plain settings values: the real provider needs a Convex client). Wrapping `root`
// too keeps the tests' own `view.root.render(...)` calls inside them.
const settings = { theme: undefined, tempUnit: 'F', setTheme() {}, setTempUnit() {} };
const wrap = (element) => React.createElement(AiFocusProvider, null, React.createElement(SettingsCtx.Provider, { value: settings }, element));
function mount(element) {
  const container = document.createElement('div'); document.body.append(container);
  const root = createRoot(container);
  act(() => root.render(wrap(element)));
  return { container, root: { render: (next) => root.render(wrap(next)), unmount: () => root.unmount() }, close() { act(() => root.unmount()); container.remove(); } };
}
test('only-gaps dates come from open booking, plan and transport tasks, one per open night or day', async () => {
  const { gapDates, kindLabel } = await import('../../lib/tasks.ts');
  assert.equal(kindLabel({ kind: 'transport', scope: { kind: 'day', date: '2040-01-07' } }), 'Transport');
  const task = (kind, refs, refsDone) => ({ kind, refs, refsDone });
  const dates = gapDates([
    task('booking', ['booking:2040-01-02|h|Synthetic|a', 'booking:2040-01-03|h|Synthetic|a'], [true, false]), // half-booked stay
    task('plan', ['plan:2040-01-05|p|Synthetic'], [false]),
    task('plan', ['plan:2040-01-06|p|Synthetic'], [true]), // dismissed
    task('transport', ['transport:2040-01-07|t|Synthetic A → Synthetic B'], [false]), // a move with nothing entered
    task('transport', ['transport:2040-01-08|t|Synthetic B → Synthetic C'], [true]), // dismissed
    task('custom', ['item:synthetic'], [false]), // a to-do is not a gap
    task('decision', ['item:synthetic-decision'], [false]),
  ]);
  assert.deepEqual([...dates].sort(), ['2040-01-03', '2040-01-05', '2040-01-07']);
});
test('controlled closed day exposes an associated empty panel, not detail descendants', () => {
  const view = mount(React.createElement(DayCard, props));
  try {
    const trigger = view.container.querySelector('button');
    assert.equal(trigger.getAttribute('aria-expanded'), 'false');
    const panel = document.getElementById(trigger.getAttribute('aria-controls'));
    assert.ok(panel);
    assert.equal(view.container.textContent.includes('Synthetic activity'), false);
  } finally { view.close(); }
});
test('full-array occurrence reconciliation retains only unambiguous choices without dropping duplicates', async () => {
  const module = await import('../../lib/itineraryState.ts').catch(() => ({}));
  assert.equal(typeof module.reconcileRows, 'function', 'occurrence reconciliation must be implemented');
  const { reconcileRows } = module;
  let serial = 0;
  const allocate = () => `row-${++serial}`;
  const a = { ...day, city: 'Synthetic A' };
  const b = { ...day, city: 'Synthetic B' };
  const c = { ...day, date: '2040-01-03' };
  const original = reconcileRows([], [a, b, c, a], allocate);
  assert.equal(new Set(original.map(r => r.id)).size, 4);
  assert.deepEqual(reconcileRows(original, [a, b, c, a], allocate).map(r => r.id), original.map(r => r.id));
  const changed = reconcileRows(original, [b, a, { ...c, note: 'Synthetic edit' }, a], allocate);
  assert.equal(changed.length, 4);
  assert.equal(changed[0].id, original[1].id);
  assert.equal(changed[2].id, original[2].id);
  assert.notEqual(changed[1].id, original[0].id);
  assert.notEqual(changed[3].id, original[3].id);
  const editedDate = reconcileRows(changed, [{ ...b, date: '2040-02-01' }], allocate);
  assert.ok(changed.every(r => r.id !== editedDate[0].id));
});
test('unified list independently toggles duplicate occurrences and jumps reveal filtered targets', async () => {
  const { DetailedView } = await import('./DetailedView.tsx');
  let scrolls = 0;
  window.HTMLElement.prototype.scrollIntoView = function() { scrolls++; };
  window.matchMedia = () => ({ matches: true });
  const days = [day, { ...day, acts: [], highlight: 'Synthetic gap' }];
  function Harness() {
    const [onlyGaps, setOnlyGaps] = React.useState(false);
    const filterRef = React.useRef(null);
    return React.createElement(React.Fragment, null,
      React.createElement('button', { ref: filterRef, 'data-filter': '', onClick: () => setOnlyGaps(!onlyGaps) }, 'Only gaps'),
      React.createElement(DetailedView, { days, legColors: [props.legColor, props.legColor], weather: {}, groups: [], ticks: {}, onlyGaps, isGap: d => !d.acts.length, onOnlyGapsChange: setOnlyGaps, filterRef, onToggle() {}, onJump() {}, actionItems: [], actionItemsDone: {}, onToggleActionItem() {} }));
  }
  const view = mount(React.createElement(Harness));
  try {
    let triggers = [...view.container.querySelectorAll('button[aria-expanded]')];
    assert.equal(triggers.length, 2);
    assert.equal(new Set(triggers.map(b => b.id)).size, 2);
    act(() => triggers[0].click());
    act(() => triggers[1].click());
    assert.deepEqual(triggers.map(b => b.getAttribute('aria-expanded')), ['true', 'true']);
    act(() => triggers[0].click());
    assert.equal(triggers[1].getAttribute('aria-expanded'), 'true');
    act(() => view.container.querySelector('[data-filter]').click());
    assert.equal(view.container.querySelectorAll('button[aria-expanded]').length, 1);
    const jumps = view.container.querySelectorAll('nav button');
    assert.equal(jumps.length, 2);
    assert.notEqual(jumps[0].textContent, jumps[1].textContent);
    act(() => jumps[0].click());
    triggers = [...view.container.querySelectorAll('button[aria-expanded]')];
    assert.equal(triggers.length, 2);
    assert.equal(triggers[0].getAttribute('aria-expanded'), 'true');
    assert.equal(document.activeElement, triggers[0]);
    act(() => jumps[0].click());
    assert.equal(scrolls, 2);
    // A filter change and jump can be queued before the same React commit.
    act(() => { view.container.querySelector('[data-filter]').click(); jumps[0].click(); });
    assert.equal(view.container.querySelectorAll('button[aria-expanded]').length, 2);
    assert.equal(document.activeElement, view.container.querySelector('button[aria-expanded]'));
    assert.equal(scrolls, 3);
  } finally { view.close(); }
});
test('route entry resets child state and reading position together including Back and retained document return', async () => {
  const module = await import('./TripEntryBoundary.tsx').catch(() => ({}));
  assert.equal(typeof module.TripEntryBoundary, 'function', 'entry reset boundary must be implemented');
  const { MemoryRouter, Routes, Route, useNavigate } = await import('react-router-dom');
  const { TripEntryBoundary, ItineraryStart, RouteScrollPolicy } = module;
  let navigate;
  let resets = 0;
  window.HTMLElement.prototype.scrollIntoView = () => { resets++; };
  window.scrollTo = () => {};
  window.requestAnimationFrame = () => 1;
  window.cancelAnimationFrame = () => {};
  function Controls() { navigate = useNavigate(); return null; }
  function Content() {
    const [open, setOpen] = React.useState(false);
    return React.createElement(ItineraryStart, null, React.createElement('button', { 'data-open': '', onClick: () => setOpen(!open) }, String(open)));
  }
  const view = mount(React.createElement(MemoryRouter, { initialEntries: ['/trip/synthetic?view=detailed'] },
    React.createElement(Controls), React.createElement(RouteScrollPolicy),
    React.createElement(Routes, null,
      React.createElement(Route, { path: '/trip/:slug', element: React.createElement(TripEntryBoundary, null, React.createElement(Content)) }),
      React.createElement(Route, { path: '/away', element: React.createElement('p', null, 'Synthetic away') }))));
  try {
    act(() => view.container.querySelector('[data-open]').click());
    assert.equal(view.container.querySelector('[data-open]').textContent, 'true');
    act(() => navigate('/away'));
    act(() => navigate(-1));
    assert.equal(view.container.querySelector('[data-open]').textContent, 'false');
    assert.equal(resets, 2);
    act(() => view.container.querySelector('[data-open]').click());
    act(() => window.dispatchEvent(new window.PageTransitionEvent('pageshow', { persisted: true })));
    assert.equal(view.container.querySelector('[data-open]').textContent, 'false');
    assert.equal(resets, 3);
    assert.equal(window.history.scrollRestoration, 'manual');
  } finally { view.close(); }
});
test('identical day task labels are occurrence-safe and nested controls never toggle the day', () => {
  const calls = [];
  const item = { id: 'synthetic-task', date: day.date, title: 'Synthetic task', detail: 'Synthetic detail' };
  const rich = { ...day, note: 'Synthetic note', tourDetails: { summary: 'Synthetic tour', body: 'Synthetic tour body' }, callout: '<b>Synthetic callout</b>' };
  const element = React.createElement(React.Fragment, null, ...['one', 'two'].map(rowId => React.createElement(DayCard, { ...props, key: rowId, rowId, day: rich, expanded: true, dayActionItems: [item], onToggleActionItem: id => calls.push(id), onExpandedChange: () => calls.push('day-toggle') })));
  const view = mount(element);
  try {
    const inputs = [...view.container.querySelectorAll('input')];
    assert.equal(new Set(inputs.map(i => i.id)).size, 2);
    // Only the checkbox toggles a task; its text is a plain, selectable span that names the checkbox.
    const text = document.getElementById(inputs[1].getAttribute('aria-labelledby'));
    assert.ok(text.textContent.includes('Synthetic task'));
    act(() => text.click());
    assert.deepEqual(calls, []);
    act(() => inputs[1].click());
    assert.deepEqual(calls, [item.id]);
    const details = view.container.querySelector('details');
    details.open = true;
    assert.equal(view.container.querySelectorAll('button[aria-expanded=true]').length, 2);
    act(() => view.root.render(React.createElement(DayCard, { ...props, day: rich, expanded: false })));
    assert.equal(view.container.querySelector('details'), null);
    act(() => view.root.render(React.createElement(DayCard, { ...props, day: rich, expanded: true })));
    assert.equal(view.container.querySelector('details').open, false);
    assert.equal(view.container.querySelector('.day-summary').textContent, 'Synthetic note');
  } finally { view.close(); }
});
test('live gaps removal returns focus to filter while retaining hidden disclosure choices', async () => {
  const { DetailedView } = await import('./DetailedView.tsx');
  const { resolveDays } = await import('../../lib/tripLogic.ts');
  const days = resolveDays({ days: [{ ...day, flights: [{ who: 'all', route: 'Synthetic route', status: 'needed', mode: 'train' }], hotels: [] }] });
  function Harness() {
    const [onlyGaps, setOnlyGaps] = React.useState(true);
    const [ticks, setTicks] = React.useState({});
    const filterRef = React.useRef(null);
    return React.createElement(React.Fragment, null,
      React.createElement('button', { ref: filterRef, 'data-filter': '', onClick: () => setOnlyGaps(!onlyGaps) }, 'Only gaps'),
      React.createElement(DetailedView, { days, legColors: [props.legColor], weather: {}, groups: [], ticks, onlyGaps, isGap: d => d.flights.length > 0 && Object.keys(ticks).length === 0, onOnlyGapsChange: setOnlyGaps, filterRef, onToggle(ids) { setTicks(Object.fromEntries(ids.map(id => [id, 'booked']))); }, actionItems: [], actionItemsDone: {}, onToggleActionItem() {} }));
  }
  const view = mount(React.createElement(Harness));
  try {
    act(() => view.container.querySelector('button[aria-expanded]').click());
    const status = view.container.querySelector('.status');
    status.focus();
    act(() => status.click());
    assert.equal(view.container.querySelector('.day-card'), null);
    assert.equal(document.activeElement, view.container.querySelector('[data-filter]'));
    assert.ok(view.container.textContent.includes('No days match Only gaps'));
    act(() => view.container.querySelector('.itinerary-empty button').click());
    assert.equal(view.container.querySelector('button[aria-expanded]').getAttribute('aria-expanded'), 'true');
  } finally { view.close(); }
});
test('reactive full payload updates preserve unique occurrences but reset ambiguous identical duplicates', async () => {
  const { DetailedView } = await import('./DetailedView.tsx');
  const shared = { days: [day, day, { ...day, date: '2040-01-03' }], legColors: [props.legColor, props.legColor, props.legColor], weather: {}, groups: [], ticks: {}, onlyGaps: false, onOnlyGapsChange() {}, filterRef: { current: null }, onToggle() {}, actionItems: [], actionItemsDone: {}, onToggleActionItem() {} };
  const view = mount(React.createElement(DetailedView, shared));
  try {
    act(() => { for (const b of view.container.querySelectorAll('button[aria-expanded]')) b.click(); });
    act(() => view.root.render(React.createElement(DetailedView, { ...shared, weather: {}, days: shared.days.map(d => ({ ...d })) })));
    assert.deepEqual([...view.container.querySelectorAll('button[aria-expanded]')].map(b => b.getAttribute('aria-expanded')), ['true','true','true']);
    act(() => view.root.render(React.createElement(DetailedView, { ...shared, days: [day, day, { ...shared.days[2], note: 'Synthetic edit' }] })));
    assert.deepEqual([...view.container.querySelectorAll('button[aria-expanded]')].map(b => b.getAttribute('aria-expanded')), ['false','false','true']);
    assert.equal(view.container.querySelectorAll('nav button').length, 3);
  } finally { view.close(); }
});
test('live removal of a focused inner control falls back to the filter even when its day remains', async () => {
  const { DetailedView } = await import('./DetailedView.tsx');
  const filter = document.createElement('button'); document.body.append(filter);
  const shared = { days: [{ ...day, acts: ['<a href="https://example.com/synthetic">Synthetic link</a>'] }], legColors: [props.legColor], weather: {}, groups: [], ticks: {}, onlyGaps: false, onOnlyGapsChange() {}, filterRef: { current: filter }, onToggle() {}, actionItems: [], actionItemsDone: {}, onToggleActionItem() {} };
  const view = mount(React.createElement(DetailedView, shared));
  try {
    act(() => view.container.querySelector('button[aria-expanded]').click());
    view.container.querySelector('.activity a').focus();
    act(() => view.root.render(React.createElement(DetailedView, { ...shared, days: [day] })));
    assert.equal(document.activeElement, filter);
    assert.equal(view.container.querySelector('button[aria-expanded]').getAttribute('aria-expanded'), 'true');
  } finally { view.close(); filter.remove(); }
});
test('existing rich transport lodging activity and task detail capabilities remain available', async () => {
  const { resolveDays, flightId } = await import('../../lib/tripLogic.ts');
  const hotel = { who: 'all', name: 'Synthetic lodging', address: 'Synthetic address', status: 'needed', detail: 'Synthetic lodging detail' };
  const richFlight = { who: 'all', route: 'Synthetic rich route', title: 'Synthetic multi-leg', status: 'needed', legs: [{ route: 'Synthetic leg A', time: 'Synthetic time', meta: 'Synthetic meta' }], layovers: ['Synthetic connection'] };
  const simple = { who: 'all', route: 'Synthetic simple route', mode: 'ferry', status: 'booked', detail: 'Synthetic transit detail' };
  const days = resolveDays({ days: [{ ...day, flights: [richFlight, simple], hotels: [hotel], acts: [{ tag: 'Synthetic tag', time: 'Synthetic time', text: '<b>Synthetic rich activity</b>' }] }, { ...day, date: '2040-01-03', hotels: 'same' }] });
  const calls = [];
  const view = mount(React.createElement(DayCard, { ...props, day: days[0], expanded: true, onToggle: (...args) => calls.push(args) }));
  try {
    for (const text of ['Synthetic multi-leg', 'Synthetic rich route', 'Synthetic lodging', 'Synthetic lodging detail', 'Synthetic simple route', 'Synthetic transit detail', 'Synthetic rich activity', 'Synthetic tag']) {
      // Rich flight title replaces its aggregate route, as in the existing renderer.
      if (text !== 'Synthetic rich route') assert.ok(view.container.textContent.includes(text), text);
    }
    assert.ok(view.container.querySelector('a[href^="https://maps.google.com/"]'));
    act(() => view.container.querySelector('.flight-box .status').click());
    assert.deepEqual(calls[0], [[flightId(day.date, richFlight)], 'needed']);
    assert.equal(view.container.querySelector('button[aria-expanded]').getAttribute('aria-expanded'), 'true');
    assert.equal(days[1].hotels[0].src, days[0].hotels[0].src);
    assert.equal(days[1].hotels[0].carried, true);
  } finally { view.close(); }
});
test('latest jump wins and a removed pending occurrence never scrolls to a surviving date match', async () => {
  const { DetailedView } = await import('./DetailedView.tsx');
  let updateDays;
  const destinations = [];
  window.HTMLElement.prototype.scrollIntoView = function() { destinations.push(this.id); };
  function Harness() {
    const [days, setDays] = React.useState([day, { ...day, date: '2040-01-03' }]);
    updateDays = setDays;
    return React.createElement(DetailedView, { days, legColors: [props.legColor, props.legColor], weather: {}, groups: [], ticks: {}, onlyGaps: false, onOnlyGapsChange() {}, filterRef: { current: null }, onToggle() {}, actionItems: [], actionItemsDone: {}, onToggleActionItem() {} });
  }
  const view = mount(React.createElement(Harness));
  try {
    const buttons = view.container.querySelectorAll('nav button');
    act(() => { buttons[0].click(); buttons[1].click(); });
    assert.equal(destinations.length, 1);
    assert.equal(document.activeElement, view.container.querySelectorAll('button[aria-expanded]')[1]);
    act(() => { buttons[1].click(); updateDays([day]); });
    assert.equal(destinations.length, 1);
    assert.ok(view.container.querySelector('[role=status]').textContent.includes('no longer available'));
    assert.equal(view.container.querySelectorAll('.day-card').length, 1);
  } finally { view.close(); }
});
test('bare urls are found without trailing punctuation and only as http(s)', async () => {
  const { findLinks } = await import('../../lib/links.ts');
  const hrefs = text => findLinks(text).map(l => l.href);
  assert.deepEqual(hrefs('See https://example.com/a, then www.example.org.'), ['https://example.com/a', 'https://www.example.org']);
  assert.deepEqual(hrefs('(https://example.com/x) and https://example.com/Foo_(bar)'), ['https://example.com/x', 'https://example.com/Foo_(bar)']);
  assert.deepEqual(hrefs('javascript:alert(1) ftp://example.com https:// www. mail@www.example.com'), []);
  const [l] = findLinks('go to https://example.com/a.');
  assert.equal('go to https://example.com/a.'.slice(l.start, l.end), 'https://example.com/a');
});
test('sanitizeHtml links bare urls but never double-links or links inside an existing anchor', async () => {
  const { sanitizeHtml } = await import('../../lib/sanitizeHtml.ts');
  const out = document.createElement('div');
  out.innerHTML = sanitizeHtml('Book <b>https://example.com/b</b> or <a href="https://example.com/c">https://example.com/c</a> <script>https://example.com/s</script>');
  const links = [...out.querySelectorAll('a')];
  assert.deepEqual(links.map(a => a.getAttribute('href')), ['https://example.com/b', 'https://example.com/c']);
  assert.ok(links.every(a => a.target === '_blank' && a.rel === 'noopener noreferrer'));
  assert.equal(out.querySelector('a a'), null);
  assert.equal(out.textContent.includes('example.com/s'), false);
  assert.equal(sanitizeHtml('plain <i>text</i>'), 'plain <i>text</i>');
});
test('plain-text task, tour and hotel text render clickable links that do not toggle the task', () => {
  const calls = [];
  const item = { id: 'synthetic-task', date: day.date, title: 'Book https://example.com/t', detail: 'Details at www.example.com/d.' };
  const rich = { ...day, hotels: [{ who: 'all', name: 'Synthetic lodging', address: 'Synthetic address', status: 'needed', detail: 'Info https://example.com/h' }], tourDetails: { summary: 'Synthetic tour', body: 'Tickets https://example.com/tour' } };
  const view = mount(React.createElement(DayCard, { ...props, day: rich, expanded: true, dayActionItems: [item], onToggleActionItem: id => calls.push(id) }));
  try {
    const hrefs = [...view.container.querySelectorAll('.action-text a, .tour-body a, .cmeta a')].map(a => a.getAttribute('href'));
    assert.ok(['https://example.com/t', 'https://www.example.com/d', 'https://example.com/tour', 'https://example.com/h'].every(h => hrefs.includes(h)), hrefs.join());
    assert.equal(view.container.querySelector('.action-text a[href="https://www.example.com/d"]').textContent, 'www.example.com/d');
    act(() => view.container.querySelector('.action-text a').click());
    assert.deepEqual(calls, []);
  } finally { view.close(); }
});
export { mount, day, props, React, act, assert, test };
