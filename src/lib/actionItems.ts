// Action-item done-state stays in browser localStorage, same pattern as
// booking ticks — not synced via Convex.
const keyFor = (slug: string) => `trip.${slug}.actionItems.v1`;

export function loadDone(slug: string): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(keyFor(slug)) || "{}");
  } catch {
    return {};
  }
}

export function saveDone(slug: string, done: Record<string, boolean>) {
  localStorage.setItem(keyFor(slug), JSON.stringify(done));
}
