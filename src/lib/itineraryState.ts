import type { ResolvedDay } from "./types";

export interface ItineraryRow {
  id: string;
  day: ResolvedDay;
}

// Compare complete JSON-shaped query values in memory, including resolved Dates.
// No content-derived identifiers or fingerprints leave the active route.
function equal(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (!a || !b || typeof a !== "object" || typeof b !== "object") return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const left = a as Record<string, unknown>, right = b as Record<string, unknown>;
  const keys = Object.keys(left);
  return keys.length === Object.keys(right).length && keys.every(k => Object.hasOwn(right, k) && equal(left[k], right[k]));
}

export function reconcileRows(previous: ItineraryRow[], days: ResolvedDay[], allocate: () => string): ItineraryRow[] {
  if (previous.length === days.length && days.every((d, i) => equal(d, previous[i].day))) {
    return days.map((day, i) => ({ id: previous[i].id, day }));
  }
  return days.map(day => {
    const before = previous.filter(row => row.day.date === day.date);
    const after = days.filter(d => d.date === day.date);
    if (before.length === 1 && after.length === 1) return { id: before[0].id, day };
    const matches = before.filter(row => equal(row.day, day));
    if (matches.length === 1 && after.filter(d => equal(d, day)).length === 1) return { id: matches[0].id, day };
    return { id: allocate(), day };
  });
}
