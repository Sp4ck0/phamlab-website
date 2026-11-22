import type { Act, MapCategory, MapPointData, Place, ResolvedDay, Task, TaskScope } from "./types";
import { actParts, fmtShort } from "./tripLogic";
import { isPlaceholderHotel } from "./tileHeaders";
import type { DayWeather } from "./weather";

export const CATEGORY_LABELS: Record<MapCategory, string> = {
  hotel: "Hotel",
  restaurant: "Restaurant",
  attraction: "Attraction",
  transport: "Transport",
  event: "Event",
  city: "City",
  other: "Other",
};

export const CATEGORY_COLORS: Record<MapCategory, string> = {
  hotel: "#2a78d6",
  restaurant: "#eb6834",
  attraction: "#1baf7a",
  transport: "#7c5cd1",
  event: "#d6336c",
  city: "#0e9594",
  other: "#898781",
};

// Emoji drawn inside a category's map pin. City has none: it stays a plain dot.
export const CATEGORY_EMOJI: Partial<Record<MapCategory, string>> = {
  hotel: "🏨",
  restaurant: "🍽️",
  attraction: "📸",
  transport: "✈️",
  event: "🎟️",
  other: "📍",
};

// What an activity's tag says about the kind of place it happens at; any tag
// not listed (Event, Venue, Evening, none…) is an "event".
const ACT_CATEGORY: Record<string, MapCategory> = {
  Food: "restaurant",
  Sightsee: "attraction",
  Nature: "attraction",
  Activity: "attraction",
  Trek: "attraction",
  Boat: "attraction",
  Sunset: "attraction",
  Transport: "transport",
};

// Two pins are the same place if they share a Place ID, else an address.
export function placeKey(p: Place): string | undefined {
  return p.placeId ? `id:${p.placeId}` : p.address?.trim() ? `addr:${p.address.trim()}` : undefined;
}

// Link that opens a place in Google Maps. With a Place ID it opens that
// exact listing; otherwise Google searches the name and address.
export function googleMapsUrl(p: Place): string {
  const url = new URL("https://www.google.com/maps/search/");
  url.searchParams.set("api", "1");
  url.searchParams.set("query", [p.name, p.address].filter(Boolean).join(", "));
  if (p.placeId) url.searchParams.set("query_place_id", p.placeId);
  return url.toString();
}

// "Show on the trip map": any place button announces the place's key and the
// one TripMap on the page answers by scrolling to itself and opening the pin.
export const MAP_FOCUS_EVENT = "trip-map:focus";
export function focusOnMapKey(key: string) {
  window.dispatchEvent(new CustomEvent<string>(MAP_FOCUS_EVENT, { detail: key }));
}
export function focusOnMap(place: Place) {
  const key = placeKey(place);
  if (key) focusOnMapKey(key);
}

// While the map is pinned (desktop), it follows the reader. The itinerary says which day is being
// looked at (MAP_DAY_EVENT, a date) and which tile is under the pointer (MAP_GLANCE_EVENT, a place
// key). Unlike MAP_FOCUS_EVENT neither scrolls the page or opens a popup; an unpinned map ignores both.
export const MAP_DAY_EVENT = "trip-map:day";
export function focusMapDay(date: string | undefined) {
  window.dispatchEvent(new CustomEvent<string | undefined>(MAP_DAY_EVENT, { detail: date }));
}
export const MAP_GLANCE_EVENT = "trip-map:glance";
export function glanceOnMap(key: string) {
  window.dispatchEvent(new CustomEvent<string>(MAP_GLANCE_EVENT, { detail: key }));
}

// Crosshair icon for the show-on-map button (also used inside inlinePlaces' HTML).
// Show on the trip map (in the page): a folded map with a pin.
export const MAP_FOCUS_ICON =
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<path d="M3 7l5-1.8 6 2 7-2.2v12.5l-7 2.2-6-2-5 1.8z"/><path d="M8 5.2v12.5M14 7.2v12.5"/>' +
  '<path d="M16.5 12.6s-3-3-3-5.3a3 3 0 0 1 6 0c0 2.3-3 5.3-3 5.3z" style="fill:var(--card)"/><circle cx="16.5" cy="7.3" r="1.1"/></svg>';

// Open in Google Maps: an outline pin on its ground ring, before the place's name in the link.
export const MAPS_PIN_ICON =
  '<svg class="maps-pin" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<path d="M12 19s-6-6-6-10.6a6 6 0 0 1 12 0C18 13 12 19 12 19z"/><circle cx="12" cy="8.6" r="2.3"/>' +
  '<path d="M8.4 17.6C5.9 18 4.5 18.7 4.5 19.5c0 1.2 3.4 2 7.5 2s7.5-.8 7.5-2c0-.8-1.4-1.5-3.9-1.9"/></svg>';

const escapeAttr = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

// Turns the first mention of each place's name in an activity's text into its
// Maps link (pin icon), right where it is written. Places whose name isn't in the sentence
// (an event "at" a venue the text doesn't name) come back in `rest`, for the
// caller to show as chips after the text. Only plain text is searched, never
// inside tags or an existing link, and the text keeps its own spelling. The
// text must already be sanitized: the result adds a show-on-map button after
// each link (identified by data-map-key), which a sanitizer would strip.
export function inlinePlaces(text: string, places: Place[] = []): { html: string; rest: Place[] } {
  let html = text;
  const rest: Place[] = [];
  for (const p of places) {
    const parts = html.split(/(<[^>]*>)/); // odd entries are tags
    let linkDepth = 0;
    let done = false;
    for (let i = 0; i < parts.length && !done; i++) {
      if (i % 2) {
        if (/^<a\b/i.test(parts[i])) linkDepth++;
        else if (/^<\/a\s*>/i.test(parts[i])) linkDepth--;
        continue;
      }
      if (linkDepth > 0 || !p.name) continue;
      // The text is HTML, where the name's & < > are entities ("aesthetic &amp; spa").
      const name = p.name.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      const at = parts[i].toLowerCase().indexOf(name.toLowerCase());
      if (at < 0) continue;
      const shown = parts[i].slice(at, at + name.length);
      const href = googleMapsUrl(p).replace(/&/g, "&amp;");
      const key = placeKey(p);
      const button = key
        ? `<button type="button" class="map-focus" data-map-key="${escapeAttr(key)}" title="Show ${escapeAttr(p.name)} on the trip map" aria-label="Show ${escapeAttr(p.name)} on the trip map">${MAP_FOCUS_ICON}</button>`
        : "";
      parts[i] = `${parts[i].slice(0, at)}<a href="${href}" target="_blank" rel="noopener noreferrer">${MAPS_PIN_ICON}${shown}</a>${button}${parts[i].slice(at + name.length)}`;
      done = true;
    }
    if (done) html = parts.join("");
    else rest.push(p);
  }
  return { html, rest };
}

// Every pin comes from the itinerary, so it comes and goes with its entry. Hotels and
// activity places share the Place shape, so they dedupe on the same key; a second thing at an existing place
// (an event at the hotel you're staying in) adds a line to that pin's note
// instead of vanishing. Places with neither a Place ID nor an address can't
// be pinned. Every day also carries a city/country regardless of whether any
// place is filled in yet, so fall back to a city-level pin for any city that
// isn't otherwise represented — this is what gives a trip like Thailand (no
// precise hotel addresses yet) a usable map at all.
export function derivePoints(days: ResolvedDay[]): MapPointData[] {
  const points: MapPointData[] = [];
  const byKey = new Map<string, MapPointData>();
  const citiesWithPoint = new Set<string>();

  // A day's place also marks that day on a pin already there (a hotel over several nights).
  const onDay = (point: MapPointData, date: string) => {
    if (!point.dates) point.dates = [date];
    else if (!point.dates.includes(date)) point.dates.push(date);
  };
  const add = (point: MapPointData, city?: string, date?: string) => {
    const key = placeKey(point);
    const existing = key ? byKey.get(key) : undefined;
    if (existing && date) onDay(existing, date);
    if (!key || existing) return false;
    if (date) onDay(point, date);
    byKey.set(key, point);
    points.push(point);
    if (city) citiesWithPoint.add(city);
    return true;
  };

  days.forEach((d) => {
    d.hotels.forEach((h) => {
      add({ id: `hotel-${h.src}`, name: h.name || "Hotel", address: h.address, placeId: h.placeId, category: "hotel" }, d.city, d.date);
    });
  });

  days.forEach((d) => {
    d.acts.forEach((a, i) => {
      const act = actParts(a);
      const text = act.text.replace(/<[^>]*>/g, "").trim();
      const when = [fmtShort(d.date), act.time].filter(Boolean).join(" ");
      const line = text ? `${text} · ${when}` : when;
      (act.places ?? []).forEach((place, j) => {
        const category = (act.tag && ACT_CATEGORY[act.tag]) || "event";
        if (add({ ...place, id: `act-${d.date}-${i}-${j}`, category, note: line }, d.city, d.date)) return;
        const existing = byKey.get(placeKey(place) ?? "");
        if (existing) existing.note = existing.note ? `${existing.note}; ${line}` : line;
      });
    });
  });

  // Seattle is everyone's home departure/arrival city, not a trip
  // destination — excluding it keeps the map focused on where the trip
  // actually goes instead of zooming out to include home.
  const seenCities = new Set<string>(["Seattle"]);
  days.forEach((d) => {
    [
      { city: d.city, country: d.country },
      ...(d.to ? [{ city: d.to, country: d.toCountry || d.country }] : []),
    ].forEach(({ city, country }) => {
      if (!city || seenCities.has(city) || citiesWithPoint.has(city)) return;
      seenCities.add(city);
      const dates = days.filter((o) => o.city === city || o.to === city).map((o) => o.date);
      points.push({ id: `city-${city}`, name: city, address: `${city}, ${country}`, category: "city", dates });
    });
  });

  return points;
}

// The days a task covers, for a pinned map following one day; none for the whole trip.
function scopeDates(scope: TaskScope): string[] | undefined {
  if (scope.kind === "day") return [scope.date];
  if (scope.kind !== "range") return undefined;
  const out: string[] = [];
  for (const d = new Date(`${scope.start}T00:00:00Z`); out.length < 366; d.setUTCDate(d.getUTCDate() + 1)) {
    const iso = d.toISOString().slice(0, 10);
    if (iso > scope.end) break;
    out.push(iso);
  }
  return out;
}

// Pins for what isn't in the plan yet: the places on considerations and to-dos, and the
// hotel or activity an item proposes. The map draws them as ghost pins (open, or chosen /
// done until the item is added to the itinerary); a dropped consideration has none. Each
// takes its category from the draft (a hotel, or the activity's tag), else "other", and its
// item's days. A place already pinned for real (`existing`, from derivePoints) or by an
// earlier item is skipped, so a ghost never sits on top of the plan; once the item is added,
// its place is a real pin and the ghost goes. The id carries the item id
// (`task|<itemId>|<n>`) so the map can look up the live vote tally at click time instead of
// rebuilding its pins.
export function deriveTaskPoints(tasks: Task[], existing: MapPointData[]): MapPointData[] {
  const seen = new Set(existing.map(placeKey).filter((k): k is string => !!k));
  const out: MapPointData[] = [];
  for (const t of tasks) {
    if (!t.key.startsWith("item:") || t.outcome === "dropped") continue;
    const itemId = t.key.slice("item:".length);
    const settled = t.kind === "consider" ? t.outcome === "chosen" : t.done;
    const draft = t.proposes;
    const draftCategory: MapCategory =
      draft?.type === "hotel" ? "hotel" : draft?.type === "activity" ? (draft.entry.tag && ACT_CATEGORY[draft.entry.tag]) || "event" : "other";
    const places: { place: Place; category: MapCategory }[] = [
      ...(t.places ?? []).map((place) => ({ place, category: draftCategory })),
      ...(draft?.type === "hotel" ? [{ place: { name: draft.entry.name, address: draft.entry.address, placeId: draft.entry.placeId }, category: "hotel" as const }] : []),
      ...(draft?.type === "activity" ? (draft.entry.places ?? []).map((place) => ({ place, category: draftCategory })) : []),
    ];
    const dates = scopeDates(t.scope);
    places.forEach(({ place, category }, j) => {
      const key = placeKey(place);
      if (!key || seen.has(key)) return;
      seen.add(key);
      out.push({ ...place, id: `task|${itemId}|${j}`, category, note: t.title, ...(dates ? { dates } : {}), candidate: settled ? "chosen" : "open" });
    });
  }
  return out;
}

// A place the AI marked on the map for a while (mark_on_map): not part of the trip, kept only
// while the page stays open. `at` is when it was marked (it pulses for MARK_PULSE_MS after),
// `batch` the call it came in, so the map can fit a new call's places.
export interface MapMark extends MapPointData {
  at: number;
  batch: string;
}
export const MARK_PULSE_MS = 60_000;

// Adds one call's places to the page's marks. A place marked again moves to the new call (and
// pulses again); a place with no Place ID or address can't be put on the map.
export function addMarks(marks: MapMark[], places: Place[], batch: string, at: number): MapMark[] {
  const fresh: MapMark[] = places.flatMap((p) => {
    const key = placeKey(p);
    return key ? [{ name: p.name, address: p.address, placeId: p.placeId, id: `mark|${key}`, category: "other" as const, at, batch }] : [];
  });
  const ids = new Set(fresh.map((m) => m.id));
  return [...marks.filter((m) => !ids.has(m.id)), ...fresh];
}

export interface JumpTarget {
  day?: string; // first day the place appears on (hotel stay or activity)
  item?: string; // first action item that mentions it
}

// Where a pin's popup can send you, by place key. Looked up by place rather than
// read off the pin's id, because derivePoints keeps one pin per place: an activity at
// your hotel is that hotel's pin, whose id says nothing about the activity's day.
const nameKey = (name: string) => `name:${name.trim().toLowerCase()}`;

export function deriveJumpTargets(days: ResolvedDay[], tasks: Task[]): Map<string, JumpTarget> {
  const out = new Map<string, JumpTarget>();
  // Filed under the place key and under its name: two entries for the same hotel or venue
  // can carry a different Place ID or address.
  const note = (p: Place, field: keyof JumpTarget, value: string) => {
    const keys = [placeKey(p), p.name?.trim() ? nameKey(p.name) : undefined];
    for (const k of keys) {
      if (!k) continue;
      const t = out.get(k) ?? {};
      t[field] ??= value;
      out.set(k, t);
    }
  };
  days.forEach((d) => {
    d.hotels.forEach((h) => note(h, "day", d.date));
    d.acts.forEach((a) => (actParts(a).places ?? []).forEach((place) => note(place, "day", d.date)));
  });
  tasks.forEach((task) => {
    if (!task.key.startsWith("item:")) return;
    const item = task.key.slice("item:".length);
    (task.places ?? []).forEach((place) => note(place, "item", item));
    const draft = task.proposes;
    if (draft?.type === "hotel") note(draft.entry, "item", item);
    if (draft?.type === "activity") (draft.entry.places ?? []).forEach((place) => note(place, "item", item));
  });
  return out;
}

// The pin's own place first, then any place of the same name.
export function jumpTargetFor(targets: Map<string, JumpTarget>, p: Place): JumpTarget | undefined {
  const key = placeKey(p);
  return (key ? targets.get(key) : undefined) ?? (p.name?.trim() ? targets.get(nameKey(p.name)) : undefined);
}

// Ordered city waypoints for the map's route line. Mirrors deriveRoute's
// walk (city, then `to`) and the home-city exclusion in derivePoints; only
// consecutive repeats are collapsed so a revisit (A → B → A) still draws.
export function deriveRouteAddresses(days: ResolvedDay[]): MapPointData[] {
  const route: MapPointData[] = [];
  days.forEach((d) => {
    [
      { city: d.city, country: d.country },
      ...(d.to ? [{ city: d.to, country: d.toCountry || d.country }] : []),
    ].forEach(({ city, country }) => {
      if (!city || city === "Seattle") return;
      if (route[route.length - 1]?.name === city) return;
      route.push({ id: `route-${route.length}`, name: city, address: `${city}, ${country}`, category: "city" });
    });
  });
  return route;
}

// Each day's own route, for the map zoomed in past the city line: the place keys in the
// order the day's timeline shows them. The hotel being left first (else the one stayed
// at), the activities' places (all-day ones first, then stored order, as the timeline
// does), then that night's hotel. A hotel not chosen yet and a place with no key are
// skipped, a stop repeated right after itself is one stop, and a day with fewer than two
// stops has no route. Keys, not positions: the map finds them among its pins.
export interface DayRoute {
  date: string;
  keys: string[];
}
export function deriveDayRoutes(days: ResolvedDay[]): DayRoute[] {
  return days.flatMap((d) => {
    const hotels = d.hotels.filter((h) => !isPlaceholderHotel(h));
    const leaving = hotels.find((h) => h.checkOut && !h.checkIn);
    const staying = hotels.find((h) => !(h.checkOut && !h.checkIn));
    const allDay = (a: Act) => typeof a !== "string" && !!a.allDay;
    const places = [...d.acts.filter(allDay), ...d.acts.filter((a) => !allDay(a))].flatMap((a) => actParts(a).places ?? []);
    const keys: string[] = [];
    [leaving ?? staying, ...places, staying].forEach((p) => {
      const key = p && placeKey(p);
      if (key && keys[keys.length - 1] !== key) keys.push(key);
    });
    return new Set(keys).size >= 2 ? [{ date: d.date, keys }] : [];
  });
}

export interface WeatherStop extends MapPointData {
  days: { date: string; weather: DayWeather }[];
}

// One stop per city with the weather for every day spent there. Cities are
// keyed by where the day ends (`to` on move days), matching how the backend
// picks each day's weather location; the home city is excluded like in the
// other derivations, and revisits merge into a single stop. Days without a
// weather row are skipped, and so are cities left with none.
export function deriveWeatherStops(days: ResolvedDay[], weather: Record<string, DayWeather>): WeatherStop[] {
  const stops = new Map<string, WeatherStop>();
  days.forEach((d) => {
    const city = d.to ?? d.city;
    const country = d.toCountry ?? d.country;
    const w = weather[d.date];
    if (!city || city === "Seattle" || !w) return;
    const key = `${city}|${country}`;
    if (!stops.has(key)) {
      stops.set(key, { id: `weather-${key}`, name: city, address: `${city}, ${country}`, category: "city", days: [] });
    }
    stops.get(key)!.days.push({ date: d.date, weather: w });
  });
  return [...stops.values()];
}
