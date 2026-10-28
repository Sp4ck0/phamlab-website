import type { ItineraryRow } from "../../lib/itineraryState";
import { DOW, MON } from "../../lib/tripLogic";

export function DayNav({ rows, onJump }: { rows: ItineraryRow[]; onJump: (rowId: string) => void }) {
  return (
    <div className="daynav-shell">
      <nav className="daynav" aria-label="Jump to itinerary day">
        {rows.map(({ id, day: d }, i) => (
          <button type="button" key={id} onClick={() => onJump(id)}>
            <span className="d">Day {i} · {DOW[d._d.getDay()]}</span> {MON[d._d.getMonth()]} {d._d.getDate()}
          </button>
        ))}
      </nav>
    </div>
  );
}
