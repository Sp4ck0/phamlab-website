import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent } from "react";
import type { ItineraryRow } from "../../lib/itineraryState";
import { DOW, MON } from "../../lib/tripLogic";
import { SCRUBBER_EVENT } from "../../lib/hideBars";
import { indexAtOffset, rampSpeed, steadyFinger } from "../../lib/scrubber";
import type { SteadyFinger } from "../../lib/scrubber";

const HOLD_MS = 250;
const PEEK_MS = 1500;
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

// A strip down the right edge for long itineraries, on touch screens only (CSS). A slim marker on it shows
// the day the page is at; a press-and-hold anywhere on the strip grabs it, with a knob under the thumb. It
// works by rate, like autoscroll or a shuttle dial: the farther the finger slides up or down from where it
// pressed, the faster the page scrolls that way. Back to the start point, or lifting the finger, stops it.
// A flick that starts on the strip scrolls the page as usual, and a quick tap goes to whatever is under it.
// When it first shows, the knob peeks in at the marker and slides away again, so people find it.
export function DayScrubber({ rows, currentId }: { rows: ItineraryRow[]; currentId?: string }) {
  const track = useRef<HTMLDivElement>(null);
  // While scrubbing: how far down the track the knob is drawn (0 to 1) and the day the page is at.
  const [dragAt, setDragAt] = useState<{ fraction: number; index: number } | null>(null);
  const [peek, setPeek] = useState(true);
  const currentIndex = Math.max(0, rows.findIndex(r => r.id === currentId));
  const index = Math.min(rows.length - 1, dragAt?.index ?? currentIndex);
  const restAt = rows.length < 2 ? 0 : currentIndex / (rows.length - 1);
  // The scroll loop: `y` is the page offset kept as a fraction (scrollY rounds, which would stall a slow
  // scroll), `offset` how far the finger is from `anchor`, `tops` each day's page offset for the bubble,
  // `steady` the finger's last accepted position (see steadyFinger).
  const scrub = useRef({ frame: 0, last: 0, y: 0, anchor: 0, finger: 0, offset: 0, tops: [] as number[], shown: "", dragging: false,
    steady: { y: 0, held: null, count: 0 } as SteadyFinger });

  useEffect(() => {
    const t = window.setTimeout(() => setPeek(false), PEEK_MS);
    return () => window.clearTimeout(t);
  }, []);

  // The strip lets the page scroll (touch-action: pan-y) so a flick on it isn't lost. Once a hold has
  // started a scrub, the finger's moves are the scrub's: the browser must not start scrolling with them.
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const hold = (e: TouchEvent) => { if (scrub.current.dragging && e.cancelable) e.preventDefault(); };
    el.addEventListener("touchmove", hold, { passive: false });
    return () => el.removeEventListener("touchmove", hold);
  }, []);

  function go(i: number) {
    const row = rows[i];
    if (!row) return;
    const reduced = !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    document.getElementById(row.id)?.scrollIntoView({ block: "start", behavior: reduced ? "instant" : "smooth" });
  }
  // How far down the track a point on the screen is (0 to 1).
  function along(y: number) {
    const box = track.current?.getBoundingClientRect();
    return box && box.height > 0 ? Math.min(1, Math.max(0, (y - box.top) / box.height)) : restAt;
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
    const fraction = along(g.finger);
    const index = indexAtOffset(g.y, g.tops);
    const shown = `${index}:${fraction.toFixed(3)}`;
    if (shown !== g.shown) { g.shown = shown; setDragAt({ fraction, index }); }
    g.frame = requestAnimationFrame(tick);
  }
  // Starting to scrub (after a deliberate press, see onDown): anchor the finger and start the loop.
  function begin(strip: HTMLElement, pointerId: number, finger: number | null) {
    const g = scrub.current;
    try { strip.setPointerCapture(pointerId); } catch { /* the finger already lifted */ }
    tell(true); // the bars go away first, so the tops below are measured with them gone
    // Each day's page offset (past its sticky-bar margin), measured once: nothing reflows while scrubbing.
    g.tops = rows.map(r => {
      const el = document.getElementById(r.id);
      return el ? el.getBoundingClientRect().top + window.scrollY - (parseFloat(getComputedStyle(el).scrollMarginTop) || 0) : 0;
    });
    const box = strip.getBoundingClientRect();
    g.anchor = g.finger = finger ?? box.top + restAt * box.height;
    g.steady = { y: g.finger, held: null, count: 0 };
    g.offset = 0;
    g.shown = "";
    g.y = window.scrollY;
    g.dragging = true;
    setPeek(false);
    setDragAt({ fraction: along(g.finger), index: indexAtOffset(g.y, g.tops) });
    cancelAnimationFrame(g.frame);
    g.last = performance.now();
    g.frame = requestAnimationFrame(tick);
  }
  // The strip is where a thumb rests while scrolling, so a quick flick that starts on it must not scrub:
  // a finger (or pen) has to stay put on it for HOLD_MS first. Moving sooner starts nothing (the browser
  // scrolls the page). A mouse scrubs at once.
  const press = useRef({ timer: 0, x: 0, y: 0, lastY: null as number | null });
  function onDown(e: PointerEvent<HTMLDivElement>) {
    const strip = e.currentTarget, id = e.pointerId, p = press.current;
    window.clearTimeout(p.timer);
    p.x = e.clientX; p.y = e.clientY; p.lastY = fingerY(e);
    if (e.pointerType === "mouse") { begin(strip, id, p.lastY); return; }
    p.timer = window.setTimeout(() => { p.timer = 0; begin(strip, id, p.lastY); }, HOLD_MS);
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
    g.steady = steadyFinger(g.steady, finger);
    g.finger = g.steady.y;
    g.offset = g.finger - g.anchor;
  }
  // Lifted before the hold finished, without moving: a tap meant for what is under the strip.
  function onLift(e: PointerEvent<HTMLDivElement>) {
    const tapped = press.current.timer !== 0 && !scrub.current.dragging;
    onUp();
    if (!tapped) return;
    const under = document.elementsFromPoint?.(e.clientX, e.clientY).find(el => !track.current?.contains(el));
    if (under instanceof HTMLElement) under.click();
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
    <div
      className={`day-scrubber${dragAt !== null ? " is-dragging" : peek ? " is-peeking" : ""}`}
      ref={track}
      role="slider"
      tabIndex={0}
      aria-label="Scrub through itinerary days"
      aria-orientation="vertical"
      aria-valuemin={1}
      aria-valuemax={rows.length}
      aria-valuenow={index + 1}
      aria-valuetext={label(rows[index])}
      onKeyDown={onKey}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onLift}
      onPointerCancel={onUp}
      onLostPointerCapture={onUp}
    >
      <span className="day-scrubber-marker" aria-hidden="true" style={{ top: `${restAt * 100}%` }} />
      <span className="day-scrubber-knob" aria-hidden="true" style={{ top: `${(dragAt ? dragAt.fraction : restAt) * 100}%` }}>
        {dragAt !== null && <span className="day-scrubber-bubble">{label(rows[index])}</span>}
      </span>
    </div>
  );
}
