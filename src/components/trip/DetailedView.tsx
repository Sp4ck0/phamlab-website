import { Fragment, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import type { ActionItem, Group, LegColor, ResolvedDay, Status, Task, Vote } from "../../lib/types";
import { coversDay } from "../../lib/tasks";
import type { DayGaps } from "../../lib/tasks";
import { useAiFocus } from "../../hooks/useAiFocus";
import { useRecentChanges } from "../../hooks/useRecentChanges";
import { DOW, MON } from "../../lib/tripLogic";
import { flash, scrollBehavior, SETTLE_MS } from "../../lib/flash";
import { tileDomId } from "../../lib/tileId";
import { reconcileRows } from "../../lib/itineraryState";
import { DayNav } from "./DayNav";
import { DayCard } from "./DayCard";
import type { DayWeather } from "../../lib/weather";

interface Props {
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
  onToggle: (ids: string[], status: Status) => void;
  actionItems: ActionItem[];
  // Considerations (open or chosen), shown on the days they cover.
  considerations: Task[];
  pendingVotes: Record<string, Vote | null>;
  onVote: (itemId: string, vote: Vote | null) => void;
  actionItemsDone: Record<string, boolean>;
  onToggleActionItem: (id: string) => void;
  onEditActivity?: (date: string, index: number, expected: string, text: string) => Promise<unknown>;
}

// Unified itinerary; name retained to keep the detail renderer's consumer small.
export function DetailedView({ days, legColors, weather, groups, ticks, onlyGaps, isGap, dayGaps, onOnlyGapsChange, filterRef,
  onToggle, actionItems, considerations, pendingVotes, onVote, actionItemsDone, onToggleActionItem, onEditActivity }: Props) {
  const prefix = useId();
  const [state, setState] = useState(() => {
    let serial = 0;
    const rows = reconcileRows([], days, () => `${prefix}-day-${++serial}`);
    return { days, rows, serial, expanded: new Set<string>() };
  });
  if (state.days !== days) {
    let serial = state.serial;
    const rows = reconcileRows(state.rows, days, () => `${prefix}-day-${++serial}`);
    const retained = new Set(rows.map(row => row.id));
    setState({ days, rows, serial, expanded: new Set([...state.expanded].filter(id => retained.has(id))) });
  }
  const [pending, setPending] = useState<{ id: string } | null>(null);
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
  const pendingOpen = !!pending && isOpen(pending.id);

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
      // The header filter can be above a tall day; allow native focus scrolling
      // so the recovery destination is visible, unlike an ordinary row toggle.
      filterRef.current?.focus();
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
      trigger.focus({ preventScroll: true });
      trigger.scrollIntoView({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
    } else {
      setMessage("That day is no longer available. Choose a day from the navigation.");
    }
    setPending(null);
  }, [state, onlyGaps, ticks, pending, pendingOpen, filterRef, visible, onOnlyGapsChange]);

  function jump(id: string) {
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
    setPending({ id }); // A new intent also makes repeat jumps work.
  }

  // The AI or a shared link pointed at a day, or at one tile on it: open and
  // scroll to the day like a nav jump, then blink it (or the tile). The day may
  // not have arrived yet, so wait for it.
  //
  // When the AI edited the day, show what changed instead of a plain blink: the
  // day is rendered against its previous version for a few seconds (DayCard's
  // changedFrom), and a day it removed is shown as a ghost where it was.
  const { focus: dayFocus, consume } = useAiFocus("day");
  const { focus: tileFocus } = useAiFocus("tile");
  const focus = dayFocus ?? tileFocus;
  const recent = useRecentChanges(days, d => d.date);
  const [diff, setDiff] = useState<{ date: string; prev: ResolvedDay } | null>(null);
  const [ghost, setGhost] = useState<ResolvedDay | null>(null);
  useEffect(() => {
    if (!diff && !ghost) return;
    if (ghost) document.getElementById("removed-day")?.scrollIntoView({ block: "center", behavior: scrollBehavior() });
    const t = setTimeout(() => { setDiff(null); setGhost(null); }, 4200);
    return () => clearTimeout(t);
  }, [diff, ghost]);
  useEffect(() => {
    if (!focus) return;
    const date = focus.target.date;
    const tile = focus.target.kind === "tile" ? focus.target.tile : null;
    const row = state.rows.find(r => r.day.date === date);
    if (!row && !recent.peek(date)?.gone) return;
    const t = setTimeout(() => {
      consume(focus.nonce);
      const change = recent.take(date);
      if (!row) {
        if (change?.prev) setGhost(change.prev);
        return;
      }
      jump(row.id);
      setTimeout(() => {
        // A tile that is gone (the booking changed) falls back to the day.
        const el = document.getElementById(tile ? tileDomId(row.id, tile) : row.id) ?? document.getElementById(row.id);
        if (!el) return;
        if (tile && el.id !== row.id) el.scrollIntoView({ block: "center", behavior: scrollBehavior() });
        if (!tile && change?.prev && !change.gone) setDiff({ date, prev: change.prev });
        else flash(el);
      }, 250);
    }, SETTLE_MS);
    return () => clearTimeout(t);
    // jump is recreated every render and only reads this render's state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus, state.rows, consume]);

  // The removed day, where it sat among the rest.
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
      <DayNav rows={state.rows} onJump={jump} />
      <p role="status" className="itinerary-status">{message}</p>
      {days.length === 0 ? <p>No itinerary days yet.</p> : !visible.some(Boolean) ? (
        <div className="itinerary-empty"><p>No days match Only gaps.</p><button type="button" className="btn" onClick={() => onOnlyGapsChange(false)}>Show all days</button></div>
      ) : null}
      <div className="timeline">
        {state.rows.map(({ id, day: d }, i) => visible[i] && (
          <Fragment key={id}>
          {ghostAt === i && ghostDay}
          <DayCard rowId={id} day={d} changedFrom={diff?.date === d.date ? diff.prev : undefined} days={days} dayNumber={i} legColor={legColors[i]} weather={weather[d.date]}
            groups={groups} ticks={ticks} expanded={isOpen(id)} gapsOnly={gapsView} gaps={dayGaps?.[d.date]} onExpandedChange={() => {
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
            dayConsiderations={considerations.filter(t => t.scope.kind !== "trip" && coversDay(t.scope, d.date))}
            pendingVotes={pendingVotes} onVote={onVote}
            actionItemsDone={actionItemsDone} onToggleActionItem={onToggleActionItem} onEditActivity={onEditActivity} />
          </Fragment>
        ))}
        {ghostAt === -1 && ghostDay}
      </div>
    </>
  );
}
