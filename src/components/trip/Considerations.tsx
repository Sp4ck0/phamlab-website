import type { ReactNode } from "react";
import type { ActionItem, Group, Outcome, Task, Vote } from "../../lib/types";
import { gapLabel } from "../../lib/tripLogic";
import { scopeStart, voteTally } from "../../lib/tasks";
import { googleMapsUrl } from "../../lib/mapPoints";
import type { ActionItemFields } from "../../hooks/useActionItemEdits";
import { sanitizeHtml } from "../../lib/sanitizeHtml";
import { ActionItemEditor } from "./ActionItemEditor";
import { PencilIcon, ScopeLinks, TrashIcon } from "./taskParts";

interface Props {
  // Only the consider tasks.
  tasks: Task[];
  items: ActionItem[];
  groups: Group[];
  tripStart: string;
  tripEnd: string;
  // "new-consider" = the composer is open; an id = that item is being edited.
  editing: string | null;
  setEditing: (v: string | null) => void;
  pendingVotes: Record<string, Vote | null>;
  onVote: (itemId: string, vote: Vote | null) => void;
  onSetOutcome: (key: string, outcome: Outcome | null) => void;
  onAddItem: (fields: ActionItemFields) => Promise<unknown>;
  onUpdateItem: (id: string, fields: ActionItemFields) => Promise<unknown>;
  onRemove: (task: Task, item: ActionItem) => void;
  settledOpen: boolean;
  onSettledOpenChange: (open: boolean) => void;
}

const itemId = (task: Task) => task.key.slice("item:".length);

// Soonest first; whole-trip candidates last.
function byDate(a: Task, b: Task) {
  const x = scopeStart(a.scope);
  const y = scopeStart(b.scope);
  if (x && y) return x.localeCompare(y) || a.title.localeCompare(b.title);
  if (x) return -1;
  if (y) return 1;
  return a.title.localeCompare(b.title);
}

const badgeStyle = (color: string | null) => ({
  display: "inline-block",
  padding: "3px 7px",
  borderRadius: 6,
  fontSize: 10,
  fontWeight: 700,
  ...(color ? { background: `${color}1a`, color } : { background: "var(--chip-bg)", color: "var(--text-secondary)" }),
});

// Things the group is still weighing, shown apart from the plan so they can't be
// mistaken for it: dashed, tinted, no checkbox. Each can be voted yes / no by
// anyone with access, then marked Chosen or Dropped.
export function Considerations({
  tasks,
  items,
  groups,
  tripStart,
  tripEnd,
  editing,
  setEditing,
  pendingVotes,
  onVote,
  onSetOutcome,
  onAddItem,
  onUpdateItem,
  onRemove,
  settledOpen,
  onSettledOpenChange,
}: Props) {
  const editorProps = { groups, minDate: tripStart, maxDate: tripEnd, onCancel: () => setEditing(null) };

  const card = (task: Task): ReactNode => {
    const id = itemId(task);
    const item = items.find((i) => i.id === id);
    if (!item) return null;
    if (editing === id) {
      return (
        <div className="consider" key={task.key}>
          <ActionItemEditor
            {...editorProps}
            initial={item}
            onSave={async (fields) => {
              await onUpdateItem(id, fields);
              setEditing(null);
            }}
          />
        </div>
      );
    }
    const badge = task.who !== undefined ? gapLabel(task.who, groups, scopeStart(task.scope) ?? "") : null;
    const { mine, yes, no, votes } = voteTally(task, pendingVotes[id]);
    const settled = task.outcome;
    const pick = (v: Vote) => onVote(id, mine === v ? null : v);
    return (
      <div className="consider" data-outcome={settled} key={task.key} id={`ai-row-${id}`}>
        <div className="consider-head">
          <span className="consider-pill">{settled === "chosen" ? "Chosen" : settled === "dropped" ? "Dropped" : "Considering"}</span>
          {badge && <span style={badgeStyle(badge.color)}>{badge.label}</span>}
          <span className="consider-title" dangerouslySetInnerHTML={{ __html: sanitizeHtml(task.title) }} />
        </div>
        {task.detail && <p className="consider-detail" dangerouslySetInnerHTML={{ __html: sanitizeHtml(task.detail) }} />}
        <div className="consider-meta">
          <span>{<ScopeLinks scope={task.scope} />}</span>
          {task.places?.map((p, i) => (
            <a key={i} href={googleMapsUrl(p)} target="_blank" rel="noopener noreferrer" className="consider-place">
              📍 {p.name}
            </a>
          ))}
        </div>
        <div className="consider-actions">
          <div className="vote-bar" role="group" aria-label={`Vote on ${task.title}`}>
            <button type="button" className="vote-btn" data-vote="yes" aria-pressed={mine === "yes"} onClick={() => pick("yes")}>
              👍 <b>{yes}</b>
            </button>
            <button type="button" className="vote-btn" data-vote="no" aria-pressed={mine === "no"} onClick={() => pick("no")}>
              👎 <b>{no}</b>
            </button>
          </div>
          {settled ? (
            <button type="button" className="ai-btn" onClick={() => onSetOutcome(task.key, null)}>
              Reopen
            </button>
          ) : (
            <>
              <button type="button" className="ai-btn" onClick={() => onSetOutcome(task.key, "chosen")}>
                Choose
              </button>
              <button type="button" className="ai-btn" onClick={() => onSetOutcome(task.key, "dropped")}>
                Drop
              </button>
            </>
          )}
          <span className="row-actions">
            <button type="button" className="icon-btn" aria-label={`Edit ${task.title}`} onClick={() => setEditing(id)}>
              <PencilIcon />
            </button>
            <button type="button" className="icon-btn" aria-label={`Delete ${task.title}`} onClick={() => onRemove(task, item)}>
              <TrashIcon />
            </button>
          </span>
        </div>
        {(votes.yes.length > 0 || votes.no.length > 0) && (
          <div className="vote-names">
            {votes.yes.length > 0 && <span>👍 {votes.yes.join(", ")}</span>}
            {votes.no.length > 0 && <span>👎 {votes.no.join(", ")}</span>}
          </div>
        )}
      </div>
    );
  };

  const sorted = [...tasks].sort(byDate);
  const open = sorted.filter((t) => !t.outcome);
  const settled = sorted.filter((t) => t.outcome);

  return (
    <>
      <div className="section-head-row">
        <h2 className="section-title">Under consideration</h2>
        <div className="head-actions">
          <button type="button" className="add-btn" onClick={() => setEditing("new-consider")}>
            + Consider
          </button>
        </div>
      </div>
      <p className="section-sub">
        Ideas the group is still weighing — not part of the plan yet. Vote 👍 or 👎, then choose or drop each one.
        Each person gets one vote.
      </p>
      {editing === "new-consider" && (
        <div className="consider">
          <ActionItemEditor
            {...editorProps}
            defaultKind="consider"
            onSave={async (fields) => {
              await onAddItem(fields);
              setEditing(null);
            }}
          />
        </div>
      )}
      {open.length > 0 ? (
        <div className="considerations">{open.map(card)}</div>
      ) : (
        editing !== "new-consider" && <div className="action-items action-items-empty">Nothing under consideration.</div>
      )}
      {settled.length > 0 && (
        <details className="action-completed" open={settledOpen} onToggle={(e) => onSettledOpenChange(e.currentTarget.open)}>
          <summary>Settled ({settled.length})</summary>
          <div className="considerations">{settled.map(card)}</div>
        </details>
      )}
    </>
  );
}
