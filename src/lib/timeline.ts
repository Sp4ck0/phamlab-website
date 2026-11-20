// A day as one ordered list of tiles: what the timeline renders, top to bottom.
//
// The order never depends on a guessed time. Hotels come first ("All day"), then
// transport with no usable time, then the activities in their stored order. A
// transport row with a real departure time on this day is slotted in among the
// activities that have times; nothing else moves. Only-gaps placeholders and the
// tour box close the day.
import type { Change } from "./changeDiff";
import { actWindow, parseTime } from "./calendar";
import type { Span } from "./nowMarker";
import { actParts } from "./tripLogic";
import type { FlightGroup, HotelGroup } from "./tripLogic";
import type { Act, ResolvedDay, Task } from "./types";

/** An activity row as DayCard builds it: its diff state, its real index (-1 for a ghost) and, for a rewrite, the old wording. */
export type ActRow = Change<Act> & { prev?: Act; ai: number };

export type TimelineEntry =
  // `key` is unique within the day and is what open/closed state is stored under;
  // `domKey` is set when the tile gets an element id (a removed ghost has none).
  | { kind: "hotel"; key: string; domKey?: string; change: Change<HotelGroup> }
  | { kind: "transport"; key: string; domKey?: string; time?: string; minutes?: number; change: Change<FlightGroup> }
  | { kind: "activity"; key: string; domKey?: string; time?: string; minutes?: number; row: ActRow }
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
  tour: boolean;
}

export function buildTimeline({ date, hotels, flights, acts, gaps, tour }: TimelineInput): TimelineEntry[] {
  const out: TimelineEntry[] = [];

  // A hotel being left goes first, then the rest, each in data order.
  const leaving = (g: HotelGroup) => g.checkOut && !g.checkIn;
  const ordered = [...hotels.filter((c) => leaving(c.item)), ...hotels.filter((c) => !leaving(c.item))];
  ordered.forEach((change, i) => {
    const gone = change.state === "gone";
    const key = gone ? `gone:hotel:${i}` : change.item.srcs[0];
    out.push({ kind: "hotel", key, domKey: gone ? undefined : key, change });
  });

  const transport = flights.map((change, i): TimelineEntry & { kind: "transport" } => {
    const gone = change.state === "gone";
    const key = gone ? `gone:transport:${i}` : change.item.ids[0];
    const time = departureTime(change.item, date);
    return { kind: "transport", key, domKey: gone ? undefined : key, time, minutes: time ? minutesOf(time) : undefined, change };
  });
  for (const t of transport) if (t.minutes === undefined) out.push(t);
  // Timed transport, earliest first (data order for equal times).
  const timed = transport.filter((t) => t.minutes !== undefined).sort((a, b) => a.minutes! - b.minutes!);

  const actEntries = acts.map((row, i): TimelineEntry & { kind: "activity" } => {
    const gone = row.state === "gone";
    const key = gone ? `gone:act:${i}` : `act:${row.ai}`;
    const { time } = actParts(row.item);
    const clock = parseTime(time);
    return { kind: "activity", key, domKey: gone ? undefined : key, time: time || undefined, minutes: clock ? clock.h * 60 + clock.m : undefined, row };
  });
  const lastTimed = actEntries.reduce((last, e, i) => (e.minutes !== undefined ? i : last), -1);

  // No timed activity to slot between: timed transport closes the transport block.
  if (lastTimed < 0) out.push(...timed);
  actEntries.forEach((e, i) => {
    if (e.minutes !== undefined) {
      // Before the first activity that starts later; an equal time sorts after the activity.
      while (timed.length && timed[0].minutes! < e.minutes) out.push(timed.shift()!);
    }
    out.push(e);
    if (i === lastTimed) out.push(...timed.splice(0));
  });

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
