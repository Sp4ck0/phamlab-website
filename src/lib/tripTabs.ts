// The trip page's views (TripTabs), and the ids that tie each tab to its panel.
export type TripTab = "agenda" | "map" | "notes";
export const TRIP_TABS: TripTab[] = ["agenda", "map", "notes"];
export const tripTabId = (tab: TripTab) => `trip-tab-${tab}`;
export const tripPanelId = (tab: TripTab) => `trip-panel-${tab}`;

// The tab named in a query string ("?tab=map&…"); anything else is the agenda.
export function tabFromHash(search: string): TripTab {
  const asked = new URLSearchParams(search.slice(search.indexOf("?") + 1)).get("tab") as TripTab | null;
  return asked && TRIP_TABS.includes(asked) ? asked : "agenda";
}

// The page address with ?tab= set (or removed for the agenda). The site uses hash routes
// (#/trip/<slug>?tab=map), so the query lives in the hash.
export function withTab(href: string, tab: TripTab): string {
  const url = new URL(href);
  const hash = url.hash || "#/";
  const at = hash.indexOf("?");
  const path = at < 0 ? hash : hash.slice(0, at);
  const q = new URLSearchParams(at < 0 ? "" : hash.slice(at + 1));
  if (tab === "agenda") q.delete("tab");
  else q.set("tab", tab);
  const query = q.toString();
  url.hash = query ? `${path}?${query}` : path;
  return url.toString();
}
