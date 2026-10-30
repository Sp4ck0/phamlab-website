import type { ReactNode } from "react";
import type { DueState } from "../../lib/dueDates";
import { Linkify } from "./Linkify";

interface Badge {
  label: string;
  color: string | null;
}

interface Props {
  // Prefix for the checkbox / text ids (aria-labelledby).
  domId: string;
  // Id of the row element itself, for scrolling to it (AI focus).
  rowId?: string;
  done: boolean;
  onToggle: () => void;
  // Who it's for; null shows no badge.
  badge: Badge | null;
  // Small pill before the text, e.g. "Decision".
  pill?: string;
  // Bold lead: what is being booked, or the item's own title.
  lead: string;
  // Muted text after the lead: the route/city, or the item's detail.
  body?: string;
  // When it applies ("Fri Nov 20 – Sun Nov 22"); left out for whole-trip items.
  scope?: ReactNode;
  // Edit / delete buttons.
  actions?: ReactNode;
  // The due-date chip; the per-day lists have none.
  due?: ReactNode;
  dueState?: DueState;
}

const badgeBase = { display: "inline-block", padding: "3px 7px", borderRadius: 6, fontSize: 10, fontWeight: 700, marginRight: 7 } as const;

// One row of a task list: checkbox, who-badge, what and when, due date. Only
// the checkbox toggles it; the text is a plain span so it can be selected and
// copied without marking the task complete. Shared by the Action Items list and
// the per-day checklists.
export function TaskRow({ domId, rowId, done, onToggle, badge, pill, lead, body, scope, actions, due, dueState }: Props) {
  const hasRest = !!(body || scope);
  const tint = (color: string | null) =>
    color ? { background: `${color}1a`, color } : { background: "var(--chip-bg)", color: "var(--text-secondary)" };
  return (
    <div
      className={`action-item ${done ? "done" : ""}`}
      data-due={dueState && dueState !== "ok" ? dueState : undefined}
      id={rowId}
    >
      <input type="checkbox" id={domId} aria-labelledby={`${domId}-text`} checked={done} onChange={onToggle} />
      <span className="action-text" id={`${domId}-text`}>
        {badge && (
          <span className="who" style={{ ...tint(badge.color), ...badgeBase }}>
            {badge.label}
          </span>
        )}
        {pill && <span style={{ ...tint(null), ...badgeBase }}>{pill}</span>}
        <span className="at">
          <Linkify text={lead} />
          {hasRest ? " —" : ""}
        </span>
        {hasRest && (
          <>
            {" "}
            <span className="ad">
              {body && <Linkify text={body} />}
              {body && scope ? " · " : ""}
              {scope}
            </span>
          </>
        )}
      </span>
      {actions && <div className="row-actions">{actions}</div>}
      {due}
    </div>
  );
}
