import type { Group } from "../../lib/types";

export function Roster({ groups, sdek }: { groups: Group[]; sdek?: string }) {
  return (
    <>
      <h2 className="shead">The roster</h2>
      {sdek && <p className="sdek" dangerouslySetInnerHTML={{ __html: sdek }} />}
      <div className="roster-list">
        {groups.map((g) => (
          <span className="roster-person" key={g.id}>
            <span className="dot" style={{ background: g.color }} />
            {g.name}
            {g.note && <span className="roster-note"> · {g.note}</span>}
          </span>
        ))}
      </div>
    </>
  );
}
