import type { MapCategory, MapPointData, Place, ResolvedDay, Task, Trip } from "./types";
import { actParts, fmtShort } from "./tripLogic";
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

// Crosshair icon for the show-on-map button (also used inside inlinePlaces' HTML).
export const MAP_FOCUS_ICON =
  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">' +
  '<circle cx="12" cy="12" r="6.5"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/></svg>';

const escapeAttr = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

// Turns the first mention of each place's name in an activity's text into its
// 📍 link, right where it is written. Places whose name isn't in the sentence
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
      parts[i] = `${parts[i].slice(0, at)}<a href="${href}" target="_blank" rel="noopener noreferrer">📍 ${shown}</a>${button}${parts[i].slice(at + name.length)}`;
      done = true;
    }
    if (done) html = parts.join("");
    else rest.push(p);
  }
  return { html, rest };
}

// Hotels, activity places and the trip's curated POIs all share the Place
// shape, so they dedupe on the same key; a second thing at an existing place
// (an event at the hotel you're staying in) adds a line to that pin's note
// instead of vanishing. Places with neither a Place ID nor an address can't
// be pinned. Every day also carries a city/country regardless of whether any
// place is filled in yet, so fall back to a city-level pin for any city that
// isn't otherwise represented — this is what gives a trip like Thailand (no
// precise hotel addresses yet) a usable map at all.
export function derivePoints(days: ResolvedDay[], mapPoints: Trip["mapPoints"]): MapPointData[] {
  const points: MapPointData[] = [];
  const byKey = new Map<string, MapPointData>();
  const citiesWithPoint = new Set<string>();

  const add = (point: MapPointData, city?: string) => {
    const key = placeKey(point);
    if (!key || byKey.has(key)) return false;
    byKey.set(key, point);
    points.push(point);
    if (city) citiesWithPoint.add(city);
    return true;
  };

  days.forEach((d) => {
    d.hotels.forEach((h) => {
      add({ id: `hotel-${h.src}`, name: h.name || "Hotel", address: h.address, placeId: h.placeId, category: "hotel" }, d.city);
    });
  });

  (mapPoints || []).forEach((p) => add(p));

  days.forEach((d) => {
    d.acts.forEach((a, i) => {
      const act = actParts(a);
      const text = act.text.replace(/<[^>]*>/g, "").trim();
      const when = [fmtShort(d.date), act.time].filter(Boolean).join(" ");
      const line = text ? `${text} · ${when}` : when;
      (act.places ?? []).forEach((place, j) => {
        const category = (act.tag && ACT_CATEGORY[act.tag]) || "event";
        if (add({ ...place, id: `act-${d.date}-${i}-${j}`, category, note: line }, d.city)) return;
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
      points.push({ id: `city-${city}`, name: city, address: `${city}, ${country}`, category: "city" });
    });
  });

  return points;
}

// Pins for the places on action items that aren't part of the plan itself:
// considerations, to-dos and decisions. Open ones are dashed rings; a chosen
// consideration or a finished to-do/decision is a solid ring; a dropped
// consideration is gone. A place already pinned for real (`existing`, from
// derivePoints) or by an earlier item is skipped, so a ring never sits on top of
// the plan. The id carries the item id (`task|<itemId>|<n>`) so the map can look
// up the live vote tally at click time instead of rebuilding its pins.
export function deriveTaskPoints(tasks: Task[], existing: MapPointData[]): MapPointData[] {
  const seen = new Set(existing.map(placeKey).filter((k): k is string => !!k));
  const out: MapPointData[] = [];
  for (const t of tasks) {
    if (!t.places?.length || t.outcome === "dropped") continue;
    const itemId = t.key.slice("item:".length);
    const settled = t.kind === "consider" ? t.outcome === "chosen" : t.done;
    t.places.forEach((place, j) => {
      const key = placeKey(place);
      if (!key || seen.has(key)) return;
      seen.add(key);
      out.push({ ...place, id: `task|${itemId}|${j}`, category: "other", note: t.title, candidate: settled ? "chosen" : "open" });
    });
  }
  return out;
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
