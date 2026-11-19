// "What's next?" while a trip is under way: the one upcoming departure or check-in,
// so its tile can say "Departs in 2 h 10 min". Times in the data are local to the
// place, and are compared here as wall-clock time in the reader's own zone, which is
// right when you are travelling in that zone and close enough otherwise.
import { flightId } from "./tripLogic";
import type { ResolvedDay } from "./types";
import { hasTime } from "./segments";

export interface NextUp {
  /** A tile owns it when one of its ids matches: a transport row's id, or a hotel entry's `src`. */
  id: string;
  kind: "depart" | "checkin";
  at: string; // "YYYY-MM-DDTHH:MM"
}

const wallMs = (dt: string) => Date.parse(`${dt}:00`);
const isoDay = (ms: number) => {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

/**
 * The next booked departure (its first hop with a clock time) or check-in (with a
 * time) after `now`, or null when the trip is not under way (before its first day
 * or after its last) or nothing with a time is left.
 */
export function nextUp(days: ResolvedDay[], now: number): NextUp | null {
  if (!days.length) return null;
  const today = isoDay(now);
  if (today < days[0].date || today > days[days.length - 1].date) return null;
  let bestMs = Infinity;
  let best: NextUp | null = null;
  const consider = (up: NextUp) => {
    const ms = wallMs(up.at);
    if (ms > now && ms < bestMs) {
      bestMs = ms;
      best = up;
    }
  };
  for (const d of days) {
    for (const f of d.flights) {
      if (f.status !== "booked") continue;
      const first = f.segments?.[0];
      if (first && hasTime(first.depart)) consider({ id: flightId(d.date, f), kind: "depart", at: first.depart });
    }
    for (const h of d.hotels) {
      if (h.carried || h.status !== "booked" || !h.checkIn || !h.checkInTime) continue;
      consider({ id: h.src, kind: "checkin", at: `${d.date}T${h.checkInTime}` });
    }
  }
  return best;
}

/** "Departs in 2 h 10 min", "Check-in in 45 min", "Departs in 2 days". */
export function countdownText(up: NextUp, now: number): string {
  const mins = Math.max(0, Math.round((wallMs(up.at) - now) / 6e4));
  const lead = up.kind === "depart" ? "Departs in" : "Check-in in";
  if (mins < 1) return up.kind === "depart" ? "Departs now" : "Check-in now";
  if (mins < 60) return `${lead} ${mins} min`;
  if (mins < 24 * 60) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${lead} ${h} h${m ? ` ${m} min` : ""}`;
  }
  const days = Math.floor(mins / (24 * 60));
  return `${lead} ${days} ${days === 1 ? "day" : "days"}`;
}
