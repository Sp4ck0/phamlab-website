import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent } from "react";
import type { ItineraryRow } from "../../lib/itineraryState";
import { DOW, MON } from "../../lib/tripLogic";
import { SCRUBBER_EVENT } from "../../lib/hideBars";
import { indexAtOffset, rampSpeed } from "../../lib/scrubber";

const HOLD_MS = 250;
const tell = (active: boolean) => window.dispatchEvent(new CustomEvent(SCRUBBER_EVENT, { detail: { active } }));
// Where the finger is on the screen. On an iPhone (installed app) the page scrolling under the finger can
// leave scroll offsets in these readings: clientY has read ~4000 on a 780-tall screen, and screenY has
// included the page's whole scroll position. Each reading is tried, with the scroll offset taken off
// where that explains it. Of those on the screen, the one nearest the last reading (`near`) is used, since
// a finger moves only a little between events, while a wrong reading drifts with the page scrolled under
// the finger; with rate control that drift would speed up the very scroll that causes it. Without a last
// reading, the first one on the screen. None on the screen: ignore this event.
function fingerY(e: PointerEvent, near?: number | null): number | null {
  const sy = window.scrollY, h = window.innerHeight;
  let best: number | null = null;
  for (const y of [e.clientY, e.screenY - sy, e.pageY - sy]) {
    if (!Number.isFinite(y) || y < -40 || y > h + 40) continue;
    if (near == null) return y;
    if (best === null || Math.abs(y - near) < Math.abs(best - near)) best = y;
  }
  return best;
}
const label = (r: ItineraryRow) => `${DOW[r.day._d.getDay()]}, ${MON[r.day._d.getMonth()]} ${r.day._d.getDate()}`;

// A slim handle down the right edge for long itineraries, on touch screens only (CSS). Only the handle
// takes touches, so page scrolling and edge gestures are untouched. It works by rate, like autoscroll or a
// shuttle dial: press and hold it, then the farther the finger slides up or down from where it pressed,
// the faster the page scrolls that way. Back to the start point, or lifting the finger, stops it. An
// accidental grab can only start a slow scroll, never throw the page across the trip.
export function DayScrubber({ rows, currentId }: { rows: ItineraryRow[]; currentId?: string }) {
  const track = useRef<HTMLDivElement>(null);
  // While scrubbing: how far down the track the handle is drawn (0 to 1) and the day the page is at.
  const [dragAt, setDragAt] = useState<{ fraction: number; index: number } | null>(null);
  const currentIndex = Math.max(0, rows.findIndex(r => r.id === currentId));
  const index = Math.min(rows.length - 1, dragAt?.index ?? currentIndex);
  const restAt = rows.length < 2 ? 0 : currentIndex / (rows.length - 1);
  const handleTop = dragAt ? dragAt.fraction : restAt;
  // The scroll loop: `y` is the page offset kept as a fraction (scrollY rounds, which would stall a slow
  // scroll), `offset` how far the finger is from `anchor`, `tops` each day's page offset for the bubble.
  const scrub = useRef({ frame: 0, last: 0, y: 0, anchor: 0, finger: 0, offset: 0, from: 0, tops: [] as number[], shown: "", dragging: false });

  function go(i: number) {
    const row = rows[i];
    if (!row) return;
    const reduced = !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    document.getElementById(row.id)?.scrollIntoView({ block: "start", behavior: reduced ? "instant" : "smooth" });
  }
  function tick(now: number) {
    const g = scrub.current;
    if (!g.dragging) { g.frame = 0; return; }
    const dt = Math.max(0, Math.min(0.05, (now - g.last) / 1000));
    g.last = now;
    const speed = rampSpeed(g.offset, 4 * window.innerHeight);
    if (speed) {
      const end = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      g.y = Math.min(end, Math.max(0, g.y + speed * dt));
      window.scrollTo({ top: g.y, behavior: "instant" });
    } else g.y = window.scrollY; // still: leave the page alone
    const box = track.current?.getBoundingClientRect();
    const fraction = box && box.height > 0 ? Math.min(1, Math.max(0, g.from + g.offset / box.height)) : g.from;
    const index = indexAtOffset(g.y, g.tops);
    const shown = `${index}:${fraction.toFixed(3)}`;
    if (shown !== g.shown) { g.shown = shown; setDragAt({ fraction, index }); }
    g.frame = requestAnimationFrame(tick);
  }
  // Starting to scrub (after a deliberate press, see onDown): anchor the finger and start the loop.
  function begin(handle: HTMLElement, pointerId: number, finger: number | null) {
    const g = scrub.current;
    try { handle.setPointerCapture(pointerId); } catch { /* the finger already lifted */ }
    tell(true); // the bars go away first, so the tops below are measured with them gone
    // Each day's page offset (past its sticky-bar margin), measured once: nothing reflows while scrubbing.
    g.tops = rows.map(r => {
      const el = document.getElementById(r.id);
      return el ? el.getBoundingClientRect().top + window.scrollY - (parseFloat(getComputedStyle(el).scrollMarginTop) || 0) : 0;
    });
    const box = handle.getBoundingClientRect();
    g.anchor = g.finger = finger ?? box.top + box.height / 2;
    g.offset = 0;
    g.shown = "";
    g.from = restAt;
    g.y = window.scrollY;
    g.dragging = true;
    setDragAt({ fraction: g.from, index: indexAtOffset(g.y, g.tops) });
    cancelAnimationFrame(g.frame);
    g.last = performance.now();
    g.frame = requestAnimationFrame(tick);
  }
  // The handle sits where a thumb rests while scrolling, so a quick flick that starts on it must not scrub:
  // a finger (or pen) has to stay put on it for HOLD_MS first. Moving sooner starts nothing. A mouse
  // scrubs at once.
  const press = useRef({ timer: 0, x: 0, y: 0, lastY: null as number | null });
  function onDown(e: PointerEvent<HTMLDivElement>) {
    const handle = e.currentTarget, id = e.pointerId, p = press.current;
    window.clearTimeout(p.timer);
    p.x = e.clientX; p.y = e.clientY; p.lastY = fingerY(e);
    if (e.pointerType === "mouse") { begin(handle, id, p.lastY); return; }
    p.timer = window.setTimeout(() => { p.timer = 0; begin(handle, id, p.lastY); }, HOLD_MS);
  }
  // Stop when the finger can no longer be followed: the app was hidden, or the scrubber went away mid-scrub.
  useEffect(() => {
    const hidden = () => { if (document.hidden) onUp(); };
    document.addEventListener("visibilitychange", hidden);
    window.addEventListener("blur", onUp);
    return () => {
      document.removeEventListener("visibilitychange", hidden);
      window.removeEventListener("blur", onUp);
      onUp();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  function onMove(e: PointerEvent<HTMLDivElement>) {
    const g = scrub.current;
    if (!g.dragging) {
      // Moved before the hold finished: this is a scroll, not a scrub.
      if (press.current.timer && Math.hypot(e.clientX - press.current.x, e.clientY - press.current.y) > 8) {
        window.clearTimeout(press.current.timer);
        press.current.timer = 0;
      } else press.current.lastY = fingerY(e) ?? press.current.lastY;
      return;
    }
    const finger = fingerY(e, g.finger);
    if (finger === null) return; // an impossible reading keeps the last offset
    g.finger = finger;
    g.offset = finger - g.anchor;
  }
  function onUp() {
    window.clearTimeout(press.current.timer);
    press.current.timer = 0;
    const g = scrub.current;
    if (!g.dragging) return; // never held long enough to scrub: nothing was started
    g.dragging = false;
    cancelAnimationFrame(g.frame);
    g.frame = 0;
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
        style={{ top: `${handleTop * 100}%` }}
        onKeyDown={onKey}
        onTouchStart={e => e.stopPropagation()}
        onTouchEnd={e => e.stopPropagation()}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onLostPointerCapture={onUp}
      >
        {dragAt !== null && <span className="day-scrubber-bubble" aria-hidden="true">{label(rows[index])}</span>}
      </div>
    </div>
  );
}
