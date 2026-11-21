// The trip page's views (TripTabs), and the ids that tie each tab to its panel.
export type TripTab = "agenda" | "map" | "notes";
export const TRIP_TABS: TripTab[] = ["agenda", "map", "notes"];
export const tripTabId = (tab: TripTab) => `trip-tab-${tab}`;
export const tripPanelId = (tab: TripTab) => `trip-panel-${tab}`;
