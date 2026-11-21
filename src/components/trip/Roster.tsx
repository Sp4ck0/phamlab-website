import type { Group } from "../../lib/types";
import { byStay, fmtShort } from "../../lib/tripLogic";

const span = (g: Group) =>
  g.from && g.to ? `${fmtShort(g.from)} – ${fmtShort(g.to)}` : g.from ? `from ${fmtShort(g.from)}` : g.to ? `until ${fmtShort(g.to)}` : "";

export function Roster({ groups }: { groups: Group[] }) {
  const sorted = [...groups].sort(byStay);
  if (!sorted.length) return null;
  return (
    <details className="roster">
      <summary>
        {sorted.length} {sorted.length === 1 ? "traveler" : "travelers"}
      </summary>
      <div className="roster-list">
        {sorted.map((g) => (
          <span className="roster-person" key={g.id}>
            <span className="dot" style={{ background: g.color }} />
            {g.name}
            {span(g) && <span className="roster-span">{span(g)}</span>}
          </span>
        ))}
      </div>
    </details>
  );
}
