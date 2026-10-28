import { useId, useLayoutEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import type { ActionItem, Group, LegColor, ResolvedDay, Status } from "../../lib/types";
import { reconcileRows } from "../../lib/itineraryState";
import { mergeFlightsByRoute, statusOf } from "../../lib/tripLogic";
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
  onOnlyGapsChange: (value: boolean) => void;
  filterRef: RefObject<HTMLButtonElement | null>;
  onToggle: (ids: string[], status: Status) => void;
  actionItems: ActionItem[];
  actionItemsDone: Record<string, boolean>;
  onToggleActionItem: (id: string) => void;
}

// Unified itinerary; name retained to keep the detail renderer's consumer small.
export function DetailedView({ days, legColors, weather, groups, ticks, onlyGaps, onOnlyGapsChange, filterRef,
  onToggle, actionItems, actionItemsDone, onToggleActionItem }: Props) {
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
  const visible = state.rows.map(({ day: d }) => !onlyGaps ||
    mergeFlightsByRoute(d.flights, d.date, ticks).some(g => g.statuses.includes("needed")) ||
    d.hotels.some(h => !h.carried && statusOf(ticks, h.src, h.status) === "needed") ||
    (!(d.acts && d.acts.length) && !(d.flights && d.flights.length) && d.tag !== "transit"));

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
    if (trigger && state.expanded.has(pending.id)) {
      trigger.focus({ preventScroll: true });
      trigger.scrollIntoView({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
    } else {
      setMessage("That day is no longer available. Choose a day from the navigation.");
    }
    setPending(null);
  }, [state, onlyGaps, ticks, pending, filterRef, visible, onOnlyGapsChange]);

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
    setPending({ id }); // A new intent also makes repeat jumps work.
  }
  return (
    <>
      <DayNav rows={state.rows} onJump={jump} />
      <p role="status" className="itinerary-status">{message}</p>
      {days.length === 0 ? <p>No itinerary days yet.</p> : !visible.some(Boolean) ? (
        <div className="itinerary-empty"><p>No days match Only gaps.</p><button type="button" className="btn" onClick={() => onOnlyGapsChange(false)}>Show all days</button></div>
      ) : null}
      <div className="timeline">
        {state.rows.map(({ id, day: d }, i) => visible[i] && (
          <DayCard key={id} rowId={id} day={d} days={days} dayNumber={i} legColor={legColors[i]} weather={weather[d.date]}
            groups={groups} ticks={ticks} expanded={state.expanded.has(id)} onExpandedChange={() => {
              setState(current => {
                const expanded = new Set(current.expanded);
                if (expanded.has(id)) expanded.delete(id); else expanded.add(id);
                return { ...current, expanded };
              });
            }} onToggle={onToggle} dayActionItems={actionItems.filter(item => item.date === d.date)}
            actionItemsDone={actionItemsDone} onToggleActionItem={onToggleActionItem} />
        ))}
      </div>
    </>
  );
}
