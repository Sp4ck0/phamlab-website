import type { Group, ResolvedDay, Status } from "../../lib/types";
import { RosterCard } from "./RosterCard";

export function Roster({ groups, resolvedDays, ticks, sdek }: {
  groups: Group[];
  resolvedDays: ResolvedDay[];
  ticks: Record<string, Status>;
  sdek?: string;
}) {
  return (
    <>
      <h2 className="shead">The roster</h2>
      {sdek && <p className="sdek" dangerouslySetInnerHTML={{ __html: sdek }} />}
      <div className="roster">
        {groups.map((g) => (
          <RosterCard key={g.id} group={g} days={resolvedDays} ticks={ticks} />
        ))}
      </div>
    </>
  );
}
