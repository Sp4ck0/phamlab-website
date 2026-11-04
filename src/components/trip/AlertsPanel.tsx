import { useState } from "react";
import type { ActionItem, Group, Task } from "../../lib/types";
import { gapLabel } from "../../lib/tripLogic";
import { scopeLabel, scopeStart } from "../../lib/tasks";
import type { ActionItemFields } from "../../hooks/useActionItemEdits";
import { useUndoableDelete } from "../../hooks/useUndoableDelete";
import { ActionItemEditor } from "./ActionItemEditor";
import { PencilIcon, PlaceLinks, TrashIcon } from "./taskParts";
import { UndoBar } from "./UndoBar";

interface Props {
  // Every task for the trip; only the high-priority stored items are listed here.
  tasks: Task[];
  items: ActionItem[];
  groups: Group[];
  tripStart: string;
  tripEnd: string;
  onSetDone: (keys: string[], done: boolean) => void;
  onSetDue: (key: string, dueDate: string | undefined) => void;
  onAddItem: (fields: ActionItemFields & { id?: string }) => Promise<unknown>;
  onUpdateItem: (id: string, fields: ActionItemFields) => Promise<unknown>;
  onRemoveItem: (id: string) => Promise<unknown>;
}

// A long item is stored as a shortened title plus the whole text as detail
// (see admin:migrateTaskState): then the detail alone says it all.
function textOf(task: Task) {
  const { title, detail } = task;
  if (!detail) return title;
  return detail.startsWith(title.replace(/…$/, "")) ? detail : `${title} — ${detail}`;
}

// "High priority": the trip's high-priority to-dos and open considerations, open
// ones counted. Ticking a to-do finishes it (it stays listed, struck through, so
// it can be reopened). A consideration has no tick; it is settled in its own
// section, so here it only links there.
export function AlertsPanel({
  tasks,
  items,
  groups,
  tripStart,
  tripEnd,
  onSetDone,
  onSetDue,
  onAddItem,
  onUpdateItem,
  onRemoveItem,
}: Props) {
  const [editing, setEditing] = useState<string | null>(null);
  const undoable = useUndoableDelete({ onAddItem, onRemoveItem, onSetDone, onSetDue });
  const urgent = tasks.filter((t) => t.editable && t.priority === "high" && !(t.kind === "consider" && t.outcome));
  // Deleting the last one must not take the panel, and its Undo, with it.
  if (urgent.length === 0 && !undoable.deletedTitle) return null;

  const open = urgent.filter((t) => !t.done).length;
  const undoBar = undoable.deletedTitle && <UndoBar title={undoable.deletedTitle} onUndo={() => void undoable.undo()} />;

  if (urgent.length === 0) return <div className="alerts">{undoBar}</div>;

  return (
    <div className="alerts">
      <div className="alert">
        <h3>
          High priority <span className="n">{open}</span>
        </h3>
        {undoBar}
        <ul style={{ listStyle: "none", paddingLeft: 0 }}>
          {urgent.map((t) => {
            const id = t.key.slice("item:".length);
            const item = items.find((i) => i.id === id);
            if (editing === id && item) {
              return (
                <li key={t.key}>
                  <ActionItemEditor
                    groups={groups}
                    minDate={tripStart}
                    maxDate={tripEnd}
                    initial={item}
                    onCancel={() => setEditing(null)}
                    onSave={async (fields) => {
                      await onUpdateItem(id, fields);
                      setEditing(null);
                    }}
                  />
                </li>
              );
            }
            const badge = t.who !== undefined ? gapLabel(t.who, groups, scopeStart(t.scope) ?? "") : null;
            return (
              <li key={t.key} style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                {t.kind === "consider" ? (
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={`Go to ${t.title} under consideration`}
                    onClick={() => document.getElementById(`ai-row-${id}`)?.scrollIntoView({ block: "center", behavior: "smooth" })}
                  >
                    Considering ↓
                  </button>
                ) : (
                  <input
                    type="checkbox"
                    id={`priority-${id}`}
                    aria-labelledby={`priority-${id}-text`}
                    checked={t.done}
                    onChange={() => onSetDone(t.refs, !t.done)}
                  />
                )}
                <span id={`priority-${id}-text`} style={t.done ? { textDecoration: "line-through", opacity: 0.6 } : undefined}>
                  {badge && <strong>{badge.label}: </strong>}
                  {textOf(t)}
                  {t.scope.kind !== "trip" && ` · ${scopeLabel(t.scope)}`}
                  {!!t.places?.length && (
                    <>
                      {" · "}
                      <PlaceLinks places={t.places} />
                    </>
                  )}
                </span>
                {item && (
                  <span style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
                    <button type="button" className="icon-btn" aria-label={`Edit ${t.title}`} onClick={() => setEditing(id)}>
                      <PencilIcon />
                    </button>
                    <button type="button" className="icon-btn" aria-label={`Delete ${t.title}`} onClick={() => undoable.remove(t, item)}>
                      <TrashIcon />
                    </button>
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
