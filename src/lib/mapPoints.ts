import type { MapCategory, MapPointData, ResolvedDay, Trip } from "./types";
import type { DayWeather } from "./weather";

export const CATEGORY_LABELS: Record<MapCategory, string> = {
  hotel: "Hotel",
  restaurant: "Restaurant",
  attraction: "Attraction",
  transport: "Transport",
  city: "City",
  other: "Other",
};

export const CATEGORY_COLORS: Record<MapCategory, string> = {
  hotel: "#2a78d6",
  restaurant: "#eb6834",
  attraction: "#1baf7a",
  transport: "#7c5cd1",
  city: "#0e9594",
  other: "#898781",
};

// Hotels already carry real addresses in the day data — auto-derive map
// points from those (deduped by address) rather than requiring them to be
// re-entered into `trip.mapPoints`. Restaurants/attractions/etc. aren't
// structured data anywhere else, so they come only from `trip.mapPoints`.
// Every day also carries a city/country regardless of whether hotel
// addresses are filled in yet, so fall back to a city-level pin for any
// city that isn't otherwise represented — this is what gives a trip like
// Thailand (no precise hotel addresses yet) a usable map at all.
export function derivePoints(days: ResolvedDay[], mapPoints: Trip["mapPoints"]): MapPointData[] {
  const points: MapPointData[] = [];
  const seen = new Set<string>();
  const citiesWithPoint = new Set<string>();

  days.forEach((d) => {
    d.hotels.forEach((h) => {
      if (!h.address || !h.address.trim()) return;
      if (seen.has(h.address)) return;
      seen.add(h.address);
      citiesWithPoint.add(d.city);
      points.push({ id: `hotel-${h.src}`, label: h.name || "Hotel", address: h.address, category: "hotel" });
    });
  });

  (mapPoints || []).forEach((p) => {
    if (seen.has(p.address)) return;
    seen.add(p.address);
    points.push(p);
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
      points.push({ id: `city-${city}`, label: city, address: `${city}, ${country}`, category: "city" });
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
      if (route[route.length - 1]?.label === city) return;
      route.push({ id: `route-${route.length}`, label: city, address: `${city}, ${country}`, category: "city" });
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
      stops.set(key, { id: `weather-${key}`, label: city, address: `${city}, ${country}`, category: "city", days: [] });
    }
    stops.get(key)!.days.push({ date: d.date, weather: w });
  });
  return [...stops.values()];
}
