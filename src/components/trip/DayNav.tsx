import { useEffect, useLayoutEffect, useRef } from "react";
import type { ItineraryRow } from "../../lib/itineraryState";
import { DOW, MON } from "../../lib/tripLogic";
import { scrollBehavior } from "../../lib/flash";

// Scrolls the strip (not the page) so chip `i` sits second from the left: the day before it
// first, just right of the Today button. Then you can see where you came from and what's next.
function lineUp(n: HTMLElement, i: number, smooth: boolean) {
  const lead = n.querySelectorAll<HTMLElement>("[data-row]")[Math.max(0, i - 1)];
  if (!lead) return;
  const pad = parseFloat(n.style.scrollPaddingLeft) || 0;
  const left = n.scrollLeft + lead.getBoundingClientRect().left - n.getBoundingClientRect().left - pad;
  if (smooth && typeof n.scrollTo === "function") n.scrollTo({ left, behavior: scrollBehavior() });
  else n.scrollLeft = left;
}

// currentId: the day the reader is looking at (filled); todayId: today (outlined, labelled "Today").
export function DayNav({ rows, todayId, currentId, onJump }: { rows: ItineraryRow[]; todayId?: string; currentId?: string; onJump: (rowId: string) => void }) {
  const nav = useRef<HTMLElement>(null);
  // Chips snap to whole buttons after a swipe; they line up just right of the sticky
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
  // Open on today, with yesterday before it.
  useLayoutEffect(() => {
    const n = nav.current, i = rows.findIndex(r => r.id === todayId);
    if (n && i >= 0) lineUp(n, i, false);
    // Only when today changes, not on every edit to the days.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayId]);
  // Keep the day being looked at on the strip: when its chip is out of sight, line it up the same way.
  useEffect(() => {
    const n = nav.current, i = rows.findIndex(r => r.id === currentId);
    const chip = n?.querySelectorAll<HTMLElement>("[data-row]")[i];
    if (!n || !chip) return;
    const box = n.getBoundingClientRect(), c = chip.getBoundingClientRect();
    const pad = parseFloat(n.style.scrollPaddingLeft) || 0;
    if (c.left < box.left + pad - 1 || c.right > box.right + 1) lineUp(n, i, true);
    // Only when that day changes: an edit to the days shouldn't slide the strip.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentId]);
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
  // Where the pinned strip ends on screen (--daynav-bottom), for a phone's day header to pin under it.
  // Always where it ends while shown: its `top` has the bars' current scroll shift taken off (CSS).
  useEffect(() => {
    const s = shell.current;
    if (!s || typeof window.getComputedStyle !== "function") return;
    const root = document.documentElement;
    const set = () => {
      const style = window.getComputedStyle(s);
      const top = (parseFloat(style.top) || 0) + (parseFloat(style.getPropertyValue("--bars-shift")) || 0);
      root.style.setProperty("--daynav-bottom", `${top + s.offsetHeight}px`);
    };
    set();
    const ro = typeof ResizeObserver === "function" ? new ResizeObserver(set) : undefined;
    ro?.observe(s);
    window.addEventListener("resize", set);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", set);
      root.style.removeProperty("--daynav-bottom");
    };
  }, []);
  return (
    <div className="daynav-shell" ref={shell}>
      <nav className="daynav" aria-label="Jump to itinerary day" ref={nav}>
        {/* Stays at the strip's left edge so today is one tap away from any day. */}
        {todayId && (
          <button type="button" className="daynav-jump" ref={jumpBtn} onClick={() => onJump(todayId)}>
            ↩ Today
          </button>
        )}
        {rows.map(({ id, day: d }, i) => {
          const date = `${MON[d._d.getMonth()]} ${d._d.getDate()}`;
          const dow = DOW[d._d.getDay()];
          const today = id === todayId, current = id === currentId;
          // Chips: the weekday (or "Today") over the date. The day number is in the label and tooltip.
          return (
            <button
              type="button"
              key={id}
              data-row={id}
              className={[today && "daynav-today", current && "daynav-current"].filter(Boolean).join(" ") || undefined}
              aria-current={current ? "location" : today ? "date" : undefined}
              aria-label={`${today ? "Today, " : ""}Day ${i}, ${dow} ${date}`}
              title={`Day ${i}`}
              onClick={() => onJump(id)}
            >
              <span className="dn-dow">{today ? "Today" : dow}</span>
              <span className="dn-date">{date}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
