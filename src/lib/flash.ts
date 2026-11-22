// Blink an element to show where the AI just pointed (.ai-focus-flash).
export function flash(el: HTMLElement) {
  el.classList.remove("ai-focus-flash");
  void el.offsetWidth; // restart the animation if one is already running
  el.classList.add("ai-focus-flash");
  el.addEventListener(
    "animationend",
    (e) => {
      if (e.target === el) el.classList.remove("ai-focus-flash");
    },
    { once: true }
  );
}

export const scrollBehavior = (): ScrollBehavior =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth";

// A short wait after a trip page opens, so its first layout has settled before
// we scroll to a day.
export const SETTLE_MS = 150;

// Run `cb` once the page has stopped scrolling (scrollend), or `fallbackMs`
// after it last moved when scrollend never comes (nothing needed to scroll, or
// a browser without it). Each scroll movement restarts the fallback, so a long
// smooth scroll is never cut short. Returns a cancel function.
export function afterScroll(cb: () => void, fallbackMs = 600) {
  let done = false;
  let timer = setTimeout(() => finish(), fallbackMs);
  const moved = () => {
    clearTimeout(timer);
    timer = setTimeout(finish, fallbackMs);
  };
  const stop = () => {
    done = true;
    clearTimeout(timer);
    window.removeEventListener("scrollend", finish);
    window.removeEventListener("scroll", moved);
  };
  function finish() {
    if (done) return;
    stop();
    cb();
  }
  window.addEventListener("scrollend", finish, { once: true });
  window.addEventListener("scroll", moved, { passive: true });
  return stop;
}
