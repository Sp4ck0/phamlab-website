import type { ActionItem, Group, Status } from "../../lib/types";
import type { Gap } from "../../lib/tripLogic";
import { gapLabel } from "../../lib/tripLogic";

interface Props {
  gaps: Gap[];
  groups: Group[];
  ticks: Record<string, Status>;
  onToggleGap: (ids: string[], status: Status) => void;
  items: ActionItem[];
  done: Record<string, boolean>;
  onToggleItem: (id: string) => void;
}

export function ActionItems({ gaps, groups, ticks, onToggleGap, items, done, onToggleItem }: Props) {
  const gapDoneCount = gaps.filter((g) => g.ids && g.ids.every((id) => ticks[id] === "booked")).length;
  const itemDoneCount = items.filter((i) => done[i.id]).length;
  const total = gaps.length + items.length;
  const doneCount = gapDoneCount + itemDoneCount;

  if (total === 0) return null;

  return (
    <>
      <div className="section-head-row">
        <h2 className="section-title">Action Items</h2>
        <span className="progress-pill">
          {doneCount} of {total} done
        </span>
      </div>
      <p className="section-sub">Bookings still needed and things to nail down — check them off as they're settled.</p>
      <div className="action-items">
        {gaps.map((g, i) => {
          const { label, color } = gapLabel(g.who, groups, g.date);
          const style = color
            ? { background: `${color}1a`, color }
            : { background: "var(--chip-bg)", color: "var(--text-secondary)" };
          const isBooked = !!g.ids && g.ids.every((id) => ticks[id] === "booked");
          const checkboxId = `gap-${i}`;
          return (
            <div className={`action-item ${isBooked ? "done" : ""}`} key={checkboxId}>
              {g.ids ? (
                <input
                  type="checkbox"
                  id={checkboxId}
                  checked={isBooked}
                  onChange={() => onToggleGap(g.ids!, isBooked ? "booked" : "needed")}
                />
              ) : (
                <span aria-hidden style={{ width: 17, flex: "none", textAlign: "center", color: "var(--text-muted)" }}>·</span>
              )}
              <label htmlFor={g.ids ? checkboxId : undefined}>
                <span className="who" style={{ ...style, display: "inline-block", padding: "3px 7px", borderRadius: 6, fontSize: 10, fontWeight: 700, marginRight: 7 }}>
                  {label}
                </span>
                <span className="at">{g.kind}</span> <span className="ad">— {g.text} · {g.dateLabel}</span>
              </label>
            </div>
          );
        })}
        {items.map((item) => {
          const isDone = !!done[item.id];
          return (
            <div className={`action-item ${isDone ? "done" : ""}`} key={item.id}>
              <input type="checkbox" id={`ai-${item.id}`} checked={isDone} onChange={() => onToggleItem(item.id)} />
              <label htmlFor={`ai-${item.id}`}>
                <span className="at">{item.title} —</span> <span className="ad">{item.detail}</span>
              </label>
            </div>
          );
        })}
      </div>
    </>
  );
}
