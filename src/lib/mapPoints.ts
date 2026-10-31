import type { MapCategory, MapPointData, Place, ResolvedDay, Trip } from "./types";
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
function placeKey(p: Place): string | undefined {
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
