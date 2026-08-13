import type { Conflict } from "../../lib/types";

export function AlertsPanel({ conflicts }: { conflicts: Conflict[] }) {
  if (conflicts.length === 0) return null;

  return (
    <div className="alerts">
      <div className="alert">
        <h3>
          Needs a decision <span className="n">{conflicts.length}</span>
        </h3>
        <ul>
          {conflicts.map((c, i) => (
            <li key={i} dangerouslySetInnerHTML={{ __html: c.text }} />
          ))}
        </ul>
      </div>
    </div>
  );
}
