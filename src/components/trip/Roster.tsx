import type { Group } from "../../lib/types";
import { byStay, fmtShort } from "../../lib/tripLogic";

const span = (g: Group) =>
  g.from && g.to ? `${fmtShort(g.from)} – ${fmtShort(g.to)}` : g.from ? `from ${fmtShort(g.from)}` : g.to ? `until ${fmtShort(g.to)}` : "Whole trip";

// One row per join/leave date pair, whole-trip travelers first.
export function Roster({ groups }: { groups: Group[] }) {
  if (!groups.length) return null;
  const rows = new Map<string, Group[]>();
  for (const g of [...groups].sort(byStay)) {
    const key = `${g.from ?? ""}|${g.to ?? ""}`;
    rows.set(key, [...(rows.get(key) ?? []), g]);
  }
  return (
    <details className="roster">
      <summary>
        {groups.length} {groups.length === 1 ? "traveler" : "travelers"}
      </summary>
      <div className="roster-rows">
        {[...rows.values()].map((row) => (
          <div className="roster-row" key={row[0].id}>
            <span className="roster-span">{span(row[0])}</span>
            <div className="roster-list">
              {row.map((g) => (
                <span className="roster-person" key={g.id}>
                  <span className="dot" style={{ background: g.color }} />
                  {g.name}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </details>
  );
}
