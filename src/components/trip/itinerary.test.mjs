// Synthetic-only developer checks. See implementation handoff for invocation.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
const require = createRequire(import.meta.url);
const { JSDOM } = require('jsdom');
const { DayCard } = await import('./DayCard.tsx');
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost' });
globalThis.React = React; // tsx's config-free classic JSX transform for this standalone probe.
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.localStorage = dom.window.localStorage; // tile open state is saved per trip
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const day = { date: '2040-01-02', city: 'Synthetic stop', leg: 'synthetic', _d: new Date(2040, 0, 2), flights: [], hotels: [], acts: ['Synthetic activity'] };
// Tile open state: a stub that follows each tile's own default; tests that toggle tiles use a stateful wrapper.
const tilesStub = { isOpen: (_id, defaultOpen) => defaultOpen, toggle() {}, setMany() {}, reveal() {} };
const props = { tiles: tilesStub, day, dayNumber: 0, legColor: { color: '#333', tint: '#eee', label: 'Synthetic leg' }, groups: [], ticks: {}, onlyGaps: false, onToggle() {}, dayActionItems: [], dayConsiderations: [], pendingVotes: {}, onVote() {}, actionItemsDone: {}, onToggleActionItem() {}, rowId: 'synthetic-row', expanded: false, onExpandedChange() {} };
// sanitizeHtml parses callouts/activities with these, so the page's DOM globals come from jsdom.
for (const name of ['DOMParser', 'Node', 'Element', 'NodeFilter', 'Text', 'Comment', 'DocumentFragment', 'Event', 'KeyboardEvent', 'MouseEvent', 'FocusEvent']) globalThis[name] = dom.window[name];
const { AiFocusProvider } = await import('../../hooks/useAiFocus.tsx');
const { Ctx: SettingsCtx } = await import('../../hooks/useSettings.tsx');
// The day cards read the AI-focus and settings contexts, so everything renders inside
// them (plain settings values: the real provider needs a Convex client). Wrapping `root`
// too keeps the tests' own `view.root.render(...)` calls inside them.
const settings = { theme: undefined, tempUnit: 'F', setTheme() {}, setTempUnit() {} };
// DetailedView reads the URL (useSearchParams), so it needs a Router too; tests that bring their own MemoryRouter keep it (routers can't nest).
const { MemoryRouter: DefaultRouter } = await import('react-router-dom');
const wrap = (element) => React.createElement(AiFocusProvider, null, React.createElement(SettingsCtx.Provider, { value: settings }, element.type === DefaultRouter ? element : React.createElement(DefaultRouter, null, element)));
// A DayCard whose tiles keep their open state, the way DetailedView does through useTileOpen.
const { useTileOpen } = await import('../../hooks/useTileOpen.ts');
function Stateful(p) { return React.createElement(DayCard, { ...p, tiles: useTileOpen('synthetic', !!p.gapsOnly) }); }
// Opens the "⋯" menu inside `scope` (a row, or the only row in a view) and returns its items.
const openMenu = (scope) => { act(() => scope.querySelector('.tl-menu-btn').click()); return [...scope.querySelectorAll('[role=menuitem]')]; };
const menuItem = (items, label) => items.find((i) => i.textContent === label);
const tileToggle = (container, test) => [...container.querySelectorAll('.tl-toggle')].find((b) => test(b.closest('.tl-tile')));
function mount(element) {
  const container = document.createElement('div'); document.body.append(container);
  const root = createRoot(container);
  act(() => root.render(wrap(element)));
  return { container, root: { render: (next) => root.render(wrap(next)), unmount: () => root.unmount() }, close() { act(() => root.unmount()); container.remove(); } };
}
test('only-gaps dates come from open booking, plan and transport tasks (one per open night or day) and open items tied to a day or range', async () => {
  const { gapDates, kindLabel } = await import('../../lib/tasks.ts');
  assert.equal(kindLabel({ kind: 'transport', scope: { kind: 'day', date: '2040-01-07' } }), 'Transport');
  const task = (kind, refs, refsDone) => ({ kind, refs, refsDone });
  const dates = gapDates([
    task('booking', ['booking:2040-01-02|h|Synthetic|a', 'booking:2040-01-03|h|Synthetic|a'], [true, false]), // half-booked stay
    task('plan', ['plan:2040-01-05|p|Synthetic'], [false]),
    task('plan', ['plan:2040-01-06|p|Synthetic'], [true]), // dismissed
    task('transport', ['transport:2040-01-07|t|Synthetic A → Synthetic B'], [false]), // a move with nothing entered
    task('transport', ['transport:2040-01-08|t|Synthetic B → Synthetic C'], [true]), // dismissed
    { ...task('custom', ['item:synthetic'], [false]), done: false, scope: { kind: 'trip' } }, // a whole-trip to-do marks no day
    { ...task('custom', ['item:synthetic-day'], [false]), done: false, scope: { kind: 'day', date: '2040-01-09' } }, // an open to-do on a day
    { ...task('custom', ['item:synthetic-done'], [true]), done: true, scope: { kind: 'day', date: '2040-01-10' } }, // done: not a gap
    { ...task('consider', ['item:synthetic-range'], [false]), done: false, scope: { kind: 'range', start: '2040-01-11', end: '2040-01-12' } }, // an open consideration covers its whole range
  ]);
  assert.deepEqual([...dates].sort(), ['2040-01-03', '2040-01-05', '2040-01-07', '2040-01-09', '2040-01-11', '2040-01-12']);
});
test('controlled closed day keeps its panel findable (until-found) and opens itself when the browser matches in it', () => {
  const calls = [];
  const view = mount(React.createElement(DayCard, { ...props, onExpandedChange: () => calls.push('toggle') }));
  try {
    const trigger = view.container.querySelector('button');
    assert.equal(trigger.getAttribute('aria-expanded'), 'false');
    const panel = document.getElementById(trigger.getAttribute('aria-controls'));
    assert.ok(panel);
    assert.equal(panel.getAttribute('hidden'), 'until-found');
    assert.ok(panel.textContent.includes('Synthetic activity'));
    panel.dispatchEvent(new window.Event('beforematch'));
    assert.deepEqual(calls, ['toggle']);
    // Once open, a match inside it must not toggle it closed again.
    act(() => view.root.render(React.createElement(DayCard, { ...props, expanded: true, onExpandedChange: () => calls.push('toggle') })));
    assert.equal(panel.hasAttribute('hidden'), false);
    panel.dispatchEvent(new window.Event('beforematch'));
    assert.deepEqual(calls, ['toggle']);
  } finally { view.close(); }
});
test('a tap anywhere on the day header (the photo, the space under the ⋯) opens or closes the day, once; its own controls keep their click', () => {
  const calls = [];
  const view = mount(React.createElement(DayCard, { ...props, onExpandedChange: () => calls.push('toggle') }));
  try {
    const heading = view.container.querySelector('.day-heading');
    act(() => heading.querySelector('.day-photo').click());
    act(() => heading.querySelector('.day-tools').click()); // the empty space around the ⋯
    assert.deepEqual(calls, ['toggle', 'toggle']);
    act(() => heading.querySelector('.day-head-btn .day-date').click()); // the button toggles itself: not twice
    assert.deepEqual(calls, ['toggle', 'toggle', 'toggle']);
    act(() => heading.querySelector('.tl-menu-btn').click()); // opening the ⋯ menu doesn't toggle the day
    assert.deepEqual(calls, ['toggle', 'toggle', 'toggle']);
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
      React.createElement(DetailedView, { days, legColors: [props.legColor, props.legColor], weather: {}, groups: [], ticks: {}, onlyGaps, isGap: d => !d.acts.length, onOnlyGapsChange: setOnlyGaps, filterRef, onToggle() {}, onJump() {}, actionItems: [], considerations: [], pendingVotes: {}, onVote() {}, actionItemsDone: {}, onToggleActionItem() {} }));
  }
  const view = mount(React.createElement(Harness));
  try {
    let triggers = [...view.container.querySelectorAll('.day-head-btn[aria-expanded]')];
    assert.equal(triggers.length, 2);
    assert.equal(new Set(triggers.map(b => b.id)).size, 2);
    act(() => triggers[0].click());
    act(() => triggers[1].click());
    assert.deepEqual(triggers.map(b => b.getAttribute('aria-expanded')), ['true', 'true']);
    act(() => triggers[0].click());
    assert.equal(triggers[1].getAttribute('aria-expanded'), 'true');
    act(() => view.container.querySelector('[data-filter]').click());
    assert.equal(view.container.querySelectorAll('.day-head-btn[aria-expanded]').length, 1);
    const jumps = view.container.querySelectorAll('nav button');
    assert.equal(jumps.length, 2);
    assert.notEqual(jumps[0].getAttribute('aria-label'), jumps[1].getAttribute('aria-label')); // the day number tells two same-date days apart
    act(() => jumps[0].click());
    triggers = [...view.container.querySelectorAll('.day-head-btn[aria-expanded]')];
    assert.equal(triggers.length, 2);
    assert.equal(triggers[0].getAttribute('aria-expanded'), 'true');
    assert.equal(document.activeElement, triggers[0]);
    act(() => jumps[0].click());
    assert.equal(scrolls, 2);
    // A filter change and jump can be queued before the same React commit.
    act(() => { view.container.querySelector('[data-filter]').click(); jumps[0].click(); });
    assert.equal(view.container.querySelectorAll('.day-head-btn[aria-expanded]').length, 2);
    assert.equal(document.activeElement, view.container.querySelector('.day-head-btn[aria-expanded]'));
    assert.equal(scrolls, 3);
  } finally { view.close(); }
});
test('route entry resets child state and reading position together including Back and retained document return', async () => {
  const module = await import('./TripEntryBoundary.tsx').catch(() => ({}));
  assert.equal(typeof module.TripEntryBoundary, 'function', 'entry reset boundary must be implemented');
  const { MemoryRouter, Routes, Route, useNavigate } = await import('react-router-dom');
  const { TripEntryBoundary, RouteScrollPolicy } = module;
  let navigate;
  let itineraryScrolls = 0;
  window.HTMLElement.prototype.scrollIntoView = () => { itineraryScrolls++; };
  window.scrollTo = () => {};
  function Controls() { navigate = useNavigate(); return null; }
  function Content() {
    const [open, setOpen] = React.useState(false);
    return React.createElement('button', { 'data-open': '', onClick: () => setOpen(!open) }, String(open));
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
    act(() => view.container.querySelector('[data-open]').click());
    act(() => window.dispatchEvent(new window.PageTransitionEvent('pageshow', { persisted: true })));
    assert.equal(view.container.querySelector('[data-open]').textContent, 'false');
    // Opening a trip never scrolls an element into view; only jumps do.
    assert.equal(itineraryScrolls, 0);
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
    // Each day's to-do is a card ticked from its "⋯" menu; ids stay unique across the two days.
    const todos = [...view.container.querySelectorAll('.tl-item')];
    assert.equal(todos.length, 2);
    const ids = [...view.container.querySelectorAll('[id]')].map((e) => e.id);
    assert.equal(new Set(ids).size, ids.length);
    // Only the menu ticks the task; the card's title opens and closes the card, never the day.
    const toggle = todos[1].querySelector('.tl-toggle');
    assert.ok(toggle.textContent.includes('Synthetic task'));
    act(() => toggle.click());
    assert.deepEqual(calls, []);
    const done = menuItem(openMenu(todos[1]), 'Mark as done');
    act(() => done.click());
    assert.deepEqual(calls, [item.id]);
    const details = view.container.querySelector('details');
    details.open = true;
    assert.equal(view.container.querySelectorAll('.day-head-btn[aria-expanded=true]').length, 2);
    act(() => view.root.render(React.createElement(DayCard, { ...props, day: rich, expanded: false })));
    // Collapsed content stays mounted (hidden until found) so Ctrl+F can match it.
    assert.ok(view.container.querySelector('details'));
    act(() => view.root.render(React.createElement(DayCard, { ...props, day: rich, expanded: true })));
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
      React.createElement(DetailedView, { days, legColors: [props.legColor], weather: {}, groups: [], ticks, onlyGaps, isGap: d => d.flights.length > 0 && Object.keys(ticks).length === 0, onOnlyGapsChange: setOnlyGaps, filterRef, onToggle(ids) { setTicks(Object.fromEntries(ids.map(id => [id, 'booked']))); }, actionItems: [], considerations: [], pendingVotes: {}, onVote() {}, actionItemsDone: {}, onToggleActionItem() {} }));
  }
  const view = mount(React.createElement(Harness));
  try {
    // Under Only gaps the day opens on its own.
    assert.equal(view.container.querySelector('.day-head-btn[aria-expanded]').getAttribute('aria-expanded'), 'true');
    const book = menuItem(openMenu(view.container.querySelector('.tl-transport')), 'Mark as booked');
    book.focus();
    await act(async () => book.click());
    assert.equal(view.container.querySelector('.day-card'), null);
    assert.equal(document.activeElement, view.container.querySelector('[data-filter]'));
    assert.ok(view.container.textContent.includes('No days match Only gaps'));
    act(() => view.container.querySelector('.itinerary-empty button').click());
    // The normal view keeps its own choices; the day wasn't opened by hand there.
    assert.equal(view.container.querySelector('.day-head-btn[aria-expanded]').getAttribute('aria-expanded'), 'false');
  } finally { view.close(); }
});
test('reactive full payload updates preserve unique occurrences but reset ambiguous identical duplicates', async () => {
  const { DetailedView } = await import('./DetailedView.tsx');
  const shared = { days: [day, day, { ...day, date: '2040-01-03' }], legColors: [props.legColor, props.legColor, props.legColor], weather: {}, groups: [], ticks: {}, onlyGaps: false, onOnlyGapsChange() {}, filterRef: { current: null }, onToggle() {}, actionItems: [], considerations: [], pendingVotes: {}, onVote() {}, actionItemsDone: {}, onToggleActionItem() {} };
  const view = mount(React.createElement(DetailedView, shared));
  try {
    act(() => { for (const b of view.container.querySelectorAll('.day-head-btn[aria-expanded]')) b.click(); });
    act(() => view.root.render(React.createElement(DetailedView, { ...shared, weather: {}, days: shared.days.map(d => ({ ...d })) })));
    assert.deepEqual([...view.container.querySelectorAll('.day-head-btn[aria-expanded]')].map(b => b.getAttribute('aria-expanded')), ['true','true','true']);
    act(() => view.root.render(React.createElement(DetailedView, { ...shared, days: [day, day, { ...shared.days[2], note: 'Synthetic edit' }] })));
    assert.deepEqual([...view.container.querySelectorAll('.day-head-btn[aria-expanded]')].map(b => b.getAttribute('aria-expanded')), ['false','false','true']);
    assert.equal(view.container.querySelectorAll('nav button').length, 3);
  } finally { view.close(); }
});
test('live removal of a focused inner control keeps focus on its day header while the day remains', async () => {
  const { DetailedView } = await import('./DetailedView.tsx');
  const filter = document.createElement('button'); document.body.append(filter);
  const shared = { days: [{ ...day, flights: [{ who: 'all', route: 'Synthetic A → Synthetic B', status: 'booked' }] }], legColors: [props.legColor], weather: {}, groups: [], ticks: {}, onlyGaps: false, onOnlyGapsChange() {}, filterRef: { current: filter }, onToggle() {}, actionItems: [], considerations: [], pendingVotes: {}, onVote() {}, actionItemsDone: {}, onToggleActionItem() {} };
  const view = mount(React.createElement(DetailedView, shared));
  try {
    act(() => view.container.querySelector('.day-head-btn[aria-expanded]').click());
    view.container.querySelector('.tl-transport .tl-menu-btn').focus(); // a control on a row the update removes
    act(() => view.root.render(React.createElement(DetailedView, { ...shared, days: [day] })));
    // The day is still shown, so focus lands on its header rather than the filter (#174).
    // Compare booleans: a failed assert.equal on jsdom elements inspects the whole DOM.
    assert.ok(document.activeElement === view.container.querySelector('.day-head-btn[aria-expanded]'));
    assert.equal(view.container.querySelector('.day-head-btn[aria-expanded]').getAttribute('aria-expanded'), 'true');
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
    for (const text of ['Synthetic multi-leg', 'Synthetic rich route', 'Synthetic lodging', 'Synthetic lodging detail', 'Synthetic simple route', 'Synthetic transit detail', 'Synthetic rich activity']) {
      // Rich flight title replaces its aggregate route, as in the existing renderer.
      if (text !== 'Synthetic rich route') assert.ok(view.container.textContent.includes(text), text);
    }
    // An activity's tag is its icon; the tag's name is the icon's tooltip, not a second line.
    assert.ok([...view.container.querySelectorAll('.tl-dot')].some((dot) => dot.getAttribute('title') === 'Synthetic tag'));
    assert.match(menuItem(openMenu(view.container.querySelector('.tl-hotel')), 'Open in Google Maps').getAttribute('href'), /^https:\/\/www\.google\.com\/maps\//);
    const book = menuItem(openMenu(view.container.querySelector('.tl-transport')), 'Mark as booked');
    await act(async () => book.click());
    assert.deepEqual(calls[0], [[flightId(day.date, richFlight)], 'needed']);
    assert.equal(view.container.querySelector('.day-head-btn[aria-expanded]').getAttribute('aria-expanded'), 'true');
    assert.equal(days[1].hotels[0].src, days[0].hotels[0].src);
    assert.equal(days[1].hotels[0].carried, true);
  } finally { view.close(); }
});
test('legacy flight legs show an airline logo chip from the flight number in meta', async () => {
  const { resolveDays } = await import('../../lib/tripLogic.ts');
  const legs = [
    { route: 'Synthetic leg A', time: 'Synthetic time', meta: 'JL5 · Synthetic meta' },
    { route: 'Synthetic leg B', time: 'Synthetic time', meta: 'UA 837 · Synthetic meta' },
    { route: 'Synthetic leg C', time: 'Synthetic time', meta: 'Synthetic meta' },
    { route: 'Synthetic leg D', time: 'Synthetic time', meta: 'Synthetic Air CI 21 · Airbus A350 · 13h' },
  ];
  const flight = { who: 'all', route: 'Synthetic route', title: 'Synthetic multi-leg', status: 'booked', legs };
  const days = resolveDays({ days: [{ ...day, flights: [flight] }] });
  const view = mount(React.createElement(DayCard, { ...props, day: days[0], expanded: true, onToggle() {} }));
  try {
    const srcs = [...view.container.querySelectorAll('.fl-airline')].map(i => i.getAttribute('src'));
    assert.deepEqual(srcs, [
      'https://www.gstatic.com/flights/airline_logos/70px/JL.png',
      'https://www.gstatic.com/flights/airline_logos/70px/UA.png',
      'https://www.gstatic.com/flights/airline_logos/70px/CI.png',
    ]);
  } finally { view.close(); }
});
test('structured segments render as boarding-pass rows with a computed layover and a tap-to-reveal confirmation', async () => {
  const { resolveDays } = await import('../../lib/tripLogic.ts');
  const segments = [
    { from: 'SEA', to: 'TPE', depart: '2040-01-02T00:10', arrive: '2040-01-03T05:20', airline: 'CI', number: '21', aircraft: 'Synthetic jet', cabin: 'Synthetic cabin' },
    { from: 'TPE', to: 'BKK', depart: '2040-01-03T07:00', arrive: '2040-01-03T09:50', airline: 'CI', number: '833' },
  ];
  const flight = { who: 'all', route: 'Synthetic route', title: 'Synthetic multi-segment', status: 'booked', segments, confirmation: 'SYNTH1' };
  const days = resolveDays({ days: [{ ...day, flights: [flight] }] });
  const view = mount(React.createElement(DayCard, { ...props, day: days[0], expanded: true, onToggle() {} }));
  try {
    const box = view.container.querySelector('.tl-transport');
    assert.equal(box.querySelectorAll('.seg').length, 2);
    assert.deepEqual([...box.querySelectorAll('.seg-time')].map(t => t.textContent), ['00:10', '05:20+1', '07:00', '09:50']);
    assert.deepEqual([...box.querySelectorAll('.seg-dur')].map(t => t.textContent), ['13h 10m', '3h 50m']);
    assert.equal(box.querySelector('.fl-layover').textContent, '1h 40m layover · TPE');
    assert.equal(box.querySelector('.fl-airline').getAttribute('src'), 'https://www.gstatic.com/flights/airline_logos/70px/CI.png');
    assert.ok(box.textContent.includes('Synthetic jet') && box.textContent.includes('Synthetic cabin'));
    // The booking reference is not on screen until tapped.
    assert.ok(!box.textContent.includes('SYNTH1'));
    act(() => box.querySelector('.conf-chip').click());
    assert.ok(box.querySelector('.conf-chip').textContent.includes('SYNTH1'));
  } finally { view.close(); }
});
test('hotel tiles show their stay facts and a tap-to-reveal confirmation; a not-chosen hotel says what is to be decided', async () => {
  const { resolveDays } = await import('../../lib/tripLogic.ts');
  const booked = { who: 'all', name: 'Synthetic Hotel', address: 'Synthetic street', status: 'booked', checkInTime: '15:00', checkOutTime: '11:00', room: 'Synthetic twin', price: { amount: 131.03, currency: 'USD', per: 'night' }, confirmation: 'SYNTH1', detail: 'Synthetic leftover' };
  const open = { who: 'all', name: 'TBD — Synthetic hotel', status: 'needed', area: 'Synthetic area', detail: 'Synthetic free-form note' };
  // Two nights, so the first day is the check-in day and not also the check-out day.
  const days = resolveDays({ days: [{ ...day, hotels: [booked, open] }, { ...day, date: '2040-01-03', hotels: [{ ...booked, checkInTime: undefined, confirmation: undefined }] }] });
  const view = mount(React.createElement(DayCard, { ...props, day: days[0], expanded: true, onToggle() {} }));
  try {
    const cards = [...view.container.querySelectorAll('.tl-hotel')];
    const stay = cards.find((c) => c.textContent.includes('Synthetic Hotel') && !c.textContent.includes('TBD'));
    const text = stay.textContent;
    assert.ok(text.includes('Check-in from 15:00') && text.includes('Synthetic twin') && text.includes('$131.03 / night') && text.includes('Synthetic leftover'));
    assert.ok(!text.includes('Check-out by')); // the check-out time belongs on the check-out tile, not the arrival tile
    assert.ok(!text.includes('SYNTH1')); // the reference stays hidden until tapped
    act(() => stay.querySelector('.conf-chip').click());
    assert.ok(stay.querySelector('.conf-chip').textContent.includes('SYNTH1'));
    assert.ok(!stay.querySelector('.tbd')); // a booked tile never says "to be decided"
    const undecided = cards.find((c) => c.textContent.includes('Hotel to be decided'));
    assert.ok(!undecided.textContent.includes('TBD')); // the typed placeholder is not shown
    assert.equal(undecided.querySelector('.cmain').textContent, 'Hotel to be decided');
    assert.equal(undecided.querySelector('.cmain a'), null); // no pin or map link for a place that isn't chosen
    assert.equal(undecided.querySelector('.cmeta').textContent, 'Synthetic area'); // the city sits under the title
    assert.equal(undecided.querySelector('.tbd-label').textContent, 'To be decided');
    assert.equal(undecided.querySelector('.tx-state.open').textContent, 'Not booked'); // amber state text, like the proposal
    assert.ok(undecided.classList.contains('miss')); // the dashed amber tile
    assert.deepEqual([...undecided.querySelectorAll('.tbd-chip')].map((c) => c.textContent), ['hotel', 'check-in time', 'check-out time']);
    assert.equal(undecided.querySelector('.tbd a'), null); // the search is in the card's menu, not inline
    const search = menuItem(openMenu(undecided), 'Search hotels here');
    assert.ok(new URL(search.href).searchParams.get('q').startsWith('Hotels in Synthetic area'));
    assert.equal(undecided.querySelector('.tile-links'), null); // no separate links row
    const note = [...undecided.querySelectorAll('.cmeta')].find((m) => m.textContent === 'Synthetic free-form note');
    assert.ok(note.compareDocumentPosition(undecided.querySelector('.tbd')) & 2); // the note comes after the to-be-decided row (preceding bit)
    assert.ok(note.parentElement.lastElementChild === note); // and is the last thing in its column of the tile (a boolean: a failing element diff would hang the run)
    assert.ok(!stay.querySelector('.tile-links')); // a booked tile has no actions to book
  } finally { view.close(); }
});
test('a not-booked transport tile lists what is to be decided; a booked one missing a field is labelled under Only gaps', async () => {
  const { resolveDays, flightId } = await import('../../lib/tripLogic.ts');
  const needed = { who: 'all', route: 'Synthetic needed route', status: 'needed' };
  const bookedPlain = { who: 'all', route: 'Synthetic booked route', status: 'booked' };
  const days = resolveDays({ days: [{ ...day, flights: [needed, bookedPlain] }] });
  const id = flightId(day.date, bookedPlain);
  const gaps = { plan: false, transport: [], details: [{ key: `details:${id}`, kind: 'details', refs: [`details:${id}`], refsDone: [false], done: false }] };
  const view = mount(React.createElement(DayCard, { ...props, day: days[0], expanded: true, gapsOnly: true, gaps, onToggle() {} }));
  try {
    const cards = [...view.container.querySelectorAll('.tl-transport')];
    const open = cards.find((c) => c.textContent.includes('Synthetic needed route'));
    assert.equal(open.querySelector('.tbd-label').textContent, 'To be decided');
    // One blank hop (the route names no places we can read), so every field is open.
    assert.deepEqual([...open.querySelectorAll('.tbd-chip')].map((c) => c.textContent), ['origin', 'destination', 'airline', 'flight number', 'depart time', 'arrive time']);
    assert.deepEqual([...open.querySelectorAll('.seg-time')].map((t) => t.textContent), ['--:--', '--:--']); // the blank slots
    assert.equal(open.querySelector('.tx-state.open').textContent, 'Not booked');
    const missing = cards.find((c) => c.textContent.includes('Synthetic booked route'));
    assert.equal(missing.querySelector('.tx-state.open').textContent, 'Missing details');
    assert.ok(!missing.querySelector('.tbd')); // booked: labelled as a gap, but not "to be decided"
  } finally { view.close(); }
});
test('a hop not planned yet is the same tile: blank time slots, a day or a window, an undecided place, Maybe', async () => {
  const { resolveDays } = await import('../../lib/tripLogic.ts');
  const rows = [
    { who: 'all', route: 'Synthetic window route', status: 'needed', mode: 'train', segments: [{ from: 'Synthetic A', to: 'Synthetic B', window: { from: '2040-01-10', to: '2040-01-12' }, note: 'Synthetic preference' }] },
    { who: 'all', route: 'Synthetic day route', status: 'needed', mode: 'train', segments: [{ from: 'Synthetic C', depart: '2040-01-02' }] },
    { who: 'all', route: 'Synthetic A → Synthetic M → Synthetic Z', status: 'needed' },
    { who: 'all', route: 'Synthetic maybe route', status: 'needed', tentative: true },
  ];
  const maybeHotel = { who: 'all', name: 'Synthetic maybe stay', status: 'needed', tentative: true };
  const days = resolveDays({ days: [{ ...day, flights: rows, hotels: [maybeHotel] }] });
  const gaps = { plan: false, transport: [], details: [] };
  const view = mount(React.createElement(DayCard, { ...props, day: days[0], expanded: true, gapsOnly: true, gaps, onToggle() {} }));
  try {
    const tiles = [...view.container.querySelectorAll('.tl-transport')];
    const tile = (t) => tiles.find((c) => c.textContent.includes(t));
    const win = tile('Synthetic window route');
    assert.ok(win.textContent.includes('Any day Jan 10–12') && win.textContent.includes('Synthetic preference'));
    assert.deepEqual([...win.querySelectorAll('.seg-time')].map((t) => t.textContent), ['--:--', '--:--']);
    const dayOnly = tile('Synthetic day route');
    assert.ok(dayOnly.textContent.includes('Not decided')); // the destination was never chosen
    assert.ok(dayOnly.textContent.includes('Mon, Jan 2')); // the day shows where a time would
    assert.ok(dayOnly.querySelector('.seg-undecided'));
    const multi = tile('Synthetic A → Synthetic M → Synthetic Z');
    assert.equal(multi.querySelectorAll('.seg').length, 2); // built from the route: two hops, no plain card
    const maybe = tile('Synthetic maybe route');
    assert.equal(maybe.querySelector('.maybe-pill').textContent, 'Maybe');
    assert.ok(!maybe.querySelector('.gap-reason')); // a maybe row is not a gap
    const stay = [...view.container.querySelectorAll('.tl-hotel')].find((c) => c.textContent.includes('Synthetic maybe stay'));
    assert.equal(stay.querySelector('.maybe-pill').textContent, 'Maybe');
    assert.ok(!stay.querySelector('.gap-reason'));
    assert.equal(view.container.querySelectorAll('.tl-gap').length, 0); // no transport row falls back to the old card
  } finally { view.close(); }
});
test('a hotel tile shows the whole stay on every night: both times, nights, a dot for tonight, per-night price, directions, and opens in Google Maps', async () => {
  const { resolveDays } = await import('../../lib/tripLogic.ts');
  const stay = (extra = {}) => ({ who: 'all', name: 'Synthetic Hotel', address: 'Synthetic street', status: 'booked', ...extra });
  const raw = { days: [
    { ...day, date: '2040-01-02', hotels: [stay({ checkInTime: '15:00', price: { amount: 900, currency: 'USD', per: 'stay' } })] },
    { ...day, date: '2040-01-03', hotels: 'same' },
    { ...day, date: '2040-01-04', hotels: 'same' },
    { ...day, date: '2040-01-05', hotels: [stay({ checkOutTime: '12:00' })] },
  ] };
  const days = resolveDays(raw);
  const render = (i) => mount(React.createElement(DayCard, { ...props, day: days[i], days, dayNumber: i, expanded: true, onToggle() {} }));
  let view = render(0);
  try {
    const card = view.container.querySelector('.tl-hotel');
    assert.equal(card.querySelector('.tl-title').textContent, 'Synthetic Hotel');
    assert.match(menuItem(openMenu(card), 'Open in Google Maps').getAttribute('href'), /google\.com\/maps/); // the menu opens Google Maps
    assert.equal(card.querySelector('.cmain'), null); // and isn't repeated in the body
    const strip = card.querySelector('.stay-strip');
    assert.ok(strip.textContent.includes('3 nights') && strip.textContent.includes('Mon, Jan 2 · 15:00') && strip.textContent.includes('Thu, Jan 5 · 12:00')); // both times on the check-in tile
    assert.equal(strip.querySelectorAll('.stay-dot').length, 4);
    assert.equal(strip.querySelectorAll('.stay-dot.on').length, 1);
    assert.equal(strip.querySelectorAll('.stay-dot.now').length, 1);
    assert.ok(card.textContent.includes('$900.00 total · $300 / night'));
    assert.ok(!card.textContent.includes('Check-in from')); // the strip says it; not repeated
    assert.equal(card.querySelector('a[href*="google.com/maps/dir"]'), null); // no Directions button
    assert.equal(card.querySelector('.stay-collapse'), null); // a full tile that was never slim has nothing to collapse
  } finally { view.close(); }
  view = render(3);
  try {
    const strip = view.container.querySelector('.stay-strip');
    assert.equal(strip.querySelectorAll('.stay-dot.on').length, 4); // the whole stay is done
    assert.equal(strip.querySelector('.stay-hot'), null); // no blue date: the ringed dot already says where you are
    assert.ok(!/\bIn\b|\bOut\b/.test(strip.querySelector('.stay-lbl').textContent)); // the dates alone, left is in and right is out
    assert.ok(strip.querySelector('.stay-dot.now'));
  } finally { view.close(); }
});
test('a hotel tile shows the cancellation deadline in its colour, a Call link, and a budget only while unbooked', async () => {
  const { resolveDays } = await import('../../lib/tripLogic.ts');
  const when = (offsetHours) => { const d = new Date(Date.now() + offsetHours * 36e5); const p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };
  const render = (hotel) => {
    const days = resolveDays({ days: [{ ...day, date: '2040-01-02', hotels: [hotel] }, { ...day, date: '2040-01-04', hotels: [hotel] }] });
    return mount(React.createElement(DayCard, { ...props, day: days[0], days, dayNumber: 0, expanded: true, onToggle() {} }));
  };
  const base = { who: 'all', name: 'Synthetic Hotel', address: 'Synthetic street', status: 'booked', phone: '+00 111 222 3333' };
  const chip = (view) => view.container.querySelector('.seg-chip[class*="cx-"]');
  let view = render({ ...base, freeCancelUntil: when(24 * 10) });
  try {
    assert.ok(chip(view).classList.contains('cx-ok') && /Free cancel until .*\(\d+ days\)/.test(chip(view).textContent));
    const call = menuItem(openMenu(view.container.querySelector('.tl-hotel')), 'Call +00 111 222 3333'); // in the row's "⋯" menu
    assert.equal(call.getAttribute('href'), 'tel:+001112223333');
    assert.equal(call.getAttribute('target'), null); // a phone link stays in the same tab
    assert.equal(view.container.querySelector('.cmain a[href^="tel:"]'), null); // no longer beside the name
  } finally { view.close(); }
  view = render({ ...base, freeCancelUntil: when(30) });
  try { assert.ok(chip(view).classList.contains('cx-soon') && chip(view).textContent.startsWith('⚠ Free cancel ends in 2 days')); } finally { view.close(); }
  view = render({ ...base, freeCancelUntil: when(-24) });
  try { assert.ok(chip(view).classList.contains('cx-ended') && chip(view).textContent === 'Cancellation window ended'); } finally { view.close(); }
  // No Call link without a phone; the budget shows only while the stay is not booked.
  view = render({ ...base, phone: undefined, status: 'needed', budget: { amount: 400, currency: 'USD', per: 'night' } });
  try {
    assert.ok(!view.container.querySelector('a[href^="tel:"]'));
    assert.deepEqual([...view.container.querySelectorAll('.seg-chip')].map((c) => c.textContent).filter((t) => /≈/.test(t)), ['Budget ≈ $400.00 / night', '≈ $800.00 for 2 nights']); // two chips, not one long one
  } finally { view.close(); }
  view = render({ ...base, budget: { amount: 400, currency: 'USD', per: 'night' } });
  try { assert.ok(!view.container.textContent.includes('Budget')); } finally { view.close(); }
});
test('every night of a stay is a tile that opens and closes on its own: first, middle and last', async () => {
  const { resolveDays } = await import('../../lib/tripLogic.ts');
  const stay = (extra = {}) => ({ who: 'all', name: 'Synthetic Hotel', address: 'Synthetic street', status: 'booked', ...extra });
  const days = resolveDays({ days: [
    { ...day, date: '2040-01-02', hotels: [stay({ checkInTime: '15:00' })] },
    { ...day, date: '2040-01-03', hotels: 'same' },
    { ...day, date: '2040-01-04', hotels: [stay({ checkOutTime: '12:00' })] },
  ] });
  const nights = [['first', 0, 'Check-in 15:00 · 2 nights'], ['middle', 1, 'Night 2 of 2'], ['last', 2, 'Check-out 12:00']];
  for (const [which, i, meta] of nights) {
    const view = mount(React.createElement(Stateful, { ...props, day: days[i], days, dayNumber: i, expanded: true, onToggle() {} }));
    try {
      const toggle = view.container.querySelector('.tl-hotel .tl-toggle');
      const head = view.container.querySelector('.tl-hotel .tl-head').textContent;
      assert.ok(head.includes('Synthetic Hotel') && head.includes(meta), `${which}: header says ${meta}, got ${head}`);
      assert.equal(toggle.getAttribute('aria-expanded'), 'false', `${which}: a booked night starts closed`);
      assert.equal(view.container.querySelector('.tl-hotel .tl-body').getAttribute('hidden'), 'until-found');
      act(() => toggle.click());
      assert.equal(toggle.getAttribute('aria-expanded'), 'true');
      assert.ok(view.container.querySelector('.tl-hotel .stay-strip'), `${which}: opens to the full tile`);
      assert.equal(view.container.querySelector('.tl-hotel .tl-body').hasAttribute('hidden'), false);
      act(() => toggle.click());
      assert.equal(toggle.getAttribute('aria-expanded'), 'false');
    } finally { view.close(); }
  }
  // An unbooked night starts open with nothing hiding it, and the reader can still close it: a dot then says it is unresolved.
  localStorage.clear(); // the loop above saved this hotel's first night as closed
  const open = resolveDays({ days: [{ ...day, hotels: [stay({ status: 'needed' })] }] });
  const view = mount(React.createElement(Stateful, { ...props, day: open[0], days: open, expanded: true, onToggle() {} }));
  try {
    const toggle = view.container.querySelector('.tl-hotel .tl-toggle');
    assert.equal(toggle.getAttribute('aria-expanded'), 'true');
    assert.equal(view.container.querySelector('.tl-warn'), null);
    act(() => toggle.click());
    assert.equal(toggle.getAttribute('aria-expanded'), 'false');
    assert.ok(view.container.querySelector('.tl-warn'));
    assert.equal(view.container.querySelector('.stay-collapse'), null); // the old "Show less" button is gone
  } finally { view.close(); }
});
test('moving hotels on one day says how long it is between check-out and check-in', async () => {
  const { resolveDays } = await import('../../lib/tripLogic.ts');
  const hotel = (name, extra = {}) => ({ who: 'all', name, address: 'Synthetic street', status: 'booked', ...extra });
  const days = resolveDays({ days: [
    { ...day, date: '2040-01-02', hotels: [hotel('Synthetic Hotel A', { checkOutTime: '11:00' })] },
    { ...day, date: '2040-01-03', hotels: [hotel('Synthetic Hotel A'), hotel('Synthetic Hotel B', { checkInTime: '15:00' })] },
    { ...day, date: '2040-01-04', hotels: [hotel('Synthetic Hotel B')] },
  ] });
  const view = mount(React.createElement(DayCard, { ...props, day: days[1], days, dayNumber: 1, expanded: true, onToggle() {} }));
  try {
    const into = [...view.container.querySelectorAll('.tl-hotel')].find((c) => c.textContent.includes('Synthetic Hotel B'));
    assert.ok(into.querySelector('.stay-gap').textContent.includes('4h between check-out at Synthetic Hotel A (11:00) and check-in here'));
    const leaving = [...view.container.querySelectorAll('.tl-hotel')].find((c) => c.textContent.includes('Synthetic Hotel A') && !c.textContent.includes('Synthetic Hotel B'));
    assert.ok(!leaving.querySelector('.stay-gap')); // only the tile you are arriving at
  } finally { view.close(); }
});
test('a booking can mix a ferry hop and a flight hop, each with its own icon and operator', async () => {
  const { resolveDays } = await import('../../lib/tripLogic.ts');
  const segments = [
    { from: 'Synthetic Pier', to: 'Synthetic Quay', mode: 'ferry', carrier: 'Synthetic Ferries', depart: '2040-01-02T16:00', arrive: '2040-01-02T16:45' },
    { from: 'USM', to: 'BKK', airline: 'PG', number: '170', depart: '2040-01-02T19:05', arrive: '2040-01-02T20:20' },
  ];
  const flight = { who: 'all', route: 'Synthetic mixed route', status: 'booked', segments };
  const days = resolveDays({ days: [{ ...day, flights: [flight] }] });
  const view = mount(React.createElement(DayCard, { ...props, day: days[0], expanded: true, onToggle() {} }));
  try {
    const rows = view.container.querySelectorAll('.tl-transport .seg');
    assert.equal(rows.length, 2);
    assert.ok(rows[0].querySelector('.seg-mode').textContent.includes('⛴'));
    assert.ok(rows[0].textContent.includes('Synthetic Ferries') && rows[0].querySelector('.seg-dur').textContent === '45m');
    assert.ok(rows[1].querySelector('.fl-airline') && !rows[1].querySelector('.seg-mode'));
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
    return React.createElement(DetailedView, { days, legColors: [props.legColor, props.legColor], weather: {}, groups: [], ticks: {}, onlyGaps: false, onOnlyGapsChange() {}, filterRef: { current: null }, onToggle() {}, actionItems: [], considerations: [], pendingVotes: {}, onVote() {}, actionItemsDone: {}, onToggleActionItem() {} });
  }
  const view = mount(React.createElement(Harness));
  try {
    const buttons = view.container.querySelectorAll('nav button');
    act(() => { buttons[0].click(); buttons[1].click(); });
    assert.equal(destinations.length, 1);
    assert.equal(document.activeElement, view.container.querySelectorAll('.day-head-btn[aria-expanded]')[1]);
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
test('task text keeps <a> markup as a link with its label and drops unsafe markup', () => {
  const item = { id: 'synthetic-markup', date: day.date, title: 'Book via <a href="https://example.com/k">Klook</a>', detail: 'See <a href="javascript:alert(1)">bad</a> <script>x</script>' };
  const view = mount(React.createElement(DayCard, { ...props, day, expanded: true, dayActionItems: [item], onToggleActionItem: () => {} }));
  try {
    const link = view.container.querySelector('.action-text a[href="https://example.com/k"]');
    assert.equal(link.textContent, 'Klook');
    assert.equal(view.container.querySelector('.action-text a[href^="javascript"]'), null);
    assert.equal(view.container.querySelector('.action-text').textContent.includes('<a'), false);
  } finally { view.close(); }
});
export { mount, day, props, React, act, assert, test };

test('Only gaps opens each day and shows just the open items, each with why it is listed', async () => {
  const { MemoryRouter } = await import('react-router-dom');
  const { DetailedView } = await import('./DetailedView.tsx');
  const { resolveDays } = await import('../../lib/tripLogic.ts');
  const open = { who: 'all', name: 'Synthetic open lodging', address: 'Synthetic address', status: 'needed' };
  const booked = { who: 'all', name: 'Synthetic booked lodging', address: 'Synthetic address', status: 'booked' };
  const days = resolveDays({ days: [{ ...day, hotels: [open, booked], flights: [{ who: 'all', route: 'Synthetic booked route', status: 'booked', mode: 'train' }], callout: 'Synthetic callout', acts: ['Synthetic activity'] }, { ...day, date: '2040-01-03', hotels: [], flights: [], acts: [] }] });
  const gaps = { '2040-01-03': { plan: true, transport: [{ key: 'transport:2040-01-03|t|A → B', title: 'Synthetic A → Synthetic B' }] } };
  function Harness() {
    const [onlyGaps, setOnlyGaps] = React.useState(true);
    const filterRef = React.useRef(null);
    return React.createElement(React.Fragment, null,
      React.createElement('button', { ref: filterRef, 'data-filter': '', onClick: () => setOnlyGaps(!onlyGaps) }, 'Only gaps'),
      React.createElement(DetailedView, { days, legColors: [props.legColor, props.legColor], weather: {}, groups: [], ticks: {}, onlyGaps, isGap: () => true, dayGaps: gaps, onOnlyGapsChange: setOnlyGaps, filterRef, onToggle() {}, actionItems: [], considerations: [], pendingVotes: {}, onVote() {}, actionItemsDone: {}, onToggleActionItem() {} }));
  }
  const view = mount(React.createElement(MemoryRouter, null, React.createElement(Harness)));
  const triggers = () => [...view.container.querySelectorAll('.day-head-btn[aria-expanded]')];
  try {
    assert.deepEqual(triggers().map(b => b.getAttribute('aria-expanded')), ['true', 'true']);
    const text = view.container.textContent;
    assert.ok(text.includes('Synthetic open lodging') && text.includes('Not booked'));
    // Booked hotels and transport stay as planning context, without the "Not booked" label.
    const cardWith = (t) => [...view.container.querySelectorAll('.tl-hotel, .tl-transport')].find(c => c.textContent.includes(t));
    assert.ok(cardWith('Synthetic booked lodging') && !cardWith('Synthetic booked lodging').textContent.includes('Not booked'));
    assert.ok(cardWith('Synthetic booked route') && !cardWith('Synthetic booked route').textContent.includes('Not booked'));
    assert.ok(cardWith('Synthetic open lodging').textContent.includes('Not booked'));
    assert.ok(!text.includes('Synthetic activity') && !text.includes('Synthetic callout'));
    assert.ok(text.includes('Not planned') && text.includes('None entered') && text.includes('Synthetic A → Synthetic B'));
    // An empty day is a row on the rail like any other tile, not a loose line of text.
    const empty = view.container.querySelector('.tl-plan');
    assert.ok(empty && empty.closest('li.tl-entry') && empty.classList.contains('tl-flat'));
    assert.equal(empty.querySelector('.tx-state').textContent, 'Not planned');
    // A day can still be closed by hand; turning the filter off and on opens it again.
    act(() => triggers()[0].click());
    assert.equal(triggers()[0].getAttribute('aria-expanded'), 'false');
    act(() => view.container.querySelector('[data-filter]').click());
    assert.equal(triggers()[0].getAttribute('aria-expanded'), 'false'); // normal view: nothing was opened by hand
    act(() => view.container.querySelector('[data-filter]').click());
    assert.equal(triggers()[0].getAttribute('aria-expanded'), 'true');
  } finally { view.close(); }
});
test('word diff marks only the words that changed', async () => {
  const { diffWords, plainText } = await import('../../lib/wordDiff.ts');
  const parts = diffWords('Winter gear list. Josh: Large Thermals?', 'Summer gear list. Tony: Swim shorts.');
  const of = state => parts.filter(p => p.state === state).map(p => p.item).join('');
  assert.ok(of('gone').includes('Winter') && of('new').includes('Summer'));
  assert.ok(of('same').includes('gear') && !of('gone').includes('gear'));
  assert.equal(plainText('Visit <a href="https://example.com">the <b>market</b></a>'), 'Visit the market');
});
test('word runs mark only the changed phrases on each side', async () => {
  const { diffRuns } = await import('../../lib/wordDiff.ts');
  const before = 'Consider a fairly relaxed afternoon walking tour through central Oslo. We could explore the waterfront and stop for pastries before dinner.';
  const after = 'Consider a leisurely afternoon walking tour through historic Oslo. We could explore the sculpture park and stop for pastries before dinner.';
  const marked = side => diffRuns(before, after, side).filter(r => r.changed).map(r => r.text);
  assert.deepEqual(marked('old'), ['fairly relaxed', 'central', 'waterfront']);
  assert.deepEqual(marked('new'), ['leisurely', 'historic', 'sculpture park']);
  assert.equal(diffRuns(before, after, 'old').map(r => r.text).join(''), before); // runs rebuild the whole text
  assert.equal(diffRuns(before, after, 'new').map(r => r.text).join(''), after);
  assert.ok(diffRuns('same text', 'same text', 'new').every(r => !r.changed));
});
test('a reworded activity diffs in place: old words struck, then new words, then the normal line', async () => {
  const act = text => ({ ...day, acts: [text] });
  const view = mount(React.createElement(DayCard, { ...props, expanded: true, day: act('Synthetic summer plan'), changedFrom: act('Synthetic winter plan') }));
  const wait = async ms => { await new Promise(r => setTimeout(r, ms)); act(() => {}); };
  try {
    const item = () => view.container.querySelectorAll('.tl-entry');
    assert.equal(item().length, 1); // no separate ghost row for the old wording
    const on = sel => item()[0].querySelector(sel).parentElement.dataset.on;
    // both texts are laid out all along (so the row never resizes); one is shown
    assert.equal(item()[0].querySelector('.chg-del').textContent, 'winter'); // only the changed word is marked
    assert.equal(item()[0].querySelector('.chg-ins').textContent, 'summer');
    assert.equal(item()[0].querySelector('.chg-del').parentElement.textContent, 'Synthetic winter plan'); // the whole line is laid out
    assert.equal(item()[0].querySelector('.chg-ins').parentElement.textContent, 'Synthetic summer plan');
    assert.deepEqual([on('.chg-del'), on('.chg-ins')], ['true', 'false']);
    await wait(1200);
    assert.deepEqual([on('.chg-del'), on('.chg-ins')], ['false', 'true']);
    await wait(1800);
    assert.equal(item()[0].querySelector('.chg-ins'), null);
    assert.ok(item()[0].textContent.includes('Synthetic summer plan'));
  } finally { view.close(); }
});
test('an edit is held at its old content until released, skipped, or expired', async () => {
  const { useRecentChanges } = await import('../../hooks/useRecentChanges.ts');
  let api;
  function Probe({ list }) {
    api = useRecentChanges(list, x => x.id, true);
    return React.createElement('div', null, list.map(x => api.held(x.id)?.text ?? x.text).join('|'));
  }
  const item = (id, text) => ({ id, text });
  const view = mount(React.createElement(Probe, { list: [item('a', 'one'), item('b', 'bee')] }));
  const show = list => act(() => view.root.render(React.createElement(Probe, { list })));
  const text = () => view.container.textContent;
  try {
    show([item('a', 'two'), item('b', 'bee'), item('c', 'new')]);
    assert.equal(text(), 'one|bee|new'); // the edit waits; a new entry shows at once
    assert.equal(api.peek('a').prev.text, 'one');
    act(() => api.release('a'));
    assert.equal(text(), 'two|bee|new');
    api.skip('a'); // the reader's own edit
    show([item('a', 'three'), item('b', 'bee'), item('c', 'new')]);
    assert.equal(text(), 'three|bee|new');
    show([item('a', 'four'), item('b', 'bee'), item('c', 'new')]);
    assert.equal(text(), 'three|bee|new');
    await new Promise(r => setTimeout(r, 2700)); // no focus signal came
    act(() => {});
    assert.equal(text(), 'four|bee|new');
  } finally { view.close(); }
});

test('a booked train, ferry or bus has a mode and state header, the operator as title, seat, platform and a ticket link', async () => {
  const { resolveDays } = await import('../../lib/tripLogic.ts');
  const seg = { from: 'Synthetic City South', to: 'Synthetic Town East', carrier: 'Synthetic Rail', number: 'G123', depart: '2040-01-02T11:25', arrive: '2040-01-02T12:27', fromTerminal: '4', seat: 'Coach 5 · 12A' };
  const row = { who: 'all', route: 'Synthetic City → Synthetic Town', mode: 'train', status: 'booked', confirmation: 'SYNTH1', ticketUrl: 'https://example.com/ticket', segments: [seg] };
  const days = resolveDays({ days: [{ ...day, flights: [row], hotels: [] }] });
  const view = mount(React.createElement(DayCard, { ...props, day: days[0], days, expanded: true }));
  try {
    const box = view.container.querySelector('.tl-transport');
    assert.equal(box.querySelector('.ctype').textContent, 'Train');
    assert.equal(box.closest('.tl-entry').querySelector('.tl-dot').textContent, '🚆'); // the mode's icon is the marker on the rail
    assert.equal(box.querySelector('.tx-state'), null); // booked needs no words: the check says it
    assert.ok(!box.querySelector('.tl-end')?.textContent); // booked: a plain card, no mark
    assert.equal(box.querySelector('.tx-title'), null); // the operator in the row is the title
    assert.ok(box.querySelector('.seg-carrier').textContent.includes('Synthetic Rail'));
    assert.equal(box.querySelector('.seg-terminal').textContent, 'Platform 4');
    assert.ok([...box.querySelectorAll('.seg-chip')].some((c) => c.textContent === 'Coach 5 · 12A'));
    const items = openMenu(box);
    assert.equal(menuItem(items, 'Ticket').getAttribute('href'), 'https://example.com/ticket');
    assert.ok(menuItem(items, 'Mark as not booked')); // booked: the menu can only un-book it
    assert.equal(menuItem(items, 'Search this route'), undefined);
    assert.ok(!box.querySelector('.status')); // no check: a plain card is a booked one
  } finally { view.close(); }
  // Only an https ticket link is ever rendered.
  const bad = resolveDays({ days: [{ ...day, flights: [{ ...row, ticketUrl: 'javascript:alert(1)' }], hotels: [] }] });
  const view2 = mount(React.createElement(DayCard, { ...props, day: bad[0], days: bad, expanded: true }));
  try { assert.equal(menuItem(openMenu(view2.container.querySelector('.tl-entry')), 'Ticket'), undefined); } finally { view2.close(); }
});

test('an unbooked train shows its route as the title, a route search; its menu books it; the flight tile is unchanged', async () => {
  const { resolveDays, flightId } = await import('../../lib/tripLogic.ts');
  const open = { who: 'all', route: 'Synthetic City → Synthetic Town', mode: 'train', status: 'needed', detail: 'Synthetic train note' };
  const flight = { who: 'all', route: 'Synthetic F → Synthetic G', status: 'booked', title: 'Synthetic flight title' };
  const days = resolveDays({ days: [{ ...day, flights: [open, flight], hotels: [] }] });
  const calls = [];
  const view = mount(React.createElement(DayCard, { ...props, day: days[0], days, expanded: true, onToggle: (...a) => calls.push(a) }));
  try {
    const [train, plane] = view.container.querySelectorAll('.tl-transport');
    assert.equal(train.querySelector('.tx-state').textContent, 'Not booked');
    assert.equal(train.querySelector('.tl-title').textContent, 'Synthetic City → Synthetic Town');
    // The free-form note comes after the to-be-decided row and closes the tile; the links are in the "⋯" menu.
    const note = [...train.querySelectorAll('.fl-meta')].find((m) => m.textContent === 'Synthetic train note');
    assert.ok(note && (train.querySelector('.tbd').compareDocumentPosition(note) & 4)); // (following)
    assert.ok(note.parentElement.lastElementChild === note);
    const items = openMenu(train);
    const search = menuItem(items, 'Search this route');
    assert.equal(search.textContent, 'Search this route');
    assert.equal(new URL(search.href).searchParams.get('travelmode'), 'transit');
    const book = menuItem(items, 'Mark as booked');
    await act(async () => book.click());
    assert.deepEqual(calls[0], [[flightId(day.date, open)], 'needed']); // the toggle reports the current state; the page flips it
    // A flight keeps its own title; booked, its header has just the check, and it has no booking links.
    assert.equal(plane.querySelector('.ctype'), null);
    assert.equal(plane.querySelector('.tx-state'), null);
    assert.ok(!plane.querySelector('.tl-end')?.textContent); // booked: nothing beside the title
    assert.ok(!openMenu(plane).some((i) => i.textContent === 'Ticket' || i.textContent === 'Search this route'));
  } finally { view.close(); }
});

test('while the trip is under way the next departure and the next check-in say how long is left, on their own tile only', async () => {
  const { resolveDays } = await import('../../lib/tripLogic.ts');
  const p = (n) => String(n).padStart(2, '0');
  const local = (ms) => { const d = new Date(ms); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };
  const plus = (iso, n) => local(Date.parse(`${iso.slice(0, 10)}T12:00:00`) + n * 864e5).slice(0, 10);
  const depart = local(Date.now() + 2 * 36e5);
  const date = depart.slice(0, 10);
  const mk = (route, at) => ({ who: 'all', route, mode: 'ferry', status: 'booked', segments: [{ from: 'Synthetic P', to: 'Synthetic Q', carrier: 'Synthetic Ferries', depart: at, arrive: at }] });
  const days = resolveDays({ days: [
    { ...day, date: plus(date, -1), hotels: [] },
    { ...day, date, flights: [mk('Synthetic soon', depart), mk('Synthetic later', local(Date.now() + 30 * 36e5))], hotels: [] },
    { ...day, date: plus(date, 2), hotels: [] },
  ] });
  const view = mount(React.createElement(DayCard, { ...props, day: days[1], days, dayNumber: 1, expanded: true }));
  try {
    // (The departure with a time today sorts after the one on another day, which has no usable time here.)
    const tile = (t) => [...view.container.querySelectorAll('.tl-transport')].find((c) => c.textContent.includes(t));
    const soon = tile('Synthetic soon');
    const later = tile('Synthetic later');
    assert.match(soon.querySelector('.next-up-line').textContent, /^Departs in (1 h 5\d min|2 h)$/);
    assert.ok(soon.closest('.tl-entry').classList.contains('next-up'));
    assert.equal(later.querySelector('.next-up-line'), null);
  } finally { view.close(); }
});

test('a chosen hotel shows no district line (the area is only the city of a hotel not chosen yet); a deadline task has its own label and is not a gap', async () => {
  const { resolveDays } = await import('../../lib/tripLogic.ts');
  const { gapDates, kindLabel } = await import('../../lib/tasks.ts');
  const days = resolveDays({ days: [{ ...day, date: '2040-01-02', hotels: [{ who: 'all', name: 'Synthetic Hotel', address: 'Synthetic street', status: 'booked', area: 'Synthetic District' }] }] });
  const view = mount(React.createElement(DayCard, { ...props, day: days[0], days, expanded: true }));
  try {
    const card = [...view.container.querySelectorAll('.tl-hotel')].find((c) => c.textContent.includes('Synthetic Hotel'));
    assert.ok(![...card.querySelectorAll('.cmeta')].some((m) => m.textContent === 'Synthetic District'));
  } finally { view.close(); }
  const task = { kind: 'deadline', mode: 'hotel', key: 'deadline:2040-01-02|h|Synthetic|all', refs: ['deadline:2040-01-02|h|Synthetic|all'], refsDone: [false], done: false, scope: { kind: 'day', date: '2040-01-04' } };
  assert.equal(kindLabel(task), 'Free cancellation');
  assert.deepEqual([...gapDates([task])], []); // information, not something missing
});

// The site has no search box: "search" is the browser's find-in-page, which matches the text in the
// page (collapsed days stay in the page as hidden="until-found"). So what is findable is exactly the
// rendered text: everything a tile shows must be in it, and nothing secret may be.
test('find-in-page: structured tile fields are findable; confirmations, phone numbers and ticket links are not in the page text', async () => {
  const { resolveDays } = await import('../../lib/tripLogic.ts');
  const { AIRLINES } = await import('../../lib/airlines.ts');
  const hotel = { who: 'all', name: 'Synthetic Grand', address: 'Synthetic Street 1', status: 'booked', checkInTime: '15:00', checkOutTime: '11:00', room: 'Synthetic Twin Room', price: { amount: 900, currency: 'USD', per: 'stay' },
    freeCancelUntil: '2999-01-01T23:59', phone: '+00 777 888 9999', confirmation: 'SECRETHOTEL1', detail: 'Synthetic hotel note' };
  const unbooked = { who: 'all', name: 'TBD — Synthetic placeholder', status: 'needed', area: 'Synthetic Area', budget: { amount: 400, currency: 'USD', per: 'night' } };
  const flight = { who: 'all', route: 'SEA → ICN', status: 'booked', title: 'Synthetic flight title', confirmation: 'SECRETFLIGHT1', ticketUrl: 'https://example.com/secret-flight-ticket',
    segments: [{ from: 'SEA', to: 'ICN', airline: 'DL', number: '197', depart: '2040-01-02T12:30', arrive: '2040-01-03T17:45', aircraft: 'Synthetic Jet', cabin: 'Synthetic Economy', seat: '42F', toTerminal: 'T2' }] };
  const train = { who: 'all', route: 'Synthetic City → Synthetic Town', mode: 'train', status: 'booked', confirmation: 'SECRETTRAIN1', ticketUrl: 'https://example.com/secret-train-ticket',
    segments: [{ from: 'Synthetic City South', to: 'Synthetic Town East', carrier: 'Synthetic Rail', number: 'G123', depart: '2040-01-02T11:25', arrive: '2040-01-02T12:27', fromTerminal: '4', seat: 'Coach 5 · 12A' }] };
  const days = resolveDays({ days: [{ ...day, date: '2040-01-02', flights: [flight, train], hotels: [hotel, unbooked] }, { ...day, date: '2040-01-04', hotels: 'same' }] });
  const view = mount(React.createElement(DayCard, { ...props, day: days[0], days, expanded: false }));
  try {
    const text = view.container.textContent;
    const findable = {
      'hotel name': 'Synthetic Grand', 'hotel note': 'Synthetic hotel note', 'room': 'Synthetic Twin Room', 'price': '$900.00', 'check-in time': '15:00', 'check-out time': '11:00',
      'free-cancel deadline': 'Free cancel until', 'budget': 'Budget ≈ $400.00 / night', 'budget for the stay': '$800.00 for 2 nights', 'placeholder shown as': 'Hotel to be decided', 'placeholder city': 'Synthetic Area',
      'flight title': 'Synthetic flight title', 'airline name': AIRLINES.DL.name, 'flight code and number': 'DL 197', 'route places': 'SEA', 'arrival place': 'ICN', 'aircraft': 'Synthetic Jet', 'cabin': 'Synthetic Economy', 'seat': '42F', 'terminal': 'T2',
      'operator': 'Synthetic Rail', 'train number': 'G123', 'train places': 'Synthetic City South', 'platform': 'Platform 4', 'coach seat': 'Coach 5 · 12A', 'mode': 'Train', 'depart time': '11:25', 'arrive time': '12:27',
    };
    for (const [what, needle] of Object.entries(findable)) assert.ok(text.includes(needle), `${what}: "${needle}" is not findable in the page text`);
    // Never in the text: a code, a phone number, a ticket link (the code appears only after a tap).
    for (const secret of ['SECRETHOTEL1', 'SECRETFLIGHT1', 'SECRETTRAIN1', '777 888 9999', '7778889999', 'secret-flight-ticket', 'secret-train-ticket', 'https://']) {
      assert.ok(!text.includes(secret), `${secret} leaked into the page text`);
    }
    assert.ok(text.includes('••••••')); // the chip shows a mask
  } finally { view.close(); }
});

test('today\'s card marks "now" in the destination\'s time on the rail: a line between tiles, a pill on the one in progress', () => {
  const realNow = Date.now;
  const at = (hhmm) => { Date.now = () => Date.parse(`2040-01-02T${hhmm}:00+07:00`); }; // Bangkok wall clock, whatever zone the test runs in
  const synthetic = { ...day, country: 'TH', acts: [{ tag: 'Food', time: '09:00', text: 'First' }, { tag: 'Activity', time: '16:00', text: 'Second' }] };
  // Each view closes even when an assertion fails: a mounted day keeps the clock ticking and the run would never end.
  const check = (dayProps, fn) => { const view = mount(React.createElement(DayCard, { ...props, expanded: true, isToday: true, ...dayProps })); try { fn(view.container); } finally { view.close(); } };
  try {
    at('12:00');
    check({ day: synthetic }, (c) => {
      assert.equal(c.querySelectorAll('.tl-now').length, 1);
      assert.equal(c.querySelectorAll('.tl-entry--now').length, 0);
      assert.match(c.querySelector('.tl-now').textContent, /Now 12:00 · next 16:00 \(in 4h\)/);
      assert.ok(c.querySelector('.tl-now').nextElementSibling.textContent.includes('Second')); // between the two activities
      assert.match(c.querySelector('.today-badge').textContent, /Today · 12:00/);
    });
    at('09:30');
    check({ day: synthetic }, (c) => {
      assert.equal(c.querySelectorAll('.tl-now').length, 0);
      const live = c.querySelectorAll('.tl-entry--now');
      assert.equal(live.length, 1);
      assert.equal(live[0].querySelectorAll('.tl-head .now-progress .now-progress-emoji').length, 1); // a progress line along the header, with the emoji on it
      assert.match(live[0].querySelector('.tl-head').textContent, /Now/); // visible while the tile is closed
    });
    // A ferry under way is "now" too, and the line sits after the activity it follows.
    const ferry = { who: 'all', route: 'Synthetic P → Synthetic Q', mode: 'ferry', status: 'booked', segments: [{ from: 'Synthetic P', to: 'Synthetic Q', depart: '2040-01-02T11:00', arrive: '2040-01-02T12:00' }] };
    at('11:30');
    check({ day: { ...synthetic, flights: [ferry] } }, (c) => {
      const live = c.querySelector('.tl-entry--now');
      assert.ok(live && live.querySelector('.tl-transport') && live.textContent.includes('Synthetic P → Synthetic Q'));
    });
    // No timed tiles, or none at all: still one line, saying why it has nothing to sit between.
    at('12:00');
    check({ day: { ...synthetic, acts: ['Untimed plan'] } }, (c) => assert.match(c.querySelector('.tl-now').textContent, /Now 12:00 · today's plans have no times/));
    check({ day: { ...synthetic, acts: [] } }, (c) => {
      assert.equal(c.querySelectorAll('.tl-now').length, 1);
      assert.match(c.querySelector('.tl-now').textContent, /no activities listed/);
    });
  } finally { Date.now = realNow; }
});

// ---- timeline tiles inside the itinerary (DetailedView keeps their open state) ----
const timelineView = async (days, extra = {}) => {
  const { DetailedView } = await import('./DetailedView.tsx');
  const { Routes, Route } = await import('react-router-dom');
  const { useShowAiFocus } = await import('../../hooks/useAiFocus.tsx');
  window.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} }); // reduced motion: instant scrolls
  window.HTMLElement.prototype.scrollIntoView = () => {};
  const out = { show: null };
  function Pointer() { out.show = useShowAiFocus(); return null; }
  const shared = { days, legColors: days.map(() => props.legColor), weather: {}, groups: [], ticks: {}, onlyGaps: false, onOnlyGapsChange() {}, filterRef: { current: null }, onToggle() {}, actionItems: [], considerations: [], pendingVotes: {}, onVote() {}, actionItemsDone: {}, onToggleActionItem() {}, ...extra };
  out.view = mount(React.createElement(DefaultRouter, { initialEntries: ['/trip/synthetic'] },
    React.createElement(Routes, null, React.createElement(Route, { path: '/trip/:slug', element: React.createElement(React.Fragment, null, React.createElement(DetailedView, shared), React.createElement(Pointer)) }))));
  return out;
};
const dayCards = (c) => [...c.querySelectorAll('section.day-card')];
const tileStates = (section) => [...section.querySelectorAll('.tl-toggle')].map((b) => b.getAttribute('aria-expanded'));

test('Expand all / Collapse all opens and closes the tiles of that one day only', async () => {
  localStorage.clear();
  const flights = [{ who: 'all', route: 'Synthetic A → Synthetic B', status: 'booked' }, { who: 'all', route: 'Synthetic C → Synthetic D', status: 'booked' }];
  const { view } = await timelineView([{ ...day, flights }, { ...day, date: '2040-01-03', flights }]);
  try {
    for (const b of view.container.querySelectorAll('.day-head-btn')) act(() => b.click());
    const [first, second] = dayCards(view.container);
    assert.deepEqual([tileStates(first), tileStates(second)], [['false', 'false'], ['false', 'false']]);
    // In the day's one ⋯ menu (the only button in its header besides the header itself).
    const tools = first.querySelector('.day-tools');
    assert.equal(tools.querySelectorAll('button').length, 1);
    const expandAll = menuItem(openMenu(tools), 'Expand all');
    await act(async () => expandAll.click());
    assert.deepEqual([tileStates(first), tileStates(second)], [['true', 'true'], ['false', 'false']]);
    const collapseAll = menuItem(openMenu(tools), 'Collapse all');
    await act(async () => collapseAll.click());
    assert.deepEqual(tileStates(first), ['false', 'false']);
    // The chevron sits in the day's bottom border and opens or closes the day like its header.
    const head = first.querySelector('.day-head-btn');
    const notch = first.querySelector(':scope > .day-notch');
    assert.equal(notch.getAttribute('aria-hidden'), 'true');
    assert.equal(first.querySelector('.day-heading .day-chevron'), null); // not in the header any more
    act(() => notch.dispatchEvent(new window.MouseEvent('click', { bubbles: true })));
    assert.equal(head.getAttribute('aria-expanded'), 'false');
    act(() => notch.dispatchEvent(new window.MouseEvent('click', { bubbles: true })));
    assert.equal(head.getAttribute('aria-expanded'), 'true');
  } finally { view.close(); localStorage.clear(); }
});

test('a tile the AI or a shared link points at opens, scrolls and blinks; tiles the reader opened stay open', async () => {
  localStorage.clear();
  const { resolveDays } = await import('../../lib/tripLogic.ts');
  const { flightId } = await import('../../lib/tripLogic.ts');
  const one = { who: 'all', route: 'Synthetic one', status: 'booked' };
  const two = { who: 'all', route: 'Synthetic two', status: 'booked' };
  const days = resolveDays({ days: [{ ...day, flights: [one, two], hotels: [{ who: 'all', name: 'Synthetic Hotel', status: 'booked' }] }] });
  const out = await timelineView(days);
  const { view } = out;
  try {
    const [section] = dayCards(view.container);
    act(() => section.querySelector('.day-head-btn').click());
    const toggle = (text) => tileToggle(section, (t) => t.textContent.includes(text));
    act(() => toggle('Synthetic two').click()); // the reader opens one
    document.activeElement?.blur();
    act(() => out.show({ slug: 'synthetic', target: { kind: 'tile', date: day.date, tile: flightId(day.date, one) }, nonce: 'n1' }));
    await act(async () => { await new Promise((r) => setTimeout(r, 900)); }); // settle, then the scroll fallback
    assert.equal(toggle('Synthetic one').getAttribute('aria-expanded'), 'true');
    assert.ok(toggle('Synthetic one').closest('li.tl-entry').classList.contains('ai-focus-flash'));
    assert.ok(document.activeElement === document.body); // the blink shows where; focus (and its ring) doesn't move
    assert.equal(toggle('Synthetic two').getAttribute('aria-expanded'), 'true'); // untouched
    assert.equal(toggle('Synthetic Hotel').getAttribute('aria-expanded'), 'false'); // untouched
    assert.equal(localStorage.getItem('tiles:synthetic'), JSON.stringify({ [`${day.date}#${flightId(day.date, two)}`]: true })); // the reveal is not saved
  } finally { view.close(); localStorage.clear(); }
});

test('Only gaps: booked tiles start closed and actionable ones open, whatever the reader saved; every element id is unique', async () => {
  localStorage.clear();
  const { resolveDays } = await import('../../lib/tripLogic.ts');
  const days = resolveDays({ days: [{ ...day,
    hotels: [{ who: 'all', name: 'Synthetic Hotel', status: 'booked' }],
    flights: [{ who: 'all', route: 'Synthetic open route', status: 'needed' }, { who: 'all', route: 'Synthetic booked route', status: 'booked' }],
  }] });
  localStorage.setItem('tiles:synthetic', JSON.stringify({ [`${day.date}#${days[0].hotels[0].src}`]: true })); // opened in the normal view
  const { view } = await timelineView(days, { onlyGaps: true, isGap: () => true, dayGaps: {} });
  try {
    const [section] = dayCards(view.container);
    const state = (text) => tileToggle(section, (t) => t.textContent.includes(text)).getAttribute('aria-expanded');
    assert.equal(state('Synthetic Hotel'), 'false'); // booked, and the saved choice is ignored here
    assert.equal(state('Synthetic open route'), 'true');
    assert.equal(state('Synthetic booked route'), 'false');
    const ids = [...view.container.querySelectorAll('[id]')].map((e) => e.id);
    assert.equal(new Set(ids).size, ids.length);
  } finally { view.close(); localStorage.clear(); }
});

// ---- to-dos and considerations on the timeline ----
const consider = (id, extra = {}) => ({ key: `item:${id}`, kind: 'consider', scope: { kind: 'day', date: day.date }, title: `Synthetic ${id}`, refs: [`item:${id}`], refsDone: [false], done: false, dueDate: null, dueDateIsDefault: true, editable: true, votes: { yes: [], no: [], mine: null }, ...extra });

test('dated to-dos and considerations are tiles on the day: a timed one among the activities, an untimed one after them', async () => {
  const votes = [];
  const ticks = [];
  const synthetic = { ...day, acts: [{ time: '09:00', text: 'Synthetic morning' }, { time: '15:00', text: 'Synthetic afternoon' }] };
  const todo = { id: 'todo1', date: day.date, title: 'Synthetic to-do', detail: '' };
  const view = mount(React.createElement(DayCard, { ...props, day: synthetic, expanded: true,
    dayConsiderations: [consider('lunch', { time: '12:00', votes: { yes: ['Ann'], no: [], mine: null } })], dayActionItems: [todo],
    onVote: (...a) => votes.push(a), onToggleActionItem: (id) => ticks.push(id) }));
  try {
    const titles = [...view.container.querySelectorAll('.tl-entry .tl-title')].map((t) => t.textContent);
    assert.deepEqual(titles, ['Synthetic morning', 'Synthetic lunch', 'Synthetic afternoon', 'Synthetic to-do']);
    const lunch = view.container.querySelector('.tl-consider');
    assert.equal(lunch.closest('.tl-entry').querySelector('.tl-time').textContent, '12:00');
    assert.match(lunch.querySelector('.tl-meta').textContent, /Considering/);
    // Voting and ticking are in the card's menu, so they work while the card is closed, and never toggle it.
    const before = lunch.querySelector('.tl-toggle').getAttribute('aria-expanded');
    const yes = menuItem(openMenu(lunch), 'Vote yes');
    await act(async () => yes.click());
    assert.deepEqual(votes, [['lunch', 'yes']]);
    assert.equal(lunch.querySelector('.tl-toggle').getAttribute('aria-expanded'), before);
    assert.equal(lunch.querySelector('.vote-tally b').textContent, '1'); // the tally stays in the header
    const tick = menuItem(openMenu(view.container.querySelector('.tl-item:not(.tl-consider)')), 'Mark as done');
    await act(async () => tick.click());
    assert.deepEqual(ticks, ['todo1']);
  } finally { view.close(); }
});

test('a consideration proposing a hotel shows it as a Proposed tile, and Add to itinerary approves it for that day', async () => {
  const promoted = [];
  const hotel = { who: 'all', name: 'Synthetic Proposed Hotel', status: 'needed', checkInTime: '15:00' };
  const task = consider('stay', { scope: { kind: 'range', start: day.date, end: '2040-01-04' }, proposes: { type: 'hotel', entry: hotel } });
  const view = mount(React.createElement(DayCard, { ...props, day, expanded: true, dayConsiderations: [task], onPromote: async (...a) => { promoted.push(a); } }));
  try {
    const tile = view.container.querySelector('.tl-consider');
    assert.equal(tile.closest('.tl-entry').querySelector('.tl-dot').textContent, '🏨');
    assert.match(tile.querySelector('.tl-meta').textContent, /Proposed stay · Synthetic Proposed Hotel/);
    assert.equal(tile.querySelector('.tl-toggle').getAttribute('aria-expanded'), 'true'); // unsettled: open
    const proposal = tile.querySelector('.tl-proposal');
    assert.ok(proposal.textContent.includes('Proposed') && proposal.textContent.includes('Synthetic Proposed Hotel'));
    assert.equal(proposal.querySelector('.tl-actions'), null); // the draft has no actions of its own
    const add = menuItem(openMenu(tile), 'Add to itinerary');
    await act(async () => { add.click(); });
    assert.deepEqual(promoted, [['stay', day.date]]);
    assert.equal(tile.querySelector('.share-status').textContent, 'Added to the itinerary');
  } finally { view.close(); }
});

test('an entry approved from an item shows its History (wording and votes), and the item says it is in the itinerary', () => {
  const synthetic = { ...day, acts: [{ text: 'Synthetic chosen dinner', time: '19:00', fromItem: 'dinner' }] };
  const task = consider('dinner', { title: 'Synthetic dinner idea', detail: 'Synthetic reason', done: true, outcome: 'chosen', votes: { yes: ['Ann', 'Ben'], no: ['Cy'], mine: null } });
  const view = mount(React.createElement(DayCard, { ...props, day: synthetic, days: [synthetic], expanded: true, dayConsiderations: [task], itemTasks: { dinner: task }, onPromote: async () => {} }));
  try {
    const act = [...view.container.querySelectorAll('.tl-tile')].find((t) => t.querySelector('.tl-title').textContent === 'Synthetic chosen dinner');
    const hist = act.querySelector('details.tl-history');
    assert.ok(hist && !hist.open); // folded away
    assert.ok(hist.textContent.includes('Synthetic dinner idea') && hist.textContent.includes('Synthetic reason'));
    assert.match(hist.textContent, /👍 2 \(Ann, Ben\) · 👎 1 \(Cy\) · Chosen/);
    const item = view.container.querySelector('.tl-consider');
    assert.ok(item.textContent.includes('In the itinerary.'));
    assert.equal(menuItem(openMenu(item), 'Add to itinerary'), undefined); // already added
    assert.equal(item.querySelector('.tl-toggle').getAttribute('aria-expanded'), 'false'); // settled: closed
  } finally { view.close(); }
});

test('an activity is one static card: time, icon and title, and all its actions in the "⋯" menu; nothing to open', () => {
  const synthetic = { ...day, country: 'TH', acts: [{ tag: 'Food', time: '12:00', text: 'Synthetic Cafe', places: [{ name: 'Synthetic Cafe', address: 'Synthetic street' }] }] };
  const edits = [];
  const view = mount(React.createElement(DayCard, { ...props, day: synthetic, days: [synthetic], expanded: true, onEditActivity: async (...a) => { edits.push(a); } }));
  try {
    const tile = view.container.querySelector('.tl-tile');
    assert.ok(tile.classList.contains('tl-flat'));
    assert.equal(tile.querySelector('.tl-toggle, .tl-notch, .tl-body'), null); // no chevron, no body
    assert.equal(tile.querySelector('.tl-meta'), null); // no "Food" line: the icon says it
    assert.equal(tile.querySelector('.tl-time').textContent, '12:00');
    assert.equal(tile.querySelector('.tl-title').textContent, 'Synthetic Cafe');
    assert.equal(tile.querySelectorAll('button, a').length, 1); // the "⋯" button is the card's only control
    const items = openMenu(tile);
    assert.deepEqual(items.map((i) => i.textContent), ['Edit', 'Show on the trip map', 'Open in Google Maps', 'Add to Google Calendar', 'Copy link']);
    assert.match(menuItem(items, 'Open in Google Maps').getAttribute('href'), /google\.com\/maps/);
    assert.ok(items.every((i) => i.querySelector('.tl-menu-icon svg'))); // every action has its icon
    act(() => menuItem(items, 'Edit').click()); // editing opens it, with the editor
    assert.ok(view.container.querySelector('.tl-tile .tl-body .ai-editor'));
  } finally { view.close(); }
});

test('an activity approved from a suggestion opens to its History; a card opens from anywhere on it but its menu', () => {
  const synthetic = { ...day, acts: [{ text: 'Synthetic dinner', fromItem: 'x' }], hotels: [{ who: 'all', name: 'Synthetic Hotel', status: 'booked' }] };
  const task = consider('x', { title: 'Synthetic idea', done: true, outcome: 'chosen' });
  const view = mount(React.createElement(Stateful, { ...props, day: { ...synthetic, _d: day._d, hotels: [{ ...synthetic.hotels[0], src: `${day.date}|h|Synthetic Hotel|all`, checkIn: true, checkOut: true }] }, days: [synthetic], expanded: true, itemTasks: { x: task } }));
  try {
    const dinner = [...view.container.querySelectorAll('.tl-tile')].find((t) => t.textContent.includes('Synthetic dinner'));
    assert.ok(!dinner.classList.contains('tl-flat') && dinner.querySelector('.tl-body details.tl-history'));
    const hotel = view.container.querySelector('.tl-hotel');
    const toggle = hotel.querySelector('.tl-toggle');
    act(() => hotel.querySelector('.tl-menu-btn').click());
    assert.equal(toggle.getAttribute('aria-expanded'), 'false'); // opening the menu doesn't toggle the card
    // A tap outside closes the menu; the click it makes doesn't toggle the card either.
    act(() => { hotel.querySelector('.tl-time').dispatchEvent(new window.Event('pointerdown', { bubbles: true })); hotel.querySelector('.tl-time').dispatchEvent(new window.MouseEvent('click', { bubbles: true })); });
    assert.equal(hotel.querySelector('[role=menu]'), null);
    assert.equal(toggle.getAttribute('aria-expanded'), 'false');
    act(() => hotel.querySelector('.tl-time').dispatchEvent(new window.MouseEvent('click', { bubbles: true })));
    assert.equal(toggle.getAttribute('aria-expanded'), 'true'); // anywhere else on the card opens it
    assert.equal(hotel.querySelector('.tl-notch').getAttribute('aria-hidden'), 'true'); // the chevron is decoration
    act(() => hotel.querySelector('.tl-notch').dispatchEvent(new window.MouseEvent('click', { bubbles: true })));
    assert.equal(toggle.getAttribute('aria-expanded'), 'false'); // but a tap on it toggles the card
    act(() => hotel.querySelector('.tl-notch svg').dispatchEvent(new window.MouseEvent('click', { bubbles: true })));
    assert.equal(toggle.getAttribute('aria-expanded'), 'true');
    act(() => hotel.querySelector('.tl-body').dispatchEvent(new window.MouseEvent('click', { bubbles: true })));
    assert.equal(toggle.getAttribute('aria-expanded'), 'false'); // and from its body it closes
  } finally { view.close(); }
});

test('a day with an open plan task shows a "Not planned" tile on the rail in the normal view too; a dismissed one shows none', () => {
  const plan = { plan: true, transport: [], details: [] };
  const view = mount(React.createElement(DayCard, { ...props, day: { ...day, acts: [] }, expanded: true, gaps: plan }));
  try {
    const tile = view.container.querySelector('.tl-plan');
    assert.ok(tile && tile.closest('li.tl-entry'));
    assert.equal(tile.querySelector('.tl-title').textContent, 'Not planned'); // said once: the amber label is the title
    assert.equal(tile.querySelector('.tl-toggle, .tl-body'), null); // nothing to open
    assert.ok(tile.querySelector('.tl-dot .tl-warn')); // and the amber badge on its icon, like other open items
    assert.equal(view.container.querySelector('.day-subtitle'), null); // no loose "Not decided yet" line
  } finally { view.close(); }
  // Dismissed in Action Items (no open plan task): no tile, even though the day is empty.
  const dismissed = mount(React.createElement(DayCard, { ...props, day: { ...day, acts: [] }, expanded: true, gaps: { ...plan, plan: false } }));
  try { assert.equal(dismissed.container.querySelector('.tl-plan'), null); } finally { dismissed.close(); }
});

test('the day header: the city photo with its credit once it nears the screen, Day N of M · country, the place and the weather', async () => {
  const { resolveDays } = await import('../../lib/tripLogic.ts');
  const { batchedPhotos } = await import('../../lib/cityPhoto.ts');
  const asked = [];
  const one = batchedPhotos((c) => `${c.city}|${c.country}`, async (cities) => {
    asked.push(cities.map((c) => `${c.city}|${c.country}`));
    return cities.map(() => ({ url: 'https://example.com/synthetic.jpg', credit: { name: 'Synthetic Photographer', uri: 'https://example.com/p' } }));
  }, 0);
  const fetcher = (city, country) => one({ city, country });
  const days = resolveDays({ days: [{ ...day, country: 'TH' }, { ...day, date: '2040-01-03', country: 'TH', to: 'Synthetic Town' }] });
  const weather = { date: day.date, kind: 'forecast', code: 2, tMax: 31, tMin: 24, precipProb: 29, fetchedAt: 0 };
  // Off screen: no photo is asked for.
  const observers = [];
  globalThis.IntersectionObserver = class { constructor(cb) { this.cb = cb; observers.push(this); } observe() {} disconnect() {} };
  const view = mount(React.createElement(React.Fragment, null,
    React.createElement(DayCard, { ...props, rowId: 'a', day: days[0], days, dayNumber: 0, weather, cityPhoto: fetcher }),
    React.createElement(DayCard, { ...props, rowId: 'b', day: days[1], days, dayNumber: 1, cityPhoto: fetcher })));
  try {
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    assert.deepEqual(asked, []);
    await act(async () => { observers.forEach((o) => o.cb([{ isIntersecting: true }])); await new Promise((r) => setTimeout(r, 0)); });
    const [first, second] = view.container.querySelectorAll('section.day-card');
    const photo = first.querySelector('.day-photo');
    assert.ok(photo.classList.contains('has-photo') && photo.style.backgroundImage.includes('https://example.com/synthetic.jpg'));
    const dayMenu = openMenu(first.querySelector('.day-tools'));
    assert.equal(menuItem(dayMenu, 'See photo credit').getAttribute('href'), 'https://example.com/p'); // the credit Google asks for: the photographer's page
    assert.ok(menuItem(dayMenu, 'Copy link'));
    assert.equal(photo.textContent, ''); // nothing written on the photo
    assert.deepEqual(asked, [[`${day.city}|TH`]]); // the same city twice is asked for once
    assert.equal(first.querySelector('.day-num').textContent, 'Day 0 of 1 · Thailand');
    assert.equal(first.querySelector('.day-place').textContent, day.city);
    assert.equal(second.querySelector('.day-place').textContent, `${day.city} → Synthetic Town`);
    assert.equal(first.querySelector('.weather-block-temps').textContent, '88° / 75°'); // in the settings' unit (F here)
    assert.equal(first.querySelector('.weather-block-label').textContent, 'Partly cloudy · 29% rain');
  } finally { view.close(); delete globalThis.IntersectionObserver; }
  // No photo source: the leg's colour, no credit.
  const plain = mount(React.createElement(DayCard, { ...props, day: days[0], days }));
  try {
    assert.ok(!plain.container.querySelector('.day-photo').classList.contains('has-photo'));
    assert.ok(!openMenu(plain.container.querySelector('.day-tools')).some((i) => i.textContent === 'See photo credit'));
  } finally { plain.close(); }
});

test('a tile with places shows one photo, its first place\'s, once it nears the screen, the credit in its menu; tiles in view together are one request', async () => {
  const { resolveDays } = await import('../../lib/tripLogic.ts');
  const { batchedPhotos } = await import('../../lib/cityPhoto.ts');
  const places = ['A', 'B', 'C', 'D'].map((x) => ({ name: `Synthetic ${x}`, placeId: `SYN${x}` }));
  const acts = [
    { time: '10:00', text: 'Synthetic tour', places: [places[0], places[0], ...places.slice(1)] },
    { time: '11:00', text: 'Synthetic walk', places: [{ name: 'Synthetic E', placeId: 'SYNE' }] },
    { time: '12:00', text: 'Synthetic lunch', places: [{ name: 'Synthetic Spot', address: 'Synthetic street' }] },
  ];
  const days = resolveDays({ days: [{ ...day, acts }] });
  const asked = [];
  const fetcher = batchedPhotos((placeId) => placeId, async (placeIds) => {
    asked.push(placeIds);
    return placeIds.map((placeId) => ({ url: `https://example.com/${placeId}.jpg`, credit: { name: `Photographer ${placeId}`, uri: 'https://example.com/p' } }));
  }, 0);
  // Tiles start off screen: nothing is asked for until the observer says one is near.
  const observers = [];
  globalThis.IntersectionObserver = class { constructor(cb) { this.cb = cb; observers.push(this); } observe() {} disconnect() {} };
  const view = mount(React.createElement(DayCard, { ...props, day: days[0], days, expanded: true, placePhoto: fetcher }));
  try {
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    assert.deepEqual(asked, []);
    await act(async () => { observers.forEach((o) => o.cb([{ isIntersecting: true }])); await new Promise((r) => setTimeout(r, 0)); });
    assert.deepEqual(asked, [['SYNA', 'SYNE']]); // one request for both tiles, only each one's first place
    const tile = (text) => [...view.container.querySelectorAll('.tl-entry')].find((e) => e.textContent.includes(text));
    const tour = tile('Synthetic tour');
    // One photo, a decorative layer behind the header (its fade is CSS), on a static tile like any other.
    const photos = [...tour.querySelectorAll('.tl-photo')];
    assert.equal(photos.length, 1);
    assert.ok(photos[0].style.backgroundImage.includes('https://example.com/SYNA.jpg'));
    assert.equal(photos[0].getAttribute('aria-hidden'), 'true');
    assert.equal(photos[0].textContent, ''); // just the photo: no count of its other places
    assert.equal(tour.querySelector('.tl-head').firstElementChild, photos[0]);
    assert.ok(tour.querySelector('.tl-head').classList.contains('has-photo'));
    assert.ok(tour.querySelector('.tl-tile').classList.contains('tl-flat'));
    assert.equal(menuItem(openMenu(tour), 'See photo credit').getAttribute('href'), 'https://example.com/p');
    const walk = tile('Synthetic walk');
    assert.ok(walk.querySelector('.tl-photo').style.backgroundImage.includes('https://example.com/SYNE.jpg'));
    const lunch = tile('Synthetic lunch');
    assert.equal(lunch.querySelector('.tl-photo'), null); // an address alone has no photo
    assert.ok(!lunch.querySelector('.tl-head').classList.contains('has-photo'));
  } finally { view.close(); delete globalThis.IntersectionObserver; }
});

test('opening a day re-marks its closed tiles as closed (Safari otherwise keeps their full height), and they stay searchable', async () => {
  const { resolveDays } = await import('../../lib/tripLogic.ts');
  const days = resolveDays({ days: [{ ...day, hotels: [{ who: 'all', name: 'Synthetic Hotel', status: 'booked' }] }] });
  const view = mount(React.createElement(DayCard, { ...props, day: days[0], days, expanded: false }));
  const marks = [];
  const real = window.Element.prototype.setAttribute;
  window.Element.prototype.setAttribute = function (name, value) {
    if (name === 'hidden' && this.classList?.contains('tl-body')) marks.push(value);
    return real.call(this, name, value);
  };
  try {
    act(() => view.root.render(React.createElement(DayCard, { ...props, day: days[0], days, expanded: true })));
    assert.deepEqual(marks, ['until-found']); // the closed hotel tile, re-marked as the day opened
    assert.equal(view.container.querySelector('.tl-hotel .tl-body').getAttribute('hidden'), 'until-found'); // still closed, still searchable
  } finally { window.Element.prototype.setAttribute = real; view.close(); }
});

test('the Not planned card is one line: the label is its title, said once', () => {
  const view = mount(React.createElement(DayCard, { ...props, day: { ...day, acts: [] }, expanded: true, gaps: { plan: true, transport: [], details: [] } }));
  try {
    const tile = view.container.querySelector('.tl-plan');
    assert.equal(tile.querySelector('.tl-meta'), null);
    assert.equal(tile.querySelector('.tx-state').textContent, 'Not planned');
    assert.equal(tile.querySelectorAll('.tx-state').length, 1);
    assert.ok(!tile.textContent.includes('Nothing planned yet'));
  } finally { view.close(); }
});

test('the "⋯" menu: arrow keys move through it, Escape closes it back to its button, and a settled vote is shown but unavailable', async () => {
  const votes = [];
  const task = consider('settled', { done: true, outcome: 'chosen', votes: { yes: ['Ann'], no: [], mine: null } });
  const view = mount(React.createElement(DayCard, { ...props, day, expanded: true, dayConsiderations: [task], onVote: (...a) => votes.push(a), onPromote: async () => {} }));
  try {
    const tile = view.container.querySelector('.tl-consider');
    const items = openMenu(tile);
    const yes = menuItem(items, 'Vote yes');
    assert.equal(yes.getAttribute('aria-disabled'), 'true');
    await act(async () => yes.click());
    assert.deepEqual(votes, []); // voting is over
    const enabled = items.filter((i) => i.getAttribute('aria-disabled') !== 'true');
    assert.equal(document.activeElement, enabled[0]); // opening focuses the first available action
    const list = tile.querySelector('[role=menu]');
    act(() => list.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })));
    assert.equal(document.activeElement, enabled[1]);
    act(() => list.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true })));
    assert.equal(document.activeElement, enabled[0]);
    act(() => document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    assert.equal(tile.querySelector('[role=menu]'), null);
    assert.equal(document.activeElement, tile.querySelector('.tl-menu-btn'));
  } finally { view.close(); }
});

test('an overnight train: its gate goes on a line under the row, and both ends show their date', async () => {
  const { resolveDays } = await import('../../lib/tripLogic.ts');
  const seg = { from: 'Synthetic North', to: 'Synthetic Central', carrier: 'Synthetic Rail', number: 'D1', depart: '2040-01-02T19:59', arrive: '2040-01-03T07:04', fromTerminal: 'Ticket gate 5A (may change)', durationMin: 665 };
  const days = resolveDays({ days: [{ ...day, flights: [{ who: 'all', route: 'Synthetic North → Synthetic Central', mode: 'train', status: 'booked', segments: [seg] }], hotels: [] }] });
  const view = mount(React.createElement(DayCard, { ...props, day: days[0], days, expanded: true }));
  try {
    const row = view.container.querySelector('.seg');
    const [dep, arr] = row.querySelectorAll('.seg-main .seg-end');
    assert.ok(!dep.querySelector('.seg-terminal')); // not under the departure place, where it pushed the arrow over
    assert.equal(row.querySelector(':scope > .seg-gates .seg-terminal').textContent, 'Ticket gate 5A (may change)');
    assert.equal(dep.querySelector('.seg-date').textContent, 'Mon, Jan 2'); // the departure day, like the arrival's
    assert.equal(arr.querySelector('.seg-date').textContent, 'Tue, Jan 3');
  } finally { view.close(); }
});

test('a transport title that already names the route doesn\'t repeat it under it; one that doesn\'t still shows it', async () => {
  const { resolveDays } = await import('../../lib/tripLogic.ts');
  const rows = [
    { who: 'all', route: 'Synthetic East → Synthetic West', title: 'Train — Synthetic East to Synthetic West', mode: 'train', status: 'needed' },
    { who: 'all', route: 'Synthetic North → Synthetic South', title: 'Synthetic overnight train', mode: 'train', status: 'needed' },
  ];
  const days = resolveDays({ days: [{ ...day, flights: rows, hotels: [] }] });
  const view = mount(React.createElement(DayCard, { ...props, day: days[0], days, expanded: true }));
  try {
    const [named, plain] = view.container.querySelectorAll('.tl-transport');
    assert.ok(!(named.querySelector('.tl-meta')?.textContent ?? '').includes('Synthetic East → Synthetic West'));
    assert.ok(plain.querySelector('.tl-meta').textContent.includes('Synthetic North → Synthetic South'));
  } finally { view.close(); }
});

test('a static card whose title is cut off gets the chevron and opens to show the whole title; one that fits stays static', () => {
  const proto = window.HTMLElement.prototype;
  const sh = Object.getOwnPropertyDescriptor(proto, 'scrollHeight');
  const ch = Object.getOwnPropertyDescriptor(proto, 'clientHeight');
  // jsdom has no layout: a title containing "long" measures as clamped (taller than its two lines).
  Object.defineProperty(proto, 'scrollHeight', { configurable: true, get() { return this.classList?.contains('tl-title') && this.textContent.includes('long') ? 80 : 40; } });
  Object.defineProperty(proto, 'clientHeight', { configurable: true, get() { return 40; } });
  const synthetic = { ...day, acts: [{ tag: 'Food', time: '12:00', text: 'Synthetic long lunch with a very long description' }, { tag: 'Food', time: '18:00', text: 'Synthetic dinner' }] };
  const view = mount(React.createElement(Stateful, { ...props, day: synthetic, days: [synthetic], expanded: true }));
  try {
    const [lunch, dinner] = view.container.querySelectorAll('.tl-tile');
    assert.ok(!lunch.classList.contains('tl-flat') && lunch.querySelector('.tl-notch')); // cut off: it opens
    assert.ok(dinner.classList.contains('tl-flat') && !dinner.querySelector('.tl-notch')); // fits: static
    const toggle = lunch.querySelector('.tl-toggle');
    assert.equal(toggle.getAttribute('aria-expanded'), 'false');
    act(() => lunch.dispatchEvent(new window.MouseEvent('click', { bubbles: true })));
    assert.equal(toggle.getAttribute('aria-expanded'), 'true');
    assert.ok(lunch.classList.contains('is-open')); // open: the title shows in full (no clamp)
  } finally {
    view.close();
    if (sh) Object.defineProperty(proto, 'scrollHeight', sh); else delete proto.scrollHeight;
    if (ch) Object.defineProperty(proto, 'clientHeight', ch); else delete proto.clientHeight;
  }
});

test('editing an activity: its time is in the editor; "No time" clears it, a text-only edit leaves it alone', async () => {
  // (Typing a new time is checked in a real browser: react-dom loads here before jsdom's document,
  // so it doesn't see input events and a typed change never reaches onChange.)
  const synthetic = { ...day, country: 'TH', acts: [{ tag: 'Food', time: '12:00', text: 'Synthetic lunch' }] };
  const edits = [];
  const open = () => {
    const view = mount(React.createElement(Stateful, { ...props, day: synthetic, days: [synthetic], expanded: true, onEditActivity: async (...a) => { edits.push(a); } }));
    const edit = menuItem(openMenu(view.container.querySelector('.tl-tile')), 'Edit');
    act(() => edit.click());
    return view;
  };
  const save = (view) => act(async () => { view.container.querySelector('.ai-editor button[type=submit]').click(); });

  let view = open();
  try {
    assert.equal(view.container.querySelector('.ai-editor input[type=time]').value, '12:00'); // opens with the activity's time
    act(() => view.container.querySelector('.ai-time-clear').click());
    assert.equal(view.container.querySelector('.ai-editor input[type=time]').value, '');
    await save(view);
    assert.ok(edits.pop()[5] === null); // cleared
  } finally { view.close(); }

  view = open();
  try {
    await save(view);
    const saved = edits.pop();
    assert.equal(saved[3], 'Synthetic lunch');
    assert.ok(saved[5] === undefined); // unchanged: the activity keeps its place
  } finally { view.close(); }
});
