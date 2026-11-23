import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent } from "react";
import type { ItineraryRow } from "../../lib/itineraryState";
import { DOW, MON } from "../../lib/tripLogic";
import { SCRUBBER_EVENT } from "../../lib/hideBars";
import { offsetAtPosition, positionAtPointer, smoothDamp } from "../../lib/scrubber";

const tell = (active: boolean) => window.dispatchEvent(new CustomEvent(SCRUBBER_EVENT, { detail: { active } }));
const label = (r: ItineraryRow) => `${DOW[r.day._d.getDay()]}, ${MON[r.day._d.getMonth()]} ${r.day._d.getDate()}`;

// A slim drag handle down the right edge for long itineraries, on touch screens only (CSS). Only the
// handle takes touches, so page scrolling and edge gestures are untouched. Dragging scrolls to a day
// without opening it, so scrubbing past many days doesn't reflow the page.
export function DayScrubber({ rows, currentId }: { rows: ItineraryRow[]; currentId?: string }) {
  const track = useRef<HTMLDivElement>(null);
  // While dragging: where the finger is, as a position between days (2.5 = halfway from day 2 to 3).
  const [dragAt, setDragAt] = useState<number | null>(null);
  const currentIndex = Math.max(0, rows.findIndex(r => r.id === currentId));
  const position = dragAt ?? currentIndex;
  const index = Math.round(position);
  // The page glides toward where the finger points instead of being pinned to it: a spring chases
  // the target scroll offset each frame, so it speeds up, slows into place, and carries on a moment
  // after the finger lifts.
  const glide = useRef({ frame: 0, last: 0, y: 0, velocity: 0, target: 0, tops: [] as number[], grab: 0, dragging: false });

  useEffect(() => () => cancelAnimationFrame(glide.current.frame), []);

  function go(i: number) {
    const row = rows[i];
    if (!row) return;
    const reduced = !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    document.getElementById(row.id)?.scrollIntoView({ block: "start", behavior: reduced ? "instant" : "smooth" });
  }
  function tick(now: number) {
    const g = glide.current;
    const dt = Math.min(0.05, (now - g.last) / 1000);
    g.last = now;
    const reduced = !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced) { g.y = g.target; g.velocity = 0; }
    else [g.y, g.velocity] = smoothDamp(g.y, g.target, g.velocity, 0.22, dt);
    const arrived = Math.abs(g.y - g.target) < 0.5 && Math.abs(g.velocity) < 5;
    window.scrollTo({ top: arrived ? g.target : g.y, behavior: "instant" });
    g.frame = arrived && !g.dragging ? 0 : requestAnimationFrame(tick);
  }
  function onDown(e: PointerEvent<HTMLDivElement>) {
    const g = glide.current, box = e.currentTarget.getBoundingClientRect();
    e.currentTarget.setPointerCapture(e.pointerId);
    tell(true); // the bars go away first, so the tops below are measured with them gone
    // Each day's page offset (past its sticky-bar margin), measured once: nothing reflows while dragging.
    g.tops = rows.map(r => {
      const el = document.getElementById(r.id);
      return el ? el.getBoundingClientRect().top + window.scrollY - (parseFloat(getComputedStyle(el).scrollMarginTop) || 0) : 0;
    });
    g.grab = e.clientY - (box.top + box.height / 2); // grabbed off-centre: the handle doesn't jump to the finger
    g.y = window.scrollY;
    g.target = g.y;
    g.velocity = 0;
    g.dragging = true;
    setDragAt(currentIndex);
  }
  function onMove(e: PointerEvent<HTMLDivElement>) {
    const g = glide.current, box = track.current?.getBoundingClientRect();
    if (!g.dragging || !box) return;
    const pos = positionAtPointer(e.clientY - g.grab, box.top, box.height, rows.length);
    setDragAt(pos);
    g.target = offsetAtPosition(pos, g.tops);
    if (!g.frame) { g.last = performance.now(); g.frame = requestAnimationFrame(tick); }
  }
  function onUp() {
    glide.current.dragging = false;
    setDragAt(null);
    tell(false);
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
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      >
        {dragAt !== null && <span className="day-scrubber-bubble" aria-hidden="true">{label(rows[index])}</span>}
      </div>
    </div>
  );
}
