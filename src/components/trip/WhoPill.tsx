import type { Group, Who } from "../../lib/types";
import { presentGroups } from "../../lib/tripLogic";

export function WhoPill({ who, groups, date }: { who: Who; groups: Group[]; date: string }) {
  if (Array.isArray(who)) {
    const byId = Object.fromEntries(groups.map((g) => [g.id, g]));
    const names = who.map((id) => byId[id]?.name || id).join(" & ");
    return (
      <span className="who-pill" style={{ background: "var(--chip-bg)", color: "var(--text-secondary)" }}>
        {names}
      </span>
    );
  }
  const g = groups.find((x) => x.id === who);
  if (!g) {
    const label = presentGroups(groups, date).map((x) => x.name).join(", ") || "Everyone";
    return (
      <span className="who-pill" style={{ background: "var(--chip-bg)", color: "var(--text-secondary)" }}>
        {label}
      </span>
    );
  }
  return (
    <span className="who-pill" style={{ background: `${g.color}1a`, color: g.color }}>
      {g.name}
    </span>
  );
}
