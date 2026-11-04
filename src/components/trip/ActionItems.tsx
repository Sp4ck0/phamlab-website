import { Fragment, useEffect, useState, type ReactNode } from "react";
import type { ActionItem, Group, Outcome, Priority, Task, Vote } from "../../lib/types";
import { gapLabel } from "../../lib/tripLogic";
import { dueLabel, dueState } from "../../lib/dueDates";
import { kindLabel, PRIORITY_LABELS, priorityRank, scopeStart } from "../../lib/tasks";
import type { ActionItemFields } from "../../hooks/useActionItemEdits";
import { useAiFocus } from "../../hooks/useAiFocus";
import { useRecentChanges } from "../../hooks/useRecentChanges";
import { sanitizeHtml } from "../../lib/sanitizeHtml";
import { useUndoableDelete } from "../../hooks/useUndoableDelete";
import { flash, scrollBehavior, SETTLE_MS } from "../../lib/flash";
import { ActionItemEditor } from "./ActionItemEditor";
import { Considerations } from "./Considerations";
import { ShareLinkButton } from "./ShareLinkButton";
import { PencilIcon, PlaceLinks, ScopeLinks, TrashIcon } from "./taskParts";
import { DueDateInput } from "./DueDateInput";
import { TaskRow } from "./TaskRow";
import { UndoBar } from "./UndoBar";

interface Props {
  // Every task for the trip. High-priority ones are also listed in the panel at the top.
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
  // Considerations: voting and settling (see Considerations.tsx).
  pendingVotes: Record<string, Vote | null>;
  onVote: (itemId: string, vote: Vote | null) => void;
  onSetOutcome: (key: string, outcome: Outcome | null) => void;
}

interface Row {
  priority?: Priority;
  date?: string;
  due: string;
  done: boolean;
  node: ReactNode;
}

const itemId = (task: Task) => task.key.slice("item:".length);
// The row's element id: stored items keep the id the AI focus has always used.
const rowDomId = (task: Task) => (task.editable ? `ai-row-${itemId(task)}` : `task-row-${task.key}`);

// High priority first, then medium, then low or none; within each, soonest due first; ties (and the common case where everything still has the
// default due date) fall back to the task's own date. Whole-trip tasks sort to
// the end, after everything with a date.
function byPriorityDueDate(a: Row, b: Row) {
  const byPriority = priorityRank(a.priority) - priorityRank(b.priority);
  if (byPriority) return byPriority;
  if (a.due !== b.due) return a.due.localeCompare(b.due);
  if (!a.date && !b.date) return 0;
  if (!a.date) return 1;
  if (!b.date) return -1;
  return a.date.localeCompare(b.date);
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
  pendingVotes,
  onVote,
  onSetOutcome,
}: Props) {
  // "new" = the composer is open; "new-consider" = the considerations composer;
  // an id = that item's row is being edited.
  const [editing, setEditing] = useState<"new" | "new-consider" | string | null>(null);
  const [completedOpen, setCompletedOpen] = useState(false);
  const [settledOpen, setSettledOpen] = useState(false);
  const undoable = useUndoableDelete({ onAddItem, onRemoveItem, onSetDone, onSetDue });

  // The AI (mcpFocus.ts) or a shared link pointed at a task: scroll to it and
  // blink it. A done task sits in a collapsed list, so open that first; the task
  // may also not have arrived yet, so wait for it.
  const { focus: itemFocus, consume } = useAiFocus("actionItem");
  const { focus: taskFocus } = useAiFocus("task");
  const focus = itemFocus ?? taskFocus;
  // When the AI edited the item, show what changed instead of a plain blink: the
  // old wording stays above it, struck through, while the row glows. An item it
  // removed is shown the same way (useRecentChanges remembers the "before").
  const recent = useRecentChanges(items, (i) => i.id);
  const [diff, setDiff] = useState<{ id: string; prev: ActionItem } | null>(null);
  const [ghost, setGhost] = useState<ActionItem | null>(null);
  useEffect(() => {
    if (!diff && !ghost) return;
    if (ghost) document.getElementById("removed-item")?.scrollIntoView({ block: "center", behavior: scrollBehavior() });
    const t = setTimeout(() => {
      if (diff) document.getElementById(`ai-row-${diff.id}`)?.classList.remove("chg-new");
      setDiff(null);
      setGhost(null);
    }, 4200);
    return () => clearTimeout(t);
  }, [diff, ghost]);
  useEffect(() => {
    if (!focus) return;
    const key = focus.target.kind === "task" ? focus.target.key : `item:${focus.target.id}`;
    const task = tasks.find((t) => t.key === key);
    if (!task) {
      const removed = focus.target.kind === "actionItem" ? focus.target.id : null;
      if (!removed || !recent.peek(removed)?.gone) return;
      const t = setTimeout(() => {
        consume(focus.nonce);
        const prev = recent.take(removed)?.prev;
        if (prev) setGhost(prev);
      }, SETTLE_MS);
      return () => clearTimeout(t);
    }
    if (task.done) (task.kind === "consider" ? setSettledOpen : setCompletedOpen)(true);
    const t = setTimeout(() => {
      const el = document.getElementById(rowDomId(task));
      if (!el) return;
      consume(focus.nonce);
      const change = focus.target.kind === "actionItem" && task.editable && task.kind !== "consider" ? recent.take(itemId(task)) : null;
      el.scrollIntoView({ block: "center", behavior: scrollBehavior() });
      setTimeout(() => {
        if (change?.prev && !change.gone) {
          setDiff({ id: itemId(task), prev: change.prev });
          el.classList.add("chg-new");
        } else flash(el);
      }, 250);
    }, SETTLE_MS);
    return () => clearTimeout(t);
  }, [focus, tasks, consume, recent]);

  // What an item said before the AI changed it: struck through, then folded away.
  const ghostRow = (prev: ActionItem, id?: string) => (
    <div className="action-item chg-gone" id={id} inert aria-hidden="true">
      <div>
        <b dangerouslySetInnerHTML={{ __html: sanitizeHtml(prev.title) }} />{" "}
        <span dangerouslySetInnerHTML={{ __html: sanitizeHtml(prev.detail ?? "") }} />
      </div>
    </div>
  );

  const editorProps = { groups, minDate: tripStart, maxDate: tripEnd, onCancel: () => setEditing(null) };

  function startEdit(id: string, isDone: boolean) {
    if (isDone) setCompletedOpen(true);
    setEditing(id);
  }

  function remove(task: Task, item: ActionItem) {
    if (editing === item.id) setEditing(null);
    // A settled consideration comes back open: its votes are gone with it, and
    // done-without-an-outcome is not a state it can be in.
    undoable.remove(task.kind === "consider" ? { ...task, done: false } : task, item);
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
    const row = (node: ReactNode): Row => ({ priority: task.priority, date: start, due, done: task.done, node });
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
      const reworded = diff?.id === item.id && (diff.prev.title !== item.title || diff.prev.detail !== item.detail);
      return row(
        <Fragment key={task.key}>
        {reworded && ghostRow(diff.prev)}
        <TaskRow
          key={task.key}
          domId={`ai-${item.id}`}
          rowId={`ai-row-${item.id}`}
          done={task.done}
          onToggle={() => onSetDone(task.refs, !task.done)}
          badge={badge}
          pill={task.priority ? PRIORITY_LABELS[task.priority] : undefined}
          lead={task.title}
          body={task.detail}
          scope={
            task.scope.kind === "trip" && !task.places?.length ? undefined : (
              <>
                {task.scope.kind !== "trip" && <ScopeLinks scope={task.scope} />}
                {task.scope.kind !== "trip" && !!task.places?.length && " · "}
                {!!task.places?.length && <PlaceLinks places={task.places} />}
              </>
            )
          }
          dueState={state}
          due={dueControl}
          actions={
            <>
              <ShareLinkButton param={{ task: task.key }} label={`Share link to ${task.title}`} />
              <button type="button" className="icon-btn" aria-label={`Edit ${task.title}`} onClick={() => startEdit(item.id, task.done)}>
                <PencilIcon />
              </button>
              <button type="button" className="icon-btn" aria-label={`Delete ${task.title}`} onClick={() => remove(task, item)}>
                <TrashIcon />
              </button>
            </>
          }
        />
        </Fragment>
      );
    }

    // Derived: a booking, a blank day or a move with no transport. Ticking covers every night/day merged into it.
    return row(
      <TaskRow
        key={task.key}
        domId={`task-${task.key}`}
        rowId={rowDomId(task)}
        done={task.done}
        onToggle={() => onSetDone(task.refs, !task.done)}
        badge={badge}
        lead={kindLabel(task) ?? task.title}
        body={
          task.mode === "hotel" && task.detail
            ? `${task.title} · ${task.detail}`
            : task.kind === "transport"
              ? `${task.title} · nothing entered yet`
              : task.title
        }
        scope={<ScopeLinks scope={task.scope} />}
        dueState={state}
        due={dueControl}
        actions={<ShareLinkButton param={{ task: task.key }} label={`Share link to ${kindLabel(task) ?? task.title}`} />}
      />
    );
  };

  const considerTasks = tasks.filter((t) => t.kind === "consider");
  const rows = tasks.filter((t) => t.kind !== "consider").map(rowFor).sort(byPriorityDueDate);
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
      {open.length > 0 || composer || ghost ? (
        <div className="action-items">
          {composer}
          {ghost && ghostRow(ghost, "removed-item")}
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
      <Considerations
        tasks={considerTasks}
        items={items}
        groups={groups}
        tripStart={tripStart}
        tripEnd={tripEnd}
        editing={editing === "new" ? null : editing}
        setEditing={setEditing}
        pendingVotes={pendingVotes}
        onVote={onVote}
        onSetOutcome={onSetOutcome}
        onAddItem={onAddItem}
        onUpdateItem={onUpdateItem}
        onRemove={remove}
        settledOpen={settledOpen}
        onSettledOpenChange={setSettledOpen}
      />
    </>
  );
}
