import type { Group } from "../../lib/types";

export function Roster({ groups }: { groups: Group[] }) {
  const sorted = [...groups].sort((a, b) => a.name.localeCompare(b.name));
  return (
    <div className="roster-list">
      {sorted.map((g) => (
        <span className="roster-person" key={g.id}>
          <span className="dot" style={{ background: g.color }} />
          {g.name}
        </span>
      ))}
    </div>
  );
}
