import { useEffect, useState, type ReactNode } from "react";
import type { ActionItem, Group, Status } from "../../lib/types";
import type { Gap } from "../../lib/tripLogic";
import { gapLabel } from "../../lib/tripLogic";
import { dueLabel, dueState } from "../../lib/dueDates";
import type { ActionItemFields } from "../../hooks/useActionItemEdits";
import { useAiFocus } from "../../hooks/useAiFocus";
import { flash, scrollBehavior, SETTLE_MS } from "../../lib/flash";
import { ActionItemEditor } from "./ActionItemEditor";
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
  // Bounds for an item's optional "day" picker.
  tripStart: string;
  tripEnd: string;
  onAddItem: (fields: ActionItemFields & { id?: string }) => Promise<unknown>;
  onUpdateItem: (id: string, fields: ActionItemFields) => Promise<unknown>;
  onRemoveItem: (id: string) => Promise<unknown>;
}

interface Row {
  date?: string;
  due: string;
  done: boolean;
  node: ReactNode;
}

// What's needed to put a just-deleted item back exactly as it was.
interface Deleted {
  item: ActionItem;
  done: boolean;
  due?: string;
}

const UNDO_MS = 6000;

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

const PencilIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
  </svg>
);

const TrashIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M3 6h18" />
    <path d="M8 6V4h8v2" />
    <path d="M19 6l-1 14H6L5 6" />
  </svg>
);

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
  tripStart,
  tripEnd,
  onAddItem,
  onUpdateItem,
  onRemoveItem,
}: Props) {
  // "new" = the composer is open; an id = that item's row is being edited.
  const [editing, setEditing] = useState<"new" | string | null>(null);
  const [completedOpen, setCompletedOpen] = useState(false);
  const [deleted, setDeleted] = useState<Deleted | null>(null);

  useEffect(() => {
    if (!deleted) return;
    const t = setTimeout(() => setDeleted(null), UNDO_MS);
    return () => clearTimeout(t);
  }, [deleted]);

  // The AI pointed at an item (mcpFocus.ts): scroll to it and blink it. A done
  // item sits in the collapsed Completed list, so open that first; the item may
  // also not have arrived yet, so wait for it.
  const { focus, consume } = useAiFocus("actionItem");
  useEffect(() => {
    if (!focus) return;
    const id = focus.target.id;
    if (!items.some((i) => i.id === id)) return;
    if (done[id]) setCompletedOpen(true);
    const t = setTimeout(() => {
      const el = document.getElementById(`ai-row-${id}`);
      if (!el) return;
      consume(focus.nonce);
      el.scrollIntoView({ block: "center", behavior: scrollBehavior() });
      setTimeout(() => flash(el), 250);
    }, SETTLE_MS);
    return () => clearTimeout(t);
  }, [focus, items, done, consume]);

  const editorProps = { groups, minDate: tripStart, maxDate: tripEnd, onCancel: () => setEditing(null) };

  function startEdit(id: string, isDone: boolean) {
    if (isDone) setCompletedOpen(true);
    setEditing(id);
  }

  function remove(item: ActionItem, isDone: boolean) {
    setDeleted({ item, done: isDone, due: dueOverrides[`ai:${item.id}`] });
    if (editing === item.id) setEditing(null);
    void onRemoveItem(item.id);
  }

  async function undo() {
    if (!deleted) return;
    const { item, done: wasDone, due } = deleted;
    setDeleted(null);
    await onAddItem(item);
    if (wasDone) onToggleItem(item.id);
    if (due) onSetDue(`ai:${item.id}`, due);
  }

  // Only the checkbox toggles an item; the row text is a plain span so it can
  // be selected and copied without marking the item complete.
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
            aria-labelledby={`${checkboxId}-text`}
            onChange={() => onToggleGap(g.ids!, g.done ? "booked" : "needed")}
          />
          <span className="action-text" id={`${checkboxId}-text`}>
            <span
              className="who"
              style={{ ...style, display: "inline-block", padding: "3px 7px", borderRadius: 6, fontSize: 10, fontWeight: 700, marginRight: 7 }}
            >
              {label}
            </span>
            <span className="at">{g.kind}</span> <span className="ad">— {g.text} · {g.dateLabel}</span>
          </span>
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
    const isEditing = editing === item.id;
    return {
      date: item.date,
      due,
      done: isDone,
      node: isEditing ? (
        <div className="action-item" key={item.id}>
          <ActionItemEditor
            {...editorProps}
            initial={item}
            onSave={async (fields) => {
              await onUpdateItem(item.id, fields);
              setEditing(null);
            }}
          />
        </div>
      ) : (
        <div
          className={`action-item ${isDone ? "done" : ""}`}
          data-due={state === "ok" ? undefined : state}
          id={`ai-row-${item.id}`}
          key={item.id}
        >
          <input type="checkbox" id={`ai-${item.id}`} aria-labelledby={`ai-${item.id}-text`} checked={isDone} onChange={() => onToggleItem(item.id)} />
          <span className="action-text" id={`ai-${item.id}-text`}>
            {badge && (
              <span
                className="who"
                style={{ ...badgeStyle, display: "inline-block", padding: "3px 7px", borderRadius: 6, fontSize: 10, fontWeight: 700, marginRight: 7 }}
              >
                {badge.label}
              </span>
            )}
            <span className="at">{item.title} —</span> <span className="ad">{item.detail}</span>
          </span>
          <div className="row-actions">
            <button type="button" className="icon-btn" aria-label={`Edit ${item.title}`} onClick={() => startEdit(item.id, isDone)}>
              <PencilIcon />
            </button>
            <button type="button" className="icon-btn" aria-label={`Delete ${item.title}`} onClick={() => remove(item, isDone)}>
              <TrashIcon />
            </button>
          </div>
          {dueControl(dueKey, due, isDone)}
        </div>
      ),
    };
  });

  const rows = [...gapRows, ...itemRows].sort(byDueThenDate);
  const open = rows.filter((r) => !r.done);
  const completed = rows.filter((r) => r.done);
  const total = rows.length;

  const composer = editing === "new" && (
    <div className="action-item">
      <ActionItemEditor
        {...editorProps}
        onSave={async (fields) => {
          await onAddItem(fields);
          setEditing(null);
        }}
      />
    </div>
  );

  return (
    <>
      <div className="section-head-row">
        <h2 className="section-title">Action Items</h2>
        <div className="head-actions">
          {total > 0 && (
            <span className="progress-pill">
              {completed.length} of {total} done
            </span>
          )}
          <button type="button" className="add-btn" onClick={() => setEditing("new")}>
            + Add
          </button>
        </div>
      </div>
      <p className="section-sub">
        Bookings still needed and things to nail down — check them off as they're settled. Each has a due date
        (the trip start unless you change it): yellow within a week, red once it's past due.
      </p>
      {deleted && (
        <div className="undo-bar" role="status">
          <span>Deleted “{deleted.item.title}”</span>
          <button type="button" onClick={() => void undo()}>
            Undo
          </button>
        </div>
      )}
      {open.length > 0 || composer ? (
        <div className="action-items">
          {composer}
          {open.map((r) => r.node)}
        </div>
      ) : (
        <div className="action-items action-items-empty">All caught up — nothing left to do.</div>
      )}
      {completed.length > 0 && (
        <details className="action-completed" open={completedOpen} onToggle={(e) => setCompletedOpen(e.currentTarget.open)}>
          <summary>Completed ({completed.length})</summary>
          <div className="action-items">{completed.map((r) => r.node)}</div>
        </details>
      )}
    </>
  );
}
