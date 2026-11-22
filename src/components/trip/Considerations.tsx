import { useState } from "react";
import { useParams } from "react-router-dom";
import type { ActionItem, Group, Outcome, ResolvedDay, Task, Vote } from "../../lib/types";
import { priorityRank, scopeStart } from "../../lib/tasks";
import { googleMapsUrl } from "../../lib/mapPoints";
import { copyShareLink } from "../../lib/shareLink";
import type { ActionItemFields } from "../../hooks/useActionItemEdits";
import { ActionItemEditor } from "./ActionItemEditor";
import { TimelineTile } from "./TimelineTile";
import { describeItemTile, linkedItems } from "./itemTile";

interface Props {
  // Only the consider tasks.
  tasks: Task[];
  items: ActionItem[];
  groups: Group[];
  // The trip's days: the days an idea can be added to, and where an added one is.
  days: ResolvedDay[];
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
  onPromote?: (id: string, date: string) => Promise<unknown>;
  onUnpromote?: (id: string) => Promise<unknown>;
  settledOpen: boolean;
  onSettledOpenChange: (open: boolean) => void;
}

const itemId = (task: Task) => task.key.slice("item:".length);

// High priority first; then soonest first, whole-trip candidates last.
function byDate(a: Task, b: Task) {
  const byPriority = priorityRank(a.priority) - priorityRank(b.priority);
  if (byPriority) return byPriority;
  const x = scopeStart(a.scope);
  const y = scopeStart(b.scope);
  if (x && y) return x.localeCompare(y) || a.title.localeCompare(b.title);
  if (x) return -1;
  if (y) return 1;
  return a.title.localeCompare(b.title);
}

// The days an idea can be added to: its own day or range, or any day for a whole-trip idea.
function promoteDays(task: Task, days: ResolvedDay[]) {
  const s = task.scope;
  return days
    .map((d) => d.date)
    .filter((date) => (s.kind === "trip" ? true : s.kind === "day" ? date === s.date : date >= s.start && date <= s.end));
}

// Ideas the group is still weighing, each drawn as the tile it would become on its day (itemTile.tsx):
// dashed, voted on in its header, added to the itinerary or dropped from its body. Settled ones fold away.
export function Considerations({
  tasks,
  items,
  groups,
  days,
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
  onPromote,
  onUnpromote,
  settledOpen,
  onSettledOpenChange,
}: Props) {
  const { slug } = useParams<{ slug: string }>();
  const [opened, setOpened] = useState<Record<string, boolean>>({});
  const editorProps = { groups, minDate: tripStart, maxDate: tripEnd, onCancel: () => setEditing(null) };
  const linkedOn = linkedItems(days);

  const tile = (task: Task) => {
    const id = itemId(task);
    const item = items.find((i) => i.id === id);
    if (!item) return null;
    const start = scopeStart(task.scope);
    const at = Math.max(0, start ? days.findIndex((d) => d.date === start) : 0);
    const place = task.places?.[0];
    const x = describeItemTile({
      item: { id, task },
      domId: `ai-row-${id}`,
      time: task.time,
      day: days[at] ? { day: days[at], dayNumber: at } : undefined,
      groups,
      pendingVotes,
      onVote,
      done: !!task.done,
      linkedOn: linkedOn.get(id),
      promoteDays: promoteDays(task, days),
      onPromote,
      onUnpromote,
      onSetOutcome,
      showDay: true,
      menu: [
        { label: "Edit", icon: "edit", onSelect: () => setEditing(id) },
        ...(place?.name ? [{ label: "Open in Google Maps", icon: "pin" as const, href: googleMapsUrl(place) }] : []),
        { label: "Copy link", icon: "link", onSelect: () => copyShareLink(slug, { task: task.key }) },
        { label: "Delete", onSelect: () => onRemove(task, item) },
      ],
      editor:
        editing === id ? (
          <ActionItemEditor
            {...editorProps}
            initial={item}
            onSave={async (fields) => {
              await onUpdateItem(id, fields);
              setEditing(null);
            }}
          />
        ) : undefined,
    });
    const open = !!x.forceOpen || (opened[id] ?? x.defaultOpen);
    return (
      <TimelineTile
        key={task.key}
        {...x.tile}
        open={open}
        onToggle={() => setOpened((o) => ({ ...o, [id]: !open }))}
        onReveal={() => setOpened((o) => ({ ...o, [id]: true }))}
      />
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
        Possible additions to the itinerary. Vote 👍 or 👎 (one vote each), then add the winner to the itinerary or drop it.
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
        <ol className="tl considerations">{open.map(tile)}</ol>
      ) : (
        editing !== "new-consider" && <div className="action-items action-items-empty">Nothing under consideration.</div>
      )}
      {settled.length > 0 && (
        <details className="action-completed" open={settledOpen} onToggle={(e) => onSettledOpenChange(e.currentTarget.open)}>
          <summary>Settled ({settled.length})</summary>
          <ol className="tl considerations">{settled.map(tile)}</ol>
        </details>
      )}
    </>
  );
}
