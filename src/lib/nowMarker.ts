// "Now" on a day card, in the destination's time zone (not the viewer's): which
// day is today there, and where the current time falls among that day's timed
// activities. Activity times are local to the day's city, and each day's zone
// comes from the same lookup the calendar links use.
import { actWindow, zoneFor, zoneNow } from "./calendar";
import { todayISO } from "./dueDates";
import type { ResolvedDay } from "./types";

/** The marker that sits at the left end of the now line. */
export const NOW_EMOJI = "👉";

// Positions are named by tile key (lib/timeline.ts: `act:<index>` for an activity, a
// booking id for transport), so the line can sit between any two timed tiles.
export type NowPosition =
  | { kind: "during"; key: string; hhmm: string; progress: number } // progress: 0..1 through the tile's time
  | { kind: "untimed"; hhmm: string } // nothing timed to place it among
  | { kind: "before" | "between"; beforeKey: string; hhmm: string; next: { hhmm: string; inMin: number } }
  | { kind: "after"; afterKey: string; hhmm: string };

/** A timed tile: minutes since midnight, local to the day. `end === start` is a moment, never "during". */
export interface Span { key: string; start: number; end: number }

type DayLike = Pick<ResolvedDay, "date" | "city" | "country" | "acts">;

export const dayZone = (d: Pick<ResolvedDay, "city" | "country">) => zoneFor(d.city, d.country);

/** Is `d` today where it is? Falls back to the viewer's date when the day's zone is unknown. */
export function isDestToday(d: Pick<ResolvedDay, "date" | "city" | "country">, now: number): boolean {
  const zone = dayZone(d);
  return (zone ? zoneNow(now, zone).date : todayISO(new Date(now))) === d.date;
}

const hm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

/** The day's timed activities as spans (an activity's length comes from actWindow). */
export function actSpans(d: Pick<ResolvedDay, "acts">): Span[] {
  return d.acts.flatMap((a, index) => {
    const w = actWindow(a, d, index);
    if (!w) return [];
    const start = w.start.h * 60 + w.start.m;
    return [{ key: `act:${index}`, start, end: w.end ? w.end.h * 60 + w.end.m : start + w.minutes }];
  });
}

/** Where "now" falls among the day's timed tiles (its activities, unless `spans` says otherwise); null when the day's zone is unknown. */
export function nowPosition(d: DayLike, now: number, spans: Span[] = actSpans(d)): NowPosition | null {
  const zone = dayZone(d);
  if (!zone) return null;
  const t = zoneNow(now, zone);
  const timed = [...spans].sort((a, b) => a.start - b.start);
  if (!timed.length) return { kind: "untimed", hhmm: t.hhmm };
  const upcoming = (i: number) => ({ beforeKey: timed[i].key, hhmm: t.hhmm, next: { hhmm: hm(timed[i].start), inMin: timed[i].start - t.minutes } });
  if (t.minutes < timed[0].start) return { kind: "before", ...upcoming(0) };
  for (let i = 0; i < timed.length; i++) {
    const s = timed[i];
    if (t.minutes >= s.start && t.minutes < s.end) return { kind: "during", key: s.key, hhmm: t.hhmm, progress: (t.minutes - s.start) / (s.end - s.start) };
    const nxt = timed[i + 1];
    if (nxt && t.minutes >= Math.max(s.end, s.start) && t.minutes < nxt.start) return { kind: "between", ...upcoming(i + 1) };
  }
  return { kind: "after", afterKey: timed[timed.length - 1].key, hhmm: t.hhmm };
}

/** The viewer's own clock ("11:32 pm") when it differs from the destination's, else null. */
export function viewerHint(now: number, zone: string | null): string | null {
  if (!zone) return null;
  const mine = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (mine === zone) return null;
  const there = zoneNow(now, zone);
  const here = zoneNow(now, mine);
  if (there.date === here.date && there.minutes === here.minutes) return null;
  return new Date(now).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }).toLowerCase();
}

/** "1h 50m", "28m". */
export function untilText(min: number): string {
  const h = Math.floor(min / 60);
  return h ? `${h}h${min % 60 ? ` ${min % 60}m` : ""}` : `${min}m`;
}
