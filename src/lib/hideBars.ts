import { useEffect, type RefObject } from "react";

// Phones: the trip tabs and the date strip move with the reader's own scrolling, like a phone
// browser's address bar. Scroll down 30px and they slide up 30px; scroll up 30px and 30px of them
// comes back, so a partial scroll leaves them partly shown. The site's top bar never moves; they
// slide under it. When scrolling stops halfway, they ease to whichever end is nearer.
//
// One number, the shift (0 = shown, up to the bars' height = hidden), is written as --bars-shift on
// the trip page. The bars and the pinned day header take it off their sticky `top` (CSS).

// The next shift after the page scrolled by `dy` to `y`, with the bars `height` tall. It never hides
// more than has been scrolled, so at the top of the page the bars are always all there.
export function nextShift(shift: number, dy: number, y: number, height: number): number {
  return Math.min(Math.max(shift + dy, 0), Math.max(0, Math.min(height, y)));
}

// Where a half-shown pair of bars settles once scrolling stops: the nearer end (`max` = fully hidden).
export function settleTarget(shift: number, max: number): number {
  if (shift <= 0 || shift >= max) return Math.max(0, Math.min(shift, max));
  return shift < max / 2 ? 0 : max;
}

const BARS = ".trip-tabs-bar, .daynav-shell";
const SETTLE_AFTER_MS = 120; // no scroll events for this long (and no finger down): scrolling has stopped
const SETTLE_MS = 180;

export function useScrollLinkedBars(page: RefObject<HTMLElement | null>, on: boolean) {
  useEffect(() => {
    const el = page.current;
    if (!on || !el) return;
    let shift = 0;
    let lastY = window.scrollY;
    // Only the reader's own scrolling moves the bars: a jump to a day (after a tap) scrolls the page
    // too, and moving the bars mid-jump would leave it landing in the wrong place.
    let byHand = false;
    let touching = false;
    let frame = 0;
    let idle = 0;
    let tween = 0;
    // The bars on screen: the date strip only exists on the Agenda tab (it measures 0 when hidden).
    const height = () => [...el.querySelectorAll<HTMLElement>(BARS)].reduce((h, b) => h + b.offsetHeight, 0);
    const most = () => Math.max(0, Math.min(height(), window.scrollY));
    const write = () => el.style.setProperty("--bars-shift", `${Math.round(shift * 10) / 10}px`);
    const stopTween = () => {
      cancelAnimationFrame(tween);
      tween = 0;
    };
    const easeTo = (target: number) => {
      stopTween();
      if (target === shift || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        shift = target;
        write();
        return;
      }
      const from = shift;
      const start = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, (now - start) / SETTLE_MS);
        shift = from + (target - from) * (1 - (1 - t) ** 3);
        write();
        tween = t < 1 ? requestAnimationFrame(step) : 0;
      };
      tween = requestAnimationFrame(step);
    };
    const settle = () => {
      if (!touching) easeTo(settleTarget(shift, most()));
    };
    const settleLater = () => {
      window.clearTimeout(idle);
      idle = window.setTimeout(settle, SETTLE_AFTER_MS);
    };
    const measure = () => {
      frame = 0;
      const y = window.scrollY;
      const dy = y - lastY;
      lastY = y;
      if (byHand) {
        stopTween();
        shift = nextShift(shift, dy, y, height());
      } else {
        shift = Math.min(shift, most());
      }
      write();
      settleLater();
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    const onTouchStart = () => {
      byHand = true;
      touching = true;
      stopTween();
      window.clearTimeout(idle);
    };
    const onTouchEnd = () => {
      touching = false;
      settleLater(); // momentum scrolling keeps pushing this back until it stops
    };
    const hand = () => { byHand = true; };
    const tap = () => { byHand = false; };
    const onKey = (e: KeyboardEvent) => { if (/^(Arrow(Up|Down)|Page(Up|Down)|Home|End| )$/.test(e.key)) byHand = true; };
    // Keyboard focus reaching a bar brings them back, so you can see where you are.
    const onFocus = (e: FocusEvent) => {
      if ((e.target as Element | null)?.closest?.(BARS)) easeTo(0);
    };
    write();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("touchcancel", onTouchEnd, { passive: true });
    window.addEventListener("wheel", hand, { passive: true });
    window.addEventListener("click", tap, true);
    window.addEventListener("keydown", onKey);
    document.addEventListener("focusin", onFocus);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      stopTween();
      window.clearTimeout(idle);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
      window.removeEventListener("wheel", hand);
      window.removeEventListener("click", tap, true);
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("focusin", onFocus);
      el.style.removeProperty("--bars-shift");
    };
  }, [page, on]);
}
