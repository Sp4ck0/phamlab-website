// Booking-status "ticks" (booked/needed overrides) stay in browser
// localStorage, unchanged from the original static site — not synced via
// Convex. Keyed by trip slug, same key format as before.
import type { Status } from "./types";

const keyFor = (slug: string) => `trip.${slug}.ticks.v1`;

export function loadTicks(slug: string): Record<string, Status> {
  try {
    return JSON.parse(localStorage.getItem(keyFor(slug)) || "{}");
  } catch {
    return {};
  }
}

export function saveTicks(slug: string, ticks: Record<string, Status>) {
  localStorage.setItem(keyFor(slug), JSON.stringify(ticks));
}

export function resetTicks(slug: string) {
  localStorage.removeItem(keyFor(slug));
}
