import { useEffect, type RefObject } from "react";

// Phones: the trip tabs and the date strip move with the reader's own scrolling, like a phone
// browser's address bar, while the site's top bar stays put.
//
// For it to be smooth, nothing here moves the bars frame by frame: the page's own scrolling does.
// - Shown, the bars are pinned (sticky) under the site bar, and the day header pins under them, all
//   in CSS.
// - When the reader scrolls down, the bars are "released": made position:relative with a fixed
//   offset that keeps them exactly where they are, so from then on they scroll away with the
//   content, at the same pace, on the browser's scrolling thread.
// - When the reader scrolls back up after they have gone, they are placed just above the screen,
//   behind the site bar, so the same scrolling brings them back in. Once fully back they pin again.
// - If scrolling stops with them half shown, they ease to the nearer end.
// The only thing that follows the bars frame by frame, while they are released and partly on
// screen, is the pinned day header (a transform: no layout).

// A released bar's offset from where the page would put it: never upward (a bar near the top of the
// page that is still in its place stays there).
export function releaseOffset(screenTop: number, naturalTop: number): number {
  return Math.max(0, screenTop - naturalTop);
}

// Offsets that place the bars, stacked, with their bottom at `line` (just hidden behind the site
// bar) or their top at `line` (`from: "top"`, fully shown). `bars` are their natural tops and heights.
export function stackOffsets(bars: { natural: number; height: number }[], line: number, from: "top" | "bottom"): number[] {
  const total = bars.reduce((h, b) => h + b.height, 0);
  let at = from === "top" ? line : line - total;
  return bars.map((b) => {
    const offset = releaseOffset(at, b.natural);
    at += b.height;
    return offset;
  });
}

// Where a half-shown pair of bars settles once scrolling stops: shown if at least half of them is.
export function settleShown(hiddenBy: number, height: number): boolean {
  return hiddenBy < height / 2;
}

// How far to move a day header whose top is at `top` (before any move)
// so it sits under the bars' bottom (`line`) instead, without leaving its day (`maxTop`).
export function headerOffset(top: number, line: number, maxTop: number): number {
  return Math.min(Math.max(top, line), maxTop) - top;
}

const SETTLE_AFTER_MS = 120; // no scroll events for this long (and no finger down): scrolling has stopped
const SETTLE_MS = 180;

export function useScrollLinkedBars(page: RefObject<HTMLElement | null>, on: boolean) {
  useEffect(() => {
    const el = page.current;
    if (!on || !el) return;
    const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const siteBar = () => Math.max(0, document.querySelector(".mobile-topbar")?.getBoundingClientRect().bottom ?? 0);
    // The bars on screen, top to bottom (the date strip is only there on the Agenda tab).
    const bars = () => [...el.querySelectorAll<HTMLElement>(".trip-tabs-bar, .daynav-shell")].filter((b) => b.offsetParent !== null);
    let released = false;
    const offsets = new Map<HTMLElement, number>();
    const moved = new Map<HTMLElement, number>(); // day headers we have moved, by how much
    let lastY = window.scrollY;
    // Only the reader's own scrolling releases the bars: a jump to a day (after a tap) scrolls the
    // page too, and the bars should stay where the reader left them.
    let byHand = false;
    let touching = false;
    let frame = 0;
    let idle = 0;
    let tween = 0;

    const setOffset = (b: HTMLElement, offset: number) => {
      offsets.set(b, offset);
      b.style.position = "relative";
      b.style.top = `${offset}px`;
    };
    // Where each bar would be with no offset (read once the bars are released).
    const naturals = (list: HTMLElement[]) => list.map((b) => ({ b, natural: b.getBoundingClientRect().top - (offsets.get(b) ?? 0), height: b.offsetHeight }));

    // Day headers: pinned by CSS at the site bar while the bars are released; each one up there is
    // moved down to sit under whatever is left of the bars.
    const placeHeaders = () => {
      const list = bars();
      const line = Math.max(siteBar(), list.length ? list[list.length - 1].getBoundingClientRect().bottom : 0);
      const reads: [HTMLElement, number][] = [];
      for (const card of el.querySelectorAll<HTMLElement>(".day-card")) {
        const head = card.querySelector<HTMLElement>(":scope > .day-heading");
        if (!head) continue;
        const had = moved.get(head) ?? 0;
        const box = card.getBoundingClientRect();
        if (!released || box.bottom < 0 || box.top > line + 4) {
          if (had) reads.push([head, 0]);
          continue;
        }
        const h = head.getBoundingClientRect();
        const top = h.top - had;
        reads.push([head, headerOffset(top, line, box.bottom - 1 - h.height)]);
      }
      for (const [head, by] of reads) {
        if (Math.abs(by - (moved.get(head) ?? 0)) < 0.25) continue;
        if (by) moved.set(head, by);
        else moved.delete(head);
        head.style.transform = by ? `translateY(${by}px)` : "";
      }
    };

    // `dy`: the scroll that set this off. The bars move with it too, so the first frame isn't a hitch.
    const release = (dy: number) => {
      const list = bars();
      if (!list.length) return;
      const at = list.map((b) => b.getBoundingClientRect().top);
      list.forEach((b) => setOffset(b, 0));
      list.forEach((b, i) => setOffset(b, releaseOffset(at[i] - dy, b.getBoundingClientRect().top)));
      released = true;
      // The day headers now pin at the site bar (CSS), moved down under the bars by placeHeaders.
      el.style.setProperty("--pinned-top", `${siteBar()}px`);
      placeHeaders();
    };
    const pin = () => {
      for (const b of bars()) {
        b.style.position = "";
        b.style.top = "";
      }
      offsets.clear();
      released = false;
      el.style.removeProperty("--pinned-top");
      placeHeaders();
    };
    // Stack the bars with their bottom at the site bar (just hidden) or their top there (shown).
    const stack = (from: "top" | "bottom") => {
      const list = naturals(bars());
      stackOffsets(list, siteBar(), from).forEach((offset, i) => setOffset(list[i].b, offset));
    };
    const first = () => bars()[0];
    // How far the bars have gone up behind the site bar: 0 = all shown, up to their height = gone.
    const hiddenBy = () => {
      const b = first();
      return b ? Math.max(0, siteBar() - b.getBoundingClientRect().top) : 0;
    };
    const height = () => bars().reduce((h, b) => h + b.offsetHeight, 0);

    const stopTween = () => {
      cancelAnimationFrame(tween);
      tween = 0;
    };
    // Ease the released bars to fully shown (then pin them) or just hidden.
    const easeTo = (shown: boolean) => {
      stopTween();
      const list = naturals(bars());
      const to = stackOffsets(list, siteBar(), shown ? "top" : "bottom");
      const from = list.map(({ b }) => offsets.get(b) ?? 0);
      const done = () => {
        if (shown) pin();
        else placeHeaders();
      };
      if (reduced()) {
        list.forEach(({ b }, i) => setOffset(b, to[i]));
        done();
        return;
      }
      const start = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, (now - start) / SETTLE_MS);
        const k = 1 - (1 - t) ** 3;
        list.forEach(({ b }, i) => setOffset(b, from[i] + (to[i] - from[i]) * k));
        placeHeaders();
        if (t < 1) tween = requestAnimationFrame(step);
        else {
          tween = 0;
          done();
        }
      };
      tween = requestAnimationFrame(step);
    };
    const settle = () => {
      if (touching || !released) return;
      const by = hiddenBy();
      const h = height();
      if (by > 0.5 && by < h - 0.5) easeTo(settleShown(by, h));
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
      if (!released) {
        if (byHand && dy > 0 && y > 0) release(dy);
      } else {
        // Scrolling back up after the bars have gone: put them just above, so they come back in.
        if (byHand && dy < 0 && hiddenBy() >= height() - 0.5) stack("bottom");
        // Fully back (or the page is back at its top): pinned again.
        const b = first();
        if (!b || b.getBoundingClientRect().top >= siteBar() - 0.5) pin();
      }
      if (released || moved.size) placeHeaders();
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
    const hand = () => {
      byHand = true;
      stopTween();
    };
    const tap = () => { byHand = false; };
    const onKey = (e: KeyboardEvent) => { if (/^(Arrow(Up|Down)|Page(Up|Down)|Home|End| )$/.test(e.key)) byHand = true; };
    // Keyboard focus reaching a bar brings them back, so you can see where you are.
    const onFocus = (e: FocusEvent) => {
      if (released && (e.target as Element | null)?.closest?.(".trip-tabs-bar, .daynav-shell")) {
        stopTween();
        pin();
      }
    };
    // A day opening or closing moves the headers without any scrolling.
    const ro = typeof ResizeObserver === "function" ? new ResizeObserver(() => { if (released || moved.size) placeHeaders(); }) : undefined;
    const timeline = el.querySelector(".timeline");
    if (timeline) ro?.observe(timeline);

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
      ro?.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
      window.removeEventListener("wheel", hand);
      window.removeEventListener("click", tap, true);
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("focusin", onFocus);
      pin();
    };
  }, [page, on]);
}
