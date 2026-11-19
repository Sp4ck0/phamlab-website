// What a tile is still missing, worked out from its own fields; "to be decided"
// is never typed into the data. missingTransportFields mirrors the backend's rule
// in convex/travel/rules.ts (which also drives the "Missing details" tasks), so
// change both together; the table in tbd.test.mjs is the same on both sides.
import type { Segment, TransportMode } from "./types";

const hasTime = (dt: string | undefined) => !!dt && dt.includes("T");

/**
 * What a transport tile still lacks. Each hop needs its two places and both
 * clock times (a day alone is not a time); a flight hop also its airline and
 * flight number, a ferry, train or bus hop its operator (the number is optional).
 * A tile with no segments lacks its route details. A confirmation is never required.
 */
export function missingTransportFields(f: { mode?: TransportMode; segments?: Segment[] }): string[] {
  if (!f.segments?.length) return ["route details"];
  const out = new Set<string>();
  for (const s of f.segments) {
    if (!s.from) out.add("origin");
    if (!s.to) out.add("destination");
    if ((s.mode ?? f.mode ?? "flight") === "flight") {
      if (!s.airline) out.add("airline");
      if (!s.number) out.add("flight number");
    } else if (!s.carrier) {
      out.add("operator");
    }
    if (!hasTime(s.depart)) out.add("depart time");
    if (!hasTime(s.arrive)) out.add("arrive time");
  }
  return [...out];
}

/** A not-booked hotel with no address or place id has not been chosen yet. */
export function missingHotelFields(h: { address?: string; placeId?: string }): string[] {
  return !h.address && !h.placeId ? ["hotel"] : [];
}
