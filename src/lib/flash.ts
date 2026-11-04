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

// A trip page that was just opened re-places its own scroll for a couple of
// frames (ItineraryStart); scrolling after this long keeps ours from being undone.
export const SETTLE_MS = 150;

// Run `cb` once the page has stopped scrolling (scrollend), or after `fallbackMs`
// when nothing needed to scroll. Returns a cancel function.
export function afterScroll(cb: () => void, fallbackMs = 600) {
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    clearTimeout(timer);
    window.removeEventListener("scrollend", finish);
    cb();
  };
  const timer = setTimeout(finish, fallbackMs);
  window.addEventListener("scrollend", finish, { once: true });
  return () => {
    done = true;
    clearTimeout(timer);
    window.removeEventListener("scrollend", finish);
  };
}
