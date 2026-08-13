import type { Group } from "../../lib/types";
import type { Gap } from "../../lib/tripLogic";
import { gapLabel } from "../../lib/tripLogic";

export function GapsPanel({ gaps, groups }: { gaps: Gap[]; groups: Group[] }) {
  return (
    <div className="alerts">
      {gaps.length > 0 ? (
        <div className="alert warn">
          <h3>
            Not booked yet <span className="n">{gaps.length}</span>
          </h3>
          <ul>
            {gaps.map((g, i) => {
              const { label, color } = gapLabel(g.who, groups, g.date);
              const style = color
                ? { background: `${color}1a`, color }
                : { background: "var(--chip-bg)", color: "var(--text-secondary)" };
              return (
                <li key={i}>
                  <span className="who" style={style}>
                    {label}
                  </span>
                  <b>{g.kind}</b> — {g.text} <span style={{ color: "var(--text-muted)" }}>· {g.dateLabel}</span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <div className="alert good">
          <h3>All booked</h3>
          <ul>
            <li>Every hotel and flight on this itinerary is marked booked.</li>
          </ul>
        </div>
      )}
    </div>
  );
}
