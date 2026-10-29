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
