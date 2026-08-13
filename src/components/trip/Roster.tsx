import type { Group } from "../../lib/types";

export function Roster({ groups }: { groups: Group[] }) {
  return (
    <div className="roster-list">
      {groups.map((g) => (
        <span className="roster-person" key={g.id}>
          <span className="dot" style={{ background: g.color }} />
          {g.name}
          {g.note && <span className="roster-note"> · {g.note}</span>}
        </span>
      ))}
    </div>
  );
}
