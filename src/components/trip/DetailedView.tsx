import { Fragment, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { RefObject } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import type { ActionItem, Group, LegColor, Outcome, Place, ResolvedDay, Status, Task, Vote, ActTiming } from "../../lib/types";
import { coversDay } from "../../lib/tasks";
import type { DayGaps } from "../../lib/tasks";
import { useAiFocus } from "../../hooks/useAiFocus";
import { useRecentChanges } from "../../hooks/useRecentChanges";
import { useTileOpen } from "../../hooks/useTileOpen";
import { useHoldForAi } from "../../hooks/useHoldForAi";
import { DOW, MON } from "../../lib/tripLogic";
import { afterScroll, flash, scrollBehavior, SETTLE_MS } from "../../lib/flash";
import { changeVersions } from "../../lib/changeSteps";
import { useChangeQueue } from "../../hooks/useChangeQueue";
import { tileDomId } from "../../lib/tileId";
import { reconcileRows } from "../../lib/itineraryState";
import { DayNav } from "./DayNav";
import { DayScrubber } from "./DayScrubber";
import { SCRUBBER_MIN_DAYS } from "../../lib/scrubber";
import { dayAtLine } from "../../lib/dayInView";
import { focusMapDay } from "../../lib/mapPoints";
import { DayCard } from "./DayCard";
import type { DayWeather } from "../../lib/weather";
import type { CityPhotoFetcher, PlacePhotoFetcher } from "../../lib/cityPhoto";
import { isDestToday } from "../../lib/nowMarker";
import { useNow } from "../../lib/useNow";

export interface DaysControl { allOpen: boolean; toggle: () => void }

interface Props {
  // Local date (YYYY-MM-DD). The trip opens on this day when it is one of the trip's days.
  days: ResolvedDay[];
  legColors: LegColor[];
  weather: Record<string, DayWeather>;
  groups: Group[];
  ticks: Record<string, Status>;
  onlyGaps: boolean;
  // Does this day still have an open booking or unplanned-day task? Undefined
  // while the tasks load.
  isGap?: (day: ResolvedDay) => boolean;
  // Per date: a blank day to plan, moves with no transport. Shown under Only gaps.
  dayGaps?: Record<string, DayGaps>;
  onOnlyGapsChange: (value: boolean) => void;
  filterRef: RefObject<HTMLButtonElement | null>;
  // Tells the page header how to open or close every day at once (null under Only gaps, where every day opens itself).
  onDaysControl?: (control: DaysControl | null) => void;
  onToggle: (ids: string[], status: Status) => void;
  actionItems: ActionItem[];
  // ProposedItems (open or chosen), shown on the days they cover.
  proposedItems: Task[];
  pendingVotes: Record<string, Vote | null>;
  onVote: (itemId: string, vote: Vote | null) => void;
  actionItemsDone: Record<string, boolean>;
  onToggleActionItem: (id: string) => void;
  onEditActivity?: (date: string, index: number, expected: string, text: string, places: Place[], timing?: ActTiming) => Promise<unknown>;
  // Every stored item by id, for the History of an entry approved from one.
  itemTasks?: Record<string, Task>;
  // "Add to itinerary" on an item tile.
  onPromote?: (id: string, date: string) => Promise<unknown>;
  // "Back to proposed", and drop / reopen, on a proposed item's tile.
  onUnpromote?: (id: string) => Promise<unknown>;
  onSetOutcome?: (key: string, outcome: Outcome | null) => void;
  // A photo of each day's city for its header.
  cityPhoto?: CityPhotoFetcher;
  // A photo of a place on a tile.
  placePhoto?: PlacePhotoFetcher;
}

// One change of an AI edit plays this long (the longest .chg-* animation), or
// FAST_MS while a long queue catches up (useChangeQueue).
const STEP_MS = 3400;
const FAST_MS = 200;
const withoutPlaceIds = (d: ResolvedDay) => JSON.stringify(d, (key, value) => (key === "placeId" ? undefined : value));

type DayRow = { id: string; day: ResolvedDay };

// The date strip and the scrubber, with the day the reader is looking at. That day changes as they
// scroll (and on their first touch after a jump), so it is kept here: the change re-renders just
// these, not the whole page of open days.
function CurrentDay({ rows, shownRows, todayId, setJumped, onJump }: {
  rows: DayRow[]; shownRows: DayRow[]; todayId: string | undefined;
  setJumped: RefObject<(id?: string) => void>; onJump: (id: string) => void;
}) {
  // The day the reader is looking at, marked on the date strip: the day they last jumped to, until
  // they scroll by hand (a day near the page's end can't reach the strip); else the day under the strip.
  const [jumpedTo, setJumpedTo] = useState<string>();
  setJumped.current = setJumpedTo;
  const [scrolledTo, setScrolledTo] = useState<string>();
  useEffect(() => {
    let frame = 0;
    const measure = () => {
      frame = 0;
      const strip = document.querySelector(".daynav-shell");
      if (!strip) return;
      // A little below the strip: a jump leaves the day's header just under it.
      // (On a phone the strip may have scrolled far off the top with the tabs: count it as at the top.)
      const line = Math.max(0, strip.getBoundingClientRect().bottom) + 32;
      const cards = rows.flatMap(r => {
        const el = document.getElementById(r.id);
        return el ? [{ id: r.id, top: el.getBoundingClientRect().top }] : [];
      });
      setScrolledTo(dayAtLine(cards, line));
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(measure); };
    const byHand = () => setJumpedTo(undefined);
    const handEvents = ["wheel", "touchmove", "keydown"] as const;
    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    handEvents.forEach(event => window.addEventListener(event, byHand, { passive: true }));
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      handEvents.forEach(event => window.removeEventListener(event, byHand));
    };
  }, [rows]);

  // The same day is what a pinned trip map shows.
  const currentId = jumpedTo ?? scrolledTo;
  const currentDate = rows.find(r => r.id === currentId)?.day.date;
  useEffect(() => { focusMapDay(currentDate); }, [currentDate]);
  return (
    <>
      <DayNav rows={rows} todayId={todayId} currentId={currentId} onJump={onJump} />
      {shownRows.length >= SCRUBBER_MIN_DAYS && <DayScrubber rows={shownRows} currentId={currentId} />}
    </>
  );
}

// Unified itinerary; name retained to keep the detail renderer's consumer small.
export function DetailedView({ days, legColors, weather, groups, ticks, onlyGaps, isGap, dayGaps, onOnlyGapsChange, filterRef, onDaysControl,
  onToggle, actionItems, proposedItems, pendingVotes, onVote, actionItemsDone, onToggleActionItem, onEditActivity, itemTasks, onPromote, onUnpromote, onSetOutcome, cityPhoto, placePhoto }: Props) {
  const prefix = useId();
  const nowMs = useNow();
  // A day the AI just edited keeps showing its old content until the page is
  // pointed at it (see useRecentChanges), so the change can be played from the old text.
  const recent = useRecentChanges(days, d => d.date, useHoldForAi());
  const heldVersion = recent.version();
  const shown = useMemo(() => days.map(d => recent.held(d.date) ?? d),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [days, heldVersion, recent]);
  const [state, setState] = useState(() => {
    let serial = 0;
    const rows = reconcileRows([], shown, () => `${prefix}-day-${++serial}`);
    return { days: shown, rows, serial, expanded: new Set<string>() };
  });
  if (state.days !== shown) {
    let serial = state.serial;
    const rows = reconcileRows(state.rows, shown, () => `${prefix}-day-${++serial}`);
    const retained = new Set(rows.map(row => row.id));
    setState({ days: shown, rows, serial, expanded: new Set([...state.expanded].filter(id => retained.has(id))) });
  }
  const [pending, setPending] = useState<{ id: string; focus: boolean; scroll: boolean } | null>(null);
  const [message, setMessage] = useState("");
  const focusedRow = useRef<string | null>(null);
  const focusedControl = useRef<HTMLElement | null>(null);
  // "Only gaps" shows the days the Action Items list still has something open
  // for. Until the tasks have loaded there is no answer, so nothing is hidden.
  const visible = state.rows.map(({ day: d }) => !onlyGaps || !isGap || isGap(d));
  // Under Only gaps every day opens on its own (the gaps are the point); the
  // reader's own open/closed choices are kept separately for the normal view.
  const gapsView = onlyGaps && !!isGap;
  const [gapsCollapsed, setGapsCollapsed] = useState<Set<string>>(new Set());
  const [gapsViewSeen, setGapsViewSeen] = useState(gapsView);
  if (gapsViewSeen !== gapsView) {
    setGapsViewSeen(gapsView);
    setGapsCollapsed(new Set());
  }
  const isOpen = (id: string) => (gapsView ? !gapsCollapsed.has(id) : state.expanded.has(id));
  const allOpen = state.rows.length > 0 && state.rows.every(row => state.expanded.has(row.id));
  useEffect(() => {
    onDaysControl?.(gapsView ? null : {
      allOpen,
      toggle: () => setState(current => ({ ...current, expanded: allOpen ? new Set<string>() : new Set(current.rows.map(row => row.id)) })),
    });
  }, [onDaysControl, gapsView, allOpen]);
  useEffect(() => () => onDaysControl?.(null), [onDaysControl]);
  const pendingOpen = !!pending && isOpen(pending.id);
  // Which tiles inside the days are open: the reader's choices are saved per trip; Only gaps starts afresh.
  const { slug } = useParams<{ slug: string }>();
  const tiles = useTileOpen(slug, gapsView);

  useLayoutEffect(() => {
    function remember(event: FocusEvent) {
      const target = event.target;
      focusedRow.current = target instanceof HTMLElement ? target.closest<HTMLElement>(".day-card")?.id ?? null : null;
      focusedControl.current = focusedRow.current && target instanceof HTMLElement ? target : null;
    }
    document.addEventListener("focusin", remember);
    return () => document.removeEventListener("focusin", remember);
  }, []);
  useLayoutEffect(() => {
    if (focusedRow.current && (!focusedControl.current?.isConnected || focusedControl.current.closest("[hidden]") ||
      !state.rows.some((row, i) => row.id === focusedRow.current && visible[i]))) {
      const rowStillShown = state.rows.some((row, i) => row.id === focusedRow.current && visible[i]);
      const rowTrigger = rowStillShown ? document.getElementById(`${focusedRow.current}-trigger`) : null;
      if (rowTrigger && !rowTrigger.closest("[hidden]")) {
        // The day is still on screen (e.g. an inline edit closed): keep the page where it is.
        rowTrigger.focus({ preventScroll: true });
      } else {
        // The header filter can be above a tall day; allow native focus scrolling
        // so the recovery destination is visible, unlike an ordinary row toggle.
        filterRef.current?.focus();
      }
      focusedRow.current = null;
      focusedControl.current = null;
    }
    if (!pending) return;
    const targetIndex = state.rows.findIndex(row => row.id === pending.id);
    const target = state.rows[targetIndex];
    // Re-evaluate visibility after commit: a concurrent filter update may have
    // been queued after the jump handler read the previous filter value.
    if (target && !visible[targetIndex]) {
      onOnlyGapsChange(false);
      setMessage("Showing all days to reveal the selected day.");
      return;
    }
    const trigger = target && document.getElementById(`${target.id}-trigger`);
    if (trigger && pendingOpen) {
      if (pending.focus) trigger.focus({ preventScroll: true });
      if (pending.scroll) trigger.scrollIntoView({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
    } else {
      setMessage("That day is no longer available. Choose a day from the navigation.");
    }
    setPending(null);
  }, [state, onlyGaps, ticks, pending, pendingOpen, filterRef, visible, onOnlyGapsChange]);

  // focus: a jump the reader asked for (a date chip, a link) moves keyboard focus to the day;
  // landing on today when the page opens doesn't (it would draw a focus ring nobody asked for).
  // scroll: false only opens the day (an AI edit then scrolls to each change itself).
  function jump(id: string, focus = true, scroll = true) {
    const index = state.rows.findIndex(row => row.id === id);
    if (index < 0) {
      setMessage("That day is no longer available. Choose a day from the navigation.");
      setPending(null);
      return;
    }
    if (!visible[index]) {
      onOnlyGapsChange(false);
      setMessage("Showing all days to reveal the selected day.");
    } else setMessage("");
    setState(current => ({ ...current, expanded: new Set([...current.expanded, id]) }));
    setGapsCollapsed(current => { const next = new Set(current); next.delete(id); return next; });
    setPending({ id, focus, scroll }); // A new intent also makes repeat jumps work.
    setJumped.current(id);
  }

  // The AI or a shared link pointed at a day, or at one tile on it: open and
  // scroll to the day like a nav jump, then blink it (or the tile). The day may
  // not have arrived yet, so wait for it.
  //
  // When the AI edited the day, show what changed instead of a plain blink: the
  // page goes straight to each change in turn and plays it (DayCard's
  // changedFrom, one change at a time; see the queue below), and a day it
  // removed is shown as a ghost where it was.
  const { focus: dayFocus, consume } = useAiFocus("day");
  const { focus: tileFocus } = useAiFocus("tile");
  const focus = dayFocus ?? tileFocus;
  // The AI pointing at a task or to-do: the list or its tile scrolls there, so today mustn't.
  const { focus: taskFocus } = useAiFocus("task");
  const { focus: itemFocus } = useAiFocus("actionItem");
  // versions[k]: the day after its first k changes (lib/changeSteps.ts).
  const [diff, setDiff] = useState<{ date: string; tile: string | null; versions: ResolvedDay[]; nonce: string; json: string } | null>(null);
  const [ghost, setGhost] = useState<ResolvedDay | null>(null);
  useEffect(() => {
    if (!ghost) return;
    document.getElementById("removed-day")?.scrollIntoView({ block: "center", behavior: scrollBehavior() });
    const t = setTimeout(() => setGhost(null), 4200);
    return () => clearTimeout(t);
  }, [ghost]);
  // The change on screen (`step`) waits at its first frame until the page has
  // scrolled to it (`playing` names the step that has started). A reader who
  // scrolls meanwhile keeps the page: the rest play where they are. A tap, click
  // or key ends the playback, so whatever the reader then opens (an editor, a
  // menu) acts on the day as it really is, not on a step of the playback.
  const [playing, setPlaying] = useState<string | null>(null);
  const [fast, setFast] = useState(false);
  const readerMoved = useRef(false);
  // Did any step of the playback have a change on screen? If none did (only a status, or a field
  // the day doesn't show, changed), the page blinks what the AI pointed at instead, as for a plain pointer.
  const drewChange = useRef(false);
  // Blink a day, or one of its tiles (a tile that is gone, the booking changed, falls back to the day).
  function blink(rowId: string, tile: string | null, scroll: boolean) {
    const el = document.getElementById(tile ? tileDomId(rowId, tile) : rowId) ?? document.getElementById(rowId);
    if (!el) return;
    if (scroll) el.scrollIntoView({ block: "center", behavior: scrollBehavior() });
    flash(el);
  }
  useEffect(() => {
    if (!diff) return;
    readerMoved.current = false;
    const moved = () => { readerMoved.current = true; };
    const took = () => setDiff(null);
    const acts = ["pointerdown", "touchstart", "keydown"] as const;
    window.addEventListener("wheel", moved, { passive: true });
    acts.forEach(event => window.addEventListener(event, took, { passive: true, capture: true }));
    return () => {
      window.removeEventListener("wheel", moved);
      acts.forEach(event => window.removeEventListener(event, took, { capture: true }));
    };
  }, [diff]);
  // A newer AI pointer elsewhere (another day, a to-do) ends the playback: what
  // was left of it shows as it ends up, and the new pointer takes the page. One
  // at the day being played, or an item on it (an AI often points at what it just
  // edited), lets it play on: the playback already goes to each change.
  // Any other change to the day being played (the reader's own edit, a later AI
  // edit) ends it too: the page then shows the day as it really is. The server
  // filling in places' Google ids just after an AI edit shows nothing, so it doesn't.
  useEffect(() => {
    if (!diff) return;
    const live = days.find(x => x.date === diff.date);
    if (!live || withoutPlaceIds(live) !== diff.json) setDiff(null);
  }, [days, diff]);
  const newest = (focus ?? taskFocus ?? itemFocus)?.nonce;
  const newestDate = focus?.target.date;
  useEffect(() => {
    if (newest) setDiff(current => (current && current.nonce !== newest && current.date !== newestDate ? null : current));
  }, [newest, newestDate]);
  const step = useChangeQueue(diff?.nonce ?? null, diff ? diff.versions.length - 1 : 0, (i, quick, done) => {
    setFast(quick);
    let cancelScroll = () => {};
    let timer: ReturnType<typeof setTimeout> | undefined;
    // After this render is on the page (the step's change is drawn).
    const frame = setTimeout(() => {
      const row = state.rows.find(r => r.day.date === diff!.date);
      // The first change the day shows (a hidden copy, like the summary's other layout, doesn't count).
      const el = row && [...(document.getElementById(row.id)?.querySelectorAll<HTMLElement>(".chg-new, .chg-gone, .chg-inline") ?? [])]
        .find(e => e.getClientRects().length > 0);
      if (!el) { done(); return; } // nothing on screen changed (a status, a field the day doesn't show)
      drewChange.current = true;
      const start = () => {
        setPlaying(`${diff!.nonce}:${i}`);
        timer = setTimeout(done, quick ? FAST_MS : STEP_MS);
      };
      const box = el.getBoundingClientRect();
      if (readerMoved.current || (box.top >= 0 && box.bottom <= window.innerHeight)) { start(); return; }
      el.scrollIntoView({ block: "center", behavior: quick ? "instant" : scrollBehavior() });
      cancelScroll = afterScroll(start, quick ? 300 : 1000);
    }, 0);
    return () => { clearTimeout(frame); cancelScroll(); clearTimeout(timer); };
  }, () => {
    const row = diff && !drewChange.current && state.rows.find(r => r.day.date === diff.date);
    if (row) blink(row.id, diff.tile, true);
    setDiff(null);
  });
  const stepView = (date: string) =>
    diff?.date === date && step >= 0 && step < diff.versions.length - 1
      ? { day: diff.versions[step + 1], from: diff.versions[step], paused: playing !== `${diff.nonce}:${step}`, ms: fast ? FAST_MS : undefined }
      : null;
  useEffect(() => {
    if (!focus) return;
    const date = focus.target.date;
    const tile = focus.target.kind === "tile" ? focus.target.tile : null;
    const row = state.rows.find(r => r.day.date === date);
    if (!row && !recent.peek(date)?.gone) return;
    const t = setTimeout(() => {
      consume(focus.nonce);
      // The pointed-at tile opens (for this visit only); no other tile is touched.
      if (tile) tiles.reveal(`${date}#${tile}`);
      // The day's edit is already playing (see above): it shows the change, so no blink over it.
      if (diff?.date === date) return;
      const change = recent.take(date);
      if (!row) {
        if (change?.prev) setGhost(change.prev);
        return;
      }
      // An edit to the day: open it and play its changes one by one (the queue
      // scrolls to each). The day was held at its old content until now. A pointer
      // at one of its items plays it too (it may have overtaken the edit's own pointer).
      const next = days.find(x => x.date === date);
      if (change?.prev && !change.gone && next) {
        recent.release(date);
        drewChange.current = false;
        setDiff({ date, tile, versions: changeVersions(change.prev, next), nonce: focus.nonce, json: withoutPlaceIds(next) });
        jump(row.id, false, false);
        return;
      }
      // Once the page has stopped scrolling, show the new content and blink it.
      afterScroll(() => {
        recent.release(date);
        blink(row.id, tile, !!tile && !!document.getElementById(tileDomId(row.id, tile)));
      });
      jump(row.id, false); // the flash shows where; no focus ring on top of it
    }, SETTLE_MS);
    return () => clearTimeout(t);
    // jump is recreated every render and only reads this render's state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus, state.rows, consume]);

  // Opening a trip that is under way lands on today: expand it, scroll it
  // in, then settle on the now line (or the activity in progress), once per mount. A shared link or AI pointer wins, and so does the reader
  // (any input before the timer fires cancels it).
  const [params] = useSearchParams();
  const todayRow = state.rows.find(r => isDestToday(r.day, nowMs));
  // The effect below keys on the id: the row itself is a new object every render.
  const todayId = todayRow?.id;
  const autoDone = useRef(false);
  const jumpRef = useRef(jump);
  jumpRef.current = jump;
  // A link to a task (?task=, as a notification sends) is a pointer too.
  const hasPointer = params.has("day") || params.has("tile") || params.has("task") || !!focus || !!taskFocus || !!itemFocus;
  useEffect(() => {
    if (autoDone.current || !todayId || hasPointer) return;
    const id = todayId;
    let cancelNow = () => {};
    const t = setTimeout(() => {
      autoDone.current = true;
      cancelNow = afterScroll(() => {
        document.getElementById(id)?.querySelector(".tl-now, .tl-entry--now")
          ?.scrollIntoView({ block: "center", behavior: scrollBehavior() });
      });
      jumpRef.current(id, false);
    }, SETTLE_MS + 100);
    const cancel = () => { autoDone.current = true; clearTimeout(t); cancelNow(); };
    const events = ["pointerdown", "wheel", "touchstart", "keydown"] as const;
    events.forEach(event => window.addEventListener(event, cancel, { passive: true }));
    return () => {
      clearTimeout(t);
      cancelNow();
      events.forEach(event => window.removeEventListener(event, cancel));
    };
  }, [todayId, hasPointer]);

  // Which day is current lives in CurrentDay, so a change re-renders only the date strip, not every open day.
  const setJumped = useRef<(id?: string) => void>(() => {});

  // The removed day, where it sat among the rest.
  // The reader's own edit shows at once; only the AI's is held for its focus signal.
  const editActivity: typeof onEditActivity = onEditActivity && ((date, ...rest) => {
    recent.skip(date);
    return onEditActivity(date, ...rest);
  });
  const shownRows = state.rows.filter((_, i) => visible[i]);
  const ghostAt = ghost ? state.rows.findIndex(r => r.day.date > ghost.date) : -1;
  const ghostDay = ghost && (
    <section key="removed-day" id="removed-day" className="day-card chg-gone" inert aria-hidden="true">
      <h2 className="day-heading">
        <span className="day-head">
          <span className="day-title-group">
            <span className="day-num">Removed</span>
            <span className="day-date">{DOW[ghost._d.getDay()]}, {MON[ghost._d.getMonth()]} {ghost._d.getDate()}</span>
          </span>
          {(ghost.highlight || ghost.note) && <span className="day-summary">{ghost.highlight || ghost.note}</span>}
        </span>
      </h2>
    </section>
  );
  return (
    <>
      {/* Picking a day ends an AI edit's playback, so it can't scroll the page back. */}
      <CurrentDay rows={state.rows} shownRows={shownRows} todayId={todayRow?.id} setJumped={setJumped} onJump={id => { setDiff(null); jump(id); }} />
      <p role="status" className="itinerary-status">{message}</p>
      {days.length === 0 ? <p>No itinerary days yet.</p> : !visible.some(Boolean) ? (
        <div className="itinerary-empty"><p>No days match Only gaps.</p><button type="button" className="btn" onClick={() => onOnlyGapsChange(false)}>Show all days</button></div>
      ) : null}
      <div className="timeline">
        {state.rows.map(({ id, day: d }, i) => visible[i] && (
          <Fragment key={id}>
          {ghostAt === i && ghostDay}
          <DayCard rowId={id} day={stepView(d.date)?.day ?? d} isToday={isDestToday(d, nowMs)} changedFrom={stepView(d.date)?.from}
            changePaused={stepView(d.date)?.paused} changeMs={stepView(d.date)?.ms} days={days} dayNumber={i} legColor={legColors[i]} weather={weather[d.date]}
            groups={groups} ticks={ticks} tiles={tiles} expanded={isOpen(id)} gapsOnly={gapsView} gaps={dayGaps?.[d.date]} onExpandedChange={() => {
              if (gapsView) {
                setGapsCollapsed(current => {
                  const next = new Set(current);
                  if (next.has(id)) next.delete(id); else next.add(id);
                  return next;
                });
                return;
              }
              setState(current => {
                const expanded = new Set(current.expanded);
                if (expanded.has(id)) expanded.delete(id); else expanded.add(id);
                return { ...current, expanded };
              });
            }} onToggle={onToggle} dayActionItems={actionItems.filter(item => item.date !== undefined && item.date <= d.date && d.date <= (item.endDate ?? item.date))}
            dayProposed={proposedItems.filter(t => t.scope.kind !== "trip" && coversDay(t.scope, d.date))}
            pendingVotes={pendingVotes} onVote={onVote}
            actionItemsDone={actionItemsDone} onToggleActionItem={onToggleActionItem} onEditActivity={editActivity} itemTasks={itemTasks} onPromote={onPromote} onUnpromote={onUnpromote} onSetOutcome={onSetOutcome} cityPhoto={cityPhoto} placePhoto={placePhoto} />
          </Fragment>
        ))}
        {ghostAt === -1 && ghostDay}
      </div>
    </>
  );
}
