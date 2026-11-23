import { useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent } from "react";
import type { ItineraryRow } from "../../lib/itineraryState";
import { DOW, MON } from "../../lib/tripLogic";
import { offsetAtPosition, positionAtPointer } from "../../lib/scrubber";

const label = (r: ItineraryRow) => `${DOW[r.day._d.getDay()]}, ${MON[r.day._d.getMonth()]} ${r.day._d.getDate()}`;

// A slim drag handle down the right edge for long itineraries, on touch screens only (CSS). Only the
// handle takes touches, so page scrolling and edge gestures are untouched. Dragging scrolls to a day
// without opening it, so scrubbing past many days doesn't reflow the page.
export function DayScrubber({ rows, currentId }: { rows: ItineraryRow[]; currentId?: string }) {
  const track = useRef<HTMLDivElement>(null);
  // While dragging: where the finger is, as a position between days (2.5 = halfway from day 2 to 3).
  const [dragAt, setDragAt] = useState<number | null>(null);
  const frame = useRef(0);
  const latest = useRef(0);
  const currentIndex = Math.max(0, rows.findIndex(r => r.id === currentId));
  const position = dragAt ?? currentIndex;
  const index = Math.round(position);

  function go(i: number) {
    const row = rows[i];
    if (!row) return;
    const reduced = !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    document.getElementById(row.id)?.scrollIntoView({ block: "start", behavior: reduced ? "instant" : "smooth" });
  }
  // Follow the finger: scroll to the matching spot between two days' tops (past their sticky-bar margin).
  function scrollTo(pos: number) {
    const tops = rows.map(r => {
      const el = document.getElementById(r.id);
      return el ? el.getBoundingClientRect().top + window.scrollY - (parseFloat(getComputedStyle(el).scrollMarginTop) || 0) : 0;
    });
    window.scrollTo({ top: offsetAtPosition(pos, tops), behavior: "instant" });
  }
  function onMove(e: PointerEvent) {
    const box = track.current?.getBoundingClientRect();
    if (dragAt === null || !box) return;
    const pos = positionAtPointer(e.clientY, box.top, box.height, rows.length);
    setDragAt(pos);
    latest.current = pos;
    if (!frame.current) frame.current = requestAnimationFrame(() => { frame.current = 0; scrollTo(latest.current); });
  }
  function onKey(e: KeyboardEvent) {
    const step = { ArrowUp: -1, ArrowLeft: -1, ArrowDown: 1, ArrowRight: 1 }[e.key];
    const i = e.key === "Home" ? 0 : e.key === "End" ? rows.length - 1 : step === undefined ? -1 : Math.min(rows.length - 1, Math.max(0, index + step));
    if (i < 0) return;
    e.preventDefault();
    go(i);
  }

  return (
    <div className={`day-scrubber${dragAt !== null ? " is-dragging" : ""}`} ref={track}>
      <div
        className="day-scrubber-handle"
        role="slider"
        tabIndex={0}
        aria-label="Scrub through itinerary days"
        aria-orientation="vertical"
        aria-valuemin={1}
        aria-valuemax={rows.length}
        aria-valuenow={index + 1}
        aria-valuetext={label(rows[index])}
        style={{ top: `${rows.length < 2 ? 0 : (position / (rows.length - 1)) * 100}%` }}
        onKeyDown={onKey}
        onTouchStart={e => e.stopPropagation()}
        onTouchEnd={e => e.stopPropagation()}
        onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); setDragAt(currentIndex); }}
        onPointerMove={onMove}
        onPointerUp={() => setDragAt(null)}
        onPointerCancel={() => setDragAt(null)}
      >
        {dragAt !== null && <span className="day-scrubber-bubble" aria-hidden="true">{label(rows[index])}</span>}
      </div>
    </div>
  );
}
