import type { MapCategory, MapPointData, ResolvedDay, Trip } from "./types";

export const CATEGORY_LABELS: Record<MapCategory, string> = {
  hotel: "Hotel",
  restaurant: "Restaurant",
  attraction: "Attraction",
  transport: "Transport",
  other: "Other",
};

export const CATEGORY_COLORS: Record<MapCategory, string> = {
  hotel: "#2a78d6",
  restaurant: "#eb6834",
  attraction: "#1baf7a",
  transport: "#7c5cd1",
  other: "#898781",
};

// Hotels already carry real addresses in the day data — auto-derive map
// points from those (deduped by address) rather than requiring them to be
// re-entered into `trip.mapPoints`. Restaurants/attractions/etc. aren't
// structured data anywhere else, so they come only from `trip.mapPoints`.
export function derivePoints(days: ResolvedDay[], mapPoints: Trip["mapPoints"]): MapPointData[] {
  const points: MapPointData[] = [];
  const seen = new Set<string>();

  days.forEach((d) => {
    d.hotels.forEach((h) => {
      if (!h.address || !h.address.trim()) return;
      if (seen.has(h.address)) return;
      seen.add(h.address);
      points.push({ id: `hotel-${h.src}`, label: h.name || "Hotel", address: h.address, category: "hotel" });
    });
  });

  (mapPoints || []).forEach((p) => {
    if (seen.has(p.address)) return;
    seen.add(p.address);
    points.push(p);
  });

  return points;
}
