import type { Conflict, Group } from "../../lib/types";
import { visible } from "../../lib/tripLogic";

export function AlertsPanel({ conflicts, groups, activeGroup }: {
  conflicts: Conflict[];
  groups: Group[];
  activeGroup: string;
}) {
  const visibleConflicts = conflicts.filter((c) => visible(c.who, activeGroup, groups));
  if (visibleConflicts.length === 0) return null;

  return (
    <div className="alerts">
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
    </div>
  );
}
