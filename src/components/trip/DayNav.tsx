import { useEffect, useLayoutEffect, useRef } from "react";
import type { ItineraryRow } from "../../lib/itineraryState";
import { DOW, MON } from "../../lib/tripLogic";

export function DayNav({ rows, todayId, onJump }: { rows: ItineraryRow[]; todayId?: string; onJump: (rowId: string) => void }) {
  const nav = useRef<HTMLElement>(null);
  const todayBtn = useRef<HTMLButtonElement>(null);
  // Chips snap to whole buttons after a swipe; on phones they line up just right of the sticky
  // Today button, so none sits half under it.
  const jumpBtn = useRef<HTMLButtonElement>(null);
  useLayoutEffect(() => {
    const n = nav.current, j = jumpBtn.current;
    if (!n) return;
    const pad = () => { n.style.scrollPaddingLeft = j && j.offsetWidth ? `${j.offsetWidth + 6}px` : ""; };
    pad();
    window.addEventListener("resize", pad);
    return () => window.removeEventListener("resize", pad);
  }, [todayId]);
  // Bring today's pill into view along the strip only; scrollIntoView would also move the page.
  useLayoutEffect(() => {
    const n = nav.current, b = todayBtn.current;
    if (n && b) n.scrollLeft = b.offsetLeft - (n.clientWidth - b.offsetWidth) / 2;
  }, [todayId]);
  // A mouse wheel sends vertical deltas, which a horizontal-only strip ignores. While the pointer is
  // over the bar, turn them into sideways scrolling; at either end let the page scroll as usual.
  // Native listener: React's onWheel is passive, so it couldn't preventDefault.
  const shell = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const s = shell.current, n = nav.current;
    if (!s || !n) return;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      const max = n.scrollWidth - n.clientWidth;
      if ((e.deltaY < 0 && n.scrollLeft <= 0) || (e.deltaY > 0 && n.scrollLeft >= max - 1)) return;
      e.preventDefault();
      n.scrollLeft += e.deltaY;
    };
    s.addEventListener("wheel", onWheel, { passive: false });
    return () => s.removeEventListener("wheel", onWheel);
  }, []);
  return (
    <div className="daynav-shell" ref={shell}>
      <nav className="daynav" aria-label="Jump to itinerary day" ref={nav}>
        {/* Phones: stays at the strip's left edge so today is one tap away from any day. */}
        {todayId && (
          <button type="button" className="daynav-jump" ref={jumpBtn} onClick={() => onJump(todayId)}>
            ↩ Today
          </button>
        )}
        {rows.map(({ id, day: d }, i) => {
          const date = `${MON[d._d.getMonth()]} ${d._d.getDate()}`;
          const dow = DOW[d._d.getDay()];
          const today = id === todayId;
          // Chips: the weekday over the date. The day number is in the label and tooltip.
          return (
            <button
              type="button"
              key={id}
              ref={today ? todayBtn : undefined}
              className={today ? "daynav-today" : undefined}
              aria-current={today ? "date" : undefined}
              aria-label={`${today ? "Today, " : ""}Day ${i}, ${dow} ${date}`}
              title={`Day ${i}`}
              onClick={() => onJump(id)}
            >
              <span className="dn-dow">{dow}</span>
              <span className="dn-date">{date}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
