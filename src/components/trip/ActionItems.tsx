import type { ReactNode } from "react";
import type { ActionItem, Group, Status } from "../../lib/types";
import type { Gap } from "../../lib/tripLogic";
import { gapLabel } from "../../lib/tripLogic";

interface Props {
  gaps: Gap[];
  groups: Group[];
  onToggleGap: (ids: string[], status: Status) => void;
  items: ActionItem[];
  done: Record<string, boolean>;
  onToggleItem: (id: string) => void;
}

interface Row {
  date?: string;
  done: boolean;
  node: ReactNode;
}

// Undated items (no date field yet) sort to the end, after everything with a date.
function byDate(a: Row, b: Row) {
  if (!a.date && !b.date) return 0;
  if (!a.date) return 1;
  if (!b.date) return -1;
  return a.date.localeCompare(b.date);
}

export function ActionItems({ gaps, groups, onToggleGap, items, done, onToggleItem }: Props) {
  const gapRows: Row[] = gaps.map((g, i) => {
    const { label, color } = gapLabel(g.who, groups, g.date);
    const style = color
      ? { background: `${color}1a`, color }
      : { background: "var(--chip-bg)", color: "var(--text-secondary)" };
    const checkboxId = `gap-${i}`;
    return {
      date: g.date as string | undefined,
      done: g.done,
      node: (
        <div className={`action-item ${g.done ? "done" : ""}`} key={checkboxId}>
          {g.ids ? (
            <input
              type="checkbox"
              id={checkboxId}
              checked={g.done}
              onChange={() => onToggleGap(g.ids!, g.done ? "booked" : "needed")}
            />
          ) : (
            <span aria-hidden style={{ width: 17, flex: "none", textAlign: "center", color: "var(--text-muted)" }}>·</span>
          )}
          <label htmlFor={g.ids ? checkboxId : undefined}>
            <span
              className="who"
              onClick={(e) => e.preventDefault()}
              style={{ ...style, display: "inline-block", padding: "3px 7px", borderRadius: 6, fontSize: 10, fontWeight: 700, marginRight: 7 }}
            >
              {label}
            </span>
            <span className="at">{g.kind}</span> <span className="ad">— {g.text} · {g.dateLabel}</span>
          </label>
        </div>
      ),
    };
  });

  const itemRows: Row[] = items.map((item) => {
    const isDone = !!done[item.id];
    const badge = item.who ? gapLabel(item.who, groups, item.date || "") : null;
    const badgeStyle = badge?.color
      ? { background: `${badge.color}1a`, color: badge.color }
      : { background: "var(--chip-bg)", color: "var(--text-secondary)" };
    return {
      date: item.date,
      done: isDone,
      node: (
        <div className={`action-item ${isDone ? "done" : ""}`} key={item.id}>
          <input type="checkbox" id={`ai-${item.id}`} checked={isDone} onChange={() => onToggleItem(item.id)} />
          <label htmlFor={`ai-${item.id}`}>
            {badge && (
              <span
                className="who"
                onClick={(e) => e.preventDefault()}
                style={{ ...badgeStyle, display: "inline-block", padding: "3px 7px", borderRadius: 6, fontSize: 10, fontWeight: 700, marginRight: 7 }}
              >
                {badge.label}
              </span>
            )}
            <span className="at">{item.title} —</span> <span className="ad">{item.detail}</span>
          </label>
        </div>
      ),
    };
  });

  const rows = [...gapRows, ...itemRows].sort(byDate);
  const open = rows.filter((r) => !r.done);
  const completed = rows.filter((r) => r.done);
  const total = rows.length;

  if (total === 0) return null;

  return (
    <>
      <div className="section-head-row">
        <h2 className="section-title">Action Items</h2>
        <span className="progress-pill">
          {completed.length} of {total} done
        </span>
      </div>
      <p className="section-sub">Bookings still needed and things to nail down — check them off as they're settled.</p>
      {open.length > 0 ? (
        <div className="action-items">{open.map((r) => r.node)}</div>
      ) : (
        <div className="action-items action-items-empty">All caught up — nothing left to do.</div>
      )}
      {completed.length > 0 && (
        <details className="action-completed">
          <summary>Completed ({completed.length})</summary>
          <div className="action-items">{completed.map((r) => r.node)}</div>
        </details>
      )}
    </>
  );
}
