// What a timeline tile's header says while the tile is closed, per kind of tile.
// Pure, so the components that draw the tiles stay components only.
import { AIRLINES } from "./airlines";
import { MODE_EMOJI } from "./calendar";
import { derivedSegments, fmtHm, segmentLabel } from "./segments";
import type { StayInfo } from "./stay";
import type { FlightGroup, HotelGroup } from "./tripLogic";

// A placeholder name ("TBD — Oslo hotel", or none) is not a place: show it as "Hotel to be decided" (the stored name is untouched).
export const isPlaceholderHotel = (g: HotelGroup) => !g.name || /^TBD\b/i.test(g.name);

// What a hotel's timeline header says while the tile is closed: the name, and which
// part of the stay this day is (with the time when it is known).
export function hotelHeader(g: HotelGroup, stay: StayInfo | null): { title: string; meta: string } {
  const parts: string[] = [];
  if (isPlaceholderHotel(g) && g.area) parts.push(g.area);
  if (g.checkIn) parts.push(g.checkInTime ? `Check-in ${fmtHm(g.checkInTime)}` : "Check-in");
  if (g.checkOut && !g.checkIn) parts.push(g.checkOutTime ? `Check-out ${fmtHm(g.checkOutTime)}` : "Check-out");
  if (!g.checkIn && !g.checkOut && stay) parts.push(`Night ${stay.night} of ${stay.nights}`);
  if (g.checkIn && stay) parts.push(`${stay.nights} ${stay.nights === 1 ? "night" : "nights"}`);
  return { title: isPlaceholderHotel(g) ? "Hotel to be decided" : g.name, meta: parts.join(" · ") };
}

// A transport row's hops: its segments, blank ones built from the route, or legacy legs.
export const segmentsOf = (group: FlightGroup) => {
  const legs = group.segments?.length ? [] : group.legs || [];
  // Every transport row draws this one tile. A row with no segments yet gets blank
  // hops built from its route (places known, times empty), so nothing falls back to
  // a plain text card; legacy `legs` keep their own rows.
  const derived = !group.segments?.length && !legs.length;
  const segments = group.segments?.length ? group.segments : derived ? derivedSegments(group.route) : [];
  return { legs, derived, segments };
};

// What a transport tile's timeline header says while it is closed: the mode's icon,
// the title (or route), and the first hop's carrier and number, with the route again
// when a title took its place and the number of legs when there are several.
export function transportHeader(group: FlightGroup): { icon: string; title: string; meta: string } {
  const { legs, segments } = segmentsOf(group);
  const first = segments[0];
  const named = first && ((first.airline && AIRLINES[first.airline]?.name) || first.carrier || first.airline || "");
  const label = first ? (first.airline ? segmentLabel(first) : first.number ?? "") : "";
  const parts = [
    [named, label && label !== named ? label : ""].filter(Boolean).join(" · "),
    group.title && group.title !== group.route ? group.route : "",
    segments.length > 1 ? `${segments.length} legs` : "",
    legs[0]?.time ?? "",
  ].filter(Boolean);
  return { icon: MODE_EMOJI[group.mode || "flight"], title: group.title || group.route, meta: parts.join(" · ") };
}
