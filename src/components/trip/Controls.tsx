import { useSearchParams } from "react-router-dom";
import type { Group } from "../../lib/types";
import { GroupChip } from "./GroupChip";

interface Props {
  groups: Group[];
  activeGroup: string;
  onActiveGroupChange: (id: string) => void;
  onlyGaps: boolean;
  onOnlyGapsChange: (v: boolean) => void;
}

export function Controls({ groups, activeGroup, onActiveGroupChange, onlyGaps, onOnlyGapsChange }: Props) {
  const [searchParams, setSearchParams] = useSearchParams();
  const view = searchParams.get("view") === "grid" ? "grid" : "timeline";

  function toggleView() {
    const next = view === "grid" ? "timeline" : "grid";
    setSearchParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        p.set("view", next);
        return p;
      },
      { replace: true }
    );
  }

  const chips = [{ id: "all", name: "Everyone", color: "#17322f" }, ...groups];

  return (
    <div className="controls">
      <span className="lbl">Who</span>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {chips.map((g) => (
          <GroupChip key={g.id} id={g.id} name={g.name} color={g.color} active={activeGroup === g.id} onClick={onActiveGroupChange} />
        ))}
      </div>
      <span className="spacer" />
      <button className="btn" onClick={toggleView}>
        {view === "grid" ? "Timeline view" : "Grid view"}
      </button>
      <button className="btn" aria-pressed={onlyGaps} onClick={() => onOnlyGapsChange(!onlyGaps)}>
        {onlyGaps ? "Show all days" : "Only gaps"}
      </button>
    </div>
  );
}
