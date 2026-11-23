import { useState, type ReactNode } from "react";
import type { Group, Outcome, ResolvedDay, Task, Vote } from "../../lib/types";
import type { DayItem } from "../../lib/timeline";
import type { TileMenuItem } from "./TileMenu";
import type { TimelineTileProps } from "./TimelineTile";
import { TransportBody } from "./TransportBody";
import { HotelBody } from "./HotelCard";
import { MODE_EMOJI, TAG_EMOJI, plain } from "../../lib/calendar";
import { fmtShort, gapLabel } from "../../lib/tripLogic";
import { PRIORITY_LABELS, voteTally } from "../../lib/tasks";
import { sanitizeHtml } from "../../lib/sanitizeHtml";
import { serverMessage } from "../../lib/serverError";

export interface ItemTileArgs {
  item: DayItem;
  domId: string;
  time?: string;
  // The day the tile sits on (a day card), or the day its draft is drawn against (the list).
  day?: { day: ResolvedDay; dayNumber: number };
  // A day card: "Add to itinerary" adds it to this day. The list: the reader picks one of `promoteDays`.
  onDay?: string;
  groups: Group[];
  pendingVotes: Record<string, Vote | null>;
  onVote: (itemId: string, vote: Vote | null) => void;
  // A to-do's tick (a proposed item's state is its task's).
  done: boolean;
  // The day an itinerary entry approved from this item is on, if any.
  linkedOn?: string;
  // The trip's days it could be added to (its own day or range, or any day for a whole-trip item).
  promoteDays: string[];
  onToggleActionItem?: (id: string) => void;
  onPromote?: (id: string, date: string) => Promise<unknown>;
  onUnpromote?: (id: string) => Promise<unknown>;
  onSetOutcome?: (key: string, outcome: Outcome | null) => void;
  // The caller's own menu items (maps, links, edit), after the item's.
  menu: TileMenuItem[];
  // Shown in place of the body while the item is being edited.
  editor?: ReactNode;
  // The list shows a single day too (a day card already is that day).
  showDay?: boolean;
}

// Each item an itinerary entry was approved from (`fromItem`), with the first day such an entry is on.
export function linkedItems(days: ResolvedDay[]): Map<string, string> {
  const on = new Map<string, string>();
  for (const day of days) {
    for (const from of [...day.flights.map((f) => f.fromItem), ...day.hotels.map((h) => h.fromItem), ...day.acts.map((a) => (typeof a === "string" ? undefined : a.fromItem))]) {
      if (from && !on.has(from)) on.set(from, day.date);
    }
  }
  return on;
}

export type DescribedItem ={ defaultOpen: boolean; forceOpen?: boolean; tile: Omit<TimelineTileProps, "open" | "onToggle" | "onReveal"> };

// A to-do or proposed item as a tile, the same on a day card and in the Proposed items list.
// A proposed item (kind "consider") is a potential itinerary entry: drawn like the hotel, transport or activity it
// proposes (dashed, as not yet in the plan), voted on with the buttons in its header, and added
// to the itinerary (or dropped) from its body. A to-do is only ever ticked off, from its menu.
export function describeItemTile(a: ItemTileArgs): DescribedItem {
  const { id, task, todo } = a.item;
  const consider = !!task;
  // The header has the title as plain text (it sits in a button); a title with links shows them again in the body.
  const richTitle = sanitizeHtml(task?.title ?? todo?.title ?? "");
  const titleHasLinks = /<a\b/i.test(richTitle);
  const title = plain(richTitle);
  const detail = task?.detail ?? todo?.detail;
  const proposes = task?.proposes ?? todo?.proposes;
  const done = consider ? !!task!.done : a.done;
  const linked = !!a.linkedOn;
  const open = !done && !linked;
  const start = task ? (task.scope.kind === "day" ? task.scope.date : task.scope.kind === "range" ? task.scope.start : undefined) : todo?.date;
  const end = task ? (task.scope.kind === "range" ? task.scope.end : start) : todo?.endDate ?? todo?.date;
  const icon = !proposes ? (consider ? "🗳️" : "☑️")
    : proposes.type === "hotel" ? "🏨"
    : proposes.type === "transport" ? MODE_EMOJI[proposes.entry.mode || "flight"]
    : (proposes.entry.tag && TAG_EMOJI[proposes.entry.tag]) || "📍";
  const what = !proposes ? undefined
    : proposes.type === "hotel" ? `Proposed stay · ${proposes.entry.name}`
    : proposes.type === "transport" ? `Proposed ${proposes.entry.mode || "flight"} · ${proposes.entry.route}`
    : "Proposed activity";
  const range = start && end && end !== start ? `${fmtShort(start)} – ${fmtShort(end)}` : a.showDay && start ? fmtShort(start) : undefined;
  const who = task?.who ?? todo?.who;
  const priority = task?.priority ?? todo?.priority;
  const date = a.day?.day.date;

  const doneItem: TileMenuItem[] = consider || !a.onToggleActionItem ? [] : [{ label: done ? "Mark as not done" : "Mark as done", icon: done ? "uncheck" : "check", onSelect: () => a.onToggleActionItem!(id) }];
  // Settling without adding it, for something that isn't an itinerary entry ("we'll take taxis").
  const chooseItem: TileMenuItem[] =
    consider && !task!.outcome && !linked && a.onSetOutcome ? [{ label: "Mark chosen without adding", icon: "check", onSelect: () => a.onSetOutcome!(task!.key, "chosen") }] : [];

  const draftBody = (() => {
    if (!proposes) return null;
    if (proposes.type === "hotel") {
      const h = proposes.entry;
      if (!a.day) return <div className="activity-text">{h.name}</div>;
      const g = { ...h, who: [h.who].flat(), srcs: [`item:${id}`], statuses: [h.status], carriedAll: false, checkIn: date === start, checkOut: date === end };
      return <HotelBody g={g} status={h.status} stay={null} groups={a.groups} date={a.day.day.date} dayNumber={a.day.dayNumber} actions={false} showName />;
    }
    if (proposes.type === "transport") {
      const f = proposes.entry;
      if (!a.day) return <div className="activity-text">{f.route}</div>;
      const g = { ...f, who: [f.who].flat(), ids: [`item:${id}`], statuses: [f.status] };
      return <TransportBody group={g} groups={a.groups} day={a.day.day} dayNumber={a.day.dayNumber} actions={false} />;
    }
    const act = proposes.entry;
    return (
      <div className="activity-text">
        {act.time && <b>{act.time} </b>}
        <span dangerouslySetInnerHTML={{ __html: sanitizeHtml(act.text) }} />
      </div>
    );
  })();

  const state = consider ? (task!.outcome === "chosen" ? "Chosen" : task!.outcome === "dropped" ? "Dropped" : "Not finalized") : undefined;
  return {
    defaultOpen: open,
    forceOpen: !!a.editor,
    tile: {
      domId: a.domId, time: a.time, icon, title, warn: !consider && open,
      menu: [...doneItem, ...chooseItem, ...a.menu],
      meta: [consider ? undefined : done ? "Done" : "To-do", what, range, who ? gapLabel(who, a.groups, start ?? date ?? "")?.label : undefined, priority ? `${PRIORITY_LABELS[priority]} priority` : undefined].filter(Boolean).join(" · "),
      className: `tl-item${consider ? " tl-consider" : ""}${done ? " is-done" : ""}`,
      headerEnd: consider ? (
        <span className="tl-consider-head">
          <span className="consider-pill" data-outcome={task!.outcome}>{state}</span>
          <VoteButtons id={id} title={title} task={task!} pending={a.pendingVotes[id]} onVote={a.onVote} />
        </span>
      ) : undefined,
      children: a.editor ?? (
        <>
          {(titleHasLinks || detail) && (
            <div className="action-text">
              {titleHasLinks && <div dangerouslySetInnerHTML={{ __html: richTitle }} />}
              {detail && <div className="cmeta" dangerouslySetInnerHTML={{ __html: sanitizeHtml(detail) }} />}
            </div>
          )}
          {draftBody && (
            <div className="tl-proposal">
              <span className="tl-proposal-label">Proposed</span>
              {draftBody}
            </div>
          )}
          {consider ? (
            <ConsiderActions
              id={id}
              task={task!}
              pending={a.pendingVotes[id]}
              linkedOn={a.linkedOn}
              days={a.onDay ? [a.onDay] : a.promoteDays}
              hotel={proposes?.type === "hotel"}
              onPromote={a.onPromote}
              onUnpromote={a.onUnpromote}
              onSetOutcome={a.onSetOutcome}
            />
          ) : (
            linked && <p className="cmeta tl-linked">In the itinerary.</p>
          )}
        </>
      ),
    },
  };
}

// 👍 / 👎 in a proposed item's header: a tap votes, a second tap takes it back. Voting is over once it is settled.
export function VoteButtons({ id, title, task, pending, onVote }: { id: string; title: string; task: Task; pending: Vote | null | undefined; onVote: (itemId: string, vote: Vote | null) => void }) {
  const { mine, yes, no } = voteTally(task, pending);
  const over = !!task.outcome;
  const pick = (v: Vote) => onVote(id, mine === v ? null : v);
  return (
    <span className="vote-bar tl-votes" role="group" aria-label={`Vote on ${title}`}>
      <button type="button" className="vote-btn" data-vote="yes" aria-pressed={mine === "yes"} disabled={over} aria-label={`${mine === "yes" ? "Take back my yes vote" : "Vote yes"} (${yes} yes)`} onClick={() => pick("yes")}>
        👍 <b>{yes}</b>
      </button>
      <button type="button" className="vote-btn" data-vote="no" aria-pressed={mine === "no"} disabled={over} aria-label={`${mine === "no" ? "Take back my no vote" : "Vote no"} (${no} no)`} onClick={() => pick("no")}>
        👎 <b>{no}</b>
      </button>
    </span>
  );
}

// The body's actions: who voted, then add to the itinerary (on which day, when it could be several) or
// drop it; once added, where it is and how to take it back out; once dropped, reopen it.
function ConsiderActions({ id, task, pending, linkedOn, days, hotel, onPromote, onUnpromote, onSetOutcome }: {
  id: string;
  task: Task;
  pending: Vote | null | undefined;
  linkedOn?: string;
  days: string[];
  hotel: boolean;
  onPromote?: (id: string, date: string) => Promise<unknown>;
  onUnpromote?: (id: string) => Promise<unknown>;
  onSetOutcome?: (key: string, outcome: Outcome | null) => void;
}) {
  const [day, setDay] = useState(days[0] ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const { votes } = voteTally(task, pending);
  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    setMsg("");
    try {
      await fn();
      setMsg(ok);
    } catch (e) {
      setMsg(serverMessage(e, "Couldn't do that — try again."));
    } finally {
      setBusy(false);
    }
  };
  const pickDay = days.includes(day) ? day : days[0];
  const canAdd = !!onPromote && !linkedOn && task.outcome !== "dropped" && (hotel || !!pickDay);
  return (
    <>
      {(votes.yes.length > 0 || votes.no.length > 0) && (
        <div className="vote-names">
          {votes.yes.length > 0 && <span>👍 {votes.yes.join(", ")}</span>}
          {votes.no.length > 0 && <span>👎 {votes.no.join(", ")}</span>}
        </div>
      )}
      <div className="consider-actions">
        {linkedOn && <span className="cmeta tl-linked">In the itinerary on {fmtShort(linkedOn)}.</span>}
        {canAdd && !hotel && days.length > 1 && (
          <select className="due-input" aria-label="Day to add it to" value={pickDay} onChange={(e) => setDay(e.target.value)}>
            {days.map((d) => <option key={d} value={d}>{fmtShort(d)}</option>)}
          </select>
        )}
        {canAdd && (
          <button type="button" className="ai-btn ai-btn-primary" disabled={busy} onClick={() => run(() => onPromote!(id, hotel ? days[0] ?? "" : pickDay!), "Added to the itinerary")}>
            {hotel ? "Add stay to itinerary" : days.length === 1 ? `Add to itinerary · ${fmtShort(pickDay!)}` : "Add to itinerary"}
          </button>
        )}
        {linkedOn && onUnpromote && (
          <button type="button" className="ai-btn" disabled={busy} onClick={() => run(() => onUnpromote(id), "Back to proposed items")}>
            Back to proposed
          </button>
        )}
        {!task.outcome && !linkedOn && onSetOutcome && (
          <button type="button" className="ai-btn" disabled={busy} onClick={() => onSetOutcome(task.key, "dropped")}>
            Drop
          </button>
        )}
        {task.outcome && !linkedOn && onSetOutcome && (
          <button type="button" className="ai-btn" disabled={busy} onClick={() => onSetOutcome(task.key, null)}>
            Reopen
          </button>
        )}
        <span className="cmeta consider-status" role="status">{msg}</span>
      </div>
    </>
  );
}
