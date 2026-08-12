import type { Group } from "../../lib/types";
import { GroupChip } from "./GroupChip";

interface Props {
  groups: Group[];
  activeGroup: string;
  onActiveGroupChange: (id: string) => void;
  onlyGaps: boolean;
  onOnlyGapsChange: (v: boolean) => void;
  showOnlyGaps: boolean;
}

export function Controls({ groups, activeGroup, onActiveGroupChange, onlyGaps, onOnlyGapsChange, showOnlyGaps }: Props) {
  const chips = [{ id: "all", name: "Everyone", color: "var(--text-primary)" }, ...groups];

  return (
    <div className="controls">
      <span className="lbl">Who</span>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {chips.map((g) => (
          <GroupChip key={g.id} id={g.id} name={g.name} color={g.color} active={activeGroup === g.id} onClick={onActiveGroupChange} />
        ))}
      </div>
      <span className="spacer" />
      {showOnlyGaps && (
        <button className="btn" aria-pressed={onlyGaps} onClick={() => onOnlyGapsChange(!onlyGaps)}>
          {onlyGaps ? "Show all days" : "Only gaps"}
        </button>
      )}
    </div>
  );
}
