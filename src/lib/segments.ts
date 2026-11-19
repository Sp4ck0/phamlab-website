// Pure helpers for structured transport segments (types.ts Segment). Times are
// stored as local wall-clock "YYYY-MM-DDTHH:MM" at each end, so durations are
// derived here from the two airports' zones instead of being typed in. A hop may
// be only partly planned: a day with no time ("YYYY-MM-DD"), a flexible window,
// or a place not decided yet (unset from/to).
import { airportZone, localToUtcMs } from "./calendar";
import type { Segment } from "./types";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const dateOf = (dt: string) => dt.split("T")[0];
const wallMs = (dt: string) => Date.parse(`${dt}:00Z`); // wall-clock as if UTC; only for same-zone diffs

/** "2027-02-10T10:20" has a time; "2027-02-10" is only a day. */
export const hasTime = (dt: string | undefined): dt is string => !!dt && dt.includes("T");

/**
 * Minutes in the air/on the move: from both airports' zones when known, else (for
 * a ferry, train or bus, which starts and ends in one place) the wall-clock gap,
 * else the stated `durationMin`. Needs both clock times.
 */
export function durationMin(s: Segment): number | null {
  if (hasTime(s.depart) && hasTime(s.arrive)) {
    const dz = s.from ? airportZone(s.from) : null;
    const az = s.to ? airportZone(s.to) : null;
    if (dz && az) {
      const mins = Math.round((localToUtcMs(s.arrive, az) - localToUtcMs(s.depart, dz)) / 60000);
      if (mins > 0) return mins;
    } else if (s.mode && s.mode !== "flight") {
      const mins = Math.round((wallMs(s.arrive) - wallMs(s.depart)) / 60000);
      if (mins > 0) return mins;
    }
  }
  return s.durationMin ?? null;
}

/** Wait between two hops at the same place, else null. Same place means same zone, so wall-clock is enough. */
export function layoverMin(prev: Segment, next: Segment): number | null {
  if (!prev.to || prev.to !== next.from || !hasTime(prev.arrive) || !hasTime(next.depart)) return null;
  const mins = Math.round((wallMs(next.depart) - wallMs(prev.arrive)) / 60000);
  return mins >= 0 ? mins : null;
}

/** Calendar days between departing and arriving, in local dates ("+1" for an overnight flight). */
export function dayOffset(s: Segment): number {
  if (!s.depart || !s.arrive) return 0;
  return Math.round((Date.parse(dateOf(s.arrive)) - Date.parse(dateOf(s.depart))) / 864e5);
}

/** "00:10" (24-hour, zero-padded) from "2026-11-04T00:10". */
export function fmtClock(dt: string): string {
  return fmtHm(dt.split("T")[1]);
}

/** "15:00" (24-hour, zero-padded) from a bare local "15:00" (a hotel's check-in/out time). */
export function fmtHm(hm: string): string {
  const [h, m] = hm.split(":").map(Number);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** "Wed, Nov 4" from "2026-11-04" or a datetime. */
export function fmtDate(dt: string): string {
  const d = new Date(`${dateOf(dt)}T00:00:00Z`);
  return `${DAYS[d.getUTCDay()]}, ${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

/** "Feb 10–12" within a month, "Feb 28 – Mar 2" across two, for a hop that can happen on any day in the range. */
export function fmtWindow(w: { from: string; to: string }): string {
  const a = new Date(`${w.from}T00:00:00Z`);
  const b = new Date(`${w.to}T00:00:00Z`);
  const left = `${MONTHS[a.getUTCMonth()]} ${a.getUTCDate()}`;
  if (w.from === w.to) return left;
  return a.getUTCMonth() === b.getUTCMonth() ? `${left}–${b.getUTCDate()}` : `${left} – ${MONTHS[b.getUTCMonth()]} ${b.getUTCDate()}`;
}

/** "13h 10m", "3h", "45m". */
export function fmtDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return [h ? `${h}h` : "", m || !h ? `${m}m` : ""].filter(Boolean).join(" ");
}

/** One printable line: "CI 21 · SEA 00:10 → TPE 05:20 +1 · 13h 10m · Airbus A350". */
export function segmentLine(s: Segment): string {
  const plus = dayOffset(s);
  const mins = durationMin(s);
  // A time when there is one, else the day ("Wed, Feb 10") or the flexible window ("Feb 10–12").
  const when = (dt: string | undefined, plusDays = 0) =>
    hasTime(dt) ? ` ${fmtClock(dt)}${plusDays > 0 ? ` +${plusDays}` : ""}` : dt ? ` ${fmtDate(dt)}` : "";
  const ends = [
    `${s.from ?? "?"}${when(s.depart)}`,
    `${s.to ?? "?"}${when(s.arrive, plus)}`,
  ].join(" → ");
  return [segmentLabel(s), ends, !s.depart && s.window ? `any day ${fmtWindow(s.window)}` : "", mins ? fmtDuration(mins) : "", s.aircraft, s.cabin]
    .filter(Boolean)
    .join(" · ");
}

/** "CI 21", or the operator's name when there is no flight number. */
export function segmentLabel(s: Segment): string {
  return s.airline && s.number ? `${s.airline} ${s.number}` : s.carrier ?? "";
}

// A place in route text that is really a placeholder ("next destination TBD").
const PLACEHOLDER = /\b(?:TBD|TBC|next destination)\b/i;

/**
 * The places named in a route, in order: "A → B → C" (also "->", "–", "—"), or an
 * IATA chain written with hyphens ("SPU-ZAG-DBV"). A placeholder ("next destination
 * TBD") comes back as undefined, so it shows as "not decided" instead of as text.
 * Anything it can't read comes back empty.
 */
export function routePlaces(route: string): (string | undefined)[] {
  const base = route.replace(/\s+via\s+.*$/i, "").replace(/\s*·.*$/, "").trim();
  let parts = base.split(/\s*(?:→|->|–|—)\s*/).map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) {
    const chain = base.split("-").map((p) => p.trim());
    parts = chain.length >= 2 && chain.every((p) => /^[A-Z]{3}$/.test(p)) ? chain : [];
  }
  return parts.map((p) => (PLACEHOLDER.test(p) ? undefined : p));
}

/**
 * Blank hops for a transport row that has no segments, built from its route, so
 * every row draws the same structured tile (places known, times still empty). A
 * route that can't be read gives one hop with no places.
 */
export function derivedSegments(route: string): Segment[] {
  const places = routePlaces(route);
  if (places.length < 2) return [{}];
  return places.slice(1).map((to, i) => ({ from: places[i], to }));
}
