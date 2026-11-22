// A day as one ordered list of tiles: what the timeline renders, top to bottom.
//
// The order never depends on a guessed time. Hotels come first ("All day"), then
// all-day activities, then
// transport with no usable time, then the activities in their stored order. A
// transport row with a real departure time on this day is slotted in among the
// activities that have times; nothing else moves. Only-gaps placeholders and the
// tour box close the day. To-dos and considerations that cover the day follow the
// same rule as transport: one with a time is slotted among the timed activities, one
// without goes after the activities.
import type { Change } from "./changeDiff";
import { actWindow, parseTime } from "./calendar";
import type { Span } from "./nowMarker";
import { actParts } from "./tripLogic";
import type { FlightGroup, HotelGroup } from "./tripLogic";
import type { Act, ActionItem, ResolvedDay, Task } from "./types";

/** An activity row as DayCard builds it: its diff state, its real index (-1 for a ghost) and, for a rewrite, the old wording. */
export type ActRow = Change<Act> & { prev?: Act; ai: number };

/** An action item on a day: a to-do (`todo`) or a consideration (`task`). `time` only counts on its own first day. */
export interface DayItem {
  id: string;
  time?: string;
  task?: Task;
  todo?: ActionItem;
}

export type TimelineEntry =
  // `key` is unique within the day and is what open/closed state is stored under;
  // `domKey` is set when the tile gets an element id (a removed ghost has none).
  | { kind: "hotel"; key: string; domKey?: string; change: Change<HotelGroup> }
  | { kind: "transport"; key: string; domKey?: string; time?: string; minutes?: number; change: Change<FlightGroup> }
  | { kind: "activity"; key: string; domKey?: string; time?: string; minutes?: number; row: ActRow }
  | { kind: "item"; key: string; domKey: string; time?: string; minutes?: number; item: DayItem }
  | { kind: "plan"; key: "plan" }
  | { kind: "gap"; key: string; task: Task }
  | { kind: "tour"; key: "tour" };

const DEPARTS = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/;

/** The first hop's departure as "HH:MM", only when it has a time and falls on `date`. Free text (legacy legs) never counts. */
export function departureTime(g: Pick<FlightGroup, "segments">, date: string): string | undefined {
  const hit = DEPARTS.exec(g.segments?.[0]?.depart ?? "");
  return hit && hit[1] === date ? `${hit[2]}:${hit[3]}` : undefined;
}

const minutesOf = (hhmm: string) => +hhmm.slice(0, 2) * 60 + +hhmm.slice(3, 5);

export interface TimelineInput {
  date: string;
  hotels: Change<HotelGroup>[];
  flights: Change<FlightGroup>[];
  acts: ActRow[];
  /** Only gaps: transport still to be entered, as placeholder tiles. */
  gaps: Task[];
  /** To-dos and considerations that cover this day. */
  items?: DayItem[];
  /** Nothing is planned for the day yet: a placeholder tile where the activities would be. */
  plan?: boolean;
  tour: boolean;
}

export function buildTimeline({ date, hotels, flights, acts, gaps, tour, items = [], plan = false }: TimelineInput): TimelineEntry[] {
  const out: TimelineEntry[] = [];

  // A hotel being left goes first, then the rest, each in data order.
  const leaving = (g: HotelGroup) => g.checkOut && !g.checkIn;
  const ordered = [...hotels.filter((c) => leaving(c.item)), ...hotels.filter((c) => !leaving(c.item))];
  ordered.forEach((change, i) => {
    const gone = change.state === "gone";
    const key = gone ? `gone:hotel:${i}` : change.item.srcs[0];
    out.push({ kind: "hotel", key, domKey: gone ? undefined : key, change });
  });

  const actEntries = acts.map((row, i): TimelineEntry & { kind: "activity" } => {
    const gone = row.state === "gone";
    const key = gone ? `gone:act:${i}` : `act:${row.ai}`;
    const { time } = actParts(row.item);
    const clock = parseTime(time);
    return { kind: "activity", key, domKey: gone ? undefined : key, time: time || undefined, minutes: clock ? clock.h * 60 + clock.m : undefined, row };
  });
  // All-day activities take the whole day, like a hotel: right after the hotels, in data order.
  const wholeDay = (e: TimelineEntry & { kind: "activity" }) => typeof e.row.item !== "string" && !!e.row.item.allDay;
  out.push(...actEntries.filter(wholeDay));
  const dayActs = actEntries.filter((e) => !wholeDay(e));

  const transport = flights.map((change, i): TimelineEntry & { kind: "transport" } => {
    const gone = change.state === "gone";
    const key = gone ? `gone:transport:${i}` : change.item.ids[0];
    const time = departureTime(change.item, date);
    return { kind: "transport", key, domKey: gone ? undefined : key, time, minutes: time ? minutesOf(time) : undefined, change };
  });
  for (const t of transport) if (t.minutes === undefined) out.push(t);
  const itemEntries = items.map((item): TimelineEntry & { kind: "item" } => {
    const clock = parseTime(item.time);
    const key = `item:${item.id}`;
    return { kind: "item", key, domKey: key, time: clock ? item.time : undefined, minutes: clock ? clock.h * 60 + clock.m : undefined, item };
  });
  // Timed transport and items, earliest first (transport first, then data order, for equal times).
  type Timed = (TimelineEntry & { kind: "transport" }) | (TimelineEntry & { kind: "item" });
  const timed: Timed[] = [...transport, ...itemEntries].filter((t) => t.minutes !== undefined).sort((a, b) => a.minutes! - b.minutes!);

  const lastTimed = dayActs.reduce((last, e, i) => (e.minutes !== undefined ? i : last), -1);

  // No timed activity to slot between: timed transport closes the transport block (timed items wait for the activities).
  if (lastTimed < 0) {
    out.push(...timed.filter((t) => t.kind === "transport"));
    timed.splice(0, timed.length, ...timed.filter((t) => t.kind === "item"));
  }
  dayActs.forEach((e, i) => {
    if (e.minutes !== undefined) {
      // Before the first activity that starts later; an equal time sorts after the activity.
      while (timed.length && timed[0].minutes! < e.minutes) out.push(timed.shift()!);
    }
    out.push(e);
    if (i === lastTimed) out.push(...timed.splice(0));
  });

  if (plan) out.push({ kind: "plan", key: "plan" });
  out.push(...timed.splice(0));
  for (const e of itemEntries) if (e.minutes === undefined) out.push(e);
  for (const task of gaps) out.push({ kind: "gap", key: `gap:${task.key}`, task });
  if (tour) out.push({ kind: "tour", key: "tour" });
  return out;
}

const ARRIVES = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/;

// The timed tiles of a day as spans, for placing "now" among them. An activity lasts as
// actWindow says. Transport runs from its departure to the last hop's arrival that day
// (to the end of the day when it lands on a later one; a moment when no arrival is known).
// Ghosts and untimed tiles are left out.
export function timelineSpans(entries: TimelineEntry[], day: Pick<ResolvedDay, "date" | "acts">): Span[] {
  const out: Span[] = [];
  for (const e of entries) {
    if (e.kind === "activity" && e.domKey && e.minutes !== undefined) {
      const w = actWindow(e.row.item, day, e.row.ai);
      if (w) out.push({ key: e.key, start: e.minutes, end: w.end ? w.end.h * 60 + w.end.m : e.minutes + w.minutes });
    } else if (e.kind === "transport" && e.domKey && e.minutes !== undefined) {
      const segs = e.change.item.segments ?? [];
      const hit = ARRIVES.exec(segs[segs.length - 1]?.arrive ?? "");
      const end = !hit ? e.minutes : hit[1] === day.date ? +hit[2] * 60 + +hit[3] : hit[1] > day.date ? 24 * 60 : e.minutes;
      out.push({ key: e.key, start: e.minutes, end: Math.max(end, e.minutes) });
    }
  }
  return out;
}
