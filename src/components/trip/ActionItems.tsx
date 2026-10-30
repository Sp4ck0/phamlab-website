import { useEffect, useState, type ReactNode } from "react";
import { useParams } from "react-router-dom";
import type { ActionItem, Group, Task, TaskScope } from "../../lib/types";
import { gapLabel } from "../../lib/tripLogic";
import { dueLabel, dueState } from "../../lib/dueDates";
import { dow, kindLabel, scopeStart } from "../../lib/tasks";
import type { ActionItemFields } from "../../hooks/useActionItemEdits";
import { useAiFocus, useShowAiFocus } from "../../hooks/useAiFocus";
import { useUndoableDelete } from "../../hooks/useUndoableDelete";
import { flash, scrollBehavior, SETTLE_MS } from "../../lib/flash";
import { ActionItemEditor } from "./ActionItemEditor";
import { DueDateInput } from "./DueDateInput";
import { TaskRow } from "./TaskRow";
import { UndoBar } from "./UndoBar";

interface Props {
  // Every task for the trip. Decisions are also listed in the alerts panel.
  tasks: Task[];
  // The stored items behind the editable tasks, for editing and undoing a delete.
  items: ActionItem[];
  groups: Group[];
  onSetDone: (keys: string[], done: boolean) => void;
  today: string;
  // Every row's due date unless overridden: the trip's start date.
  defaultDue: string;
  onSetDue: (key: string, dueDate: string | undefined) => void;
  // Bounds for an item's optional day / range pickers.
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

const itemId = (task: Task) => task.key.slice("item:".length);

// Soonest due first; ties (and the common case where everything still has the
// default due date) fall back to the task's own date. Whole-trip tasks sort to
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

// "Fri Nov 20" or "Fri Nov 20 – Sun Nov 22", each date a link to its day in the
// itinerary. Reuses the AI-focus path, which opens, scrolls to and flashes a day.
function ScopeLinks({ scope }: { scope: TaskScope }) {
  const { slug } = useParams<{ slug: string }>();
  const show = useShowAiFocus();
  if (scope.kind === "trip") return <>Whole trip</>;
  const link = (date: string) => (
    <button
      type="button"
      className="day-link"
      onClick={() => slug && show({ slug, target: { kind: "day", date }, nonce: `${Date.now()}` })}
    >
      {dow(date)}
    </button>
  );
  return scope.kind === "day" ? link(scope.date) : <>{link(scope.start)} – {link(scope.end)}</>;
}

export function ActionItems({
  tasks,
  items,
  groups,
  onSetDone,
  today,
  defaultDue,
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
  const undoable = useUndoableDelete({ onAddItem, onRemoveItem, onSetDone, onSetDue });

  // The AI pointed at an item (mcpFocus.ts): scroll to it and blink it. A done
  // item sits in the collapsed Completed list, so open that first; the item may
  // also not have arrived yet, so wait for it.
  const { focus, consume } = useAiFocus("actionItem");
  useEffect(() => {
    if (!focus) return;
    const id = focus.target.id;
    const task = tasks.find((t) => t.editable && itemId(t) === id);
    if (!task) return;
    if (task.done) setCompletedOpen(true);
    const t = setTimeout(() => {
      const el = document.getElementById(`ai-row-${id}`);
      if (!el) return;
      consume(focus.nonce);
      el.scrollIntoView({ block: "center", behavior: scrollBehavior() });
      setTimeout(() => flash(el), 250);
    }, SETTLE_MS);
    return () => clearTimeout(t);
  }, [focus, tasks, consume]);

  const editorProps = { groups, minDate: tripStart, maxDate: tripEnd, onCancel: () => setEditing(null) };

  function startEdit(id: string, isDone: boolean) {
    if (isDone) setCompletedOpen(true);
    setEditing(id);
  }

  function remove(task: Task, item: ActionItem) {
    if (editing === item.id) setEditing(null);
    undoable.remove(task, item);
  }

  const rowFor = (task: Task): Row => {
    const start = scopeStart(task.scope);
    const due = task.dueDate ?? defaultDue;
    const state = dueState(due, today, task.done);
    const dueControl = (
      <div className="due-chip">
        {!task.done && <span className="due-text">{dueLabel(due, today, task.done)}</span>}
        <DueDateInput
          value={due}
          onCommit={(next) => onSetDue(task.key, next !== defaultDue ? next : undefined)}
          onReset={() => onSetDue(task.key, undefined)}
        />
      </div>
    );
    const row = (node: ReactNode): Row => ({ date: start, due, done: task.done, node });
    const badge = task.who !== undefined ? gapLabel(task.who, groups, start ?? "") : null;

    const item = task.editable ? items.find((i) => i.id === itemId(task)) : undefined;
    if (task.editable && item) {
      if (editing === item.id) {
        return row(
          <div className="action-item" key={task.key}>
            <ActionItemEditor
              {...editorProps}
              initial={item}
              onSave={async (fields) => {
                await onUpdateItem(item.id, fields);
                setEditing(null);
              }}
            />
          </div>
        );
      }
      return row(
        <TaskRow
          key={task.key}
          domId={`ai-${item.id}`}
          rowId={`ai-row-${item.id}`}
          done={task.done}
          onToggle={() => onSetDone(task.refs, !task.done)}
          badge={badge}
          pill={task.kind === "decision" ? "Decision" : undefined}
          lead={task.title}
          body={task.detail}
          scope={task.scope.kind === "trip" ? undefined : <ScopeLinks scope={task.scope} />}
          dueState={state}
          due={dueControl}
          actions={
            <>
              <button type="button" className="icon-btn" aria-label={`Edit ${task.title}`} onClick={() => startEdit(item.id, task.done)}>
                <PencilIcon />
              </button>
              <button type="button" className="icon-btn" aria-label={`Delete ${task.title}`} onClick={() => remove(task, item)}>
                <TrashIcon />
              </button>
            </>
          }
        />
      );
    }

    // Derived: a booking or a blank day. Ticking covers every night/day merged into it.
    return row(
      <TaskRow
        key={task.key}
        domId={`task-${task.key}`}
        done={task.done}
        onToggle={() => onSetDone(task.refs, !task.done)}
        badge={badge}
        lead={kindLabel(task) ?? task.title}
        body={task.mode === "hotel" && task.detail ? `${task.title} · ${task.detail}` : task.title}
        scope={<ScopeLinks scope={task.scope} />}
        dueState={state}
        due={dueControl}
      />
    );
  };

  const rows = tasks.map(rowFor).sort(byDueThenDate);
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
      {undoable.deletedTitle && <UndoBar title={undoable.deletedTitle} onUndo={() => void undoable.undo()} />}
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
