// Pure helpers for structured transport segments (types.ts Segment). Times are
// stored as local wall-clock "YYYY-MM-DDTHH:MM" at each end, so durations are
// derived here from the two airports' zones instead of being typed in.
import { airportZone, localToUtcMs } from "./calendar";
import type { Segment } from "./types";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const dateOf = (dt: string) => dt.split("T")[0];
const wallMs = (dt: string) => Date.parse(`${dt}:00Z`); // wall-clock as if UTC; only for same-zone diffs

/**
 * Minutes in the air/on the move: from both airports' zones when known, else (for
 * a ferry, train or bus, which starts and ends in one place) the wall-clock gap,
 * else the stated `durationMin`.
 */
export function durationMin(s: Segment): number | null {
  if (s.depart && s.arrive) {
    const dz = airportZone(s.from);
    const az = airportZone(s.to);
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
  if (!prev.arrive || !next.depart || prev.to !== next.from) return null;
  const mins = Math.round((wallMs(next.depart) - wallMs(prev.arrive)) / 60000);
  return mins >= 0 ? mins : null;
}

/** Calendar days between departing and arriving, in local dates ("+1" for an overnight flight). */
export function dayOffset(s: Segment): number {
  if (!s.depart || !s.arrive) return 0;
  return Math.round((Date.parse(dateOf(s.arrive)) - Date.parse(dateOf(s.depart))) / 864e5);
}

/** "12:10 AM" from "2026-11-04T00:10". */
export function fmtClock(dt: string): string {
  const [h, m] = dt.split("T")[1].split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

/** "3:00 PM" from a bare local "15:00" (a hotel's check-in/out time). */
export function fmtHm(hm: string): string {
  const [h, m] = hm.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

/** "Wed, Nov 4" from "2026-11-04" or a datetime. */
export function fmtDate(dt: string): string {
  const d = new Date(`${dateOf(dt)}T00:00:00Z`);
  return `${DAYS[d.getUTCDay()]}, ${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

/** "13h 10m", "3h", "45m". */
export function fmtDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return [h ? `${h}h` : "", m || !h ? `${m}m` : ""].filter(Boolean).join(" ");
}

/** One printable line: "CI 21 · SEA 12:10 AM → TPE 5:20 AM +1 · 13h 10m · Airbus A350". */
export function segmentLine(s: Segment): string {
  const plus = dayOffset(s);
  const mins = durationMin(s);
  const ends = [
    `${s.from}${s.depart ? ` ${fmtClock(s.depart)}` : ""}`,
    `${s.to}${s.arrive ? ` ${fmtClock(s.arrive)}${plus > 0 ? ` +${plus}` : ""}` : ""}`,
  ].join(" → ");
  return [segmentLabel(s), ends, mins ? fmtDuration(mins) : "", s.aircraft, s.cabin].filter(Boolean).join(" · ");
}

/** "CI 21", or the operator's name when there is no flight number. */
export function segmentLabel(s: Segment): string {
  return s.airline && s.number ? `${s.airline} ${s.number}` : s.carrier ?? "";
}
