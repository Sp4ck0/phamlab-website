import { useRef, type KeyboardEvent } from "react";
import { MAP_FOCUS_ICON } from "../../lib/mapPoints";
import { TRIP_TABS, tripPanelId, tripTabId, type TripTab } from "../../lib/tripTabs";

const LIST_ICON =
  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1" fill="currentColor"/><circle cx="4.5" cy="12" r="1" fill="currentColor"/><circle cx="4.5" cy="18" r="1" fill="currentColor"/></svg>';
const NOTE_ICON =
  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 4h14v11l-5 5H5z"/><path d="M14 20v-5h5M8.5 9h7M8.5 12.5h4"/></svg>';
const CHECK_ICON =
  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8.5 12.5l2.5 2.5 4.5-5"/></svg>';
const TABS: Record<TripTab, { label: string; icon: string }> = {
  agenda: { label: "Agenda", icon: LIST_ICON },
  tasks: { label: "Tasks", icon: CHECK_ICON },
  map: { label: "Map", icon: MAP_FOCUS_ICON },
  notes: { label: "Notes", icon: NOTE_ICON },
};

// The trip page's views: the day-by-day agenda, the tasks (action items and proposed items), the trip map and the trip note. A tab list
// with arrow keys moving between tabs; the page keeps the choice in the URL (?tab=).
export function TripTabs({ tab, onChange }: { tab: TripTab; onChange: (tab: TripTab) => void }) {
  const list = useRef<HTMLDivElement>(null);
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    const to = e.key === "Home" ? 0 : e.key === "End" ? TRIP_TABS.length - 1 : step ? (TRIP_TABS.indexOf(tab) + step + TRIP_TABS.length) % TRIP_TABS.length : -1;
    if (to < 0) return;
    e.preventDefault();
    onChange(TRIP_TABS[to]);
    list.current?.querySelectorAll<HTMLButtonElement>("[role=tab]")[to]?.focus();
  };
  return (
    <div className="trip-tabs" role="tablist" aria-label="Trip views" ref={list} onKeyDown={onKeyDown}>
      {TRIP_TABS.map((t) => (
        <button
          key={t}
          type="button"
          role="tab"
          id={tripTabId(t)}
          aria-selected={t === tab}
          aria-controls={tripPanelId(t)}
          tabIndex={t === tab ? 0 : -1}
          className="trip-tab"
          onClick={() => onChange(t)}
        >
          <span className="trip-tab-icon" aria-hidden="true" dangerouslySetInnerHTML={{ __html: TABS[t].icon }} />
          {TABS[t].label}
        </button>
      ))}
    </div>
  );
}
