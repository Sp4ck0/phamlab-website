import type { MapCategory, MapPointData, ResolvedDay, Trip } from "./types";

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

  const seenCities = new Set<string>();
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
