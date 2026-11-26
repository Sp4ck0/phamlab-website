import { scrollBehavior } from "./flash";

// The day header's fade under it, when pinned on a phone (.day-heading::after).
const HEADING_FADE = 24;
// A little air between what covers the page and the time chip.
const GAP = 8;

// Scrolls the page to the current time on an open day: the red Now line, else the tile under way.
// It lands with that tile's time chip, which sits half above the tile's border, fully in sight:
// below the date strip, and on a phone below the day header pinned under it and its fade.
// Returns false when the day shows no current time (closed, or not today).
export function scrollToNow(dayId: string): boolean {
  const day = document.getElementById(dayId);
  const marker = day?.querySelector<HTMLElement>(".tl-now, .tl-entry--now");
  if (!day || !marker) return false;
  const chip = marker.querySelector<HTMLElement>(".tl-pins");
  const top = Math.min(marker.getBoundingClientRect().top, chip?.getBoundingClientRect().top ?? Infinity);
  // The marker's own scroll margin already clears the bars above it (desktop, a pinned map).
  let clear = parseFloat(getComputedStyle(marker).scrollMarginTop) || 0;
  const heading = day.querySelector<HTMLElement>(".day-heading");
  if (heading) {
    const h = getComputedStyle(heading);
    if (h.position === "sticky") clear = Math.max(clear, (parseFloat(h.top) || 0) + heading.offsetHeight + HEADING_FADE);
  }
  window.scrollTo({ top: window.scrollY + top - clear - GAP, behavior: scrollBehavior() });
  return true;
}
