import { useLayoutEffect, useRef } from "react";
import type { ItineraryRow } from "../../lib/itineraryState";
import { DOW, MON } from "../../lib/tripLogic";

export function DayNav({ rows, todayId, onJump }: { rows: ItineraryRow[]; todayId?: string; onJump: (rowId: string) => void }) {
  const nav = useRef<HTMLElement>(null);
  const todayBtn = useRef<HTMLButtonElement>(null);
  // Bring today's pill into view along the strip only; scrollIntoView would also move the page.
  useLayoutEffect(() => {
    const n = nav.current, b = todayBtn.current;
    if (n && b) n.scrollLeft = b.offsetLeft - (n.clientWidth - b.offsetWidth) / 2;
  }, [todayId]);
  return (
    <div className="daynav-shell">
      <nav className="daynav" aria-label="Jump to itinerary day" ref={nav}>
        {rows.map(({ id, day: d }, i) => id === todayId ? (
          <button type="button" key={id} ref={todayBtn} className="daynav-today" aria-current="date" onClick={() => onJump(id)}>
            <span className="d">Today ·</span> {MON[d._d.getMonth()]} {d._d.getDate()}
          </button>
        ) : (
          <button type="button" key={id} onClick={() => onJump(id)}>
            <span className="d">Day {i} · {DOW[d._d.getDay()]}</span> {MON[d._d.getMonth()]} {d._d.getDate()}
          </button>
        ))}
      </nav>
    </div>
  );
}
