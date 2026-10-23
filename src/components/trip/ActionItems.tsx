import type { ReactNode } from "react";
import type { ActionItem, Group, Status } from "../../lib/types";
import type { Gap } from "../../lib/tripLogic";
import { gapLabel } from "../../lib/tripLogic";
import { dueLabel, dueState } from "../../lib/dueDates";
import { DueDateInput } from "./DueDateInput";

interface Props {
  gaps: Gap[];
  groups: Group[];
  onToggleGap: (ids: string[], status: Status) => void;
  items: ActionItem[];
  done: Record<string, boolean>;
  onToggleItem: (id: string) => void;
  today: string;
  // Every row's due date unless overridden: the trip's start date.
  defaultDue: string;
  dueOverrides: Record<string, string>;
  onSetDue: (key: string, dueDate: string | undefined) => void;
}

interface Row {
  date?: string;
  due: string;
  done: boolean;
  node: ReactNode;
}

// Soonest due first; ties (and the common case where everything still has the
// default due date) fall back to the item's own date. Undated items sort to
// the end, after everything with a date.
function byDueThenDate(a: Row, b: Row) {
  if (a.due !== b.due) return a.due.localeCompare(b.due);
  if (!a.date && !b.date) return 0;
  if (!a.date) return 1;
  if (!b.date) return -1;
  return a.date.localeCompare(b.date);
}

export function ActionItems({
  gaps,
  groups,
  onToggleGap,
  items,
  done,
  onToggleItem,
  today,
  defaultDue,
  dueOverrides,
  onSetDue,
}: Props) {
  // The due-date control sits next to the row's <label>, never inside it: a
  // label wraps the checkbox, so a date input inside would toggle the item.
  const dueControl = (key: string, due: string, isDone: boolean) => (
    <div className="due-chip">
      {!isDone && <span className="due-text">{dueLabel(due, today, isDone)}</span>}
      <DueDateInput
        value={due}
        onCommit={(next) => onSetDue(key, next !== defaultDue ? next : undefined)}
        onReset={() => onSetDue(key, undefined)}
      />
    </div>
  );

  const gapRows: Row[] = gaps.map((g, i) => {
    const { label, color } = gapLabel(g.who, groups, g.date);
    const style = color
      ? { background: `${color}1a`, color }
      : { background: "var(--chip-bg)", color: "var(--text-secondary)" };
    const checkboxId = `gap-${i}`;
    const dueKey = g.ids![0];
    const due = dueOverrides[dueKey] ?? defaultDue;
    const state = dueState(due, today, g.done);
    return {
      date: g.date as string | undefined,
      due,
      done: g.done,
      node: (
        <div
          className={`action-item ${g.done ? "done" : ""}`}
          data-due={state === "ok" ? undefined : state}
          key={checkboxId}
        >
          <input
            type="checkbox"
            id={checkboxId}
            checked={g.done}
            onChange={() => onToggleGap(g.ids!, g.done ? "booked" : "needed")}
          />
          <label htmlFor={checkboxId}>
            <span
              className="who"
              onClick={(e) => e.preventDefault()}
              style={{ ...style, display: "inline-block", padding: "3px 7px", borderRadius: 6, fontSize: 10, fontWeight: 700, marginRight: 7 }}
            >
              {label}
            </span>
            <span className="at">{g.kind}</span> <span className="ad">— {g.text} · {g.dateLabel}</span>
          </label>
          {dueControl(dueKey, due, g.done)}
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
    const dueKey = `ai:${item.id}`;
    const due = dueOverrides[dueKey] ?? defaultDue;
    const state = dueState(due, today, isDone);
    return {
      date: item.date,
      due,
      done: isDone,
      node: (
        <div
          className={`action-item ${isDone ? "done" : ""}`}
          data-due={state === "ok" ? undefined : state}
          key={item.id}
        >
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
          {dueControl(dueKey, due, isDone)}
        </div>
      ),
    };
  });

  const rows = [...gapRows, ...itemRows].sort(byDueThenDate);
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
      <p className="section-sub">
        Bookings still needed and things to nail down — check them off as they're settled. Each has a due date
        (the trip start unless you change it): yellow within a week, red once it's past due.
      </p>
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
