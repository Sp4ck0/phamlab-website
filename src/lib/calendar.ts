// "Add to Google Calendar" links. Uses Google's prefilled-event URL
// (calendar.google.com/calendar/render?action=TEMPLATE), so there is no
// OAuth or API key — the link opens a "Save event" page in the viewer's own
// Google account. Every helper returns null when it can't be sure of the
// time or timezone, which is how "no specific time → no button" is enforced.
import type { Act, ResolvedDay, TransportMode } from "./types";

// Country code (as stored on days) -> IANA zone. Multi-zone countries get
// their most common zone here and CITY_TZ below overrides it per city.
const COUNTRY_TZ: Record<string, string> = {
  US: "America/Los_Angeles", TH: "Asia/Bangkok", SG: "Asia/Singapore", VN: "Asia/Ho_Chi_Minh",
  JP: "Asia/Tokyo", KR: "Asia/Seoul", CN: "Asia/Shanghai", TW: "Asia/Taipei", HK: "Asia/Hong_Kong",
  ES: "Europe/Madrid", IT: "Europe/Rome", DE: "Europe/Berlin", MY: "Asia/Kuala_Lumpur",
  KH: "Asia/Phnom_Penh", TR: "Europe/Istanbul", BE: "Europe/Brussels", FR: "Europe/Paris",
  PT: "Europe/Lisbon", HR: "Europe/Zagreb", BA: "Europe/Sarajevo", GR: "Europe/Athens",
  HU: "Europe/Budapest", SK: "Europe/Bratislava", AT: "Europe/Vienna", CZ: "Europe/Prague",
  NO: "Europe/Oslo", JO: "Asia/Amman", EG: "Africa/Cairo", SI: "Europe/Ljubljana",
};
const CITY_TZ: Record<string, string> = {
  "New York": "America/New_York", Boston: "America/New_York", Washington: "America/New_York",
  Miami: "America/New_York", Chicago: "America/Chicago", Denver: "America/Denver",
  Honolulu: "Pacific/Honolulu",
};

export const zoneFor = (city: string | undefined, country: string | undefined) =>
  (city && CITY_TZ[city]) || (country && COUNTRY_TZ[country.toUpperCase()]) || null;

// ---- time parsing ---------------------------------------------------------

export interface Clock { h: number; m: number }

const CLOCK = /\b(\d{1,2}):(\d{2})\s*([ap]m)?/gi;
function toClock(h: string, m: string, ap?: string): Clock | null {
  let hh = +h;
  const mm = +m;
  if (ap) {
    if (hh < 1 || hh > 12) return null;
    hh = (hh % 12) + (ap.toLowerCase() === "pm" ? 12 : 0);
  }
  return hh > 23 || mm > 59 ? null : { h: hh, m: mm };
}

/** A whole-string clock time ("19:30", "7:30 pm"); anything vague → null. */
export function parseTime(s?: string): Clock | null {
  const hit = s && /^\s*(\d{1,2}):(\d{2})\s*([ap]m)?\s*$/i.exec(s);
  return hit ? toClock(hit[1], hit[2], hit[3]) : null;
}

/** Departure/arrival clocks anywhere in a leg string, e.g. "10:05 → 14:30 (+1)". */
export function parseLegTime(s?: string): { dep: Clock; arr?: Clock; arrDayOffset: number } | null {
  if (!s) return null;
  const clocks = [...s.matchAll(CLOCK)].map((x) => toClock(x[1], x[2], x[3]));
  if (!clocks.length || !clocks[0]) return null;
  const off = /\(\s*\+(\d)\s*\)|\+(\d)\s*d/i.exec(s);
  return { dep: clocks[0], arr: clocks[1] ?? undefined, arrDayOffset: off ? +(off[1] || off[2]) : 0 };
}

// ---- date/zone math -------------------------------------------------------

interface Wall { y: number; mo: number; d: number; h: number; mi: number }
const p2 = (n: number) => String(n).padStart(2, "0");

function wall(date: string, c: Clock, addDays = 0, addMinutes = 0): Wall {
  const [y, mo, d] = date.split("-").map(Number);
  const t = new Date(Date.UTC(y, mo - 1, d + addDays, c.h, c.m + addMinutes));
  return { y: t.getUTCFullYear(), mo: t.getUTCMonth() + 1, d: t.getUTCDate(), h: t.getUTCHours(), mi: t.getUTCMinutes() };
}
const fmtWall = (w: Wall) => `${w.y}${p2(w.mo)}${p2(w.d)}T${p2(w.h)}${p2(w.mi)}00`;

// Wall-clock time in an IANA zone -> UTC instant (two passes settle DST edges).
function wallToUtc(w: Wall, zone: string): Date {
  const want = Date.UTC(w.y, w.mo - 1, w.d, w.h, w.mi);
  let guess = want;
  for (let i = 0; i < 2; i++) {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat("en-US", {
        timeZone: zone, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric",
      }).formatToParts(new Date(guess)).map((p) => [p.type, +p.value]),
    );
    guess += want - Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
  }
  return new Date(guess);
}
const fmtUtc = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

const BASE = "https://calendar.google.com/calendar/render?action=TEMPLATE";
function link(p: { title: string; dates: string; tz?: string; location?: string; details?: string }) {
  const q = new URLSearchParams({ text: p.title, dates: p.dates });
  if (p.tz) q.set("ctz", p.tz);
  if (p.location) q.set("location", p.location);
  if (p.details) q.set("details", p.details);
  return `${BASE}&${q}`;
}

interface TimedArgs {
  title: string; date: string; start: Clock; tz: string | null;
  end?: Clock; endDayOffset?: number; endTz?: string | null; defaultMinutes: number;
  location?: string; details?: string;
}
/**
 * Same-zone events use floating wall times + `ctz`, so Google reads them in
 * the location's zone with no client conversion. Events whose end is in a
 * different zone (a flight) are converted to UTC instants instead.
 */
export function timedUrl(a: TimedArgs): string | null {
  if (!a.tz) return null;
  const s = wall(a.date, a.start);
  const crossZone = !!a.end && !!a.endTz && a.endTz !== a.tz;
  if (crossZone) {
    const e = wall(a.date, a.end!, a.endDayOffset ?? 0);
    const dates = `${fmtUtc(wallToUtc(s, a.tz))}/${fmtUtc(wallToUtc(e, a.endTz!))}`;
    return link({ title: a.title, dates, tz: a.tz, location: a.location, details: a.details });
  }
  const e = a.end ? wall(a.date, a.end, a.endDayOffset ?? 0) : wall(a.date, a.start, 0, a.defaultMinutes);
  return link({ title: a.title, dates: `${fmtWall(s)}/${fmtWall(e)}`, tz: a.tz, location: a.location, details: a.details });
}

/** All-day span; `endDate` is the (exclusive) check-out date. */
export function allDayUrl(a: { title: string; startDate: string; endDate: string; location?: string; details?: string }) {
  const d = (s: string) => s.replace(/-/g, "");
  return link({ title: a.title, dates: `${d(a.startDate)}/${d(a.endDate)}`, location: a.location, details: a.details });
}

// ---- titles ---------------------------------------------------------------

const TAG_EMOJI: Record<string, string> = {
  Food: "🍜", Sightsee: "📸", Activity: "🎟️", Transport: "🚕", Boat: "⛴️", Trek: "🥾", Nature: "🌿",
  Shopping: "🛍️", Evening: "🌙", Sunset: "🌅", Event: "🎉", Venue: "🏟️", Rest: "💆", Hotel: "🏨",
  Flight: "✈️", Note: "📝", Optional: "✨",
};
export const MODE_EMOJI: Record<TransportMode, string> = { flight: "✈️", train: "🚆", bus: "🚌", ferry: "⛴️" };
const DEFAULT_MINUTES: Record<string, number> = { Food: 90, Sightsee: 120, Activity: 120 };

const plain = (html: string) => new DOMParser().parseFromString(html, "text/html").body.textContent?.trim() || "";
const arrow = (route: string) => route.replace(/\s*(?:→|->|–|—)\s*|\s+to\s+/gi, " → ").trim();

/** "KE018", "ke 18" etc. → "KE 018"; the first plausible flight number in the text. */
export function flightNumber(...texts: (string | undefined)[]): string | null {
  for (const t of texts) {
    const hit = t && /\b([A-Z]{2}|[A-Z]\d|\d[A-Z])\s?(\d{1,4})\b/.exec(t);
    if (hit) return `${hit[1]} ${hit[2].padStart(3, "0")}`;
  }
  return null;
}

export function transportTitle(mode: TransportMode | undefined, route: string, ...numberSources: (string | undefined)[]) {
  const m = mode || "flight";
  const num = m === "flight" ? flightNumber(...numberSources) : null;
  return `${MODE_EMOJI[m]} ${num ? `${num}: ` : ""}${arrow(route)}`;
}

// ---- builders used by the UI ---------------------------------------------

const where = (d: Pick<ResolvedDay, "city" | "country">) => [d.city, d.country].filter(Boolean).join(", ");
export const detailsFor = (dayNumber: number) => `Pham Lab · Day ${dayNumber}`;

// Default length per tag, capped at the next timed act that day so back-to-back
// events don't overlap in the calendar.
export function actUrl(a: Act, day: ResolvedDay, dayNumber: number, index = -1): string | null {
  if (typeof a === "string") return null;
  const start = parseTime(a.time);
  const text = plain(a.text);
  if (!start || !text) return null;
  const emoji = (a.tag && TAG_EMOJI[a.tag]) || "📍";
  let minutes = (a.tag && DEFAULT_MINUTES[a.tag]) || 60;
  const startMin = start.h * 60 + start.m;
  for (const n of index >= 0 ? day.acts.slice(index + 1) : []) {
    const next = typeof n === "string" ? null : parseTime(n.time);
    if (!next) continue;
    const gap = next.h * 60 + next.m - startMin;
    if (gap > 0) minutes = Math.min(minutes, gap);
    break;
  }
  return timedUrl({
    title: `${emoji} ${text}`, date: day.date, start, tz: zoneFor(day.city, day.country),
    defaultMinutes: minutes, location: where(day), details: detailsFor(dayNumber),
  });
}

/**
 * One leg of a transport booking. The data records only the origin and
 * destination of the day, so a leg's departure zone is known for the first
 * leg and its arrival zone for the last; otherwise it has no button / falls
 * back to a one-hour departure marker rather than guessing a zone.
 */
export function legUrl(
  leg: { route: string; time: string; meta?: string }, legIndex: number, legCount: number,
  mode: TransportMode | undefined, day: ResolvedDay, dayNumber: number, detail?: string,
): string | null {
  const t = parseLegTime(leg.time);
  const depTz = legIndex === 0 ? zoneFor(day.city, day.country) : null;
  if (!t || !depTz) return null;
  const arrTz = legIndex === legCount - 1 ? zoneFor(day.to || day.city, day.toCountry || day.country) : null;
  return timedUrl({
    title: transportTitle(mode, leg.route, leg.meta, detail), date: day.date, start: t.dep, tz: depTz,
    end: arrTz ? t.arr : undefined, endDayOffset: t.arrDayOffset, endTz: arrTz, defaultMinutes: 60,
    location: leg.route.split(/\s*(?:→|->|–|—)\s*/)[0], details: detailsFor(dayNumber),
  });
}

/** Plain (single-line) flight/train/bus/ferry card: only when `detail` carries a time. */
export function transportUrl(
  f: { mode?: TransportMode; route: string; detail?: string }, day: ResolvedDay, dayNumber: number,
): string | null {
  return legUrl({ route: f.route, time: f.detail || "" }, 0, 1, f.mode, day, dayNumber, f.detail);
}

/** First day on/after `from` whose copy of the hotel is flagged as the check-out. */
export function stayEndDate(days: ResolvedDay[], from: number, name: string): string | null {
  for (let i = from; i < days.length; i++) {
    if (days[i].hotels.some((h) => h.name === name && h.checkOut)) return days[i].date;
  }
  return null;
}

export function hotelUrl(
  name: string, address: string | undefined, days: ResolvedDay[], dayIndex: number,
): string | null {
  const end = stayEndDate(days, dayIndex, name);
  if (!name || !end || end <= days[dayIndex].date) return null;
  return allDayUrl({
    title: `🏨 ${name}`, startDate: days[dayIndex].date, endDate: end,
    location: address || name, details: detailsFor(dayIndex),
  });
}
