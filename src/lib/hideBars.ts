import { useEffect } from "react";

// Phones: the site's top bar, the trip tabs and the date strip slide away while the reader scrolls
// down and come back as soon as they scroll up, like a phone browser's address bar. Only the day's
// header stays pinned, at the top. The state lives on <html> (data-bars-hidden) because the top bar
// is outside the trip page; CSS does the rest. BARS_EVENT tells anything measuring the pinned line.
export const BARS_EVENT = "phamlab:bars";

export interface BarsState {
  hidden: boolean;
  lastY: number;
  // Where the current run of scrolling in one direction began.
  anchorY: number;
}

// Hide after a deliberate scroll down (HIDE_AFTER px in one go), show after any small scroll up;
// within TOP_ZONE of the page's top they always show.
export const HIDE_AFTER = 24;
export const SHOW_AFTER = 8;
export const TOP_ZONE = 80;

export function nextBars(s: BarsState, y: number): BarsState {
  const turned = (y > s.lastY && s.lastY < s.anchorY) || (y < s.lastY && s.lastY > s.anchorY);
  const anchorY = turned ? s.lastY : s.anchorY;
  let hidden = s.hidden;
  if (y <= TOP_ZONE) hidden = false;
  else if (y - anchorY >= HIDE_AFTER) hidden = true;
  else if (anchorY - y >= SHOW_AFTER) hidden = false;
  return { hidden, lastY: y, anchorY };
}

const BARS = ".mobile-topbar, .trip-tabs-bar, .daynav-shell";

export function useHideBarsOnScroll(on: boolean) {
  useEffect(() => {
    if (!on) return;
    const root = document.documentElement;
    const y0 = window.scrollY;
    let state: BarsState = { hidden: false, lastY: y0, anchorY: y0 };
    // Only the reader's own scrolling moves the bars: a jump to a day (after a tap) scrolls the page
    // too, and hiding the bars mid-jump would leave it landing in the wrong place.
    let byHand = false;
    let frame = 0;
    const apply = (hidden: boolean) => {
      if (hidden === root.hasAttribute("data-bars-hidden")) return;
      root.toggleAttribute("data-bars-hidden", hidden);
      window.dispatchEvent(new Event(BARS_EVENT));
    };
    const measure = () => {
      frame = 0;
      const y = window.scrollY;
      const next = nextBars(state, y);
      if (!byHand && y > TOP_ZONE) next.hidden = state.hidden;
      state = next;
      apply(next.hidden);
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(measure); };
    const hand = () => { byHand = true; };
    const tap = () => { byHand = false; };
    const onKey = (e: KeyboardEvent) => { if (/^(Arrow(Up|Down)|Page(Up|Down)|Home|End| )$/.test(e.key)) byHand = true; };
    // Keyboard focus reaching a hidden bar brings the bars back, so you can see where you are.
    const onFocus = (e: FocusEvent) => {
      if (!(e.target as Element | null)?.closest?.(BARS)) return;
      state = { ...state, hidden: false, anchorY: state.lastY };
      apply(false);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    for (const ev of ["touchstart", "touchmove", "wheel"] as const) window.addEventListener(ev, hand, { passive: true });
    window.addEventListener("click", tap, true);
    window.addEventListener("keydown", onKey);
    document.addEventListener("focusin", onFocus);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      for (const ev of ["touchstart", "touchmove", "wheel"] as const) window.removeEventListener(ev, hand);
      window.removeEventListener("click", tap, true);
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("focusin", onFocus);
      apply(false);
    };
  }, [on]);
}
