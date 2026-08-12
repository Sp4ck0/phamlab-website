import type { Conflict, Group } from "../../lib/types";
import type { Gap } from "../../lib/tripLogic";
import { gapLabel, visible } from "../../lib/tripLogic";

export function AlertsPanel({ gaps, conflicts, groups, activeGroup }: {
  gaps: Gap[];
  conflicts: Conflict[];
  groups: Group[];
  activeGroup: string;
}) {
  const visibleConflicts = conflicts.filter((c) => visible(c.who, activeGroup, groups));

  return (
    <div className="alerts">
      {visibleConflicts.length > 0 && (
        <div className="alert">
          <h3>
            Needs a decision <span className="n">{visibleConflicts.length}</span>
          </h3>
          <ul>
            {visibleConflicts.map((c, i) => (
              <li key={i} dangerouslySetInnerHTML={{ __html: c.text }} />
            ))}
          </ul>
        </div>
      )}
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
                : { background: "rgba(23,50,47,.08)", color: "var(--ink-soft)" };
              return (
                <li key={i}>
                  <span className="who" style={style}>
                    {label}
                  </span>
                  <b>{g.kind}</b> — {g.text} <span style={{ color: "var(--ink-faint)" }}>· {g.dateLabel}</span>
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
