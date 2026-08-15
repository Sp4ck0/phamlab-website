// Ported 1:1 from the original static site's trip.js — the pure logic
// functions, decoupled from DOM rendering.
import type { Act, Day, Flight, FlightLeg, Group, Hotel, LegColor, ResolvedDay, Status, Trip, Who } from "./types";

// Normalizes a legacy plain-string activity and a rich {tag,time,text}
// activity to the same shape for rendering.
export function actParts(a: Act): { tag?: string; time?: string; text: string } {
  return typeof a === "string" ? { text: a } : a;
}

export const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const COUNTRY: Record<string, string> = {
  US: "United States", TH: "Thailand", SG: "Singapore", VN: "Vietnam", JP: "Japan",
  KR: "South Korea", CN: "China", TW: "Taiwan", HK: "Hong Kong", ES: "Spain", IT: "Italy", DE: "Germany",
  MY: "Malaysia", KH: "Cambodia",
  TR: "Turkey", BE: "Belgium", FR: "France", PT: "Portugal", HR: "Croatia", BA: "Bosnia and Herzegovina",
  GR: "Greece", HU: "Hungary", SK: "Slovakia", AT: "Austria", CZ: "Czechia",
  NO: "Norway", JO: "Jordan", EG: "Egypt", SI: "Slovenia",
};

// ISO 3166 alpha-2 -> regional-indicator flag emoji
export function flagEmoji(cc?: string): { emoji: string; label: string } | null {
  if (!cc) return null;
  const code = cc.toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return null;
  const emoji = String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
  return { emoji, label: COUNTRY[code] || code };
}

// Is this traveler on the trip yet/still, on a given ISO date?
// Groups with no from/to are on the trip start to finish.
export function presence(g: Group | undefined, dateStr: string): boolean {
  if (!g) return false;
  return (!g.from || dateStr >= g.from) && (!g.to || dateStr <= g.to);
}

export function presentGroups(groups: Group[], date: string): Group[] {
  return groups.filter((g) => presence(g, date));
}

// Compact { label, color } for a card/cell where `who` might be a single
// group id, 'all' (resolved to whoever is present that day), or an array
// of ids (a shared booking).
export function whoLabel(who: Who, groups: Group[], date: string): { label: string; color: string } {
  const byId = Object.fromEntries(groups.map((g) => [g.id, g]));
  if (Array.isArray(who)) {
    return { label: who.map((id) => byId[id]?.name || id).join(" & "), color: "var(--text-secondary)" };
  }
  const g = byId[who];
  if (g) return { label: g.name, color: g.color };
  const label = presentGroups(groups, date).map((x) => x.name).join(", ") || "Everyone";
  return { label, color: "var(--text-secondary)" };
}

const uid = (dayIndex: number, kind: "f" | "h", i: number) => `${dayIndex}.${kind}.${i}`;

export const statusOf = (ticks: Record<string, Status>, id: string, raw: Status): Status => ticks[id] ?? raw;

/**
 * Port of trip.js's top-level `days = TRIP.days.map(...)` + carry-forward
 * loop: resolves `hotels:'same'` sentinels by copying the previous
 * explicit night's hotel array forward (tagging entries `carried:true`,
 * keeping the *original* night's `src` id so ticking the source booking
 * updates every carried night), and assigns every flight/hotel a stable
 * `${dayIndex}.f.${i}` / `${dayIndex}.h.${i}` id.
 */
export function resolveDays(trip: Pick<Trip, "days">): ResolvedDay[] {
  let carried: ResolvedDay["hotels"] = [];
  const days = trip.days.map((d: Day, di: number) => {
    let hotels: ResolvedDay["hotels"];
    if (d.hotels === "same") {
      hotels = carried.map((h) => ({ ...h, carried: true }));
    } else {
      hotels = (d.hotels || []).map((h: Hotel, i: number) => ({ ...h, src: uid(di, "h", i) }));
      carried = hotels;
    }
    return { ...d, hotels, flights: d.flights || [], _d: new Date(d.date + "T00:00:00") };
  });

  // Tag each hotel entry as check-in / check-out by comparing its name
  // against the adjacent days' hotel names — independent of `carried`,
  // since a hotel now gets an explicit (non-"same") entry on both its
  // check-in day and its check-out day.
  const namesByDay = days.map((d) => new Set(d.hotels.map((h) => h.name)));
  days.forEach((d, di) => {
    const prevNames = di > 0 ? namesByDay[di - 1] : new Set<string>();
    const nextNames = di < days.length - 1 ? namesByDay[di + 1] : new Set<string>();
    d.hotels = d.hotels.map((h) => ({
      ...h,
      checkIn: !prevNames.has(h.name),
      checkOut: !nextNames.has(h.name),
    }));
  });

  return days;
}

export function flightId(dayIndex: number, flightIndex: number) {
  return uid(dayIndex, "f", flightIndex);
}

// Different people can each hold a separate booking at the *same* named
// hotel (e.g. two rooms) — merge those into one entry instead of repeating
// the hotel name once per person. Shared by both the timeline card view
// and the grid row view (the original had two near-duplicate
// implementations of this; consolidated here).
export interface HotelGroup {
  name: string;
  address?: string;
  detail?: string;
  who: string[];
  srcs: string[];
  statuses: Status[];
  carriedAll: boolean;
  checkIn: boolean;
  checkOut: boolean;
}
export function mergeHotelsByName(hotels: ResolvedDay["hotels"], ticks: Record<string, Status>): HotelGroup[] {
  const groups: HotelGroup[] = [];
  const byName = new Map<string, HotelGroup>();
  hotels.forEach((h) => {
    const ids = Array.isArray(h.who) ? h.who : [h.who];
    const status = statusOf(ticks, h.src, h.status);
    if (h.name && byName.has(h.name)) {
      const g = byName.get(h.name)!;
      g.who.push(...ids);
      g.srcs.push(h.src);
      g.statuses.push(status);
      g.carriedAll = g.carriedAll && !!h.carried;
    } else {
      const g: HotelGroup = {
        name: h.name,
        address: h.address,
        detail: h.detail,
        who: [...ids],
        srcs: [h.src],
        statuses: [status],
        carriedAll: !!h.carried,
        checkIn: !!h.checkIn,
        checkOut: !!h.checkOut,
      };
      groups.push(g);
      if (h.name) byName.set(h.name, g);
    }
  });
  return groups;
}

// Different people can each be booked on the *identical* flight (same
// route + detail) — merge those into one card/box instead of repeating it
// once per person, same principle as mergeHotelsByName above, now applied
// to flights too.
export interface FlightGroup {
  route: string;
  detail?: string;
  title?: string;
  price?: string;
  legs?: FlightLeg[];
  layovers?: string[];
  who: string[];
  ids: string[];
  statuses: Status[];
}
export function mergeFlightsByRoute(
  allFlights: Flight[],
  dayIndex: number,
  ticks: Record<string, Status>,
  filter?: (f: Flight) => boolean
): FlightGroup[] {
  const groups: FlightGroup[] = [];
  const byKey = new Map<string, FlightGroup>();
  allFlights.forEach((f, i) => {
    if (filter && !filter(f)) return;
    const id = flightId(dayIndex, i);
    const ids = Array.isArray(f.who) ? f.who : [f.who];
    const status = statusOf(ticks, id, f.status);
    const key = `${f.route}|${f.detail || ""}`;
    if (byKey.has(key)) {
      const g = byKey.get(key)!;
      g.who.push(...ids);
      g.ids.push(id);
      g.statuses.push(status);
    } else {
      const g: FlightGroup = {
        route: f.route,
        detail: f.detail,
        title: f.title,
        price: f.price,
        legs: f.legs,
        layovers: f.layovers,
        who: [...ids],
        ids: [id],
        statuses: [status],
      };
      groups.push(g);
      byKey.set(key, g);
    }
  });
  return groups;
}

const ROTATING_ACCENTS = [
  { color: "var(--accent-1)", tint: "var(--accent-1-tint)" },
  { color: "var(--accent-2)", tint: "var(--accent-2-tint)" },
  { color: "var(--accent-3)", tint: "var(--accent-3-tint)" },
  { color: "var(--accent-4)", tint: "var(--accent-4-tint)" },
  { color: "var(--accent-5)", tint: "var(--accent-5-tint)" },
];
const EVENT_ACCENT = { color: "var(--accent-event)", tint: "var(--accent-event-tint)" };
const TRANSIT_ACCENT = { color: "var(--accent-transit)", tint: "var(--accent-transit-tint)" };

/**
 * Assigns each day a leg color + badge label, computed from data already
 * on the trip — no color field to hand-maintain per day:
 *   - tag === 'event'                 -> reserved event/milestone accent
 *   - 2+ *distinct* routes that day   -> reserved multi-leg transit accent
 *                                        (several people sharing the same
 *                                        single route doesn't count)
 *   - otherwise                       -> colored by city, cycling through 5
 *                                         rotating accents in order of each
 *                                         city's first appearance in the trip
 */
export function assignLegColors(days: Pick<Day, "city" | "to" | "tag" | "event" | "flights">[]): LegColor[] {
  const cityIndex = new Map<string, number>();
  let next = 0;
  return days.map((d) => {
    const label = d.event ? d.event : d.to ? `${d.city} → ${d.to}` : d.city;
    if (d.tag === "event") return { ...EVENT_ACCENT, label };
    const uniqueRoutes = new Set((d.flights || []).map((f) => f.route));
    const isTransit = uniqueRoutes.size >= 2;
    if (isTransit) return { ...TRANSIT_ACCENT, label };
    if (!cityIndex.has(d.city)) {
      cityIndex.set(d.city, next % ROTATING_ACCENTS.length);
      next++;
    }
    return { ...ROTATING_ACCENTS[cityIndex.get(d.city)!], label };
  });
}

export interface RouteStop {
  label: string;
  color: string;
}

// Unique consecutive city waypoints for the hero's route stepper.
export function deriveRoute(days: Pick<Day, "city" | "to">[], legColors: LegColor[]): RouteStop[] {
  const stops: RouteStop[] = [];
  days.forEach((d, i) => {
    const color = legColors[i]?.color || ROTATING_ACCENTS[0].color;
    const last = stops[stops.length - 1];
    if (!last || last.label !== d.city) stops.push({ label: d.city, color });
    if (d.to) {
      const last2 = stops[stops.length - 1];
      if (!last2 || last2.label !== d.to) stops.push({ label: d.to, color });
    }
  });
  return stops;
}

export function fmtShort(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return `${MON[d.getMonth()]} ${d.getDate()}`;
}

export function fmtDow(d: Date) {
  return `${DOW[d.getDay()]} ${MON[d.getMonth()]} ${d.getDate()}`;
}

export interface Gap {
  who: Who;
  kind: "Hotel" | "Flight" | "Plan";
  date: string;
  dateLabel: string;
  text: string;
  // Tick id(s) this gap resolves when marked booked — absent for "Plan"
  // gaps, which aren't a simple booked/needed toggle.
  ids?: string[];
}

/**
 * Port of renderAlerts()'s gap-computation half: unbooked hotels/flights,
 * plus a "Plan" gap for days with no acts/flights that aren't pure travel
 * days.
 */
export function computeGaps(resolvedDays: ResolvedDay[], ticks: Record<string, Status>): Gap[] {
  const gaps: Gap[] = [];
  resolvedDays.forEach((d, di) => {
    d.hotels.forEach((h) => {
      if (h.carried) return;
      if (statusOf(ticks, h.src, h.status) === "needed") {
        gaps.push({ who: h.who, kind: "Hotel", date: d.date, dateLabel: fmtDow(d._d), text: `${d.city}${d.to ? " → " + d.to : ""}`, ids: [h.src] });
      }
    });
    d.flights.forEach((f, i) => {
      const id = flightId(di, i);
      if (statusOf(ticks, id, f.status) === "needed") {
        gaps.push({ who: f.who, kind: "Flight", date: d.date, dateLabel: fmtDow(d._d), text: f.route, ids: [id] });
      }
    });
    const blank = !(d.acts && d.acts.length) && !(d.flights && d.flights.length) && d.tag !== "transit";
    if (blank) {
      gaps.push({ who: "all", kind: "Plan", date: d.date, dateLabel: fmtDow(d._d), text: `${d.city}${d.to ? " → " + d.to : ""}` });
    }
  });
  return gaps;
}

export function gapLabel(who: Who, groups: Group[], date: string) {
  const byId = Object.fromEntries(groups.map((g) => [g.id, g]));
  if (Array.isArray(who)) return { label: who.map((id) => byId[id]?.name || id).join(" & "), color: null as string | null };
  const g = byId[who];
  if (g) return { label: g.name, color: g.color };
  return { label: presentGroups(groups, date).map((x) => x.name).join(", ") || "Everyone", color: null };
}

export function renderCountdown(days: Day[]): string {
  if (!days.length) return "";
  const start = new Date(days[0].date + "T00:00:00");
  const end = new Date(days[days.length - 1].date + "T00:00:00");
  const now = new Date();
  if (now < start) {
    const dd = Math.ceil((start.getTime() - now.getTime()) / 864e5);
    return dd === 0 ? "Departure day" : `${dd} days to go`;
  } else if (now <= end) {
    return "In progress";
  }
  return "Trip completed";
}

// Compact "Mar–Apr 2026" / "Sep 2026" label for the sidebar, derived from
// a trip's first/last day (the original hardcoded this per page; here it's
// computed once from data instead).
export function navMonthLabel(start?: string, end?: string): string {
  if (!start) return "";
  const s = new Date(start + "T00:00:00");
  const e = new Date((end || start) + "T00:00:00");
  const sm = MON[s.getMonth()];
  const em = MON[e.getMonth()];
  return sm === em ? `${e.getFullYear()} ${sm}` : `${e.getFullYear()} ${sm}–${em}`;
}

export function navCountdown(start?: string, end?: string): string {
  if (!start) return "";
  const now = new Date();
  const s = new Date(start + "T00:00:00");
  const e = new Date((end || start) + "T00:00:00");
  if (now < s) {
    const dd = Math.ceil((s.getTime() - now.getTime()) / 864e5);
    return dd === 0 ? "today" : `${dd}d`;
  } else if (now <= e) {
    return "now";
  }
  return "";
}

export function statline(groups: Group[], days: Day[]): string {
  const travelers = groups.reduce((a, g) => a + g.members, 0);
  const totalRooms = groups.reduce((a, g) => a + (g.rooms || 0), 0);
  if (totalRooms > 0) {
    return `${travelers} travelers · ${totalRooms} room${totalRooms === 1 ? "" : "s"}`;
  }
  const countries = new Set(days.flatMap((d) => [d.country, d.toCountry]).filter(Boolean));
  return `${travelers} travelers · ${countries.size} countries`;
}
