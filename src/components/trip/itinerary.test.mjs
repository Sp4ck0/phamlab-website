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
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const day = { date: '2040-01-02', city: 'Synthetic stop', leg: 'synthetic', _d: new Date(2040, 0, 2), flights: [], hotels: [], acts: ['Synthetic activity'] };
const props = { day, dayNumber: 0, legColor: { color: '#333', tint: '#eee', label: 'Synthetic leg' }, groups: [], ticks: {}, onlyGaps: false, onToggle() {}, dayActionItems: [], dayConsiderations: [], pendingVotes: {}, onVote() {}, actionItemsDone: {}, onToggleActionItem() {}, rowId: 'synthetic-row', expanded: false, onExpandedChange() {} };
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
    assert.equal(view.container.querySelector('button[aria-expanded]').getAttribute('aria-expanded'), 'true');
    const status = view.container.querySelector('.status');
    status.focus();
    act(() => status.click());
    assert.equal(view.container.querySelector('.day-card'), null);
    assert.equal(document.activeElement, view.container.querySelector('[data-filter]'));
    assert.ok(view.container.textContent.includes('No days match Only gaps'));
    act(() => view.container.querySelector('.itinerary-empty button').click());
    // The normal view keeps its own choices; the day wasn't opened by hand there.
    assert.equal(view.container.querySelector('button[aria-expanded]').getAttribute('aria-expanded'), 'false');
  } finally { view.close(); }
});
test('reactive full payload updates preserve unique occurrences but reset ambiguous identical duplicates', async () => {
  const { DetailedView } = await import('./DetailedView.tsx');
  const shared = { days: [day, day, { ...day, date: '2040-01-03' }], legColors: [props.legColor, props.legColor, props.legColor], weather: {}, groups: [], ticks: {}, onlyGaps: false, onOnlyGapsChange() {}, filterRef: { current: null }, onToggle() {}, actionItems: [], considerations: [], pendingVotes: {}, onVote() {}, actionItemsDone: {}, onToggleActionItem() {} };
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
test('live removal of a focused inner control keeps focus on its day header while the day remains', async () => {
  const { DetailedView } = await import('./DetailedView.tsx');
  const filter = document.createElement('button'); document.body.append(filter);
  const shared = { days: [{ ...day, acts: ['<a href="https://example.com/synthetic">Synthetic link</a>'] }], legColors: [props.legColor], weather: {}, groups: [], ticks: {}, onlyGaps: false, onOnlyGapsChange() {}, filterRef: { current: filter }, onToggle() {}, actionItems: [], considerations: [], pendingVotes: {}, onVote() {}, actionItemsDone: {}, onToggleActionItem() {} };
  const view = mount(React.createElement(DetailedView, shared));
  try {
    act(() => view.container.querySelector('button[aria-expanded]').click());
    view.container.querySelector('.activity a').focus();
    act(() => view.root.render(React.createElement(DetailedView, { ...shared, days: [day] })));
    // The day is still shown, so focus lands on its header rather than the filter (#174).
    // Compare booleans: a failed assert.equal on jsdom elements inspects the whole DOM.
    assert.ok(document.activeElement === view.container.querySelector('button[aria-expanded]'));
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
    assert.ok(view.container.querySelector('a[href^="https://www.google.com/maps/"]'));
    act(() => view.container.querySelector('.flight-box .status').click());
    assert.deepEqual(calls[0], [[flightId(day.date, richFlight)], 'needed']);
    assert.equal(view.container.querySelector('button[aria-expanded]').getAttribute('aria-expanded'), 'true');
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
    const box = view.container.querySelector('.flight-box');
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
    const cards = [...view.container.querySelectorAll('.card')];
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
    const search = undecided.querySelector('.tbd .tbd-action a'); // on the same row as "to be decided"
    assert.equal(search.textContent, 'Search hotels here');
    assert.ok(new URL(search.href).searchParams.get('q').startsWith('Hotels in Synthetic area'));
    assert.equal(undecided.querySelector('.tile-links'), null); // no separate links row; booking is the check mark at the top right
    const note = [...undecided.querySelectorAll('.cmeta')].find((m) => m.textContent === 'Synthetic free-form note');
    assert.ok(note.compareDocumentPosition(undecided.querySelector('.tbd')) & 2); // the note comes after the to-be-decided row (preceding bit)
    assert.equal(undecided.lastElementChild, note); // and is the last thing on the tile
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
    const cards = [...view.container.querySelectorAll('.flight-box')];
    const open = cards.find((c) => c.textContent.includes('Synthetic needed route'));
    assert.equal(open.querySelector('.tbd-label').textContent, 'To be decided');
    // One blank hop (the route names no places we can read), so every field is open.
    assert.deepEqual([...open.querySelectorAll('.tbd-chip')].map((c) => c.textContent), ['origin', 'destination', 'airline', 'flight number', 'depart time', 'arrive time']);
    assert.deepEqual([...open.querySelectorAll('.seg-time')].map((t) => t.textContent), ['--:--', '--:--']); // the blank slots
    assert.equal(open.querySelector('.gap-reason').textContent, 'Not booked');
    const missing = cards.find((c) => c.textContent.includes('Synthetic booked route'));
    assert.equal(missing.querySelector('.gap-reason').textContent, 'Missing details');
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
    const tiles = [...view.container.querySelectorAll('.flight-box')];
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
    const stay = [...view.container.querySelectorAll('.card')].find((c) => c.textContent.includes('Synthetic maybe stay'));
    assert.equal(stay.querySelector('.maybe-pill').textContent, 'Maybe');
    assert.ok(!stay.querySelector('.gap-reason'));
    assert.equal(view.container.querySelectorAll('.card.miss').length, 0); // no transport row falls back to the old card
  } finally { view.close(); }
});
test('a hotel tile shows the whole stay on every night: both times, nights, a dot for tonight, per-night price, directions, and keeps the pin', async () => {
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
    const card = view.container.querySelector('.card');
    assert.ok(card.querySelector('.cmain a').textContent.includes('📍 Synthetic Hotel')); // the pin stays
    const strip = card.querySelector('.stay-strip');
    assert.ok(strip.textContent.includes('3 nights') && strip.textContent.includes('Mon, Jan 2 · 15:00') && strip.textContent.includes('Thu, Jan 5 · 12:00')); // both times on the check-in tile
    assert.equal(strip.querySelectorAll('.stay-dot').length, 4);
    assert.equal(strip.querySelectorAll('.stay-dot.on').length, 1);
    assert.equal(strip.querySelectorAll('.stay-dot.now').length, 1);
    assert.ok(card.textContent.includes('$900.00 total · $300 / night'));
    assert.ok(!card.textContent.includes('Check-in from')); // the strip says it; not repeated
    assert.equal(card.querySelector('a.stay-dir'), null); // no Directions button
    assert.equal(card.querySelector('.stay-collapse'), null); // a full tile that was never slim has nothing to collapse
  } finally { view.close(); }
  view = render(3);
  try {
    const strip = view.container.querySelector('.stay-strip');
    assert.equal(strip.querySelectorAll('.stay-dot.on').length, 4); // the whole stay is done
    assert.equal(strip.querySelector('.stay-hot').textContent.startsWith('Out'), true); // check-out is the one that matters today
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
    const call = view.container.querySelector('a.stay-dir[href^="tel:"]');
    assert.equal(call.getAttribute('href'), 'tel:+001112223333');
    assert.equal(call.textContent, 'Call');
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
test('a middle night of a booked stay is one slim line that opens to the full tile and closes again', async () => {
  const { resolveDays } = await import('../../lib/tripLogic.ts');
  const stay = (extra = {}) => ({ who: 'all', name: 'Synthetic Hotel', address: 'Synthetic street', status: 'booked', ...extra });
  const days = resolveDays({ days: [
    { ...day, date: '2040-01-02', hotels: [stay({ checkInTime: '15:00' })] },
    { ...day, date: '2040-01-03', hotels: 'same' },
    { ...day, date: '2040-01-04', hotels: [stay({ checkOutTime: '12:00' })] },
  ] });
  const view = mount(React.createElement(DayCard, { ...props, day: days[1], days, dayNumber: 1, expanded: true, onToggle() {} }));
  try {
    const slim = view.container.querySelector('button.stay-slim');
    assert.ok(slim, 'a carried middle night is slim');
    assert.ok(slim.textContent.includes('📍 Synthetic Hotel') && slim.textContent.includes('night 2 of 2') && slim.textContent.includes('out Wed, Jan 4 · 12:00'));
    assert.equal(view.container.querySelector('.card'), null);
    act(() => slim.click());
    assert.ok(view.container.querySelector('.card .stay-strip') && !view.container.querySelector('button.stay-slim'));
    const collapse = view.container.querySelector('.stay-collapse');
    assert.equal(collapse.textContent, 'Show less ▴');
    assert.equal(collapse.closest('.ctop'), null); // not in the top row, so it can't shift the share and calendar buttons
    act(() => collapse.click());
    assert.ok(view.container.querySelector('button.stay-slim') && !view.container.querySelector('.card'));
  } finally { view.close(); }
  // The check-in day and an unbooked stay are never slimmed.
  const first = mount(React.createElement(DayCard, { ...props, day: days[0], days, dayNumber: 0, expanded: true, onToggle() {} }));
  try { assert.ok(first.container.querySelector('.card') && !first.container.querySelector('button.stay-slim')); } finally { first.close(); }
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
    const into = [...view.container.querySelectorAll('.card')].find((c) => c.textContent.includes('Synthetic Hotel B'));
    assert.ok(into.querySelector('.stay-gap').textContent.includes('4h between check-out at 📍 Synthetic Hotel A (11:00) and check-in here'));
    const leaving = [...view.container.querySelectorAll('.card')].find((c) => c.textContent.includes('Synthetic Hotel A') && !c.textContent.includes('Synthetic Hotel B'));
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
    const rows = view.container.querySelectorAll('.flight-box .seg');
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
  const triggers = () => [...view.container.querySelectorAll('button[aria-expanded]')];
  try {
    assert.deepEqual(triggers().map(b => b.getAttribute('aria-expanded')), ['true', 'true']);
    const text = view.container.textContent;
    assert.ok(text.includes('Synthetic open lodging') && text.includes('Not booked'));
    // Booked hotels and transport stay as planning context, without the "Not booked" label.
    const cardWith = (t) => [...view.container.querySelectorAll('.card, .flight-box')].find(c => c.textContent.includes(t));
    assert.ok(cardWith('Synthetic booked lodging') && !cardWith('Synthetic booked lodging').textContent.includes('Not booked'));
    assert.ok(cardWith('Synthetic booked route') && !cardWith('Synthetic booked route').textContent.includes('Not booked'));
    assert.ok(cardWith('Synthetic open lodging').textContent.includes('Not booked'));
    assert.ok(!text.includes('Synthetic activity') && !text.includes('Synthetic callout'));
    assert.ok(text.includes('Nothing planned') && text.includes('None entered') && text.includes('Synthetic A → Synthetic B'));
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
    const item = () => view.container.querySelectorAll('.activity');
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
    const box = view.container.querySelector('.flight-box');
    assert.equal(box.querySelector('.ctype').textContent, '🚆 Train');
    assert.equal(box.querySelector('.tx-state').textContent, '✓ Booked');
    assert.equal(box.querySelector('.tx-title'), null); // the operator in the row is the title
    assert.ok(box.querySelector('.seg-carrier').textContent.includes('Synthetic Rail'));
    assert.equal(box.querySelector('.seg-terminal').textContent, 'Platform 4');
    assert.ok([...box.querySelectorAll('.seg-chip')].some((c) => c.textContent === 'Coach 5 · 12A'));
    const ticket = box.querySelector('.tile-links a');
    assert.equal(ticket.textContent, 'Ticket');
    assert.equal(ticket.getAttribute('href'), 'https://example.com/ticket');
    assert.equal(box.querySelector('.tile-links button'), null); // booked: nothing to book
  } finally { view.close(); }
  // Only an https ticket link is ever rendered.
  const bad = resolveDays({ days: [{ ...day, flights: [{ ...row, ticketUrl: 'javascript:alert(1)' }], hotels: [] }] });
  const view2 = mount(React.createElement(DayCard, { ...props, day: bad[0], days: bad, expanded: true }));
  try { assert.equal(view2.container.querySelector('.tile-links'), null); } finally { view2.close(); }
});

test('an unbooked train shows its route as the title, a route search; the check mark books it; the flight tile is unchanged', async () => {
  const { resolveDays, flightId } = await import('../../lib/tripLogic.ts');
  const open = { who: 'all', route: 'Synthetic City → Synthetic Town', mode: 'train', status: 'needed' };
  const flight = { who: 'all', route: 'Synthetic F → Synthetic G', status: 'booked', title: 'Synthetic flight title' };
  const days = resolveDays({ days: [{ ...day, flights: [open, flight], hotels: [] }] });
  const calls = [];
  const view = mount(React.createElement(DayCard, { ...props, day: days[0], days, expanded: true, onToggle: (...a) => calls.push(a) }));
  try {
    const [train, plane] = view.container.querySelectorAll('.flight-box');
    assert.equal(train.querySelector('.tx-state').textContent, 'Not booked');
    assert.equal(train.querySelector('.tx-title').textContent, 'Synthetic City → Synthetic Town');
    const search = train.querySelector('.tile-links a');
    assert.equal(train.querySelector('.tile-links button'), null); // no Mark as booked: the check mark does it
    assert.equal(search.textContent, 'Search this route');
    assert.equal(new URL(search.href).searchParams.get('travelmode'), 'transit');
    act(() => train.querySelector('.status').click());
    assert.deepEqual(calls[0], [[flightId(day.date, open)], 'needed']); // the toggle reports the current state; the page flips it
    // A flight keeps its own header: no mode pill or state text, and no booking links.
    assert.equal(plane.querySelector('.ctype'), null);
    assert.equal(plane.querySelector('.tx-state'), null);
    assert.equal(plane.querySelector('.tile-links'), null);
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
    const [soon, later] = view.container.querySelectorAll('.flight-box');
    assert.match(soon.querySelector('.next-up-line').textContent, /^Departs in (1 h 5\d min|2 h)$/);
    assert.ok(soon.classList.contains('next-up'));
    assert.equal(later.querySelector('.next-up-line'), null);
  } finally { view.close(); }
});

test('a chosen hotel shows no district line (the area is only the city of a hotel not chosen yet); a deadline task has its own label and marks its day as a gap', async () => {
  const { resolveDays } = await import('../../lib/tripLogic.ts');
  const { gapDates, kindLabel } = await import('../../lib/tasks.ts');
  const days = resolveDays({ days: [{ ...day, date: '2040-01-02', hotels: [{ who: 'all', name: 'Synthetic Hotel', address: 'Synthetic street', status: 'booked', area: 'Synthetic District' }] }] });
  const view = mount(React.createElement(DayCard, { ...props, day: days[0], days, expanded: true }));
  try {
    const card = [...view.container.querySelectorAll('.card')].find((c) => c.textContent.includes('Synthetic Hotel'));
    assert.ok(![...card.querySelectorAll('.cmeta')].some((m) => m.textContent === 'Synthetic District'));
  } finally { view.close(); }
  const task = { kind: 'deadline', mode: 'hotel', key: 'deadline:2040-01-02|h|Synthetic|all', refs: ['deadline:2040-01-02|h|Synthetic|all'], refsDone: [false], done: false, scope: { kind: 'day', date: '2040-01-04' } };
  assert.equal(kindLabel(task), 'Free cancellation');
  assert.deepEqual([...gapDates([task])], ['2040-01-04']); // the day the deadline falls on, not the check-in day
  assert.deepEqual([...gapDates([{ ...task, done: true, refsDone: [true] }])], []);
});

